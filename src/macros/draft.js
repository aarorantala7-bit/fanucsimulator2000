'use strict';
// Graphics-only playback. Never sends calculator values to the motion parser or stock engine.
const draftHeader='(GRAPHICS: ROSETTE)';
const parameterDraft={
  active:false,trace:[],at:0,running:false,carry:0,error:'',
  matches(source){return source.trimStart().split(/\r?\n/)[0].trim()===draftHeader;},
  load(source){
    this.running=false;this.carry=0;this.at=0;this.trace=[];this.error='';
    this.active=this.matches(source);
    if(!this.active)return false;
    try{this.trace=calculateParameters(source);}catch(e){this.error=e.message;}
    playing=false;macroRows=[];surfaceRevision++;
    install([],['Parameter graphics overlay only; stock and motion are unchanged.',...(this.error?[this.error]:[])],'graphics');
    this.renderHUD();return true;
  },
  reset(){if(!this.active)return;this.running=false;this.at=0;this.carry=0;this.renderHUD();dirty=true;},
  control(action,value){
    if(!this.active)return false;
    if(action==='play'){if(this.trace.length){if(this.at===this.trace.length)this.at=0;this.running=!this.running;this.carry=0;}}
    else{this.running=false;this.carry=0;if(action==='reset')this.at=0;else if(action==='step')this.at=Math.min(this.at+1,this.trace.length);else if(action==='seek')this.at=clamp(Math.trunc(value)||0,0,this.trace.length);}
    this.renderHUD();dirty=true;return true;
  },
  tick(dt){if(!this.active||!this.running)return;this.carry+=dt*10*Number($('speed').value);const n=Math.floor(this.carry);if(!n)return;this.carry-=n;this.at=Math.min(this.trace.length,this.at+n);if(this.at===this.trace.length)this.running=false;this.renderHUD();dirty=true;},
  renderHUD(){
    if(!this.active)return false;
    const row=this.trace[this.at-1];$('hud').textContent='PARAMETER GRAPHICS\nDISPLAY ONLY\n'+(this.running?'PLAYING':'PAUSED');
    $('currenttool').hidden=true;$('toollegend').hidden=true;
    $('counter').textContent=this.at+' / '+this.trace.length;$('seek').max=this.trace.length;$('seek').value=this.at;
    $('play').disabled=$('step').disabled=!this.trace.length;$('play').textContent=this.running?'Ⅱ Pause':'▶ Play';
    $('active').textContent=this.error|| (row?'CALCULATION · LINE '+row.line+' | '+row.code:'Parameter rosette · ready');
    $('variables').textContent=row?Object.entries(row.vars).map(([k,v])=>'#'+k+' = '+Number(v.toPrecision(8))+(row.descriptions[k]?' · '+row.descriptions[k]:'')).join('\n')||'—':'—';
    $('loops').textContent='Calculation steps only · '+this.at+' / '+this.trace.length;
    const tr=$('macrotrace');tr.dataset.idx='';tr.dataset.rev='';tr.textContent=row?this.trace.slice(Math.max(0,this.at-4),this.at+3).map(r=>r.line+' | '+r.code).join('\n'):'No calculation step selected.';
    return true;
  },
  draw(project,context,st){
    if(!this.active)return;
    const marks=galleryMarks(this.trace,this.at,'rosette');
    const span=Math.min(st.x1-st.x0,st.y1-st.y0)*.78/192;
    context.save();
    for(const m of marks){const a=Number((m.transform||'').match(/rotate\(([^ ]+)/)?.[1])*Math.PI/180;if(![a,m.cx,m.cy,m.rx,m.ry].every(Number.isFinite))continue;context.beginPath();for(let j=0;j<=40;j++){const t=j/40*Math.PI*2,xx=m.cx-160+m.rx*Math.cos(t),yy=m.cy-96+m.ry*Math.sin(t),q=project({x:st.cx+span*(xx*Math.cos(a)-yy*Math.sin(a)),y:st.cy+span*(xx*Math.sin(a)+yy*Math.cos(a)),z:st.extent*.002});if(j===0)context.moveTo(q.x,q.y);else context.lineTo(q.x,q.y);}context.closePath();context.globalAlpha=.75;context.fillStyle=m.fill;context.fill();}
    context.restore();
  }
};
globalThis.parameterDraft=parameterDraft;
$('draftdemo').onclick=()=>{$('source').value=draftHeader+'\n'+galleryExamples.rosette.source;$('load').click();};
