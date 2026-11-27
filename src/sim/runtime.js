'use strict';
// Shared playback clock for Milling and Turning: real-time sample durations with feed, rapid and
// spindle overrides, single block, M00/M01 stops and feed hold. Pure logic, no DOM.
(function(root){
const state={feedOv:100,rapidOv:100,spindleOv:100,singleBlock:false,optStop:false,blockSkip:true,budget:0};
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
function reset(){state.budget=0;}
function fmtTime(t){if(!Number.isFinite(t))return '—';const m=Math.floor(t/60),s=t-m*60;return (m?m+'m ':'')+s.toFixed(1)+'s';}
const api={state,duration,step,reset,fmtTime,LEGACY};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SimRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this);
