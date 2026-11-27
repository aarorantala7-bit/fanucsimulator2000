'use strict';
// G31 skip function: contact search against the simulated material.
// Mill: the height-field blank (src/simulation/stock.js) with every earlier cut replayed; the tool (or probe ball)
// touches when any material column inside its radius rises above the tool's lower surface at that distance.
// Lathe: the per-Z radius profile (src/lathe/lathe.js) and the insert outline (stamp).
// The search walks the move in steps smaller than the grid, then bisects to the first contact.
(function(root){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Lower surface of a mill tool at radial distance² d2 from its axis, above the tip (flat 0, ball, bull, point).
function profileOf(t){const r=t.width/2,rr=r*r,cr=clamp(t.corner||1,.0001,r);
 return d2=>t.shape==='ball'?r-Math.sqrt(Math.max(0,rr-d2)):t.shape==='point'?Math.sqrt(d2)/r*(t.tip||0):t.shape==='round'?cr-Math.sqrt(Math.max(0,cr*cr-Math.max(0,Math.sqrt(d2)-(r-cr))**2)):0;}
// Material removal for one straight piece a→b of a mill move (shared with stock.js). Returns true when anything changed.
function cutHeight(st,t,a,b){if(Math.min(a.z,b.z)>=(st.top||0))return false;
  const r=t.width/2,rr=r*r,vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z,ll=vx*vx+vy*vy;let changed=false;
  const loX=clamp(Math.floor((Math.min(a.x,b.x)-r-st.x0)/st.dx),0,st.nx-1),hiX=clamp(Math.floor((Math.max(a.x,b.x)+r-st.x0)/st.dx),0,st.nx-1),loY=clamp(Math.floor((Math.min(a.y,b.y)-r-st.y0)/st.dy),0,st.ny-1),hiY=clamp(Math.floor((Math.max(a.y,b.y)+r-st.y0)/st.dy),0,st.ny-1);
  const profile=profileOf(t);
  for(let y=loY;y<=hiY;y++)for(let x=loX;x<=hiX;x++){
    const px=st.x0+(x+.5)*st.dx-a.x,py=st.y0+(y+.5)*st.dy-a.y;
    let z;
    if(ll<1e-12){const d2=px*px+py*py;if(d2>rr)continue;z=Math.min(a.z,b.z)+profile(d2);}
    else{
      const center=(px*vx+py*vy)/ll,perp=(px-center*vx)**2+(py-center*vy)**2;
      if(perp>rr)continue;
      const half=Math.sqrt(Math.max(0,(rr-perp)/ll)),lo=Math.max(0,center-half),hi=Math.min(1,center+half);
      if(lo>hi)continue;
      if(Math.abs(vz)<1e-10){const u=clamp(center,lo,hi);z=a.z+profile(perp+ll*(u-center)**2);}
      else if(t.shape==='flat'){z=a.z+vz*(vz>0?lo:hi);}
      else {const f=u=>a.z+vz*u+profile(perp+ll*(u-center)**2);let l=lo,h=hi;for(let j=0;j<12;j++){const u=(2*l+h)/3,v=(l+2*h)/3;if(f(u)<f(v))h=v;else l=u;}z=Math.min(f(lo),f(hi),f((l+h)/2));}
    }
    const k=y*st.nx+x;const next=Math.fround(Math.max(st.bottom,Math.min(st.h[k],z)));if(next!==st.h[k]){st.h[k]=next;changed=true;}
  }
  return changed;}
// Does the mill tool with its tip at p touch material? Columns are cells (rectangles), so the blank's outer walls are exact.
function millTouch(st,t,p,profile){const r=t.width/2,rr=r*r,eps=1e-6;if(p.z>=maxTop(st)-eps)return false;
 const loX=Math.floor((p.x-r-st.x0)/st.dx),hiX=Math.floor((p.x+r-st.x0)/st.dx),loY=Math.floor((p.y-r-st.y0)/st.dy),hiY=Math.floor((p.y+r-st.y0)/st.dy);
 for(let y=Math.max(0,loY);y<=Math.min(st.ny-1,hiY);y++){const cy0=st.y0+y*st.dy,dy=p.y<cy0?cy0-p.y:p.y>cy0+st.dy?p.y-cy0-st.dy:0;
  for(let x=Math.max(0,loX);x<=Math.min(st.nx-1,hiX);x++){const cx0=st.x0+x*st.dx,dx=p.x<cx0?cx0-p.x:p.x>cx0+st.dx?p.x-cx0-st.dx:0,d2=dx*dx+dy*dy;
   if(d2>rr+eps)continue;const h=st.h[y*st.nx+x];if(h>st.bottom+eps&&h>p.z+profile(Math.min(d2,rr))+eps)return true;}}
 return false;}
const maxTop=st=>st._max??(st._max=st.h.reduce((m,v)=>Math.max(m,v),-Infinity));
// First contact on f∈[0,1] of a move of length len: coarse steps of `step`, then bisection. null = no contact.
function search(len,step,hit){if(hit(0))return 0;const n=Math.max(1,Math.ceil(len/Math.max(1e-4,step)));let prev=0;
 for(let k=1;k<=n;k++){const f=k/n;if(hit(f)){let lo=prev,hi=f;for(let j=0;j<40;j++){const m=(lo+hi)/2;if(hit(m))hi=m;else lo=m;}return hi;}prev=f;}return null;}
const lerp=(a,b,f)=>{const o={};for(const k of Object.keys(a))o[k]=a[k]+(b[k]-a[k])*f;return o;};
// Contact on a straight mill move a→b; returns the fraction or null.
function millContact(st,t,a,b){if(!t||!(t.width>0))return null;const profile=profileOf(t);st._max=undefined;
 const len=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);return search(len,Math.min(st.dx,st.dy)/3,f=>millTouch(st,t,lerp(a,b,f),profile));}
// Blank copy for the search: {x0,x1,y0,y1,nx,ny,dx,dy,top,bottom,h}.
function blankCopy(b){return {...b,h:Float32Array.from(b.h),_max:undefined};}
// Skip callback for FanucMacro.execute on the mill. parse(blocks) → {s: segments}; the last skip segment is the G31 move.
// Earlier segments are cut into the blank incrementally (cuts(t) says whether a tool removes material).
function millHost({blank,parse,toolFor,cuts=()=>true}){const st=blankCopy(blank);let done=0;
 return ({blocks})=>{const n=blocks.filter(b=>b.text&&/G31(?!\d)/.test(b.text)).length,segs=parse(blocks),ks=[];segs.forEach((s,i)=>{if(s.skip)ks.push(i);});if(!ks.length||ks.length!==n)return null;const k=ks.at(-1);
  for(let i=done;i<k;i++){const s=segs[i];if(s.rapid||s.kind!=='feed')continue;const t=toolFor(s.tool);if(t&&cuts(t))cutHeight(st,t,s.a,s.b);}done=Math.max(done,k);
  const s=segs[k],f=millContact(st,toolFor(s.tool),s.a,s.b);const p=f===null?s.b:lerp(s.a,s.b,f);return {x:p.x,y:p.y,z:p.z,contact:f!==null};};}
// Lathe: does the insert outline (stamp.poly, nose centre at (cz, cr) in (z, radius)) overlap material? Each stock bin is
// tested against the exact radial span of the outline over the bin's Z interval, so contact does not snap to the bin size.
function polySpan(poly,a0,a1){let lo=Infinity,hi=-Infinity;for(let k=0;k<poly.length;k++){const p=poly[k],q=poly[(k+1)%poly.length];
  const amin=Math.min(p.a,q.a),amax=Math.max(p.a,q.a);if(amax<a0||amin>a1)continue;
  const at=a=>Math.abs(q.a-p.a)<1e-12?null:p.b+(q.b-p.b)*(a-p.a)/(q.a-p.a);
  const pts=[];if(p.a>=a0&&p.a<=a1)pts.push(p.b);if(q.a>=a0&&q.a<=a1)pts.push(q.b);for(const a of [a0,a1]){if(a>amin&&a<amax){const b=at(a);if(b!==null)pts.push(b);}}
  for(const b of pts){lo=Math.min(lo,b);hi=Math.max(hi,b);}}
 return lo===Infinity?null:[lo,hi];}
function latheTouch(stock,s,cz,cr){const eps=1e-6;let amin=Infinity,amax=-Infinity;for(const p of s.poly){amin=Math.min(amin,p.a);amax=Math.max(amax,p.a);}
 const i0=Math.max(0,Math.floor((cz+amin-stock.z0)/stock.dz)),i1=Math.min(stock.n-1,Math.floor((cz+amax-stock.z0)/stock.dz));
 for(let i=i0;i<=i1;i++){const ro=stock.ro[i],ri=stock.ri[i];if(ri>=ro)continue;const z0=stock.z0+i*stock.dz;
  const sp=polySpan(s.poly,z0-cz+eps,z0+stock.dz-cz-eps);if(!sp)continue;let tlo=cr+sp[0],thi=cr+sp[1];if(s.drill)tlo=Math.min(tlo,-thi);if(thi>ri+eps&&tlo<ro-eps)return true;}
 return false;}
function latheContact(stock,stamp,ca,cb){const len=Math.hypot(cb.a-ca.a,cb.b-ca.b);return search(len,stock.dz/2,f=>latheTouch(stock,stamp,ca.a+(cb.a-ca.a)*f,ca.b+(cb.b-ca.b)*f));}
// Height-field blank like stock.js blankFrom (≤ 320 cells on the long side); used by tests and Node hosts.
function makeBlank(b,cells=320){const x=b.x1-b.x0,y=b.y1-b.y0,e=Math.max(x,y,10),nx=clamp(Math.ceil(x/e*cells),10,cells),ny=clamp(Math.ceil(y/e*cells),10,cells),h=new Float32Array(nx*ny).fill(b.top||0);
 return {x0:b.x0,x1:b.x1,y0:b.y0,y1:b.y1,nx,ny,dx:x/nx,dy:y/ny,top:b.top||0,bottom:b.bottom,h};}
const api={makeBlank,cutHeight,millTouch,millContact,millHost,blankCopy,latheTouch,latheContact,search,profileOf};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SkipSim=api;
})(typeof globalThis!=='undefined'?globalThis:this);
