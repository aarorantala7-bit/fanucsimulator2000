'use strict';
// Milling interpreter (FANUC M series subset). Input is program text or blocks from FanucMacro.
// Adaptive arc segmentation: chord error ≤ tol (mm), at least one chord per 90°, at most 720 chords.
function arcSteps(r,d,tol){const da=r>tol/2?2*Math.acos(Math.max(-1,1-tol/r)):Math.PI/2;return Math.min(720,Math.max(1,Math.ceil(Math.abs(d)/(Math.PI/2)),Math.ceil(Math.abs(d)/Math.max(1e-6,da))));}
// Output segments keep the original shape {a,b,rapid,tool,line,raw} and add timing/spindle data.
// opt: {blockSkip, params, offsets:{h,d}, work, tools(Map id->{width}), library}
function parse(src,opt={}){
 const cp=p=>({x:p.x,y:p.y,z:p.z});
 const Data=globalThis.MachineData||(typeof require==='function'?require('../nc/machine.js'):null);
 const ms0=globalThis.MachineState?.mill;
 const params0=opt.params||ms0?.params||(Data?Data.defaultParams('mill'):new Map());const params=new Map([...params0].map(([k,v])=>[k,Array.isArray(v)?v.slice():v]));
 const offsets=opt.offsets||ms0?.offsets||(Data?Data.defaultMillOffsets():{h:{},d:{}});
 const work=opt.work||ms0?.work||(Data?Data.defaultWork('mill'):{});
 const P=(n,i)=>{const v=params.get(n);return Array.isArray(v)?v[i??0]:v;};
 let s=[],notes=[],p=opt.start?cp(opt.start):{x:0,y:0,z:0},motion=null,absolute=true,scale=1,tool=0,pending=null,stop=false;
 let F=0,feedMode=94,S=0,spindle=5,H=0,D=0,comp=40,wcs=54,cycle=null,cyc={},ret=98,coolant=false;
 motion=(P(3402)&1)?1:0;// power-on motion mode: parameter 3402 bit0 (0 = G00, as on the control)
 if(opt.modal){({tool=tool,S=S,spindle=spindle,F=F,H=H,feedMode=feedMode}=opt.modal);}
 const snap=()=>({lrp:(P(1401)>>1)&1,v:[P(1420,0),P(1420,1),P(1420,2)],f0:[P(1421,0),P(1421,1),P(1421,2)],fmax:P(1422)||Infinity,trap:(P(1620,2)||0)/1000,tfeed:(P(1622,2)||0)/1000,smax:P(3772)||Infinity});let pv=snap();
 const warn=(line,msg)=>notes.push('Line '+line+': '+msg);const unknownM=new Set();
 let lines;
 if(Array.isArray(src))lines=src;else{const L=src.split(/\r?\n/);if(L.length>15000)return {s,notes:['File too large for this preview (15,000 lines maximum).']};lines=L.map((raw,i)=>({text:raw,raw,line:i+1,virtual:true}));}
 const dpi=P(3401)&1;
 const add=(a,b,extra,meta)=>{s.push({a:cp(a),b:cp(b),rapid:extra.rapid??motion===0,tool,line:meta.line,raw:meta.raw,kind:extra.kind||(extra.rapid??motion===0?'rapid':'feed'),F,feedMode,S,spindle,coolant,comp,D,H,cycle:extra.cycle||null,dwell:extra.dwell||0,stop:extra.stop||null,lead:extra.lead||0,traceIndex:meta.ti,pv});};
 for(let n=0;n<lines.length;n++){const meta=lines[n];const raw=meta.raw??meta.text;if(meta.set){if(meta.set.table==='param'){const {key,axis,value}=meta.set;if(axis){const cur=params.get(key);const arr=Array.isArray(cur)?cur.slice():[cur,cur,cur];arr[axis-1]=value;params.set(key,arr);}else params.set(key,value);pv=snap();}continue;}if(meta.call!==undefined)continue;if(meta.stop){add(p,p,{rapid:true,kind:'stop',stop:meta.stop},{line:meta.line,raw:raw||''});continue;}
  const virtual=meta.virtual?raw.match(/^\s*\(SIM:([^()]*)\)\s*$/i):null;
  let str=((virtual?virtual[1]:meta.text)||'').replace(/\([^()]*\)/g,'').split(';')[0].toUpperCase().replace(/\s/g,'');
  if(!str||str==='%')continue;
  if(str.startsWith('/')){if(opt.blockSkip===false)str=str.slice(1);else continue;}
  if(/^[O:]\d+$/.test(str))continue;
  const matches=[...str.matchAll(/([A-Z])([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g)];
  if(matches.map(m=>m[0]).join('')!==str){warn(meta.line,'Unrecognized syntax; stopped.');break}
  const w={},lit={},gs=[],ms=[];for(const [,k,v] of matches){const x=Number(v);if(k==='G')gs.push(x);else if(k==='M')ms.push(x);else{w[k]=x;lit[k]=v;}}
  const bad=Object.keys(w).find(k=>!['N','O','X','Y','Z','I','J','K','R','T','F','S','P','Q','L','D','H'].includes(k));if(bad){warn(meta.line,'Unsupported word '+bad+'; stopped.');break}
  if(!dpi)for(const k of 'XYZIJKRQ')if(k in w&&!String(lit[k]).includes('.'))w[k]*=0.001;
  let nextMotion=motion;
  for(const g of gs){if([0,1,2,3].includes(g)){nextMotion=g;cycle=null;}else if(g===90)absolute=true;else if(g===91)absolute=false;else if(g===20)scale=25.4;else if(g===21)scale=1;
   else if(g===80){nextMotion=null;cycle=null;}else if(g===17||g===49||g===61||g===64||g===4||g===28||g===53||g===10||g===11)0;else if(g===94||g===95)feedMode=g;else if(g===98||g===99)ret=g;
   else if(g===40||g===41||g===42)comp=g;else if(g===43||g===44)0;else if(g>=54&&g<=59)wcs=g;
   else if([73,76,81,82,83,84,85,86,89].includes(g)){cycle=g;cyc={init:p.z};}
   else{warn(meta.line,'Unsupported G'+g+(g===18||g===19?' (only the G17 XY plane is simulated)':'')+'; stopped.');stop=true;break}}
  if(stop)break;motion=nextMotion;
  if('F'in w)F=w.F*(feedMode===94?scale:1);if('S'in w)S=w.S;if('H'in w)H=w.H;if('D'in w)D=w.D;
  if('T'in w){if(!Number.isInteger(w.T)||w.T<0||w.T>99999){warn(meta.line,'Invalid tool ID; stopped.');break}pending=w.T;}
  for(const m of ms){if(m===6){if(pending!==null)tool=pending;else warn(meta.line,'Tool change without a prior T word.');}else if([2,30].includes(m)){stop=true;}
   else if(m===3||m===4||m===5)spindle=m;else if(m===7||m===8)coolant=true;else if(m===9)coolant=false;else if(m===0||m===1)add(p,p,{rapid:true,kind:'stop',stop:m===0?'M00':'M01'},meta);
   else if(m===19||m===29)0;else{if(!unknownM.has(m)){unknownM.add(m);warn(meta.line,'M'+m+' is a machine-specific M code; treated as a no-op (no motion).');}}}
  if(stop){if(ms.some(m=>m===2||m===30)){warn(meta.line,'Program end.');add(p,p,{rapid:true,kind:'stop',stop:'end'},meta);}break}
  if(gs.includes(4)){const t='P'in w?w.P/1000:('X'in w?w.X:0);add(p,p,{rapid:false,kind:'dwell',dwell:t},meta);continue;}
  if(gs.includes(28)){const q=cp(p);for(const k of ['X','Y','Z'])if(k in w)q[k.toLowerCase()]=(absolute?0:p[k.toLowerCase()])+w[k]*scale;add(p,q,{rapid:true,cycle:'G28'},meta);const wo=work[wcs]||{},ref=params.get(1240)||[0,0,0],h=cp(q);['x','y','z'].forEach((k,i)=>{if(k.toUpperCase() in w)h[k]=ref[i]-(wo[k]||0);});add(q,h,{rapid:true,cycle:'G28'},meta);p=h;continue;}
  if(gs.includes(53)){const wo=work[wcs]||{},q=cp(p);for(const k of ['X','Y','Z'])if(k in w)q[k.toLowerCase()]=w[k]*scale-(wo[k.toLowerCase()]||0);add(p,q,{rapid:true,cycle:'G53'},meta);p=q;continue;}
  if(gs.includes(10))continue;
  if(cycle){if(!['X','Y','Z','R'].some(k=>k in w))continue;// drilling cycle: position, R level, depth
   if('Z'in w)cyc.z=absolute?w.Z*scale:null;if('Z'in w&&!absolute)cyc.dz=w.Z*scale;if('R'in w)cyc.r=w.R*scale;if('Q'in w)cyc.q=Math.abs(w.Q)*scale;if('P'in w)cyc.p=w.P/1000;
   const q=cp(p);for(const k of ['X','Y'])if(k in w)q[k.toLowerCase()]=(absolute?0:p[k.toLowerCase()])+w[k]*scale;
   const init=cyc.init,R=absolute?cyc.r:init+(cyc.r||0),Z=absolute?cyc.z:R+(cyc.dz||0);if(R===undefined||Z===undefined||R===null||Z===null){warn(meta.line,'Drilling cycle needs R and Z; stopped.');break}
   if(!(F>0)){warn(meta.line,'Drilling cycle needs F; stopped.');break}
   const tag={cycle:'G'+cycle},seq=[];let at=cp(p);const go=(x,y,z,rapid,extra={})=>{const b={x,y,z};add(at,b,{rapid,...tag,...extra},meta);at=b;};
   go(q.x,q.y,p.z,true);go(q.x,q.y,R,true);
   if(cycle===83||cycle===73){const step=cyc.q||Math.abs(Z-R);let depth=R;const back=cycle===73?(P(5114)||0.5):null;while(depth>Z+1e-9){const nd=Math.max(Z,depth-step);if(depth!==R){go(q.x,q.y,cycle===83?depth+(P(5115)||0.5):depth+back,true);}go(q.x,q.y,nd,false);depth=nd;if(depth>Z+1e-9)go(q.x,q.y,cycle===83?R:depth+back,true);}}
   else go(q.x,q.y,Z,false,cycle===84?{kind:'feed',tap:true}:{});
   if((cycle===82||cycle===89||cycle===76||cycle===84)&&cyc.p)add(at,at,{rapid:false,kind:'dwell',dwell:cyc.p,...tag},meta);
   const up=ret===98?init:R;
   if(cycle===84||cycle===85||cycle===89){go(q.x,q.y,R,false);if(up!==R)go(q.x,q.y,up,true);}
   else if(cycle===76){const sh=cyc.q||0;go(q.x+sh,q.y,Z,true);go(q.x+sh,q.y,up,true);go(q.x,q.y,up,true);}
   else go(q.x,q.y,up,true);
   p=at;continue;}
  if(!['X','Y','Z','I','J','R'].some(k=>k in w))continue;
  if(motion===null){warn(meta.line,'No supported motion mode; stopped.');break}
  const q=cp(p);for(const k of ['X','Y','Z'])if(k in w)q[k.toLowerCase()]=(absolute?0:p[k.toLowerCase()])+w[k]*scale;
  if(Object.values(q).some(v=>!Number.isFinite(v)||Math.abs(v)>1e6)){warn(meta.line,'Coordinate outside viewer limit; stopped.');break}
  if(motion===0||motion===1){if('I'in w||'J'in w){warn(meta.line,'Unexpected arc word; stopped.');break}if(motion===1&&!(F>0)){warn(meta.line,'Feed move without F (alarm 011); stopped.');break}add(p,q,{},meta);}
  else{let cx,cy;
   if('R'in w&&!('I'in w)&&!('J'in w)){const R=w.R*scale,ch=Math.hypot(q.x-p.x,q.y-p.y);if(ch<1e-9||Math.abs(R)<ch/2-1e-4){warn(meta.line,'Arc radius too small for the end point (alarm 033); stopped.');break}const h=Math.sqrt(Math.max(0,R*R-ch*ch/4)),mx=(p.x+q.x)/2,my=(p.y+q.y)/2,ux=(q.x-p.x)/ch,uy=(q.y-p.y)/ch,side=(motion===2?1:-1)*(R>0?1:-1);cx=mx+uy*h*side;cy=my-ux*h*side;}
   else{if(!('I'in w)&&!('J'in w)){warn(meta.line,'Arc needs I/J or R; stopped.');break}cx=p.x+(w.I||0)*scale;cy=p.y+(w.J||0)*scale;}
   const r=Math.hypot(p.x-cx,p.y-cy),r2=Math.hypot(q.x-cx,q.y-cy);if(r<1e-9||Math.abs(r-r2)>Math.max(.001,r*.001)){warn(meta.line,'Arc endpoints do not match center; stopped.');break}
   if(!(F>0)){warn(meta.line,'Arc without F (alarm 011); stopped.');break}
   const a=Math.atan2(p.y-cy,p.x-cx),b=Math.atan2(q.y-cy,q.x-cx);let d=b-a;if(motion===2){while(d>=-1e-10)d-=Math.PI*2;}else{while(d<=1e-10)d+=Math.PI*2;}
   let prev=p,steps=arcSteps(r,d,0.01);for(let j=1;j<=steps;j++){const t=j/steps,v=j===steps?q:{x:cx+r*Math.cos(a+d*t),y:cy+r*Math.sin(a+d*t),z:p.z+(q.z-p.z)*t};add(prev,v,{rapid:false,kind:'feed'},meta);prev=v;}}
  p=q;if(s.length>16000){warn(meta.line,'Preview geometry limit reached.');break}}
 millCompensate(s,offsets,opt.tools||globalThis.tools,notes);
 millTiming(s,notes);
 return {s,notes};}
// Cutter radius compensation G41/G42 in the XY plane (start-up and cancel on linear moves).
function millCompensate(s,offsets,tools,notes){const G=globalThis.PathGeometry||(typeof require==='function'?require('../nc/geometry.js'):null);if(!G)return;
 let i=0;while(i<s.length){if(s[i].comp===40||s[i].kind==='stop'||s[i].kind==='dwell'||s[i].cycle){i++;continue;}
  const chain=[];let j=i;while(j<s.length){const q=s[j];if(q.kind==='stop'||q.kind==='dwell'){j++;continue;}if(q.cycle)break;if(q.comp===40){chain.push(q);j++;break;}chain.push(q);j++;}
  const first=chain.find(q=>q.comp!==40);if(!first){i=j;continue;}
  const o=offsets?.d?.[first.D];let R=o?(o.geom||0)+(o.wear||0):(tools?.get?.(first.tool)?.width||0)/2;if(!first.D)R=0;
  if(R){const side=first.comp===42?1:-1,endRaw=chain.at(-1).comp===40;const verts=[{a:chain[0].a.x,b:chain[0].a.y},...chain.map(q=>({a:q.b.x,b:q.b.y}))];
   const res=G.offsetChain(verts,side,Math.abs(R)*(R<0?-1:1),{startRaw:true,endRaw});if(res.interference.length)notes.push('Line '+chain[res.interference[0]].line+': cutter radius too large for this contour (interference, alarm 041)');
   // Replace each chain segment by its offset polyline (z interpolated).
   const rep=[];chain.forEach((q,k)=>{const pts=res.paths[k];for(let m=1;m<pts.length;m++){const t0=(m-1)/(pts.length-1),t1=m/(pts.length-1);rep.push({...q,a:{x:pts[m-1].a,y:pts[m-1].b,z:q.a.z+(q.b.z-q.a.z)*t0},b:{x:pts[m].a,y:pts[m].b,z:q.a.z+(q.b.z-q.a.z)*t1},programmed:{a:q.a,b:q.b}});}});
   const idx=s.indexOf(chain[0]),last=s.indexOf(chain.at(-1));const between=s.slice(idx,last+1).filter(q=>!chain.includes(q));s.splice(idx,last-idx+1,...rep,...between);i=idx+rep.length+between.length;}else i=j;}}
// Per-segment duration at 100% overrides and at F0 rapid override; dogleg rapids when 1401 bit1 = 0.
function millTiming(s,notes){
 const out=[];for(const g of s){if(g.kind==='stop'){g.t100=g.tF0=0;out.push(g);continue;}if(g.kind==='dwell'){g.t100=g.tF0=g.dwell;out.push(g);continue;}
  const {lrp,v,f0,fmax,trap,tfeed,smax}=g.pv;const d=[g.b.x-g.a.x,g.b.y-g.a.y,g.b.z-g.a.z],len=Math.hypot(...d);g.len=len;g.rpm=g.spindle===5?0:Math.min(g.S,smax);
  if(g.rapid){const tt=Math.max(...d.map((x,i)=>Math.abs(x)/v[i]))*60;
   if(!lrp&&len>0){const times=[...new Set(d.map((x,i)=>Math.abs(x)/v[i]).filter(t=>t>1e-12).map(t=>+t.toFixed(12)))].sort((a,b)=>a-b);if(times.length>1){let prev=g.a;for(const t of times){const q={x:g.a.x+Math.sign(d[0])*Math.min(Math.abs(d[0]),v[0]*t),y:g.a.y+Math.sign(d[1])*Math.min(Math.abs(d[1]),v[1]*t),z:g.a.z+Math.sign(d[2])*Math.min(Math.abs(d[2]),v[2]*t)};const part={...g,a:prev,b:q,dog:true};const dd=[q.x-prev.x,q.y-prev.y,q.z-prev.z];part.len=Math.hypot(...dd);part.t100=Math.max(...dd.map((x,i)=>Math.abs(x)/v[i]))*60;part.tF0=Math.max(...dd.map((x,i)=>Math.abs(x)/f0[i]))*60;out.push(part);prev=q;}out.at(-1).t100+=trap;continue;}}
   g.t100=tt+(len>0?trap:0);g.tF0=Math.max(...d.map((x,i)=>Math.abs(x)/f0[i]))*60+(len>0?trap:0);out.push(g);continue;}
  let f=g.feedMode===95?g.F*g.rpm:g.F;f=Math.min(f,fmax);g.perRev=g.feedMode===95;g.rate=f;
  if(!(f>0)){if(!s.warned){notes.push('Line '+g.line+': feed per revolution with spindle stopped; shown at 1 mm/s');s.warned=true;}f=60;}
  g.t100=len/f*60+(len>0?tfeed:0);g.tF0=g.t100;out.push(g);}
 s.length=0;s.push(...out);}
if(typeof module!=='undefined'&&module.exports)module.exports={parse};
