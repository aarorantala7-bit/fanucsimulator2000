'use strict';
// Shared playback clock for Milling and Turning: real-time sample durations with feed, rapid and
// spindle overrides, single block, M00/M01 stops and feed hold. Pure logic, no DOM.
(function(root){
const state={stockMargin:10,keepManualStock:false,feedOv:100,rapidOv:100,spindleOv:100,singleBlock:false,optStop:false,blockSkip:true,budget:0};
const LEGACY=1/55;// samples per second used by the original viewer for programs without timing
function duration(sample,seg){if(!seg)return LEGACY;if(seg.t100===undefined)return LEGACY;const n=sample.n||1;
 if(seg.kind==='stop')return 0;if(seg.kind==='dwell')return seg.t100/n;
 if(seg.rapid){if(state.rapidOv==='F0'||state.rapidOv===0)return (seg.tF0??seg.t100)/n;return seg.t100/n/(state.rapidOv/100);}
 if(seg.kind==='thread')return seg.t100/n/(state.spindleOv/100);// feed override is ignored while threading
 if(state.feedOv<=0)return Infinity;let t=seg.t100/n/(state.feedOv/100);if(seg.perRev)t/=state.spindleOv/100;return t;}
// Advance by dt seconds of simulated time. Returns {position, stop} where stop is a reason or null.
function step(dt,samples,segs,position){state.budget+=dt;let stop=null,guard=0;const startLine=position>0?segs[samples[position-1].i]?.line:null;
 while(position<samples.length&&guard++<50000){const s=samples[position],seg=segs[s.i],d=duration(s,seg);if(d===Infinity){stop='feed-zero';state.budget=0;break;}if(state.budget<d)break;state.budget-=d;position++;
  if(seg&&seg.kind==='stop'&&s.last!==false){if(seg.stop==='M00'||seg.stop==='message'||(seg.stop==='M01'&&state.optStop)){stop=seg.stop;state.budget=0;break;}if(seg.stop==='end'){stop='end';break;}}
  if(state.singleBlock&&position<samples.length){const next=segs[samples[position].i];if(next&&seg&&next.line!==seg.line&&s.last!==false){stop='single-block';state.budget=0;break;}}}
 if(position>=samples.length){stop=stop||'end';state.budget=0;}return {position,stop};}
// ---- Block playback: one step = one NC block; the position inside a block is time-based per frame. ----
// blocks: [{i0,i}] = first/last segment index of each executed block. position = completed blocks;
// state.budget = seconds already spent inside block `position`.
function segDuration(seg){if(!seg)return 0;if(seg.t100===undefined)return LEGACY*Math.max(1,Math.ceil((seg.len??Math.hypot(seg.b.x-seg.a.x,(seg.b.y||0)-(seg.a.y||0),seg.b.z-seg.a.z))/1.5));return duration({n:1},seg);}
function blockDuration(block,segs){let t=0;for(let k=block.i0;k<=block.i;k++){const d=segDuration(segs[k]);if(d===Infinity)return Infinity;t+=d;}return t;}
function makeBlocks(segs){const out=[];let cur=null;for(let k=0;k<segs.length;k++){const s=segs[k],key=s.line+'|'+(s.traceIndex??'')+'|'+(s.cycleLine??'');if(!cur||cur.key!==key){cur={i0:k,i:k,key};out.push(cur);}else cur.i=k;}return out;}
function stepBlocks(dt,blocks,segs,position){state.budget+=dt;let stop=null,guard=0;
 while(position<blocks.length&&guard++<50000){const b=blocks[position],d=blockDuration(b,segs);if(d===Infinity){stop='feed-zero';break;}if(state.budget<d)break;state.budget-=d;position++;
  for(let k=b.i0;k<=b.i;k++){const seg=segs[k];if(seg.kind!=='stop')continue;if(seg.stop==='M00'||seg.stop==='message'||(seg.stop==='M01'&&state.optStop))stop=seg.stop;else if(seg.stop==='end')stop='end';}
  if(stop){state.budget=0;break;}
  if(state.singleBlock&&position<blocks.length){stop='single-block';state.budget=0;break;}}
 if(position>=blocks.length){stop=stop||'end';state.budget=0;}return {position,stop};}
// Where the tool is `t` seconds into a block: {i: segment index, f: fraction 0..1 along it}.
function locate(block,segs,t){for(let k=block.i0;k<=block.i;k++){const d=segDuration(segs[k]);if(t<d&&d>0)return {i:k,f:Math.max(0,Math.min(1,t/d))};t-=d;}return {i:block.i,f:1};}
// Rendering: consecutive segments of the same group become polylines and collinear pieces (split arcs aside)
// collapse to one straight segment. get(seg) -> [x,y,z]. Returns Map(group -> [[p0,p1,...], ...]).
function polylines(segs,group,get){const out=new Map(),last=new Map();
 for(const s of segs){const g=group(s);if(g===null)continue;const a=get(s,'a'),b=get(s,'b');let lines=out.get(g);if(!lines)out.set(g,lines=[]);const L=last.get(g);
  const same=L&&L.seg===L.line.length&&Math.abs(L.end[0]-a[0])+Math.abs(L.end[1]-a[1])+Math.abs((L.end[2]||0)-(a[2]||0))<1e-9;
  if(!same){const line=[a,b];lines.push(line);last.set(g,{line,end:b,seg:2});continue;}
  const line=L.line,p=line[line.length-2],q=line[line.length-1];const u=[q[0]-p[0],q[1]-p[1],(q[2]||0)-(p[2]||0)],v=[b[0]-q[0],b[1]-q[1],(b[2]||0)-(q[2]||0)];
  const cx=u[1]*v[2]-u[2]*v[1],cy=u[2]*v[0]-u[0]*v[2],cz=u[0]*v[1]-u[1]*v[0],nu=Math.hypot(...u),nv=Math.hypot(...v),dot=u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
  if(nu>0&&nv>0&&dot>0&&Math.hypot(cx,cy,cz)<=1e-6*nu*nv)line[line.length-1]=b;else line.push(b);L.end=b;L.seg=line.length;}
 return out;}
// ---- Auto stock (blank) sizing from the cutting moves only ----
// Ignores rapids, G28/G53/home moves and feed moves entirely above Z0 (approach/retract); adds the tool radius.
// pct: how much larger than the work area the blank is (each dimension). Returns null when nothing cuts.
function millWorkArea(segs,radiusOf,pct=10){let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,n=0;
 for(const s of segs){if(s.rapid||s.kind==='stop'||s.kind==='dwell'||(s.cycle&&/G28|G30|G53/.test(s.cycle)))continue;if(Math.min(s.a.z,s.b.z)>0)continue;const r=Math.max(0,radiusOf(s.tool)||0);
  for(const p of [s.a,s.b]){x0=Math.min(x0,p.x-r);x1=Math.max(x1,p.x+r);y0=Math.min(y0,p.y-r);y1=Math.max(y1,p.y+r);}z0=Math.min(z0,s.a.z,s.b.z);n++;}
 if(!n)return null;const k=pct/200,px=Math.max(1,(x1-x0)*k),py=Math.max(1,(y1-y0)*k),depth=Math.max(1,-z0)*(1+pct/100);
 return {x0:x0-px,x1:x1+px,y0:y0-py,y1:y1+py,depth,work:{x:x1-x0,y:y1-y0,z:Math.max(0,-z0)}};}
// Lathe: OD = largest cut diameter + pct, length from the cut Z range (Z0 = finished face) + pct, face allowance pct/2.
// Program number (first O-line) so demo stock can follow its own demo only.
function programNumber(text){const m=/^\s*[O:](\d+)/mi.exec(String(text||''));return m?'O'+Number(m[1]):null;}
function latheWorkArea(segs,pct=10){let xmax=0,zmin=Infinity,n=0;
 for(const s of segs){if(s.rapid||(s.kind!=='feed'&&s.kind!=='thread')||(s.cycle&&/G28|G30|G53/.test(s.cycle)))continue;xmax=Math.max(xmax,s.a.x,s.b.x);zmin=Math.min(zmin,s.a.z,s.b.z);n++;}
 if(!n||!(xmax>0))return null;const work=Math.max(1,-Math.min(0,zmin)),round=v=>Math.ceil(v*2)/2;
 return {od:round(xmax*(1+pct/100)),length:round(work*(1+pct/100)),face:round(Math.max(0.5,work*pct/200)),work:{od:xmax,length:work}};}
function reset(){state.budget=0;}
function fmtTime(t){if(!Number.isFinite(t))return '—';const m=Math.floor(t/60),s=t-m*60;return (m?m+'m ':'')+s.toFixed(1)+'s';}
const api={state,duration,step,reset,fmtTime,LEGACY,segDuration,blockDuration,makeBlocks,stepBlocks,locate,polylines,millWorkArea,latheWorkArea,programNumber};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SimRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this);
