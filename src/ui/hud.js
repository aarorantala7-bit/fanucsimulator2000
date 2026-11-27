'use strict';
function updateHUD(){const ph=playhead(),seg=ph.s,p=ph.p||{x:0,y:0,z:0};$('hud').textContent=`VIRTUAL POSITION\nX ${p.x.toFixed(2)}\nY ${p.y.toFixed(2)}\nZ ${p.z.toFixed(2)}\nTOOL ${seg?'T'+seg.tool:'—'}\n${seg?.skip?(seg.skip.contact?'G31 SKIP · CONTACT':'G31 SKIP · NO CONTACT')+'\n':''}${playing?'PLAYING':'PAUSED'}`;updateToolHUD(seg);$('counter').textContent=`${position} / ${samples.length}`;$('seek').value=position;$('active').textContent=seg?(seg.line?'LINE '+seg.line+'  |  '+seg.raw:'DEMO  |  '+seg.raw):'No path loaded';$('play').textContent=playing?'Ⅱ Pause':'▶ Play';const idx=seg?.traceIndex;const t=macroRows[idx];$('variables').textContent=t?Object.entries(t.vars).map(([k,v])=>k+' = '+v).join('\n')||'—':'—';$('loops').textContent=t?t.loops.join('\n')||'—':'—';const trace=$('macrotrace');if(trace.dataset.idx!==String(idx)||trace.dataset.rev!==String(macroRows.length)){trace.dataset.idx=String(idx);trace.dataset.rev=String(macroRows.length);trace.replaceChildren();if(!t){trace.textContent='No macro loaded.';}else for(let k=Math.max(0,idx-4);k<Math.min(macroRows.length,idx+5);k++){const d=document.createElement('div');d.textContent=(k===idx?'▶ ':'  ')+macroRows[k].line+' | '+macroRows[k].expanded;if(k===idx)d.className='current';trace.append(d);}}}

let toolLegendSignature='';
function updateToolHUD(seg){
  const current=$('currenttool'),swatch=$('currenttoolcolor'),label=$('currenttoolname');
  current.hidden=!seg;
  if(seg){const name='T'+seg.tool+' · '+toolDisplayName(seg.tool);label.textContent=name;label.title=name;swatch.style.background=toolPathColor(seg.tool);}
  const legend=$('toollegend'),ids=[...new Set(segs.map(s=>s.tool))].sort((a,b)=>a-b);
  const visible=$('paths').checked&&ids.length>0;legend.hidden=!visible;
  if(!visible)return;
  const key=JSON.stringify(ids.map(id=>[id,toolDisplayName(id)]));if(key===toolLegendSignature)return;toolLegendSignature=key;
  legend.replaceChildren();for(const id of ids){const chip=document.createElement('span'),dot=document.createElement('i');dot.style.background=toolPathColor(id);chip.append(dot,document.createTextNode('T'+id+' · '+toolDisplayName(id)));legend.append(chip);}
  const hint=document.createElement('small');hint.textContent='Solid: path · dashed: rapid';legend.append(hint);
}
