'use strict';
// Abstract graphics gallery. Calculator output never enters the CNC parser or stock engine.
const galleryExamples = {
  colors:{title:'Color progression',source:`#1 = 0 (Counter)
#2 = 8 (Color count)
WHILE [#1 LT #2] DO1
#3 = [#1 * 360 / #2] (Hue)
#4 = [#1 + 1] (Tile number)
#1 = [#1 + 1]
END1`,kind:'colors'},
  mosaic:{title:'Nested mosaic',source:`#1 = 0 (Row)
#2 = 3 (Rows)
#3 = 5 (Columns)
WHILE [#1 LT #2] DO1
#4 = 0 (Column)
WHILE [#4 LT #3] DO2
#5 = [#1 * 70 + #4 * 35] (Hue)
#6 = [#1 * #3 + #4 + 1] (Tile number)
#4 = [#4 + 1]
END2
#1 = [#1 + 1]
END1`,kind:'mosaic'},
  wave:{title:'Trigonometric wave',source:`#1 = 0 (Counter)
#2 = 16 (Sample count)
WHILE [#1 LT #2] DO1
#3 = [#1 * 360 / #2] (Phase)
#4 = SIN[#3] (Wave value)
#5 = [#1 + 1] (Sample number)
#1 = [#1 + 1]
END1`,kind:'wave'},
  rosette:{title:'Editable parameter rosette',source:`#1 = 12 (Petal count)
#2 = 70 (Display size)
#3 = 25 (Color offset)
#100 = 0 (Counter)
WHILE [#100 LT #1] DO1
#10 = [#100 * 360 / #1] (Rotation)
#11 = [#2 * 0.35] (Petal size)
#12 = [#3 + #10] (Hue)
#13 = [#100 + 1] (Petal number)
#100 = [#100 + 1]
END1`,kind:'rosette'}
};
function galleryMarks(trace,at,kind){
  const marks=[];const marker={colors:4,mosaic:6,wave:5,rosette:13}[kind];
  for(const row of trace.slice(0,at)){if(!new RegExp('^#'+marker+'\\s*=').test(row.code))continue;const v=row.vars;if(marks.length>=100)break;const val=k=>Number(v[k]);const bounded=(n,a,b)=>Math.min(b,Math.max(a,n));const hue=n=>((n%360)+360)%360;
    if(kind==='colors')marks.push({tag:'rect',x:18+(marks.length%10)*30,y:18+Math.floor(marks.length/10)*26,width:25,height:22,rx:4,fill:`hsl(${hue(val(3))} 68% 48%)`});
    else if(kind==='mosaic')marks.push({tag:'rect',x:18+bounded(val(4),0,19)*15,y:18+bounded(val(1),0,9)*15,width:13,height:13,rx:2,fill:`hsl(${hue(val(5))} 66% 49%)`});
    else if(kind==='wave')marks.push({tag:'circle',cx:22+bounded(val(1)/Math.max(1,val(2)-1),0,1)*276,cy:96-bounded(val(4),-1,1)*55,r:4,fill:'#2479b8'});
    else marks.push({tag:'ellipse',cx:160,cy:96-bounded(val(2),10,70)*.55,rx:bounded(val(11),3,26)*.5,ry:bounded(val(11),3,26),transform:`rotate(${hue(val(10))} 160 96)`,fill:`hsl(${hue(val(12))} 70% 50%)`,opacity:.72});
  }return marks;
}
function setupGallery(){
  const dlg=document.createElement('dialog');dlg.id='gallerydialog';dlg.style.width='min(760px,calc(100vw - 32px))';
  dlg.innerHTML='<h2>Macro graphics demos</h2><p>Abstract graphics and numbered-variable calculations only. Independent of the CNC preview.</p><section><label>Demo <select id="gal-example"></select></label><p id="gal-help">Edit the numbered variables and evaluate again to change the artwork.</p><textarea id="gal-source" aria-label="Demo calculation input" spellcheck="false" style="width:100%;height:170px;font:13px Consolas,monospace"></textarea><div class="buttons" style="flex-wrap:wrap"><button id="gal-run" class="primary">Evaluate</button><button id="gal-play">Play</button><button id="gal-prev">Previous</button><button id="gal-next">Next</button><button id="gal-reset">Reset</button><span id="gal-count"></span></div><input id="gal-step" type="range" min="0" max="0" value="0" style="width:100%" aria-label="Demo step"><p id="gal-status" role="status"></p><svg id="gal-art" viewBox="0 0 320 192" style="display:block;width:100%;max-height:230px;background:#f3f7fa;border:1px solid #d5dfe7;border-radius:5px" aria-label="Abstract graphics preview"></svg><table style="width:100%;text-align:left;margin-top:10px"><thead><tr><th>Variable</th><th>Value</th><th>Description</th></tr></thead><tbody id="gal-values"></tbody></table></section><div class="closebar"><button id="gal-close">Close</button></div>';
  document.body.append(dlg);const el=id=>document.getElementById('gal-'+id);let trace=[],at=0,timer=null;
  function stop(){if(timer!==null)clearInterval(timer);timer=null;el('play').textContent='Play';}
  function render(){const row=trace[at-1];el('step').max=trace.length;el('step').value=at;el('count').textContent=at+' / '+trace.length;el('prev').disabled=at===0;el('next').disabled=at>=trace.length;el('play').disabled=!trace.length;el('status').textContent=row?'Line '+row.line+' · '+row.code:'Ready at beginning';el('values').replaceChildren();if(row)for(const [k,v] of Object.entries(row.vars)){const tr=document.createElement('tr');for(const val of ['#'+k,Number(v.toPrecision(10)).toString(),row.descriptions[k]||'']){const td=document.createElement('td');td.textContent=val;tr.append(td);}el('values').append(tr);}const art=el('art');art.replaceChildren();for(const mark of galleryMarks(trace,at,galleryExamples[el('example').value].kind)){const {tag,...attrs}=mark;const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));art.append(node);}}
  function run(){stop();trace=[];at=0;try{trace=calculateParameters(el('source').value);render();}catch(e){render();el('status').textContent=e.message;}}
  function select(key){el('example').value=key;el('source').value=galleryExamples[key].source;run();}
  for(const [k,v] of Object.entries(galleryExamples))el('example').add(new Option(v.title,k));el('example').onchange=()=>select(el('example').value);el('run').onclick=run;el('prev').onclick=()=>{stop();at=Math.max(0,at-1);render();};el('next').onclick=()=>{stop();at=Math.min(trace.length,at+1);render();};el('reset').onclick=()=>{stop();at=0;render();};el('step').oninput=()=>{stop();at=Number(el('step').value);render();};el('source').oninput=()=>{stop();trace=[];at=0;render();el('status').textContent='Input changed. Evaluate again.';};el('play').onclick=()=>{if(timer!==null){stop();return;}if(!trace.length)return;if(at===trace.length){at=0;render();}el('play').textContent='Pause';timer=setInterval(()=>{at=Math.min(trace.length,at+1);render();if(at===trace.length)stop();},100);};el('close').onclick=()=>dlg.close();dlg.addEventListener('close',stop);select('colors');
  for(const [id,key] of [['macrodemo','colors'],['nestedmacro','mosaic'],['multimacro','wave'],['paramdemo','rosette']])document.getElementById(id).onclick=()=>{select(key);if(!dlg.open)dlg.showModal();};
}
if(typeof document!=='undefined')setupGallery();
