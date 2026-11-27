'use strict';
// Shared view gestures (mill 3D canvas and lathe XZ/revolved canvas).
// One pointer (mouse or one finger) keeps each view's own drag; two touch points pinch-zoom and pan.
// h: {one(dx,dy), two(k,px,py,dx,dy) with k = distance ratio and (px,py) = previous midpoint in canvas px, active(n)}
function viewGestures(el,h){const pts=new Map();let prev=null;
 const pair=()=>{const [a,b]=[...pts.values()],r=el.getBoundingClientRect();return {x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top,d:Math.hypot(a.x-b.x,a.y-b.y)};};
 const reset=()=>{prev=pts.size===2?pair():null;h.active?.(pts.size);};
 el.addEventListener('pointerdown',e=>{if(pts.size>=2)return;if(e.pointerType==='touch')e.preventDefault();pts.set(e.pointerId,{x:e.clientX,y:e.clientY});try{el.setPointerCapture(e.pointerId);}catch{}reset();});
 el.addEventListener('pointermove',e=>{const p=pts.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(pts.size===1){if(dx||dy)h.one(dx,dy);return;}const q=pair();if(prev&&prev.d>4&&q.d>4)h.two(q.d/prev.d,prev.x,prev.y,q.x-prev.x,q.y-prev.y);prev=q;});
 const up=e=>{if(pts.delete(e.pointerId))reset();};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);
 // Keep the browser from zooming or scrolling the page (touch-action:none is set in CSS too; Safari also needs these).
 const stop=e=>{if(e.cancelable)e.preventDefault();};el.addEventListener('touchstart',stop,{passive:false});el.addEventListener('touchmove',stop,{passive:false});
 for(const g of ['gesturestart','gesturechange','gestureend'])el.addEventListener(g,stop,{passive:false});}
// Zoom by k around screen point (px,py) for a view centred at base+pan: returns the new pan component.
function zoomPan(pan,base,p,k,d){return (p-base)-(p-base-pan)*k+d;}
if(typeof module!=='undefined')module.exports={zoomPan};
