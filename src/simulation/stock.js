'use strict';
// Height-field blank in work coordinates. The work zero on the blank comes from SimRuntime.state.millZero (default:
// X0 Y0 at the centre, Z0 on the top surface); `top` is the uncut surface height.
function blankFrom(b,maxZ,auto){const x=b.x1-b.x0,y=b.y1-b.y0,extent=Math.max(x,y,10),nx=clamp(Math.ceil(x/extent*320),10,320),ny=clamp(Math.ceil(y/extent*320),10,320),h=new Float32Array(nx*ny);if(b.top)h.fill(b.top);
 return {x0:b.x0,x1:b.x1,y0:b.y0,y1:b.y1,nx,ny,dx:x/nx,dy:y/ny,top:b.top,bottom:b.bottom,maxZ:Math.min(maxZ,extent*.6),extent,cx:(b.x0+b.x1)/2,cy:(b.y0+b.y1)/2,h,auto,outside:b.outside};}
function makeStock(){const zero=SimRuntime.state.millZero;if(stockConfig){const {x,y,z}=stockConfig;let maxZ=0;for(const s of segs)if(!s.cycle||!/G28|G53/.test(s.cycle))maxZ=Math.max(maxZ,s.a.z,s.b.z);return blankFrom(SimRuntime.placeMillStock({x,y,z},null,stockConfig.demo?null:zero),maxZ);}// Auto size: cutting moves only (+ tool radius), then the user's margin (SimRuntime.state.stockMargin, default 10 %).
 const wa=SimRuntime.millWorkArea(segs,id=>((tools.get(id)||(typeof toolDefaults==='function'?toolDefaults(id):null)||{width:5}).width||5)/2,SimRuntime.state.stockMargin);
 if(wa){let mz=0;for(const s of segs)if(!s.cycle||!/G28|G53/.test(s.cycle))mz=Math.max(mz,s.a.z,s.b.z);return blankFrom(SimRuntime.placeMillStock(null,wa,zero),mz,wa);}
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=0,maxZ=0;for(const s of segs){if(s.cycle&&/G28|G53/.test(s.cycle))continue;for(const p of [s.a,s.b]){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)}}if(!segs.length){minX=minY=-25;maxX=maxY=25;}const pad=Math.max(8,Math.max(maxX-minX,maxY-minY)*.12);const x0=minX-pad,x1=maxX+pad,y0=minY-pad,y1=maxY+pad;const extent=Math.max(x1-x0,y1-y0,10);const nx=clamp(Math.ceil((x1-x0)/extent*320),10,320),ny=clamp(Math.ceil((y1-y0)/extent*320),10,320);return {x0,x1,y0,y1,nx,ny,dx:(x1-x0)/nx,dy:(y1-y0)/ny,bottom:Math.min(minZ-4,-extent*.12),maxZ:Math.min(maxZ,extent*.6),extent,cx:(x0+x1)/2,cy:(y0+y1)/2,h:new Float32Array(nx*ny)}}
// Playback steps are NC blocks (SimRuntime.makeBlocks): one Step = one block. `live` is the time-based
// position inside the running block ({i,f,p}); `cutAt` is how far material has been removed ({i,f}).
let live=null,cutAt={i:0,f:0};
function makeSamples(){samples=SimRuntime.makeBlocks(segs);for(const b of samples){b.p=segs[b.i].b;b.n=1;}live=null;cutAt={i:0,f:0};}
// Current tool point and segment for the renderer, HUD and CNC panel.
function playhead(){if(live)return {s:segs[live.i],p:live.p,i:live.i};const b=position?samples[position-1]:null;const s=b?segs[b.i]:segs[0];return {s,p:b?b.p:s?s.a:null,i:b?b.i:0};}
// Continuous swept 2D profile for the virtual surface. No machine control or process physics.
// Material removal for a piece of one segment (fractions f0..f1); a whole block is a few calls, not one per sample.
function cutSeg(k,f0,f1){const s=segs[k];if(!s||f1<=f0)return;cutPiece(s,f0<=0?s.a:lerp(s.a,s.b,f0),f1>=1?s.b:lerp(s.a,s.b,f1));}
function cutTo(i,f){let k=cutAt.i,f0=cutAt.f;if(i<k||(i===k&&f<=f0))return;while(k<i){cutSeg(k,f0,1);k++;f0=0;}cutSeg(i,f0,f);cutAt={i,f};}
function cutPiece(s,a,b){
  const t=tools.get(s.tool);
  if(s.rapid||s.len===0||!t||isVisualOnlyTool(t)||Math.min(a.z,b.z)>=(stock.top||0))return;
  const r=t.width/2,rr=r*r,st=stock,vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z,ll=vx*vx+vy*vy;
  const loX=clamp(Math.floor((Math.min(a.x,b.x)-r-st.x0)/st.dx),0,st.nx-1),hiX=clamp(Math.floor((Math.max(a.x,b.x)+r-st.x0)/st.dx),0,st.nx-1),loY=clamp(Math.floor((Math.min(a.y,b.y)-r-st.y0)/st.dy),0,st.ny-1),hiY=clamp(Math.floor((Math.max(a.y,b.y)+r-st.y0)/st.dy),0,st.ny-1);
  const cr=clamp(t.corner||1,.0001,r), profile=d2=>t.shape==='ball'?r-Math.sqrt(Math.max(0,rr-d2)):t.shape==='point'?Math.sqrt(d2)/r*t.tip:t.shape==='round'?cr-Math.sqrt(Math.max(0,cr*cr-Math.max(0,Math.sqrt(d2)-(r-cr))**2)):0;
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
    const k=y*st.nx+x;const next=Math.fround(Math.max(st.bottom,Math.min(st.h[k],z)));if(next!==st.h[k]){st.h[k]=next;surfaceRevision++;}
  }
}
function rebuildStock(target){stock.h.fill(stock.top||0);surfaceRevision++;position=0;cutAt={i:0,f:0};live=null;advance(target);dirty=true;}
// Jump to the end of block `target` (step, seek, reset); playback passes keepLive so the in-block position stays.
function advance(target,deferHUD,keepLive){target=clamp(target,0,samples.length);if(!keepLive){live=null;SimRuntime.reset();}
 const end=target?{i:samples[target-1].i,f:1}:{i:0,f:0};if(end.i<cutAt.i||(end.i===cutAt.i&&end.f<cutAt.f)){stock.h.fill(stock.top||0);surfaceRevision++;cutAt={i:0,f:0};}
 if(target)cutTo(end.i,1);position=target;dirty=true;if(deferHUD)hudDue=true;else updateHUD();}
// Per frame while playing: the tool point inside block `position`, `t` seconds into it; material follows it.
function setLive(t){if(position>=samples.length||t<=0){if(live){live=null;dirty=true;}return;}const L=SimRuntime.locate(samples[position],segs,t);const s=segs[L.i];live={i:L.i,f:L.f,p:lerp(s.a,s.b,L.f)};cutTo(L.i,L.f);dirty=true;hudDue=true;}
function install(s,notes,m){// A demo's stock only follows that demo: another program (pasted or opened) gets auto-sized stock.
 if(stockConfig&&stockConfig.demo&&!SimRuntime.state.keepManualStock&&SimRuntime.programNumber($('source').value)!==stockConfig.demo)stockConfig=null;
 $('macrotrace').dataset.idx='';playing=false;mode=m;segs=s;const old=tools;buildTools(old);stock=makeStock();makeSamples();position=0;zoom=1;const diagnostic=[`${segs.length} path segments · ${samples.length} blocks · ${tools.size} virtual tools`,...notes];$('diagnostics').textContent=diagnostic.join('\n');$('seek').max=samples.length;$('play').disabled=$('step').disabled=!samples.length;updateHUD();dirty=true;}
