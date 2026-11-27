'use strict';
// FANUC lathe (T series, G-code system A) interpreter for the simulator.
// Conventions: X is programmed as a diameter, Z is the spindle axis. Internally positions keep
// X as a diameter; cycle maths and the view use radius r = X/2. Arc direction follows the standard
// rear-turret view (+X up, +Z to the right): G02 is clockwise and G03 counter-clockwise in that view.
// I is the incremental arc centre in X as a radius value, K in Z.
// Output: segments with the commanded tool-tip points (a,b), the nose-centre points (ca,cb), timing
// and spindle data. Canned cycles are expanded into these same explicit segments.
(function(root){
const NodeMacro=typeof require==='function'?(()=>{try{return require('../nc/macro.js');}catch{return null;}})():null;
const NodeGeo=typeof require==='function'?(()=>{try{return require('../nc/geometry.js');}catch{return null;}})():null;
const NodeData=typeof require==='function'?(()=>{try{return require('../nc/machine.js');}catch{return null;}})():null;
const Macro=()=>root.FanucMacro||NodeMacro,Geo=()=>root.PathGeometry||NodeGeo,Data=()=>root.MachineData||NodeData;
class LatheError extends Error{constructor(line,msg){super('Line '+line+': '+msg);this.line=line;}}
const TIPV={0:[0,0],9:[0,0],1:[1,1],2:[1,-1],3:[-1,-1],4:[-1,1],5:[0,1],6:[1,0],7:[0,-1],8:[-1,0]};// [radial, z]
const ALLOWED_G=new Set([0,1,2,3,4,18,20,21,28,30,32,40,41,42,50,53,54,55,56,57,58,59,70,71,72,73,74,75,76,90,92,94,96,97,98,99,80]);
const ALLOWED_M=new Set([0,1,2,3,4,5,8,9,30,19,10,11,23,24,41,42,43,44]);
function tokenize(text,line){const s=text.toUpperCase().replace(/\([^()]*\)/g,'').replace(/;\s*$/,'').trim();if(!s)return [];
 if(/,\s*[CR]/.test(s))throw new LatheError(line,'Direct drawing dimension (,C / ,R chamfer or corner) is not supported');
 const re=/([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/gy;const out=[];let i=0;const src=s.replace(/\s+/g,' ');
 while(i<src.length){if(src[i]===' '){i++;continue;}re.lastIndex=i;const m=re.exec(src);if(!m)throw new LatheError(line,'Unrecognized syntax near "'+src.slice(i,i+12)+'"');out.push([m[1],Number(m[2]),m[2]]);i=re.lastIndex;}
 return out;}

function simulate(src,opt={}){
 const D=Data();const params=opt.params||D.defaultParams('lathe');const work=opt.work||D.defaultWork('lathe');const offs=opt.offsets||D.defaultLatheOffsets();
 const toolLib=new Map((opt.tools||D.LATHE_TOOLS).map(t=>[t.id,t]));
 const pw=new Map([...params].map(([k,v])=>[k,Array.isArray(v)?v.slice():v]));// parameters as they change during the run
 const P=(n,i)=>{const v=pw.get(n);return Array.isArray(v)?v[i??0]:v;};const setP=(n,v)=>{pw.set(n,v);params.set(n,v);};
 const snap=()=>({lrp:(P(1401)>>1)&1,vx:P(1420,0),vz:P(1420,1),f0x:P(1421,0),f0z:P(1421,1),fmax:P(1422)||Infinity,trap:(P(1620,1)||0)/1000,tfeed:(P(1622,1)||0)/1000,smax:P(3772)||Infinity});let pv=snap();
 const notes=[],segs=[];let error=null;
 // Macro expansion first; it also applies parameter/offset writes in order.
 const mac=Macro().execute(src,{machine:'lathe',params,offsets:offs,work,common:opt.common||new Map(),blockSkip:opt.blockSkip!==false,library:opt.library});
 notes.push(...mac.notes.filter(n=>n!==mac.error));
 const blocks=mac.blocks;
 const st={x:0,z:0,motion:0,feedMode:99,css:false,S:0,Vc:0,maxRpm:Infinity,F:0,unit:1,tool:0,off:0,comp:40,spindle:5,coolant:false,wcs:54,cycle:null,cycleArgs:null,rpm:0};
 if(P(3402)&1)st.motion=1;
 // Start the tool at the reference position (home) in work coordinates.
 const home=()=>{const w=work[st.wcs]||{x:0,z:0},sh=work.shift||{x:0,z:0},ref=params.get(1240)||[0,0];return {x:ref[0]-w.x-sh.x,z:ref[1]-w.z-sh.z};};
 {const h=home();st.x=h.x;st.z=h.z;}
 if(opt.start){st.x=opt.start.x;st.z=opt.start.z;}if(opt.modal)Object.assign(st,opt.modal);// MDI: continue from the current position and modal state
 const tool=()=>toolLib.get(st.tool)||{id:st.tool,name:'T'+st.tool,type:'od',shape:'C',angle:80,kappa:95,noseR:0,tip:3,edge:10,width:0};
 const ofsData=()=>{const g=offs.geom?.[st.off]||{x:0,z:0,r:0,t:0},w=offs.wear?.[st.off]||{x:0,z:0,r:0,t:0};return {wx:st.off?w.x:0,wz:st.off?w.z:0,r:st.off?(g.r||0)+(w.r||0):0,t:st.off?(g.t||0):tool().tip};};
 const dpi=P(3401)&1;
 const val=(w,k)=>{const x=w.find(q=>q[0]===k);if(!x)return null;let v=x[1];if(!dpi&&'XZUWIKR'.includes(k)&&!x[2].includes('.'))v*=0.001;return v*(('XZUWIKR'.includes(k))?st.unit:1);};
 const rpmAt=xd=>{let rpm;if(st.css){const d=Math.max(Math.abs(xd),0.001);rpm=1000*st.Vc/(Math.PI*d);}else rpm=st.S;return Math.min(rpm,st.maxRpm,P(3772)||Infinity);};
 // ---- move output ----
 const moves=[];// programmed moves: {kind,a,b,line,raw,comp,...}
 let cur=null;// current block meta
 function push(kind,b,extra={}){const a={x:st.x,z:st.z};moves.push({kind,a,b:{...b},line:cur.line,raw:cur.raw,comp:st.comp,tool:st.tool,off:st.off,feedMode:st.feedMode,F:st.F,css:st.css,S:st.S,Vc:st.Vc,maxRpm:st.maxRpm,spindle:st.spindle,coolant:st.coolant,pv,...extra});st.x=b.x;st.z=b.z;}
 function rapid(x,z,extra){if(x===st.x&&z===st.z)return;push('rapid',{x,z},extra);}
 function feed(x,z,extra){if(x===st.x&&z===st.z)return;if(!(st.F>0))throw new LatheError(cur.line,'Feed move without F (feedrate zero, alarm 011)');push('feed',{x,z},extra);}
 function thread(x,z,lead,extra){if(!(lead>0))throw new LatheError(cur.line,'Thread without F lead');push('thread',{x,z},{lead,...extra});}
 function arc(x,z,cw,w,extra){// w: words for R / I / K
  const p0={a:st.z,b:st.x/2},p1={a:z,b:x/2};const R=val(w,'R'),I=val(w,'I'),K=val(w,'K');let c;
  const chord=Math.hypot(p1.a-p0.a,p1.b-p0.b);
  if(R!==null){if(chord<1e-9)throw new LatheError(cur.line,'R arc with identical start and end points');const r=Math.abs(R),h=chord/2;if(r<h-1e-4)throw new LatheError(cur.line,'Arc radius R'+R+' is smaller than half the chord (alarm 033)');
   const d=Math.sqrt(Math.max(0,r*r-h*h)),m={a:(p0.a+p1.a)/2,b:(p0.b+p1.b)/2},u={a:(p1.a-p0.a)/chord,b:(p1.b-p0.b)/chord};
   // For a minor arc (R>0) a clockwise arc has its centre on the right of the chord.
   const side=(cw?1:-1)*(R>0?1:-1);c={a:m.a+u.b*d*side,b:m.b-u.a*d*side};}
  else if(I!==null||K!==null){c={a:p0.a+(K||0),b:p0.b+(I||0)};const r0=Math.hypot(p0.a-c.a,p0.b-c.b),r1=Math.hypot(p1.a-c.a,p1.b-c.b);if(Math.abs(r0-r1)>Math.max(0.005,r0*0.001))throw new LatheError(cur.line,'Arc end point is not on the circle (radius differs by '+Math.abs(r0-r1).toFixed(4)+' mm, alarm 020)');}
  else throw new LatheError(cur.line,'G0'+(cw?2:3)+' needs R or I/K');
  const r=Math.hypot(p0.a-c.a,p0.b-c.b);let a0=Math.atan2(p0.b-c.b,p0.a-c.a),a1=Math.atan2(p1.b-c.b,p1.a-c.a);let d=a1-a0;
  if(cw){while(d>=-1e-12)d-=2*Math.PI;}else{while(d<=1e-12)d+=2*Math.PI;}
  if(chord<1e-9)d=cw?-2*Math.PI:2*Math.PI;
  const steps=Math.max(4,Math.ceil(Math.abs(d)/(Math.PI/90)));
  if(!(st.F>0))throw new LatheError(cur.line,'Arc without F (alarm 011)');
  const id=moves.length;for(let k=1;k<=steps;k++){const t=a0+d*k/steps;const q=k===steps?{x,z}:{x:2*(c.b+r*Math.sin(t)),z:c.a+r*Math.cos(t)};push('feed',q,{arc:{cw,cz:c.a,cr:c.b,r,id},...extra});}
 }
 // ---- profile (ns..nf) helpers for G70-G73 ----
 function findN(n,from,preferBefore){let idx=-1;if(preferBefore){for(let i=from;i>=0;i--)if(blocks[i].n===n){idx=i;break;}}if(idx<0)for(let i=from+1;i<blocks.length;i++)if(blocks[i].n===n){idx=i;break;}if(idx<0&&!preferBefore)for(let i=from;i>=0;i--)if(blocks[i].n===n){idx=i;break;}return idx;}
 function profile(ns,nf,from,preferBefore){const i0=findN(ns,from,preferBefore);if(i0<0)throw new LatheError(cur.line,'Sequence number N'+ns+' (P) not found (alarm 063)');let i1=-1;for(let i=i0;i<blocks.length;i++)if(blocks[i].n===nf){i1=i;break;}if(i1<0)throw new LatheError(cur.line,'Sequence number N'+nf+' (Q) not found (alarm 063)');
  // Run the profile blocks on a scratch state to get the shape.
  const save={...st},saveMoves=moves.length,saveCur=cur;const firstWords=[];let first=true;
  for(let i=i0;i<=i1;i++){const b=blocks[i];if(b.set||b.call!==undefined||!b.text)continue;cur={line:b.line,raw:b.raw};const w=tokenize(b.text,b.line);if(first){firstWords.push(...w);first=false;}const gs=w.filter(q=>q[0]==='G').map(q=>q[1]);if(gs.some(g=>[70,71,72,73,74,75,76,90,92,94,32,28,4].includes(g)))throw new LatheError(b.line,'G'+gs.find(g=>[70,71,72,73,74,75,76,90,92,94,32,28,4].includes(g))+' is not allowed inside a P-Q profile (alarm 065)');
   for(const g of gs){if([0,1,2,3].includes(g))st.motion=g;else if(g===40||g===41||g===42)st.comp=g;}const F=w.find(q=>q[0]==='F');if(F)st.F=F[1];const S=w.find(q=>q[0]==='S');if(S){if(st.css)st.Vc=S[1];else st.S=S[1];}
   const X=val(w,'X'),Z=val(w,'Z'),U=val(w,'U'),W=val(w,'W');if(X===null&&Z===null&&U===null&&W===null)continue;const x=X!==null?X:st.x+(U||0),z=Z!==null?Z:st.z+(W||0);
   if(st.motion===0)rapid(x,z,{profile:true});else if(st.motion===1){if(!(st.F>0))st.F=1;feed(x,z,{profile:true});}else arc(x,z,st.motion===2,w,{profile:true});}
  const pm=moves.splice(saveMoves);const endState={...st};Object.assign(st,save);cur=saveCur;
  const pts=[{x:save.x,z:save.z}];for(const m of pm)pts.push(m.b);
  const typeII=firstWords.some(q=>q[0]==='Z'||q[0]==='W')&&firstWords.some(q=>q[0]==='X'||q[0]==='U');
  return {moves:pm,pts,i0,i1,typeII,endState};}
 // Roughing for G71 (cut along Z, depth in X) and G72 (cut along X, depth in Z). Works in (c,d) local coordinates.
 function rough(kind,prof,du,dw,depth,esc,F){const A={x:st.x,z:st.z};
  const toL=p=>kind===71?{c:p.z,d:p.x/2}:{c:p.x/2,d:p.z};const toW=q=>kind===71?{x:q.d*2,z:q.c}:{x:q.c*2,z:q.d};
  const pts=prof.pts.slice(1).map(p=>toL({x:p.x+du,z:p.z+dw}));if(!pts.length)throw new LatheError(cur.line,'Empty P-Q profile');
  const a=toL(A);const sd=Math.sign(pts[0].d-a.d)||Math.sign(pts.at(-1).d-a.d)||-1;const ext=sd<0?Math.min(...pts.map(p=>p.d)):Math.max(...pts.map(p=>p.d));
  const sc=Math.sign(pts.at(-1).c-a.c)||-1;
  let reversals=0;for(let i=2;i<pts.length;i++){const s1=Math.sign(Math.round((pts[i].d-pts[i-1].d)*1e6)),s0=Math.sign(Math.round((pts[i-1].d-pts[i-2].d)*1e6));if(s1&&s0&&s1!==s0)reversals++;}
  if(reversals)notes.push('Line '+cur.line+': profile is not monotonic; Type I roughing stops at the first rise and leaves pockets for G70');
  const oldF=st.F;st.F=F||st.F;const fast=prof.moves[0]?.kind==='rapid';
  const crossAt=L=>{if(sd*(pts[0].d-L)<=1e-9)return pts[0].c;for(let i=1;i<pts.length;i++){const p=pts[i-1],q=pts[i];if(sd*(q.d-L)<=1e-9){if(Math.abs(q.d-p.d)<1e-12)return p.c;const t=(L-p.d)/(q.d-p.d);return p.c+(q.c-p.c)*Math.max(0,Math.min(1,t));}}return pts.at(-1).c;};
  const passes=[];for(let k=1;k<500;k++){const L=a.d+sd*depth*k;if(sd*(L-ext)>=-1e-9)break;passes.push(L);}
  if(passes.length>=499)throw new LatheError(cur.line,'Too many roughing passes; check the depth of cut');
  const tag={cycle:'G'+kind};
  for(const lv of passes){const cEnd=crossAt(lv);if(sc*(cEnd-a.c)<=1e-6)continue;
   const s0=toW({c:a.c,d:lv});if(fast)rapid(s0.x,s0.z,tag);else feed(s0.x,s0.z,tag);
   const e=toW({c:cEnd,d:lv});feed(e.x,e.z,tag);
   const r=toW({c:cEnd-sc*esc,d:lv-sd*esc});feed(r.x,r.z,tag);
   const back=toW({c:a.c,d:lv-sd*esc});rapid(back.x,back.z,tag);}
  // Final pass along the finishing-allowance profile, then back to the start point.
  const p0=toW(pts[0]);rapid(p0.x,p0.z,tag);for(let i=1;i<pts.length;i++){const q=toW(pts[i]);feed(q.x,q.z,tag);}
  const up=toW({c:pts.at(-1).c,d:a.d});rapid(up.x,up.z,tag);rapid(A.x,A.z,tag);st.F=oldF;return passes;}
 function patternRepeat(prof,ri,rk,div,du,dw,F){const A={x:st.x,z:st.z};const n=Math.max(1,Math.round(div));const oldF=st.F;st.F=F||st.F;const tag={cycle:'G73'};
  for(let k=0;k<n;k++){const f=n>1?(n-1-k)/(n-1):0;const ox=2*ri*f+du,oz=rk*f+dw;const pts=prof.pts.slice(1).map(p=>({x:p.x+ox,z:p.z+oz}));if(!pts.length)break;
   rapid(pts[0].x,pts[0].z,tag);for(let i=1;i<pts.length;i++)feed(pts[i].x,pts[i].z,tag);rapid(A.x,A.z,tag);}st.F=oldF;}
 function finish(prof){const A={x:st.x,z:st.z};const tag={cycle:'G70'};for(const m of prof.moves){st.F=m.F||st.F;if(m.kind==='rapid')rapid(m.b.x,m.b.z,{...tag,line2:m.line});else{if(!(st.F>0))throw new LatheError(cur.line,'G70 profile has no F');push('feed',m.b,{...tag,arc:m.arc,srcLine:m.line,srcRaw:m.raw,comp:m.comp});}}rapid(A.x,A.z,tag);}
 // ---- single-pass cycles ----
 function g90(X,Z,R){const A={x:st.x,z:st.z},tag={cycle:'G90'};rapid(X+2*R,A.z,tag);feed(X,Z,tag);feed(A.x,Z,tag);rapid(A.x,A.z,tag);}
 function g94(X,Z,R){const A={x:st.x,z:st.z},tag={cycle:'G94'};rapid(A.x,Z+R,tag);feed(X,Z,tag);feed(X,A.z,tag);rapid(A.x,A.z,tag);}
 function g92(X,Z,R,lead){const A={x:st.x,z:st.z},tag={cycle:'G92'};const ch=(P(5130)||0)*lead/10,sz=Math.sign(Z-A.z)||-1,sx=Math.sign(A.x-X)||1;
  rapid(X+2*R,A.z,tag);if(ch>0){thread(X,Z-sz*ch,lead,tag);thread(X+sx*2*ch,Z,lead,tag);}else thread(X,Z,lead,tag);rapid(A.x,st.z,tag);rapid(A.x,A.z,tag);}
 function g76(X,Z,i,k,dd,lead,m,rr,ang,dmin,allow){const A={x:st.x,z:st.z},tag={cycle:'G76'};const sx=Math.sign(X-A.x)||-1,sz=Math.sign(Z-A.z)||-1;// sx<0: OD thread
  const top=X-sx*2*k;const depths=[];let n=1,prev=0;const roughEnd=Math.max(0,k-allow);
  while(prev<roughEnd-1e-9&&n<200){let d=dd*Math.sqrt(n);if(d-prev<dmin)d=prev+dmin;d=Math.min(d,roughEnd);depths.push(d);prev=d;n++;}
  for(let j=0;j<Math.max(1,m);j++)depths.push(k);
  const tan=Math.tan(ang*Math.PI/360),ch=rr*lead/10;
  for(const d of depths){const xd=top+sx*2*d,zs=A.z+sz*(d*tan);rapid(xd+2*i,zs,tag);if(ch>0){thread(xd,Z-sz*ch,lead,tag);thread(xd-sx*2*ch,Z,lead,tag);}else thread(xd,Z,lead,tag);rapid(A.x,st.z,tag);rapid(A.x,A.z,tag);}
  return depths;}
 function g74(X,Z,di,dk,F,esc){const A={x:st.x,z:st.z},tag={cycle:'G74'};const sz=Math.sign(Z-A.z)||-1;const xs=[];const sx=Math.sign(X-A.x);const stepX=di>0?di*2:Math.abs(X-A.x)||1;for(let x=A.x;sx?sx*(x-X)<=1e-9:xs.length<1;x+=sx*stepX){xs.push(x);if(!sx)break;}
  for(const x of xs){rapid(x,A.z,tag);let z=A.z;while(sz*(Z-z)>1e-9){const nz=sz>0?Math.min(Z,z+dk):Math.max(Z,z-dk);feed(x,nz,tag);z=nz;if(sz*(Z-z)>1e-9)rapid(x,z-sz*esc,tag);}rapid(x,A.z,tag);}rapid(A.x,A.z,tag);}
 function g75(X,Z,di,dk,F,esc){const A={x:st.x,z:st.z},tag={cycle:'G75'};const sx=Math.sign(X-A.x)||-1;const zs=[];const sz=Math.sign(Z-A.z);for(let z=A.z;;z+=sz*(dk||Infinity)){zs.push(z);if(!sz||!dk||sz*(Z-(z+sz*dk))<-1e-9)break;}if(sz&&Math.abs(zs.at(-1)-Z)>1e-9)zs.push(Z);
  for(const z of zs){rapid(A.x,z,tag);let x=A.x;while(sx*(X-x)>1e-9){const nx=sx>0?Math.min(X,x+2*di):Math.max(X,x-2*di);feed(nx,z,tag);x=nx;if(sx*(X-x)>1e-9)rapid(x-sx*2*esc,z,tag);}rapid(A.x,z,tag);}rapid(A.x,A.z,tag);}
 const pending={};// first-block data of two-block cycles
 let bi=0;
 try{
 for(bi=0;bi<blocks.length;bi++){const b=blocks[bi];
  if(b.set){if(b.set.table==='param'){const {key,axis,value}=b.set;if(axis){const cur=pw.get(key);const arr=Array.isArray(cur)?cur.slice():[cur,cur];arr[axis-1]=value;pw.set(key,arr);}else pw.set(key,value);pv=snap();}continue;}// offset/work writes are applied by the macro executor to the shared tables
  if(b.stop){moves.push({kind:'stop',a:{x:st.x,z:st.z},b:{x:st.x,z:st.z},line:b.line,raw:b.raw||'',stop:b.stop,comp:st.comp,tool:st.tool,off:st.off});continue;}
  if(b.call!==undefined||!b.text||b.text.startsWith('('))continue;
  cur={line:b.line,raw:b.raw};const w=tokenize(b.text,b.line);if(!w.length)continue;
  const gs=w.filter(q=>q[0]==='G').map(q=>q[1]),ms=w.filter(q=>q[0]==='M').map(q=>q[1]);
  for(const [k] of w)if(!'GMNXZUWIKRFSTPQ'.includes(k))throw new LatheError(b.line,'Address '+k+' is not used on this lathe (Y/A/B/C/E/H/D/J/L/V axes are not simulated)');
  for(const g of gs)if(!ALLOWED_G.has(g)){throw new LatheError(b.line,'G'+g+' is not supported by the lathe simulator'+(g===17||g===19?' (only the G18 ZX plane is used)':g===91?' (G91 is not used in G-code system A; use U/W)':''));}
  for(const m of ms)if(!ALLOWED_M.has(m)&&m!==98&&m!==99)throw new LatheError(b.line,'M'+m+' is not supported');
  // Modal words
  for(const g of gs){if(g===20)st.unit=25.4;else if(g===21)st.unit=1;else if(g===96)st.css=true;else if(g===97)st.css=false;else if(g===98||g===99)st.feedMode=g;else if(g===40||g===41||g===42)st.comp=g;else if(g>=54&&g<=59)st.wcs=g;}
  const S=w.find(q=>q[0]==='S');
  if(gs.includes(50)){if(S)st.maxRpm=S[1];const X=val(w,'X'),Z=val(w,'Z');if(X!==null||Z!==null){const ex=work.ext||(work.ext={x:0,z:0});if(X!==null){ex.x+=st.x-X;st.x=X;}if(Z!==null){ex.z+=st.z-Z;st.z=Z;}notes.push('Line '+b.line+': G50 coordinate system setting applied');}continue;}
  if(S){if(st.css)st.Vc=S[1];else st.S=S[1];if(gs.includes(96))st.Vc=S[1];if(gs.includes(97))st.S=S[1];}
  const Fw=w.find(q=>q[0]==='F');
  const T=w.find(q=>q[0]==='T');if(T){const t=Math.round(T[1]);if(t>=100){st.tool=Math.floor(t/100);st.off=t%100;}else{st.tool=t;st.off=t;}if(st.comp!==40)notes.push('Line '+b.line+': tool change with nose radius compensation active');moves.push({kind:'tool',a:{x:st.x,z:st.z},b:{x:st.x,z:st.z},line:b.line,raw:b.raw,tool:st.tool,off:st.off,comp:st.comp});}
  for(const m of ms){if(m===3||m===4)st.spindle=m;else if(m===5)st.spindle=5;else if(m===8)st.coolant=true;else if(m===9)st.coolant=false;else if(m===0||m===1)moves.push({kind:'stop',a:{x:st.x,z:st.z},b:{x:st.x,z:st.z},line:b.line,raw:b.raw,stop:m===0?'M00':'M01',comp:st.comp,tool:st.tool,off:st.off});
   else if(![30,2,19].includes(m))notes.push('Line '+b.line+': M'+m+' has no effect in the simulator');}
  if(ms.includes(30)||ms.includes(2)){moves.push({kind:'stop',a:{x:st.x,z:st.z},b:{x:st.x,z:st.z},line:b.line,raw:b.raw,stop:'end',comp:st.comp,tool:st.tool,off:st.off});break;}
  // Cycles
  const X=val(w,'X'),Z=val(w,'Z'),U=val(w,'U'),W=val(w,'W'),R=val(w,'R');const Pw=w.find(q=>q[0]==='P'),Qw=w.find(q=>q[0]==='Q');
  const cyc=gs.find(g=>[70,71,72,73,74,75,76].includes(g));
  if(Fw&&!(cyc&&[71,72,73].includes(cyc)))st.F=Fw[1];
  if(gs.includes(4)){const t=val(w,'X')??val(w,'U')??(Pw?Pw[1]/1000:0);moves.push({kind:'dwell',a:{x:st.x,z:st.z},b:{x:st.x,z:st.z},line:b.line,raw:b.raw,dwell:Math.max(0,t),comp:st.comp,tool:st.tool,off:st.off,spindle:st.spindle,css:st.css,S:st.S,Vc:st.Vc,maxRpm:st.maxRpm});continue;}
  if(cyc){st.cycle=null;
   if(cyc===70){if(!Pw||!Qw)throw new LatheError(b.line,'G70 needs P and Q');finish(profile(Pw[1],Qw[1],bi,true));continue;}
   if(cyc===71||cyc===72){if(!Pw){// first block: U(depth)/R(escape) or W(depth) for G72
      const dep=cyc===71?U:W;if(dep!==null)setP(5132,dep);if(R!==null)setP(5133,R);continue;}
     const prof=profile(Pw[1],Qw?Qw[1]:Pw[1],bi,false);const du=U||0,dw=W||0;const F=Fw?Fw[1]:st.F;rough(cyc,prof,du,dw,P(5132)||1,P(5133)||0.5,F);bi=prof.i1;continue;}
   if(cyc===73){if(!Pw){if(U!==null)setP(5135,U);if(W!==null)setP(5136,W);if(R!==null)setP(5137,R);continue;}
     const prof=profile(Pw[1],Qw[1],bi,false);patternRepeat(prof,P(5135)||0,P(5136)||0,P(5137)||1,U||0,W||0,Fw?Fw[1]:st.F);bi=prof.i1;continue;}
   if(cyc===76){if(X===null&&U===null&&Z===null&&W===null){if(Pw){const p=String(Math.round(Pw[1])).padStart(6,'0');setP(5142,Number(p.slice(0,2)));pending.g76rr=Number(p.slice(2,4));setP(5143,Number(p.slice(4,6)));}if(Qw)setP(5140,Qw[1]/1000);if(R!==null)setP(5141,R);continue;}
     const lead=Fw?Fw[1]:st.F;const tx=X!==null?X:st.x+(U||0),tz=Z!==null?Z:st.z+(W||0);if(!Pw||!Qw)throw new LatheError(b.line,'G76 second block needs P (thread height) and Q (first depth)');
     g76(tx,tz,R||0,Pw[1]/1000,Qw[1]/1000,lead,P(5142)||1,pending.g76rr??0,P(5143)??60,P(5140)||0.05,P(5141)||0);continue;}
   if(cyc===74||cyc===75){if(!Pw&&!Qw&&X===null&&Z===null&&U===null&&W===null){if(R!==null)setP(5139,R);continue;}
     const tx=X!==null?X:st.x+(U||0),tz=Z!==null?Z:st.z+(W||0);const di=(Pw?Pw[1]:0)/1000,dk=(Qw?Qw[1]:0)/1000;if(cyc===74)g74(tx,tz,di,dk||Math.abs(tz-st.z),st.F,P(5139)||0.5);else g75(tx,tz,di||Math.abs(tx-st.x)/2,dk,st.F,P(5139)||0.5);continue;}
  }
  const motionG=gs.find(g=>[0,1,2,3,32,90,92,94].includes(g));
  if(motionG!==undefined){if([90,92,94].includes(motionG))st.cycle=motionG;else{st.cycle=null;st.motion=motionG;}}else if(gs.includes(80))st.cycle=null;
  const hasAxis=X!==null||Z!==null||U!==null||W!==null;
  if(gs.includes(28)||gs.includes(30)){if(st.comp!==40)notes.push('Line '+b.line+': G28 with nose radius compensation active');const ix=X!==null?X:st.x+(U||0),iz=Z!==null?Z:st.z+(W||0);rapid(ix,iz,{cycle:'G28'});const h=home();rapid(X!==null||U!==null?h.x:st.x,Z!==null||W!==null?h.z:st.z,{cycle:'G28'});if(gs.includes(30))notes.push('Line '+b.line+': G30 uses the first reference position');continue;}
  if(gs.includes(53)){const w0=work[st.wcs]||{x:0,z:0},sh=work.shift||{x:0,z:0};rapid(X!==null?X-w0.x-sh.x:st.x,Z!==null?Z-w0.z-sh.z:st.z,{cycle:'G53'});continue;}
  if(!hasAxis)continue;
  const tx=X!==null?X:st.x+(U||0),tz=Z!==null?Z:st.z+(W||0);
  if(st.cycle){// X(U), Z(W) and R of G90/G92/G94 are modal while the cycle stays active
   const ca=(motionG===st.cycle||!st.cycleArgs)?{x:st.x,z:st.z,r:0}:st.cycleArgs;const cx=X!==null?X:U!==null?st.x+U:ca.x,cz=Z!==null?Z:W!==null?st.z+W:ca.z,rr=R!==null&&R!==undefined?R:ca.r;st.cycleArgs={x:cx,z:cz,r:rr};const tx=cx,tz=cz;if(st.cycle===90){if(!(st.F>0))throw new LatheError(b.line,'G90 needs F');g90(tx,tz,rr);}else if(st.cycle===94){if(!(st.F>0))throw new LatheError(b.line,'G94 needs F');g94(tx,tz,rr);}else g92(tx,tz,rr,st.F);continue;}
  if(st.motion===0)rapid(tx,tz);else if(st.motion===1)feed(tx,tz);else if(st.motion===32)thread(tx,tz,st.F,{cycle:'G32'});else arc(tx,tz,st.motion===2,w);
 }}catch(e){if(e instanceof LatheError)error=e.message;else throw e;}
 if(mac.error&&!error)error=mac.error;
 if(error)notes.push(error+' — stopped.');
 return finishSegments(moves,{notes,error,params,offs,toolLib,work,P,pv0:pv,trace:mac.trace,blocks});
}
// ---- compensation, timing and segment output ----
function finishSegments(moves,ctx){const {P,offs,toolLib,work,notes}=ctx;const Gm=Geo();
 const tipOf=m=>{const g=offs.geom?.[m.off]||{},w=offs.wear?.[m.off]||{};const t=toolLib.get(m.tool);return {r:m.off?(g.r||0)+(w.r||0):(t?.noseR||0),tip:m.off?(g.t??t?.tip??3):(t?.tip??3),wx:m.off?(w.x||0):0,wz:m.off?(w.z||0):0};};
 // Commanded tip point (with wear) for every move end/start.
 const out=[];const motion=moves.filter(m=>m.kind==='rapid'||m.kind==='feed'||m.kind==='thread');
 // Build centre paths: compensation chains first.
 const centers=new Map();// move -> {ca,cb} in (z, r)
 let i=0;while(i<moves.length){const m=moves[i];if(!(m.kind==='rapid'||m.kind==='feed')||m.comp===40||(m.cycle&&m.cycle!=='G70')){i++;continue;}
  // chain: consecutive compensated motion moves; include the following G40 move as cancel
  const chain=[];let j=i;while(j<moves.length){const q=moves[j];if(q.kind==='tool'||q.kind==='dwell'||q.kind==='stop'){j++;continue;}if(!(q.kind==='rapid'||q.kind==='feed')||(q.cycle&&q.cycle!=='G70'))break;if(q.comp===40){chain.push(q);j++;break;}chain.push(q);j++;}
  const comps=chain.filter(q=>q.comp!==40);if(!comps.length){i=j;continue;}
  const ti=tipOf(comps[0]);const side=comps[0].comp===42?1:-1;const endRaw=chain.at(-1).comp===40;
  const verts=[{a:chain[0].a.z,b:chain[0].a.x/2},...chain.map(q=>({a:q.b.z,b:q.b.x/2}))];
  // the start-up vertex is the uncompensated nose centre
  const tv=TIPV[ti.tip]||[0,0];
  const res=Gm.offsetChain(verts,side,ti.r,{startRaw:true,endRaw});
  if(res.interference.length)notes.push('Line '+chain[res.interference[0]].line+': nose radius '+ti.r+' does not fit this profile (interference, FANUC alarm 041); path may gouge');
  chain.forEach((q,k)=>{let pts=res.paths[k];if(k===0)pts=[{a:pts[0].a-tv[1]*ti.r,b:pts[0].b-tv[0]*ti.r},...pts.slice(1)];if(endRaw&&k===chain.length-1)pts=[...pts.slice(0,-1),{a:pts.at(-1).a-tv[1]*ti.r,b:pts.at(-1).b-tv[0]*ti.r}];centers.set(q,pts);});
  i=j;}
 let total=0,rapidT=0,cutT=0;const rpmS=[];
 const rpmAt=(m,xd)=>{if(m.spindle===5&&m.kind!=='rapid')return 0;let r=m.css?1000*(m.Vc||0)/(Math.PI*Math.max(Math.abs(xd),0.01)):(m.S||0);return Math.min(r,m.maxRpm||Infinity,(m.pv||ctx.pv0).smax);};
 for(const m of moves){const ti=tipOf(m);const {lrp,vx,vz,f0x,f0z,fmax,trap,tfeed}=m.pv||ctx.pv0;const tv=TIPV[ti.tip]||[0,0];
  if(m.kind==='tool'||m.kind==='stop'||m.kind==='dwell'){const p={x:m.b.x+ti.wx,z:m.b.z+ti.wz};const c={a:p.z-tv[1]*ti.r,b:p.x/2-tv[0]*ti.r};
   const dur=m.kind==='dwell'?m.dwell:0;total+=dur;out.push({a:p,b:p,ca:c,cb:c,rapid:false,kind:m.kind,dwell:m.dwell||0,stop:m.stop,line:m.line,raw:m.raw,tool:m.tool,off:m.off,t100:dur,tF0:dur,perRev:false,rpm:rpmAt(m,p.x),spindle:m.spindle,len:0});continue;}
  const pts=centers.get(m);let cpts;
  if(pts){cpts=pts;}else cpts=[{a:m.a.z+ti.wz-tv[1]*ti.r,b:(m.a.x+ti.wx)/2-tv[0]*ti.r},{a:m.b.z+ti.wz-tv[1]*ti.r,b:(m.b.x+ti.wx)/2-tv[0]*ti.r}];
  // Non-linear (dogleg) rapid when parameter 1401 bit1 LRP = 0.
  if(m.kind==='rapid'&&!lrp&&cpts.length===2){const dz=cpts[1].a-cpts[0].a,dr=cpts[1].b-cpts[0].b,tz=Math.abs(dz)/vz,tr=Math.abs(dr)/vx;if(tz>1e-9&&tr>1e-9&&Math.abs(tz-tr)>1e-9){const t=Math.min(tz,tr);cpts=[cpts[0],{a:cpts[0].a+Math.sign(dz)*Math.min(Math.abs(dz),vz*t),b:cpts[0].b+Math.sign(dr)*Math.min(Math.abs(dr),vx*t)},cpts[1]];}}
  for(let k=1;k<cpts.length;k++){const ca=cpts[k-1],cb=cpts[k];const a={x:2*(ca.b+tv[0]*ti.r),z:ca.a+tv[1]*ti.r},b={x:2*(cb.b+tv[0]*ti.r),z:cb.a+tv[1]*ti.r};
   const dzz=cb.a-ca.a,drr=cb.b-ca.b,len=Math.hypot(dzz,drr);let t100=0,tF0=0,perRev=false,rate=0;
   if(m.kind==='rapid'){const tt=Math.max(Math.abs(drr)/vx,Math.abs(dzz)/vz)*60;t100=tt+(len>0?trap:0);tF0=Math.max(Math.abs(drr)/f0x,Math.abs(dzz)/f0z)*60+(len>0?trap:0);rate=len/(tt/60||1);}
   else{// integrate feed time over pieces so G96 + G99 follows the changing diameter
    const pieces=m.feedMode===99||m.kind==='thread'?Math.max(1,Math.min(16,Math.ceil(len/2))):1;let tt=0;for(let q=0;q<pieces;q++){const xd=Math.abs(a.x+(b.x-a.x)*(q+.5)/pieces);let f;if(m.kind==='thread'){f=(m.lead||m.F)*rpmAt(m,xd);perRev=true;}else if(m.feedMode===99){f=m.F*rpmAt(m,xd);perRev=true;}else f=m.F;f=Math.min(f,fmax);if(m.kind==='thread')f=(m.lead||m.F)*rpmAt(m,xd);tt+=f>0?(len/pieces)/f*60:Infinity;}
    if(!Number.isFinite(tt)){if(len>0&&!ctx.warnedSpindle){notes.push('Line '+m.line+': feed per revolution with the spindle stopped or S0 — the move would never finish on a real machine (shown at 1 mm/s)');ctx.warnedSpindle=true;}tt=len;}
    t100=tt+(len>0?tfeed:0);tF0=t100;rate=len/(tt/60||1);}
   total+=t100;if(m.kind==='rapid')rapidT+=t100;else cutT+=t100;const rpm=rpmAt(m,b.x);if(rpm)rpmS.push(rpm);
   out.push({a,b,ca,cb,rapid:m.kind==='rapid',kind:m.kind,cycle:m.cycle||null,line:m.srcLine||m.line,raw:m.srcRaw||m.raw,cycleLine:m.cycle?m.line:null,tool:m.tool,off:m.off,comp:m.comp,t100,tF0,perRev,rate,rpm,spindle:m.spindle,feedMode:m.feedMode,F:m.F,lead:m.lead,arc:m.arc||null,len,noseR:ti.r,tipDir:ti.tip});}
 }
 // Stroke limit check (machine = work + work offset + shift). X in diameter.
 const lim=[P(1320,0),P(1320,1)],nlim=[P(1321,0),P(1321,1)];
 for(const s of out){const w0=work[54]||{x:0,z:0},sh=work.shift||{x:0,z:0},ex=work.ext||{x:0,z:0};const mx=s.b.x+w0.x+sh.x+ex.x,mz=s.b.z+w0.z+sh.z+ex.z;
  if(mx>lim[0]+1e-6||mz>lim[1]+1e-6||mx<nlim[0]-1e-6||mz<nlim[1]-1e-6){notes.push('Line '+s.line+': OT05'+(mx>lim[0]||mz>lim[1]?'00 (+)':'01 (−)')+' over travel at machine X'+mx.toFixed(3)+' Z'+mz.toFixed(3)+' — stopped');const idx=out.indexOf(s);out.length=idx;ctx.error=ctx.error||'Over travel';break;}}
 return {segs:out,notes,error:ctx.error,cycleTime:total,rapidTime:rapidT,cutTime:cutT,rpmMax:rpmS.length?Math.max(...rpmS):0,rpmMin:rpmS.length?Math.min(...rpmS):0,trace:ctx.trace,params:ctx.params,offsets:offs,work};}

// ---- tool geometry: insert outline around the nose centre, in (z, r) mm ----
function toolOutline(t,noseR,tipDir){const R=Math.max(0,noseR??t.noseR??0);const pts=[];const L=Math.max(2,t.edge||10);
 const type=t.type||'od';
 if(type==='drill'){const r=(t.width||10)/2,h=r/Math.tan((t.angle||118)*Math.PI/360);return [{a:0,b:0},{a:h,b:r},{a:L,b:r},{a:L,b:-r},{a:h,b:-r}];}
 if(type==='groove'||type==='part'){const w=Math.max(0.2,t.width||3),r=Math.min(R,w/2);const arcP=(cx,a0,a1)=>{for(let k=0;k<=8;k++){const q=a0+(a1-a0)*k/8;pts.push({a:cx+r*Math.cos(q),b:r*Math.sin(q)});}};
  pts.push({a:-r,b:L});arcP(0,Math.PI,1.5*Math.PI);arcP(w-2*r,1.5*Math.PI,2*Math.PI);pts.push({a:w-r,b:L});return orient(pts,type,tipDir);}
 if(t.shape==='R'){for(let k=0;k<48;k++){const q=k/48*2*Math.PI;pts.push({a:R*Math.cos(q),b:R*Math.sin(q)});}return pts;}
 let th1,th2;if(type.startsWith('thread')){const half=(t.angle||60)/2;th1=90+half;th2=90-half;}else{th1=180-(t.kappa||95);th2=th1-(t.angle||80);}
 const rad=d=>d*Math.PI/180;const n1=rad(th1+90),n2=rad(th2-90);const d1={a:Math.cos(rad(th1)),b:Math.sin(rad(th1))},d2={a:Math.cos(rad(th2)),b:Math.sin(rad(th2))};
 const T1={a:R*Math.cos(n1),b:R*Math.sin(n1)},T2={a:R*Math.cos(n2),b:R*Math.sin(n2)};
 pts.push({a:T1.a+L*d1.a,b:T1.b+L*d1.b});let span=n2-n1;while(span<=0)span+=2*Math.PI;const steps=Math.max(2,Math.ceil(span/(Math.PI/24)));for(let k=0;k<=steps;k++){const q=n1+span*k/steps;pts.push({a:R*Math.cos(q),b:R*Math.sin(q)});}
 pts.push({a:T2.a+L*d2.a,b:T2.b+L*d2.b});
 return orient(pts,type,tipDir);}
function orient(pts,type,tipDir){const tip=tipDir??3;const id=type==='id'||type==='thread-id';const mirrorR=[1,2,6].includes(tip)||(id&&[0,9,5,7].includes(tip));const mirrorZ=[1,4].includes(tip);return pts.map(p=>({a:mirrorZ?-p.a:p.a,b:mirrorR?-p.b:p.b}));}
// ---- stock model: outer/inner radius per Z bin ----
function makeStock({od=50,bore=0,length=80,face=0,dz}={}){const step=dz||Math.max(0.02,Math.min(0.1,length/2500));const z0=face-length;const n=Math.ceil(length/step);const ro=new Float32Array(n).fill(od/2),ri=new Float32Array(n).fill(Math.max(0,bore/2));return {z0,z1:face,dz:step,n,ro,ri,od,bore,length,face,rev:0};}
// Column profile of a tool outline at the stock bin size: per column, [lo, hi] radial offsets.
const stampCache=new Map();
function stampFor(t,noseR,tipDir,dz){const key=JSON.stringify([t.type,t.shape,t.angle,t.kappa,t.edge,t.width,noseR,tipDir,dz]);let s=stampCache.get(key);if(s)return s;
 const poly=toolOutline(t,noseR,tipDir);let amin=Infinity,amax=-Infinity;for(const p of poly){amin=Math.min(amin,p.a);amax=Math.max(amax,p.a);}
 const j0=Math.floor(amin/dz),j1=Math.ceil(amax/dz),lo=new Float32Array(j1-j0+1).fill(Infinity),hi=new Float32Array(j1-j0+1).fill(-Infinity);
 for(let j=j0;j<=j1;j++){const a=(j)*dz;for(let k=0;k<poly.length;k++){const p=poly[k],q=poly[(k+1)%poly.length];if((p.a-a)*(q.a-a)>0)continue;if(Math.abs(q.a-p.a)<1e-12){lo[j-j0]=Math.min(lo[j-j0],p.b,q.b);hi[j-j0]=Math.max(hi[j-j0],p.b,q.b);continue;}const b=p.b+(q.b-p.b)*(a-p.a)/(q.a-p.a);lo[j-j0]=Math.min(lo[j-j0],b);hi[j-j0]=Math.max(hi[j-j0],b);}}
 s={j0,lo,hi,poly,outer:!(t.type==='id'||t.type==='thread-id'||t.type==='drill'),drill:t.type==='drill'};stampCache.set(key,s);if(stampCache.size>200)stampCache.delete(stampCache.keys().next().value);return s;}
// Remove material for a tool whose nose centre is at (cz, cr). Returns removed area (mm², half section).
function stampAt(stock,s,cz,cr){let removed=0;const base=Math.round((cz-stock.z0)/stock.dz-.5);for(let j=0;j<s.lo.length;j++){const lo=s.lo[j],hi=s.hi[j];if(lo===Infinity)continue;const i=base+s.j0+j;if(i<0||i>=stock.n)continue;
  const ro=stock.ro[i],ri=stock.ri[i];if(ri>=ro)continue;let tlo=cr+lo,thi=cr+hi;if(s.drill){tlo=Math.min(tlo,-thi);}if(thi<=ri||tlo>=ro)continue;let nro=ro,nri=ri;
  if(thi>=ro&&tlo<=ri)nro=nri=ri;else if(thi>=ro)nro=Math.max(ri,tlo);else if(tlo<=ri||tlo<=0)nri=Math.min(ro,thi);else if(s.outer)nro=Math.max(ri,tlo);else nri=Math.min(ro,thi);
  if(nro!==ro||nri!==ri){removed+=((ro-ri)-(nro-nri))*stock.dz;stock.ro[i]=nro;stock.ri[i]=nri;}}
 if(removed)stock.rev++;return removed;}
function sweep(stock,s,ca,cb,step){const len=Math.hypot(cb.a-ca.a,cb.b-ca.b);const n=Math.max(1,Math.ceil(len/(step||Math.max(stock.dz,0.05))));let r=0;for(let k=1;k<=n;k++){const t=k/n;r+=stampAt(stock,s,ca.a+(cb.a-ca.a)*t,ca.b+(cb.b-ca.b)*t);}return r;}
// Cut a whole simulated program into a stock (used by tests and the "final part" view).
function cutAll(result,stock,tools){const lib=new Map((tools||Data().LATHE_TOOLS).map(t=>[t.id,t]));let removed=0;for(const s of result.segs){if(s.rapid||s.len===0)continue;const t=lib.get(s.tool);if(!t)continue;const st=stampFor(t,s.noseR,s.tipDir,stock.dz);removed+=sweep(stock,st,s.ca,s.cb);}return removed;}
const api={simulate,tokenize,toolOutline,stampFor,stampAt,sweep,makeStock,cutAll,TIPV,LatheError};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LatheSim=api;
})(typeof globalThis!=='undefined'?globalThis:this);
