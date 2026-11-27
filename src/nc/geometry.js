'use strict';
// Shared 2D path offset used by lathe tool nose radius compensation and mill cutter compensation.
// Points are {a,b}: a = horizontal axis (lathe Z / mill X), b = vertical axis (lathe radius / mill Y).
(function(root){
const EPS=1e-9;
function unit(p,q){const da=q.a-p.a,db=q.b-p.b,l=Math.hypot(da,db);return l<EPS?null:{a:da/l,b:db/l,l};}
// Right-hand normal of a direction, viewed with +a to the right and +b up.
const right=u=>({a:u.b,b:-u.a});
function intersect(p1,p2,p3,p4){const d=(p2.a-p1.a)*(p4.b-p3.b)-(p2.b-p1.b)*(p4.a-p3.a);if(Math.abs(d)<1e-12)return null;const t=((p3.a-p1.a)*(p4.b-p3.b)-(p3.b-p1.b)*(p4.a-p3.a))/d;return {a:p1.a+(p2.a-p1.a)*t,b:p1.b+(p2.b-p1.b)*t};}
// verts: chain of points. side: +1 = right (G42), -1 = left (G41). R: offset distance.
// startRaw: first vertex is the uncompensated start of the start-up block.
// endRaw: last vertex is the uncompensated end of the cancel (G40) block.
// Returns {paths: array per input segment of offset point lists, interference: [segment indexes]}.
function offsetChain(verts,side,R,{startRaw=true,endRaw=false}={}){
 const n=verts.length-1;const paths=Array.from({length:Math.max(0,n)},()=>[]),interference=[];
 if(n<1||R<=0){for(let i=0;i<n;i++)paths[i]=[verts[i],verts[i+1]];return {paths,interference};}
 const dirs=[];for(let i=0;i<n;i++)dirs.push(unit(verts[i],verts[i+1]));
 // Fill zero-length segment directions from neighbours.
 for(let i=0;i<n;i++)if(!dirs[i]){let j=i+1;while(j<n&&!dirs[j])j++;dirs[i]=dirs[j]||dirs[i-1]||{a:1,b:0,l:0};dirs[i]={...dirs[i],l:0};}
 const nrm=dirs.map(u=>{const r=right(u);return {a:r.a*side*R,b:r.b*side*R};});
 const S=[],E=[];for(let i=0;i<n;i++){S.push({a:verts[i].a+nrm[i].a,b:verts[i].b+nrm[i].b});E.push({a:verts[i+1].a+nrm[i].a,b:verts[i+1].b+nrm[i].b});}
 const first=startRaw?1:0,last=endRaw?n-2:n-1;
 if(startRaw){S[0]={...verts[0]};E[0]=n>1?{a:verts[1].a+nrm[1].a,b:verts[1].b+nrm[1].b}:{...verts[1]};}
 if(endRaw&&n>=1){E[n-1]={...verts[n]};if(n>1)S[n-1]={a:verts[n-1].a+nrm[n-2].a,b:verts[n-1].b+nrm[n-2].b};}
 const corner=Array.from({length:n},()=>null);
 for(let i=first;i<last;i++){const u=dirs[i],v=dirs[i+1];const cross=u.a*v.b-u.b*v.a,dot=u.a*v.a+u.b*v.b;
  if(Math.abs(cross)<1e-9&&dot>0)continue;
  if(cross*side<0){// inside corner: trim both offsets to their intersection
   const p=intersect(S[i],E[i],S[i+1],E[i+1]);if(p){E[i]=p;S[i+1]=p;}
  }else{// outside corner: arc around the programmed vertex
   const c=verts[i+1],a0=Math.atan2(nrm[i].b,nrm[i].a);let a1=Math.atan2(nrm[i+1].b,nrm[i+1].a);let d=a1-a0;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
   const steps=Math.max(2,Math.ceil(Math.abs(d)/(Math.PI/18)));const arc=[];for(let k=1;k<steps;k++){const t=a0+d*k/steps;arc.push({a:c.a+R*Math.cos(t),b:c.b+R*Math.sin(t)});}corner[i+1]=arc;}
 }
 for(let i=0;i<n;i++){const pts=[];if(corner[i])pts.push(...corner[i].map(p=>p));pts.unshift(i>0?(corner[i]?E[i-1]:S[i]):S[i]);if(corner[i])pts.push(S[i]);pts.push(E[i]);
  // Reversal of a trimmed offset segment means the radius does not fit (FANUC alarm 041 interference).
  const u=unit(S[i],E[i]);if(dirs[i].l>0&&u&&u.a*dirs[i].a+u.b*dirs[i].b<-.5)interference.push(i);
  paths[i]=pts.filter((p,k)=>k===0||Math.hypot(p.a-pts[k-1].a,p.b-pts[k-1].b)>1e-12);}
 return {paths,interference};
}
const api={offsetChain,intersect,unit};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PathGeometry=api;
})(typeof globalThis!=='undefined'?globalThis:this);
