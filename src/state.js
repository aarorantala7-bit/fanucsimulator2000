'use strict'; const $=id=>document.getElementById(id), canvas=$('canvas'), ctx=canvas.getContext('2d');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)); const copy=p=>({...p}); const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
let segs=[],samples=[],tools=new Map(),stock=null,position=0,playing=false,clock=0,carry=0,yaw=-.68,pitch=.68,zoom=1,panX=0,panY=0,drag=null,mode='demo',dirty=true;
let macroRows=[],macroState=[],stockConfig=null;
let surfaceRevision=0;
