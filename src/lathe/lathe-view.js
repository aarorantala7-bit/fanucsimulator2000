'use strict';
// Turning workspace: XZ toolpath view, revolved part view, playback, lathe tool table and stock setup.
// Uses LatheSim (interpreter + stock model), SimRuntime (shared clock) and MachineState (tables).
(function setupLatheView(){
 const $=id=>document.getElementById(id);const MS=globalThis.MachineState,L=globalThis.LatheSim,RT=globalThis.SimRuntime;
 const vp=document.querySelector('.viewport');const cv=document.createElement('canvas');cv.id='lathecanvas';cv.hidden=true;cv.setAttribute('aria-label','Turning view');vp.append(cv);const g=cv.getContext('2d');
 const style=document.createElement('style');style.textContent='#lathecanvas{position:absolute;inset:0;width:100%;height:100%;z-index:1;background:#eef2f5;touch-action:none;cursor:grab}#lathecanvas[hidden]{display:none}.viewport .hud,.viewport .currenttool,.viewport .toollegend{z-index:2}.lathe-only{display:none!important}body[data-machine=lathe] .lathe-only{display:revert!important}body[data-machine=lathe] .mill-only{display:none!important}.ltool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px 10px;align-items:end}.ltool-grid label{display:flex;flex-direction:column;font-size:11px;gap:2px}.ltool-grid input,.ltool-grid select{width:100%;box-sizing:border-box}.ltool-card{border:1px solid #d3dce5;border-radius:6px;padding:8px;margin:8px 0;display:grid;grid-template-columns:1fr 150px;gap:10px}.ltool-card svg{width:150px;height:110px;background:#f4f7fa;border-radius:4px}.ltool-card h4{margin:0 0 6px;font-size:13px}.lstock-err{color:#b3261e;font-size:12px;min-height:1em}';document.head.append(style);
 const V={res:null,samples:[],position:0,playing:false,stock:null,view:'both',zoom:1,pan:{x:0,y:0},dirty:true,paths:null,stampCache:new Map(),lastLoad:''};
 globalThis.LatheView=V;
 const tools=()=>new Map(MS.lathe.tools.map(t=>[t.id,t]));
 function stockCfg(){return MS.lathe.stock;}
 // Auto stock for these segments (or the current stock when manual / nothing is cut).
 function stockFor(segs){const c=MS.lathe.stock;if(!V.autoStock)return c;const wa=RT.latheWorkArea(segs,RT.state.stockMargin);if(!wa)return c;const tube=c.type==='tube'&&c.bore>0&&c.bore<wa.od-0.5;const pl=RT.placeLatheStock(wa,c.zero,RT.state.stockMargin);return {...c,type:tube?'tube':'bar',bore:tube?c.bore:0,od:pl.od,length:pl.length,face:pl.face};}
 function newStock(){const c=stockCfg();return L.makeStock({od:c.od,bore:c.type==='tube'?c.bore:0,length:c.length,face:c.face});}
 V.load=function(text){RT.reset();if(V.demoO&&!RT.state.keepManualStock&&RT.programNumber(text)!==V.demoO){V.autoStock=true;V.demoO=null;}V.playing=false;const so={params:MS.lathe.params,offsets:MS.lathe.offsets,work:MS.lathe.work,tools:MS.lathe.tools,common:MS.common,blockSkip:RT.state.blockSkip,library:MS.library('lathe')};
  // G31: a first run on copies (skips at full distance) gives the stock the real run searches for contact.
  let skipStock=null;if(/\bG\s*0*31(?!\d)/i.test(text.replace(/\([^()]*\)/g,''))){const cl=o=>JSON.parse(JSON.stringify(o));const r1=L.simulate(text,{...so,params:new Map([...so.params].map(([k,v])=>[k,Array.isArray(v)?v.slice():v])),offsets:cl(so.offsets),work:cl(so.work),common:new Map(so.common)});const c=stockFor(r1.segs);skipStock={od:c.od,bore:c.type==='tube'?c.bore:0,length:c.length,face:c.face};}
  const r=L.simulate(text,{...so,skipStock});MS.persist();
  V.res=r;if(V.autoStock){const c=stockFor(r.segs);if(c!==MS.lathe.stock){MS.lathe.stock=c;MS.persist();}}V.stock=newStock();V.position=0;V.threads=L.threads(r,MS.lathe.tools);threadCache.clear();
  // Playback steps are NC blocks (one Step = one block); the tool position inside a block is time-based per frame.
  const S=RT.makeBlocks(r.segs);V.samples=S;V.live=null;V.cutAt={i:0,f:0};
  buildPaths();V.fit();
  const t=r.cycleTime;$('diagnostics').textContent=[`TURNING · ${r.segs.length} segments · cycle time ${RT.fmtTime(t)} (cutting ${RT.fmtTime(r.cutTime)}, rapid ${RT.fmtTime(r.rapidTime)}) · spindle ${r.rpmMin.toFixed(0)}–${r.rpmMax.toFixed(0)} rpm`,...r.notes].join('\n');
  $('seek').max=S.length;$('seek').value=0;$('play').disabled=$('step').disabled=!S.length;macroRowsSet(r.trace);V.hud(true);V.dirty=true;return r;};
 function macroRowsSet(trace){try{macroRows=trace||[];}catch{}}
 const colors=['#b07a16','#176ac2','#c44b36','#16836b','#8956b6','#b34b87','#347b98','#7b7e27','#a0522d','#2e7d32','#6a1b9a','#00838f','#c62828','#4e342e'];
 const toolColor=id=>colors[(id||0)%colors.length];
 function buildPaths(){const lines=RT.polylines(V.res.segs,s=>s.len===0?null:(s.rapid?'r':s.kind==='thread'?'t':'f')+s.tool,(s,k)=>[s[k].z,-s[k].x/2,0]);V.paths=[];for(const [key,ls] of lines){const s0=V.res.segs.find(s=>s.len!==0&&(s.rapid?'r':s.kind==='thread'?'t':'f')+s.tool===key);const path=new Path2D();for(const l of ls)l.forEach((q,j)=>j?path.lineTo(q[0],q[1]):path.moveTo(q[0],q[1]));V.paths.push({path,rapid:s0.rapid,thread:s0.kind==='thread',tool:s0.tool,vertices:ls.reduce((n,l)=>n+l.length,0)});}}
 V.fit=function(){const c=stockCfg();const zs=[c.face+5,c.face-c.length-10],rs=[c.od/2+8];if(V.res)for(const s of V.res.segs){if(Math.abs(s.b.z)<2000&&Math.abs(s.b.x)<2000){zs.push(s.b.z);rs.push(s.b.x/2);}}
  const zmin=Math.max(Math.min(...zs),c.face-c.length-40),zmax=Math.min(Math.max(...zs),c.face+120),rmax=Math.min(Math.max(...rs),c.od/2+90);V.box={zmin,zmax,rmax};V.zoom=1;V.pan={x:0,y:0};V.dirty=true;};
 function stampFor(s){const t=tools().get(s.tool);if(!t)return null;return L.stampFor(t,s.noseR,s.tipDir,V.stock.dz);}
 // Material removal follows V.cutAt ({i: segment, f: fraction}); a whole block is one sweep per segment.
 function cutSeg(k,f0,f1){const s=V.res.segs[k];if(!s||f1<=f0||s.rapid||!(s.len>0))return;const st=stampFor(s);if(!st)return;const at=f=>({a:s.ca.a+(s.cb.a-s.ca.a)*f,b:s.ca.b+(s.cb.b-s.ca.b)*f});L.sweep(V.stock,st,at(f0),at(f1),Math.max(V.stock.dz,0.05));}
 function cutTo(i,f){let k=V.cutAt.i,f0=V.cutAt.f;if(i<k||(i===k&&f<=f0))return;while(k<i){cutSeg(k,f0,1);k++;f0=0;}cutSeg(i,f0,f);V.cutAt={i,f};}
 function applyTo(target,keepLive){target=Math.max(0,Math.min(V.samples.length,target));if(!keepLive){V.live=null;RT.reset();}
  const end=target?{i:V.samples[target-1].i,f:1}:{i:0,f:0};if(end.i<V.cutAt.i||(end.i===V.cutAt.i&&end.f<V.cutAt.f)){V.stock=newStock();V.cutAt={i:0,f:0};}
  if(target)cutTo(end.i,1);V.position=target;V.dirty=true;}
 function setLive(t){if(V.position>=V.samples.length||t<=0){if(V.live){V.live=null;V.dirty=true;}return;}const Lc=RT.locate(V.samples[V.position],V.res.segs,t);V.live=Lc;cutTo(Lc.i,Lc.f);V.dirty=true;V.hudDue=true;}
 V.seek=function(n,defer,keepLive){applyTo(n,keepLive);V.hud(!defer);};
 V.current=function(){if(!V.res)return null;const b=V.position?V.samples[V.position-1]:null;const i=V.live?V.live.i:b?b.i:0,s=V.res.segs[i];if(!s)return null;const t=V.live?V.live.f:b?1:0;return {s,tip:{x:s.a.x+(s.b.x-s.a.x)*t,z:s.a.z+(s.b.z-s.a.z)*t},c:{a:s.ca.a+(s.cb.a-s.ca.a)*t,b:s.ca.b+(s.cb.b-s.ca.b)*t}};};
 V.elapsed=function(){let t=V.live?RT.state.budget:0;for(let k=0;k<V.position;k++)t+=RT.blockDuration(V.samples[k],V.res.segs);return t;};
 let hudT=0;
 V.hud=function(force){const now=performance.now();if(!force&&now-hudT<100){V.hudDue=true;return;}hudT=now;V.hudDue=false;const c=V.current();if(!c){$('hud').textContent='TURNING\nNo program';return;}const s=c.s,t=tools().get(s.tool);
  const sp=s.spindle===3?'CW (M03)':s.spindle===4?'CCW (M04)':'STOP (M05)';const rpm=s.spindle===5?0:s.rpm*RT.state.spindleOv/100;
  $('hud').textContent=`ABSOLUTE (WORK)\nX ${c.tip.x.toFixed(3)} (Ø)\nZ ${c.tip.z.toFixed(3)}\nT${String(s.tool).padStart(2,'0')}${String(s.off).padStart(2,'0')}  R${(s.noseR||0).toFixed(1)} T${s.tipDir??''}\nS ${rpm.toFixed(0)} rpm  ${sp}\n${s.rapid?'RAPID '+(RT.state.rapidOv==='F0'?'F0':RT.state.rapidOv+'%'):s.kind==='dwell'?'DWELL '+s.dwell.toFixed(2)+'s':'F '+(s.F||0)+(s.feedMode===99||s.kind==='thread'?' mm/rev':' mm/min')}\nTIME ${RT.fmtTime(V.elapsed())} / ${RT.fmtTime(V.res.cycleTime)}\n${s.skip?(s.skip.contact?'G31 SKIP · CONTACT':'G31 SKIP · NO CONTACT')+'\n':''}${V.playing?'CYCLE START':'STOP'}`;
  $('counter').textContent=`${V.position} / ${V.samples.length}`;$('seek').value=V.position;$('active').textContent=s.line?'LINE '+s.line+'  |  '+(s.raw||'')+(s.cycle?'  ['+s.cycle+']':''):'';$('play').textContent=V.playing?'Ⅱ Pause':'▶ Play';
  const ct=$('currenttool');ct.hidden=false;$('currenttoolname').textContent='T'+String(s.tool).padStart(2,'0')+' · '+(t?t.name:'not in tool table');$('currenttoolcolor').style.background=toolColor(s.tool);$('toollegend').hidden=true;globalThis.CncPanel?.refresh?.();};
 // ---------- drawing ----------
 function regionsFor(w,h){return V.view==='both'?[{x:0,y:0,w,h:h*.56,half:true,kind:'xz'},{x:0,y:h*.56,w,h:h*.44,kind:'rev'}]:[{x:0,y:0,w,h,half:false,kind:V.view}];}
 function view(w,h,box,region){const pad=28;const sx=(region.w-2*pad)/Math.max(1,box.zmax-box.zmin),sy=(region.h-2*pad)/Math.max(1,(region.half?1:2)*box.rmax);const sc=Math.min(sx,sy)*V.zoom;const cx=region.x+region.w/2+V.pan.x,cy=region.y+(region.half?region.h-pad-4:region.h/2)+V.pan.y;const zc=(box.zmin+box.zmax)/2;return {sc,X:z=>cx+(z-zc)*sc,Y:r=>cy-r*sc,cx,cy,zc};}
 function drawStockSection(T,stock,mirror,shaded){const n=stock.n,W=cv.clientWidth;const step=Math.max(1,Math.floor(n/Math.max(200,W*1.5)));const top=[],bot=[];
  for(let i=0;i<n;i+=step){let ro=0,ri=Infinity;for(let k=i;k<Math.min(n,i+step);k++){if(stock.ro[k]>stock.ri[k]){ro=Math.max(ro,stock.ro[k]);ri=Math.min(ri,stock.ri[k]);}}if(ri===Infinity)ri=ro=0;const z=stock.z0+(i+step/2)*stock.dz;top.push([z,ro]);bot.push([z,ri]);}
  const zA=stock.z0,zB=stock.z0+n*stock.dz;
  const shape=(sign)=>{g.beginPath();g.moveTo(T.X(zA),T.Y(sign*bot[0][1]));for(const [z,r] of top)g.lineTo(T.X(z),T.Y(sign*r));g.lineTo(T.X(zB),T.Y(sign*top.at(-1)[1]));for(let k=bot.length-1;k>=0;k--)g.lineTo(T.X(bot[k][0]),T.Y(sign*bot[k][1]));g.closePath();};
  for(const sign of mirror?[1,-1]:[1]){shape(sign);if(shaded){const maxR=stock.od/2;const gr=g.createLinearGradient(0,T.Y(sign*maxR),0,T.Y(0));gr.addColorStop(0,'#7d8894');gr.addColorStop(.35,'#e9eef2');gr.addColorStop(.55,'#c3ccd4');gr.addColorStop(1,'#8f9aa5');g.fillStyle=gr;}else g.fillStyle=sign>0?'#b9c4cf':'#d5dde4';g.fill();g.strokeStyle='#4f5e6c';g.lineWidth=1;g.stroke();}
  if(!shaded){g.save();g.strokeStyle='rgba(80,96,110,.28)';g.lineWidth=1;shape(1);g.clip();for(let x=T.X(zA)-400;x<T.X(zB)+400;x+=7){g.beginPath();g.moveTo(x,T.Y(stock.od/2+2));g.lineTo(x+60,T.Y(-2));g.stroke();}g.restore();}}
 function drawTool(T,c,s,full){const t=tools().get(s.tool);if(!t)return;const poly=L.toolOutline(t,s.noseR,s.tipDir);g.beginPath();poly.forEach((p,k)=>{const x=T.X(c.c.a+p.a),y=T.Y(c.c.b+p.b);k?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.fillStyle='rgba(246,212,75,.92)';g.fill();g.strokeStyle='#6b5410';g.lineWidth=1.2;g.stroke();
  // holder body on the insert's back side
  const up=(t.type==='id'||t.type==='thread-id')?-1:1;let amin=Infinity,amax=-Infinity,bfar=up>0?-Infinity:Infinity;for(const p of poly){amin=Math.min(amin,p.a);amax=Math.max(amax,p.a);bfar=up>0?Math.max(bfar,p.b):Math.min(bfar,p.b);}
  if(t.type==='id'||t.type==='thread-id'||t.type==='drill'){const r0=t.type==='drill'?(t.width||10)/2:Math.max(3,(t.minBore||16)/2-2);const z0=c.c.a+amax,z1=z0+60;g.fillStyle='rgba(90,104,118,.55)';const y0=t.type==='drill'?T.Y(c.c.b+r0):T.Y(c.c.b+(up<0?0:0)),y1=t.type==='drill'?T.Y(c.c.b-r0):T.Y(c.c.b-up*r0*1.6);if(t.type!=='drill')g.fillRect(T.X(c.c.a+amin+2),Math.min(y0,y1),T.X(z1)-T.X(c.c.a+amin+2),Math.abs(y1-y0));}
  else{const y0=T.Y(c.c.b+bfar),y1=T.Y(c.c.b+bfar+25);g.fillStyle='rgba(90,104,118,.55)';g.fillRect(T.X(c.c.a+amin),Math.min(y0,y1),Math.max(6,T.X(c.c.a+amax)-T.X(c.c.a+amin)),Math.abs(y1-y0));}
  g.beginPath();g.arc(T.X(c.tip.z),T.Y(c.tip.x/2),3,0,Math.PI*2);g.fillStyle='#d12f2f';g.fill();}
 // ---------- threads: cached Path2D in part coordinates (z, -r), drawn with one transform per frame ----------
 const threadCache=new Map();
 function threadState(th){const b=V.position?V.samples[V.position-1]:null,cur=V.live?V.live.i:b?b.i:-1;if(cur<th.first)return null;let root=null;for(const p of th.passes)if(p.i<=cur)root=root===null?p.x:th.id?Math.max(root,p.x):Math.min(root,p.x);return root===null?null:root;}
 function partTop(){const st=V.stock;let k=st.n-1;while(k>0&&st.ro[k]<=st.ri[k])k--;return st.z0+(k+1)*st.dz;}
 function threadPaths(th,root,zTop){const za=th.z0,zb=Math.min(th.z1,zTop);const key=[V.threads.indexOf(th),root,zb.toFixed(3)].join('|');let c=threadCache.get(key);if(c)return c;
  c={teeth:[new Path2D(),new Path2D()],crest:new Path2D(),rootL:new Path2D()};if(!(zb>za)){threadCache.set(key,c);return c;}
  const rr=root/2,rc=th.crest/2,depth=Math.abs(rc-rr),w2=Math.min(th.lead/2,depth*Math.tan(Math.PI/6)),P=th.lead;
  // teeth outline (60° V grooves at the lead, anchored at the thread start) between root and crest
  for(const [j,sg] of [[0,-1],[1,1]]){const path=c.teeth[j];path.moveTo(za,sg*rr);let z=za;const c0=th.z1-Math.ceil((th.z1-za)/P)*P;
   for(let g=c0;g<=zb+P;g+=P){const pts=[[g-w2,rc],[g,rr],[g+w2,rc]];for(const [zz,r] of pts){const zc=Math.max(za,Math.min(zb,zz));if(zc<z)continue;// clip to the threaded length
     path.lineTo(zc,sg*(zz<za||zz>zb?rr:r));z=zc;}}
   path.lineTo(zb,sg*rr);path.closePath();}
  // revolved view: front-half helix lines; crest light, root dark half a lead later
  const helix=(path,r,off)=>{for(let g=th.z1-Math.ceil((th.z1-za)/P)*P+off;g<=zb;g+=P){let first=true;for(let q=0;q<=12;q++){const th2=-Math.PI/2+Math.PI*q/12,zz=g+P*q/24,y=-r*Math.sin(th2);if(zz<za||zz>zb){first=true;continue;}first?path.moveTo(zz,y):path.lineTo(zz,y);first=false;}}};
  helix(c.crest,rc,0);helix(c.rootL,rr,P/2);threadCache.set(key,c);if(threadCache.size>64)threadCache.delete(threadCache.keys().next().value);return c;}
 function drawThreads(T,kind,mirror){if(!V.threads||!V.threads.length)return;const zTop=partTop();g.save();g.setTransform(dpr*T.sc,0,0,dpr*T.sc,dpr*(T.cx-T.zc*T.sc),dpr*T.cy);
  for(const th of V.threads){const root=threadState(th);if(root===null)continue;const c=threadPaths(th,root,zTop);
   if(kind==='xz'){for(const j of mirror?[0,1]:[0]){g.fillStyle=j?'#d5dde4':'#b9c4cf';g.fill(c.teeth[j]);g.strokeStyle='#4f5e6c';g.lineWidth=1/T.sc;g.stroke(c.teeth[j]);}}
   else{if(!th.id){for(const j of [0,1]){g.fillStyle='#b4bec8';g.fill(c.teeth[j]);g.strokeStyle='#4f5e6c';g.lineWidth=1/T.sc;g.stroke(c.teeth[j]);}
     g.lineWidth=1.3/T.sc;g.strokeStyle='rgba(255,255,255,.85)';g.stroke(c.crest);g.strokeStyle='rgba(55,68,80,.75)';g.stroke(c.rootL);}
    else{g.setLineDash([3/T.sc,3/T.sc]);g.lineWidth=1/T.sc;g.strokeStyle='rgba(55,68,80,.55)';g.stroke(c.rootL);g.setLineDash([]);}}}
  g.restore();}
 function drawPaths(T){if(!$('paths').checked)return;g.save();g.setTransform(dpr*T.sc,0,0,dpr*T.sc,dpr*(T.cx-T.zc*T.sc),dpr*T.cy);g.lineWidth=1.4/T.sc;for(const p of V.paths){g.strokeStyle=p.thread?'#8e24aa':toolColor(p.tool);g.globalAlpha=p.rapid?.55:.9;g.setLineDash(p.rapid?[5/T.sc,4/T.sc]:[]);g.stroke(p.path);}g.restore();g.setLineDash([]);g.globalAlpha=1;}
 function drawAxes(T,region){g.strokeStyle='#7a8794';g.setLineDash([12,4,2,4]);g.lineWidth=1;g.beginPath();g.moveTo(region.x,T.Y(0));g.lineTo(region.x+region.w,T.Y(0));g.stroke();g.setLineDash([]);
  const ox=T.X(0),oy=T.Y(0);g.strokeStyle='#c44b36';g.lineWidth=2;g.beginPath();g.moveTo(ox,oy);g.lineTo(ox+38,oy);g.stroke();g.strokeStyle='#176ac2';g.beginPath();g.moveTo(ox,oy);g.lineTo(ox,oy-38);g.stroke();g.font='12px monospace';g.fillStyle='#c44b36';g.fillText('+Z',ox+40,oy+4);g.fillStyle='#176ac2';g.fillText('+X',ox-8,oy-42);g.fillStyle='#43515f';g.fillText('W0',ox+3,oy+14);}
 function drawChuck(T,stock,mirror){const zb=stock.z0,jr=stock.od/2;g.fillStyle='#5b6672';for(const sign of mirror?[1,-1]:[1]){const y0=T.Y(sign*(jr+14)),y1=T.Y(sign*jr);g.fillRect(T.X(zb-22),Math.min(y0,y1),T.X(zb+12)-T.X(zb-22),Math.abs(y1-y0));}g.fillStyle='#3f4852';const y0=T.Y(jr+30),y1=T.Y(mirror?-(jr+30):0);g.fillRect(T.X(zb-60),Math.min(y0,y1),T.X(zb-22)-T.X(zb-60),Math.abs(y1-y0));}
 let dpr=1;
 V.draw=function(){if(cv.hidden)return;const w=cv.clientWidth,h=cv.clientHeight;dpr=Math.min(devicePixelRatio||1,2);if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);if(!V.stock)return;
  const box=V.box||{zmin:-80,zmax:10,rmax:30};const c=V.current();const regions=regionsFor(w,h);
  for(const R of regions){g.save();g.beginPath();g.rect(R.x,R.y,R.w,R.h);g.clip();const T=view(w,h,box,R);
   if(R.kind==='xz'){drawChuck(T,V.stock,!R.half);drawStockSection(T,V.stock,!R.half,false);drawThreads(T,'xz',!R.half);const sc=stockCfg();g.strokeStyle='rgba(30,40,50,.45)';g.setLineDash([4,3]);g.strokeRect(T.X(sc.face-sc.length),T.Y(sc.od/2),(sc.length)*T.sc,(sc.od/2-(sc.type==='tube'?sc.bore/2:0))*T.sc);g.setLineDash([]);drawAxes(T,R);drawPaths(T);if(c&&$('showTool').checked)drawTool(T,c,c.s,true);
    g.fillStyle='#33414f';g.font='600 11px Segoe UI,sans-serif';g.fillText('XZ SECTION · X shown as radius above the centreline · rapids dashed',R.x+10,R.y+16);}
   else{drawChuck(T,V.stock,true);drawStockSection(T,V.stock,true,true);drawThreads(T,'rev',true);g.strokeStyle='#7a8794';g.setLineDash([12,4,2,4]);g.beginPath();g.moveTo(R.x,T.Y(0));g.lineTo(R.x+R.w,T.Y(0));g.stroke();g.setLineDash([]);
    // front face ellipse for a revolved look
    const i=V.stock.n-1;let k=i;while(k>0&&V.stock.ro[k]<=V.stock.ri[k])k--;const zf=V.stock.z0+(k+1)*V.stock.dz,ro=V.stock.ro[k],ri=V.stock.ri[k];g.beginPath();g.ellipse(T.X(zf),T.Y(0),Math.max(1,ro*T.sc*.18),ro*T.sc,0,0,Math.PI*2);g.fillStyle='#d9e0e6';g.fill();g.strokeStyle='#4f5e6c';g.stroke();if(ri>0.01){g.beginPath();g.ellipse(T.X(zf),T.Y(0),Math.max(1,ri*T.sc*.18),ri*T.sc,0,0,Math.PI*2);g.fillStyle='#2c3640';g.fill();}
    if(c&&$('showTool').checked)drawTool(T,c,c.s,false);g.fillStyle='#33414f';g.font='600 11px Segoe UI,sans-serif';g.fillText('REVOLVED PART · '+(stockCfg().type==='tube'?'tube Ø'+stockCfg().od+' / Ø'+stockCfg().bore:'bar Ø'+stockCfg().od)+' × '+stockCfg().length,R.x+10,R.y+16);}
   g.restore();}
  if(V.view==='both'){g.strokeStyle='#c5ced7';g.beginPath();g.moveTo(0,h*.56);g.lineTo(w,h*.56);g.stroke();}};
 // ---------- interaction ----------
 // One finger / mouse pans (as before); two fingers pinch-zoom around their midpoint and pan, in the region under the fingers.
 viewGestures(cv,{one:(dx,dy)=>{V.pan.x+=dx;V.pan.y+=dy;V.dirty=true;},two:(k,px,py,dx,dy)=>{const z=Math.min(40,Math.max(.3,V.zoom*k)),kk=z/V.zoom;V.zoom=z;const R=regionsFor(cv.clientWidth,cv.clientHeight).find(r=>py>=r.y&&py<r.y+r.h)||regionsFor(cv.clientWidth,cv.clientHeight)[0];V.pan.x=zoomPan(V.pan.x,R.x+R.w/2,px,kk,dx);V.pan.y=zoomPan(V.pan.y,R.y+(R.half?R.h-28-4:R.h/2),py,kk,dy);V.dirty=true;}});
 cv.addEventListener('wheel',e=>{e.preventDefault();V.zoom=Math.min(40,Math.max(.3,V.zoom*Math.exp(-e.deltaY*.0012)));V.dirty=true;},{passive:false});cv.addEventListener('dblclick',()=>V.fit());
 new ResizeObserver(()=>V.dirty=true).observe(cv);
 let clock=0;function tick(now){const dt=Math.min(.1,(now-clock)/1000||0);clock=now;if(globalThis.simMode==='lathe'){if(V.playing&&V.res){const r=RT.stepBlocks(dt*Number($('speed').value),V.samples,V.res.segs,V.position);if(r.position!==V.position)V.seek(r.position,true,true);setLive(RT.state.budget);if(r.stop){V.playing=false;globalThis.onProgramStop?.(r.stop);V.hud(true);}}if(V.hudDue&&now-hudT>100)V.hud(true);if(V.dirty){V.dirty=false;V.draw();}}requestAnimationFrame(tick);}requestAnimationFrame(tick);
 V.play=()=>{if(!V.res)return;if(V.position>=V.samples.length)V.seek(0);V.playing=!V.playing;RT.reset();V.hud(true);};
 V.step=()=>{V.playing=false;if(V.position<V.samples.length)V.seek(V.position+1);};
 V.reset=()=>{V.playing=false;V.seek(0);};
 V.show=on=>{cv.hidden=!on;V.dirty=true;};
 // ---------- lathe stock dialog ----------
 const sd=document.createElement('dialog');sd.id='lathestockdialog';sd.innerHTML='<h2>Lathe stock (blank)</h2><section><div class="ltool-grid"><label>Type<select id="lst-type"><option value="bar">Solid bar</option><option value="tube">Tube / pipe</option></select></label><label>Outer diameter Ø<input id="lst-od" type="number" step="any" min="1" max="1000"></label><label>Bore diameter Ø (tube)<input id="lst-bore" type="number" step="any" min="0" max="999"></label><label>Length<input id="lst-len" type="number" step="any" min="1" max="2000"></label><label>Work zero Z0 (X0 = spindle centreline)<select id="lst-zero"><option value="face">Part face</option><option value="front">Stock front end</option><option value="custom">Custom</option></select></label><label>Stock front Z (face allowance)<input id="lst-face" type="number" step="any" min="-50" max="50"></label></div><div class="stockg54"><span>G54 work offset · same values as OFS/SET › WORK (machine position of the work zero)</span><label>X<input id="lst-g54x" type="number" step="any"></label><label>Z<input id="lst-g54z" type="number" step="any"></label></div><p class="lstock-err" id="lst-err"></p><p>The blank sits in the chuck with its face at the given Z (for example Z1 leaves 1 mm to face off). Applying resets playback.</p></section><div class="closebar"><button id="lst-apply" class="primary">Apply</button><button id="lst-auto">Auto size</button><button id="lst-default">Default</button><button data-close="lathestockdialog">Close</button></div>';document.body.append(sd);
 sd.querySelector('[data-close]').onclick=()=>sd.close();
 function stockValid(){const t=$('lst-type').value,od=+$('lst-od').value,b=+$('lst-bore').value,l=+$('lst-len').value,f=+$('lst-face').value;let err='';if(!(od>=1&&od<=1000))err='Outer diameter must be 1–1000 mm.';else if(t==='tube'&&!(b>0&&b<od-0.5))err='Bore must be greater than 0 and at least 0.5 mm below the outer diameter.';else if(!(l>=1&&l<=2000))err='Length must be 1–2000 mm.';else if(!(Math.abs(f)<=50))err='Face position must be within ±50 mm.';$('lst-err').textContent=err;$('lst-apply').disabled=!!err;$('lst-bore').disabled=t!=='tube';return !err;}
 sd.querySelector('.ltool-grid').insertAdjacentHTML('afterend','<div class="stockauto"><label>Auto size margin %<input id="lst-margin" class="stockmargin" type="number" min="0" max="200" step="1"></label><label><input id="lst-keep" class="stockkeep" type="checkbox"> Keep manual size when a program is opened</label></div>');
 for(const id of ['lst-type','lst-od','lst-bore','lst-len','lst-face'])sd.querySelector('#'+id).addEventListener('input',stockValid);
 V.openStock=()=>{const c=stockCfg();$('lst-type').value=c.type;$('lst-od').value=c.od;$('lst-bore').value=c.bore||Math.round(c.od*0.5);$('lst-len').value=c.length;$('lst-face').value=c.face;$('lst-zero').value=c.zero?.mode||'face';const w=MS.lathe.work[54]||{};$('lst-g54x').value=Number((w.x||0).toFixed(3));$('lst-g54z').value=Number((w.z||0).toFixed(3));zeroUi();stockValid();sd.showModal();};
 function zeroUi(){const m=$('lst-zero').value;if(m==='front')$('lst-face').value=0;$('lst-face').disabled=m==='front';}
 // G54 edits go to the same work offset table as the CNC panel (OFS/SET › WORK); the program is re-run when they change.
 function zeroSave(){const m=$('lst-zero').value;MS.lathe.stock={...MS.lathe.stock,zero:{mode:m,z:m==='custom'?+$('lst-face').value||0:0}};const w=MS.lathe.work[54]||(MS.lathe.work[54]={});let ch=false;for(const a of ['x','z']){const v=Number($('lst-g54'+a).value);if(Number.isFinite(v)&&v!==(w[a]||0)){w[a]=v;ch=true;}}MS.persist();if(ch)globalThis.CncPanel?.render?.();return ch;}
 sd.querySelector('#lst-zero').addEventListener('input',()=>{zeroUi();stockValid();});
 V.autoStock=false;V.demoO=null;V.setStock=(c)=>{V.autoStock=false;V.demoO=null;MS.lathe.stock={...MS.lathe.stock,...c};MS.persist();V.stock=newStock();V.cutAt={i:0,f:0};V.live=null;const p=V.position;V.position=0;applyTo(p);V.fit();V.hud(true);};
 $('lst-apply').onclick=()=>{if(!stockValid())return;const g54=zeroSave();V.setStock({type:$('lst-type').value,od:+$('lst-od').value,bore:$('lst-type').value==='tube'?+$('lst-bore').value:0,length:+$('lst-len').value,face:$('lst-zero').value==='front'?0:+$('lst-face').value});sd.close();if(g54){V.load($('source').value);V.fit();}};
 $('lst-auto').onclick=()=>{zeroSave();V.autoStock=true;sd.close();V.load($('source').value);V.fit();};
 $('lst-default').onclick=()=>{$('lst-type').value='bar';$('lst-od').value=50;$('lst-bore').value=25;$('lst-len').value=80;$('lst-face').value=1;stockValid();};
 // ---------- lathe tool table ----------
 const td=document.createElement('dialog');td.id='lathetooldialog';td.style.width='min(900px,calc(100vw - 24px))';td.innerHTML='<h2>Lathe tool table</h2><section><p>Edits apply immediately: the insert outline, nose radius compensation and material removal all use these values. Nose radius R and tip T are the geometry offset values of the matching offset number (T0101 → offset 01). Saved in this browser.</p><div id="ltools"></div></section><div class="closebar"><button id="ltool-reset">Reset to defaults</button><button data-close="lathetooldialog">Close</button></div>';document.body.append(td);td.querySelector('[data-close]').onclick=()=>td.close();
 const INS=globalThis.MachineData.INSERTS;
 function svgFor(t){const poly=L.toolOutline(t,t.noseR,t.tip);let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;for(const p of poly){a0=Math.min(a0,p.a);a1=Math.max(a1,p.a);b0=Math.min(b0,p.b);b1=Math.max(b1,p.b);}const sc=Math.min(130/(a1-a0||1),90/(b1-b0||1));const pts=poly.map(p=>((p.a-a0)*sc+10).toFixed(1)+','+(100-(p.b-b0)*sc).toFixed(1)).join(' ');const ox=(0-a0)*sc+10,oy=100-(0-b0)*sc;const tv=L.TIPV[t.tip]||[0,0];const tx=ox+tv[1]*t.noseR*sc,ty=oy-tv[0]*t.noseR*sc;return `<polygon points="${pts}" fill="#f6d44b" stroke="#6b5410"/><circle cx="${ox}" cy="${oy}" r="2" fill="#176ac2"/><circle cx="${tx}" cy="${ty}" r="3" fill="#d12f2f"/><text x="4" y="12" font-size="9" fill="#33414f">blue: nose centre · red: imaginary tip T${t.tip}</text>`;}
 function changed(){MS.persist();if(globalThis.simMode==='lathe')$('load').click();}
 V.renderTools=function(){const box=$('ltools');box.replaceChildren();for(const t of MS.lathe.tools){const card=document.createElement('div');card.className='ltool-card';const left=document.createElement('div');left.innerHTML=`<h4>T${String(t.id).padStart(2,'0')} · ${t.name}</h4>`;const grid=document.createElement('div');grid.className='ltool-grid';left.append(grid);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 150 110');svg.innerHTML=svgFor(t);card.append(left,svg);box.append(card);
   const off=()=>MS.lathe.offsets.geom[t.id]||(MS.lathe.offsets.geom[t.id]={x:0,z:0,r:t.noseR,t:t.tip});
   const field=(label,key,kind,opts)=>{const l=document.createElement('label');l.textContent=label;let el;if(kind==='select'){el=document.createElement('select');for(const [v,n] of opts)el.add(new Option(n,v));}else{el=document.createElement('input');el.type=kind;if(kind==='number')el.step='any';if(opts)el.setAttribute('list',opts);}el.value=t[key]??'';el.setAttribute('aria-label','T'+t.id+' '+label);
    el.onchange=()=>{let v=kind==='number'?Number(el.value):el.value;if(kind==='number'&&!Number.isFinite(v)){el.value=t[key];return;}if(key==='tip')v=Math.max(0,Math.min(9,Math.round(Number(v))));if(key==='noseR')v=Math.max(0,Math.min(25,v));t[key]=v;
     if(key==='shape'&&INS[v]){t.angle=INS[v].angle;t.kappa=INS[v].kappa;}if(key==='noseR')off().r=v;if(key==='tip')off().t=v;V.renderTools();changed();};l.append(el);grid.append(l);};
   field('Name','name','text');field('Type','type','select',[['od','OD turning'],['id','ID boring'],['groove','Grooving'],['part','Parting'],['thread-od','OD threading'],['thread-id','ID threading'],['drill','Drill']]);
   if(t.type==='od'||t.type==='id')field('Insert shape','shape','select',Object.entries(INS).map(([k,v])=>[k,v.label]));
   if(t.type!=='groove'&&t.type!=='part'&&t.shape!=='R')field(t.type.startsWith('thread')?'Thread angle °':t.type==='drill'?'Point angle °':'Insert angle °','angle','number');
   if(t.type==='od'||t.type==='id')field('Holder entering angle κr °','kappa','number');
   if(t.type!=='drill')field('Nose radius R','noseR','number','nose-radii');
   field('Tip direction T (0-9)','tip','select',[0,1,2,3,4,5,6,7,8,9].map(n=>[n,'T'+n]));
   field(t.type==='drill'?'Flute length':'Edge length','edge','number');
   if(t.type==='groove'||t.type==='part'||t.type==='drill')field(t.type==='drill'?'Diameter':'Width','width','number');
  }};
 const dl=document.createElement('datalist');dl.id='nose-radii';for(const r of [0.1,0.2,0.4,0.8,1.2,1.6])dl.append(new Option(String(r)));document.body.append(dl);
 $('ltool-reset').onclick=()=>{MS.resetTools('lathe');V.renderTools();changed();};
 V.openTools=()=>{V.renderTools();td.showModal();};
})();
