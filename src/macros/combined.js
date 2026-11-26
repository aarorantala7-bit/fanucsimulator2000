'use strict';
// Abstract graphics statements and arithmetic share a timeline, never the CNC parser.
const combinedHeader='(GRAPHICS: COMBINED DEMO)';
const combinedExample=combinedHeader+'\n#1 = 6 (Columns)\n#2 = 4 (Rows)\n#3 = 205 (Starting hue)\n#4 = 15 (Color increment)\n#5 = 0 (Row index)\nDRAW FRAME\nWHILE [#5 LT #2] DO1\n#6 = 0 (Column index)\nWHILE [#6 LT #1] DO2\nDRAW TILE\n#3 = [#3 + #4]\n#6 = [#6 + 1]\nEND2\n#5 = [#5 + 1]\nEND1\nDRAW COMPLETE';
const combinedDemo={active:false,
  draw(project,c,st,trace,at){
    const rows=trace.slice(0,at),frame=rows.find(r=>r.code==='DRAW FRAME');if(!frame)return;
    const count=v=>clamp(Math.trunc(v)||1,1,16),cols=count(frame.vars[1]),nrows=count(frame.vars[2]);
    const width=(st.x1-st.x0)*.76,length=(st.y1-st.y0)*.76,dx=width/cols,dy=length/nrows,x0=st.cx-width/2,y0=st.cy-length/2,z=st.extent*.003;
    const quad=(x,y,w,h)=>{const ps=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([x,y])=>project({x,y,z}));c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();};
    c.save();quad(x0,y0,width,length);c.fillStyle='#e9eff5';c.fill();c.strokeStyle='#55758f';c.lineWidth=1.5;c.stroke();
    for(const r of rows){if(r.code!=='DRAW TILE')continue;const row=Math.trunc(r.vars[5]),col=Math.trunc(r.vars[6]);if(!Number.isFinite(row)||!Number.isFinite(col)||row<0||col<0||row>=nrows||col>=cols)continue;const hue=((r.vars[3]||0)%360+360)%360;quad(x0+(col+.05)*dx,y0+(row+.05)*dy,.9*dx,.9*dy);c.fillStyle=`hsl(${hue} 62% 52%)`;c.fill();c.strokeStyle='#ffffffa0';c.lineWidth=.6;c.stroke();}
    if(rows.some(r=>r.code==='DRAW COMPLETE')){quad(x0,y0,width,length);c.strokeStyle='#16836b';c.lineWidth=2;c.stroke();}
    c.restore();
  }
};
const combinedPreviousMatches=parameterDraft.matches.bind(parameterDraft),combinedPreviousLoad=parameterDraft.load.bind(parameterDraft),combinedPreviousHUD=parameterDraft.renderHUD.bind(parameterDraft),combinedPreviousDraw=parameterDraft.draw.bind(parameterDraft);
parameterDraft.matches=source=>combinedPreviousMatches(source)||source.trimStart().split(/\r?\n/)[0].trim()===combinedHeader;
parameterDraft.load=function(source){
  combinedDemo.active=source.trimStart().split(/\r?\n/)[0].trim()===combinedHeader;
  if(!combinedDemo.active)return combinedPreviousLoad(source);
  const lines=source.split(/\r?\n/),commands=new Map();let invalid=/#999\b/.test(source);
  const calculation=lines.map((line,i)=>{const op=line.trim().toUpperCase();if(/^DRAW\s/.test(op)){if(!['DRAW FRAME','DRAW TILE','DRAW COMPLETE'].includes(op)){invalid=true;return line;}commands.set(i+1,op);return '#999 = 1';}return line;}).join('\n');
  const result=combinedPreviousLoad(invalid?combinedHeader+'\nINVALID GRAPHICS INPUT':calculation);
  if(invalid)this.error='Unknown graphics command or reserved variable #999.';
  for(const row of this.trace){if(commands.has(row.line))row.code=commands.get(row.line);delete row.vars[999];delete row.descriptions[999];}
  $('diagnostics').textContent='Combined graphics demo: calculation statements and DRAW commands only. No CNC motion or stock modification.'+(this.error?'\n'+this.error:'');this.renderHUD();dirty=true;return result;
};
parameterDraft.renderHUD=function(){const ok=combinedPreviousHUD();if(ok&&combinedDemo.active){$('hud').textContent='COMBINED GRAPHICS\nDISPLAY ONLY\n'+(this.running?'PLAYING':'PAUSED');if(!this.at&&!this.error)$('active').textContent='Combined demo · ready';}return ok;};
parameterDraft.draw=function(project,c,st){if(combinedDemo.active)combinedDemo.draw(project,c,st,this.trace,this.at);else combinedPreviousDraw(project,c,st);};
$('combineddemo').onclick=()=>{$('source').value=combinedExample;$('load').click();};
