'use strict';
// Independent display morph. No path generation, tool contact, or stock writes.
const materialHeader='(GRAPHICS: MATERIAL STUDY)';
const materialExample=materialHeader+'\n#1 = 65 (Shape width percent)\n#2 = 45 (Relief strength percent)\n#3 = 70 (Shape length percent)\n#4 = 0 (Display progress)\nWHILE [#4 LT 100] DO1\n#4 = [#4 + 10]\nEND1';
const materialDemo={active:false,cache:null,base:null,key:'',section:true,
  values(){const v=parameterDraft.trace[parameterDraft.at-1]?.vars||{};return {width:clamp((v[1]??65)/100,.15,.9),strength:clamp((v[2]??45)/100,0,.8),length:clamp((v[3]??70)/100,.15,.9),progress:clamp((v[4]??0)/100,0,1)};},
  shape(u,v,p){const r=u*u/(p.width*p.width)+v*v/(p.length*p.length);return r>=1?0:(1-r)**2*p.progress*p.strength;},
  displayStock(base){if(!this.active)return base;const p=this.values(),key=JSON.stringify(p);if(this.base===base&&this.key===key)return this.cache;
    const h=new Float32Array(base.h.length);for(let j=0;j<base.ny;j++)for(let i=0;i<base.nx;i++){const u=2*(i+.5)/base.nx-1,v=2*(j+.5)/base.ny-1;h[j*base.nx+i]=base.bottom*this.shape(u,v,p);}
    this.base=base;this.key=key;this.cache={...base,h};return this.cache;
  },
  draw(project,c,st){if(!this.active)return;const p=this.values(),w=canvas.clientWidth,h=canvas.clientHeight;
    // A separate stationary model reference, deliberately outside the stock surface.
    if($('showTool').checked){const r=st.extent*.035,x=st.x1+st.extent*.09,y=st.cy,z=st.extent*.12;const bands=[[z,r*.75],[z+r*.45,r],[z+r*3,r],[z+r*3,r*.55],[z+r*5,r*.55],[z+r*5,r*1.25],[z+r*6.2,r*1.25]];const faces=[];for(let k=0;k<bands.length-1;k++)for(let j=0;j<32;j++){const a=j*Math.PI/16,b=(j+1)*Math.PI/16;const pt=(band,t)=>project({x:x+band[1]*Math.cos(t),y:y+band[1]*Math.sin(t),z:band[0]});const pts=[pt(bands[k],a),pt(bands[k],b),pt(bands[k+1],b),pt(bands[k+1],a)];faces.push({pts,d:pts.reduce((n,q)=>n+q.d,0)/4,color:`hsl(210 12% ${61+12*Math.cos(a-yaw)}%)`});}faces.sort((a,b)=>b.d-a.d);c.save();for(const f of faces){c.beginPath();f.pts.forEach((q,j)=>j?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();c.fillStyle=f.color;c.fill();c.strokeStyle=f.color;c.lineWidth=.4;c.stroke();}const q=project({x,y,z:z+r*6.6});c.font='11px Segoe UI, sans-serif';c.fillStyle='#40556a';c.textAlign='center';c.fillText('Tool reference',q.x,q.y);c.restore();}
    if(!this.section)return;c.save();const sw=Math.min(250,w*.43),sh=100,sx=w-sw-12,sy=h-sh-14;c.fillStyle='#fffffff0';c.strokeStyle='#c6d2df';c.lineWidth=1;c.beginPath();c.roundRect(sx,sy,sw,sh,6);c.fill();c.stroke();c.font='11px Segoe UI, sans-serif';c.fillStyle='#354759';c.fillText('Center section · normalized shape',sx+10,sy+16);const left=sx+12,right=sx+sw-12,top=sy+31,bottom=sy+sh-10;c.beginPath();c.moveTo(left,bottom);for(let i=0;i<=80;i++){const u=i/40-1;c.lineTo(left+(right-left)*i/80,top+(bottom-top)*this.shape(u,0,p));}c.lineTo(right,bottom);c.closePath();c.fillStyle='#b8c9d9';c.fill();c.strokeStyle='#7690a6';c.stroke();c.beginPath();c.setLineDash([4,3]);c.moveTo(left,top);c.lineTo(right,top);c.strokeStyle='#a5b3bf';c.stroke();c.restore();
  }
};
globalThis.materialDemo=materialDemo;
const previousDraftMatches=parameterDraft.matches.bind(parameterDraft),previousDraftLoad=parameterDraft.load.bind(parameterDraft),previousDraftHUD=parameterDraft.renderHUD.bind(parameterDraft),previousDraftDraw=parameterDraft.draw.bind(parameterDraft);
parameterDraft.matches=source=>previousDraftMatches(source)||source.trimStart().split(/\r?\n/)[0].trim()===materialHeader;
parameterDraft.load=function(source){materialDemo.active=source.trimStart().split(/\r?\n/)[0].trim()===materialHeader;materialDemo.cache=null;materialDemo.base=null;materialDemo.key='';const ok=previousDraftLoad(source);if(materialDemo.active){$('diagnostics').textContent='Synthetic material shape preview. Actual stock is unchanged; tool model is a separate visual reference.'+(this.error?'\n'+this.error:'');}return ok;};
parameterDraft.renderHUD=function(){const ok=previousDraftHUD();if(ok&&materialDemo.active){$('hud').textContent='MATERIAL STUDY\nDISPLAY MORPH ONLY\n'+(this.running?'PLAYING':'PAUSED');$('currenttool').hidden=false;$('currenttoolcolor').style.background='#7b8793';$('currenttoolname').textContent='Virtual tool · reference only';if(!this.at&&!this.error)$('active').textContent='Material study · ready';}return ok;};
parameterDraft.draw=function(project,context,st){if(materialDemo.active)materialDemo.draw(project,context,st);else previousDraftDraw(project,context,st);};
$('materialdemo').onclick=()=>{$('source').value=materialExample;$('load').click();};
$('materialsection').onchange=()=>{materialDemo.section=$('materialsection').checked;dirty=true;};
