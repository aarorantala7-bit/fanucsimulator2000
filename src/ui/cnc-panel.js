'use strict';
// FANUC 0i-style CNC panel shared by Milling (0i-MF) and Turning (0i-TF), parameterized by machine.
// Function keys POS / PROG / OFS/SET / SYSTEM / MESSAGE, soft keys, mode select (EDIT MEM MDI JOG HANDLE REF),
// CYCLE START / FEED HOLD / RESET, SINGLE BLOCK / BLOCK SKIP / OPT STOP and the three overrides.
// Manual moves (JOG, HANDLE, REF, MDI) move the tool only; they never cut the simulated stock.
(function setupCncPanel(){
 const MS=MachineState,RT=SimRuntime,MD=MachineData;
 const CFG={mill:{axes:['X','Y','Z'],name:'0i-MF',dia:false},lathe:{axes:['X','Z'],name:'0i-TF',dia:true}};
 const source=$('source'),panel=source.closest('.panel'),body=source.parentElement,pad=$('editor-keypad'),buffer=$('keypad-buffer');
 const P={machine:'mill',mode:'MEM',screen:'PROG',sub:{POS:'ABS',OFS:'OFFSET',SYSTEM:'PARAM',PROG:'PROGRAM'},rel:{x:0,y:0,z:0},sel:null,mdi:'',ref:{},handleAxis:'X',handleStep:0.01,jogRapid:false,pwe:0,messages:[],mdiRun:null};
 const fmt=v=>(v<0?'-':' ')+Math.abs(v).toFixed(3).padStart(8,' ');
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const st=()=>MS[P.machine];
 // ---------- DOM ----------
 const fkeys=document.createElement('div');fkeys.className='cnc-fkeys';fkeys.innerHTML=['POS','PROG','OFS/SET','SYSTEM','MESSAGE'].map(k=>`<button type="button" data-fkey="${k}">${k}</button>`).join('');
 const strip=panel.querySelector('.cnc-display-header');strip.before(fkeys);
 const screen=document.createElement('div');screen.className='cnc-screen';screen.hidden=true;body.append(screen);
 const soft=document.createElement('div');soft.className='cnc-softkeys';body.after(soft);
 const op=document.createElement('div');op.className='cnc-operator';pad.after(op);
 const lampModes=['EDIT','MEM','MDI','JOG','HANDLE','REF'];
 op.innerHTML=`<div class="op-row"><span class="op-label">MODE</span>${lampModes.map(m=>`<button type="button" data-mode="${m}">${m==='MEM'?'MEM (AUTO)':m==='REF'?'REF (ZRN)':m}</button>`).join('')}</div>
 <div class="op-row"><button type="button" id="cnc-start" class="op-start">CYCLE START</button><button type="button" id="cnc-hold" class="op-hold">FEED HOLD</button><button type="button" id="cnc-reset">RESET</button><span class="op-sep"></span><button type="button" data-toggle="singleBlock">SINGLE BLOCK</button><button type="button" data-toggle="blockSkip">BLOCK SKIP /</button><button type="button" data-toggle="optStop">OPT STOP M01</button></div>
 <div class="op-row"><label>FEED OVR <select id="cnc-feedov">${Array.from({length:16},(_,i)=>`<option value="${i*10}"${i===10?' selected':''}>${i*10}%</option>`).join('')}</select></label><label>RAPID OVR <select id="cnc-rapidov"><option value="F0">F0</option><option value="25">25%</option><option value="50">50%</option><option value="100" selected>100%</option></select></label><label>SPINDLE OVR <select id="cnc-spov">${[50,60,70,80,90,100,110,120].map(v=>`<option value="${v}"${v===100?' selected':''}>${v}%</option>`).join('')}</select></label></div>
 <div class="op-row" id="cnc-jogrow"><span class="op-label">AXIS</span><span id="cnc-axes"></span><button type="button" id="cnc-jograpid">RAPID</button><span class="op-sep"></span><span class="op-label">HANDLE</span><select id="cnc-haxis"></select><select id="cnc-hstep"><option value="0.001">×1 (0.001)</option><option value="0.01" selected>×10 (0.01)</option><option value="0.1">×100 (0.1)</option></select><button type="button" id="cnc-mpgm">MPG −</button><button type="button" id="cnc-mpgp">MPG +</button></div>
 <div class="op-row op-ind" id="cnc-ind"></div>`;
 // ---------- position / state sources ----------
 function homeWork(m=P.machine){const w=MS[m].work,ref=MS[m].params.get(1240)||[0,0,0],sh=w.shift||{x:0,z:0};return m==='lathe'?{x:ref[0]-w[54].x-sh.x,z:ref[1]-w[54].z-sh.z}:{x:ref[0]-w[54].x,y:ref[1]-w[54].y,z:ref[2]-w[54].z};}
 function program(){if(P.machine==='lathe'){const c=LatheView.current();return c?{seg:c.s,pos:{x:c.tip.x,z:c.tip.z}}:null;}const smp=position?samples[position-1]:null,s=smp?segs[smp.i]:segs[0];return s?{seg:s,pos:smp?{...smp.p}:{...s.a}}:null;}
 function cur(){const pr=program();const pos=globalThis.manualPos?{...globalThis.manualPos}:pr?pr.pos:homeWork();return {pos,seg:P.mdiRun?.seg||pr?.seg||null};}
 function machinePos(p){const w=st().work,g=w[54]||{},e=w.ext||{},sh=w.shift||{};const o={};for(const a of CFG[P.machine].axes){const k=a.toLowerCase();o[k]=(p[k]||0)+(g[k]||0)+(e[k]||0)+(sh[k]||0);}return o;}
 function running(){return P.machine==='lathe'?LatheView.playing:playing;}
 function setRunning(on){if(P.machine==='lathe'){if(LatheView.playing!==on)LatheView.play();}else if(playing!==on)$('play').click();}
 function msg(t){P.messages.unshift(new Date().toLocaleTimeString()+'  '+t);P.messages.length=Math.min(P.messages.length,30);$('active').textContent=t;if(P.screen==='MESSAGE')render();}
 // ---------- manual motion (JOG / HANDLE / REF / MDI) ----------
 function limits(k){const ax=CFG[P.machine].axes.findIndex(a=>a.toLowerCase()===k);const pos=st().params.get(1320),neg=st().params.get(1321);const g=v=>Array.isArray(v)?v[ax]:v;return [g(neg)??-Infinity,g(pos)??Infinity];}
 function moveManual(k,delta){if(running()){msg('Axis motion refused while the program is running (FEED HOLD first).');return false;}const c=cur().pos;const np={...c};np[k]=(np[k]||0)+delta;const [lo,hi]=limits(k);const m=machinePos(np)[k];
  if(m>hi||m<lo){msg(`OT050${m>hi?0:1} ${m>hi?'+':'-'}${k.toUpperCase()} OVERTRAVEL (stored stroke limit 1, parameter ${m>hi?1320:1321})`);return false;}
  globalThis.manualPos=np;redraw();return true;}
 function redraw(){if(P.machine==='lathe')LatheView.dirty=true;else dirty=true;refresh(true);}
 let jog=null,jogT=0;
 function jogLoop(now){if(!jog)return;const dt=Math.min(.1,(now-(jogT||now))/1000);jogT=now;const ax=CFG[P.machine].axes.findIndex(a=>a.toLowerCase()===jog.k);
  const rate=P.jogRapid?(st().params.get(1424)||[])[ax]*(RT.state.rapidOv==='F0'?(st().params.get(1421)||[])[ax]/((st().params.get(1424)||[])[ax]||1):RT.state.rapidOv/100):(st().params.get(1423)||[])[ax]*RT.state.feedOv/100;
  const d=jog.dir*(rate||0)/60*dt*(CFG[P.machine].dia&&jog.k==='x'?2:1);if(d&&!moveManual(jog.k,d)){jog=null;return;}requestAnimationFrame(jogLoop);}
 function axisPress(k,dir){if(P.mode==='JOG'){jog={k,dir};jogT=0;requestAnimationFrame(jogLoop);}
  else if(P.mode==='REF'){const h=homeWork();if(running())return msg('Reference return refused while running.');const c=cur().pos;globalThis.manualPos={...c,[k]:h[k]};P.ref[k]=true;msg(`Reference return ${k.toUpperCase()} complete (ZRN lamp on)`);redraw();}
  else if(P.mode==='HANDLE'){P.handleAxis=k.toUpperCase();$('cnc-haxis').value=P.handleAxis;}
  else msg('Select JOG, HANDLE or REF mode to move an axis by hand.');}
 function buildAxes(){const box=$('cnc-axes');box.replaceChildren();for(const a of CFG[P.machine].axes)for(const dir of [-1,1]){const b=document.createElement('button');b.type='button';b.textContent=(dir<0?'−':'+')+a;b.dataset.axis=a.toLowerCase();b.dataset.dir=dir;
   b.onpointerdown=e=>{e.preventDefault();axisPress(a.toLowerCase(),dir);};b.onpointerup=b.onpointerleave=b.onpointercancel=()=>{jog=null;};box.append(b);}
  $('cnc-haxis').innerHTML=CFG[P.machine].axes.map(a=>`<option>${a}</option>`).join('');$('cnc-haxis').value=P.handleAxis=CFG[P.machine].axes[0];}
 function mpg(dir){if(P.mode!=='HANDLE')return msg('Select HANDLE mode to use the manual pulse generator.');const k=P.handleAxis.toLowerCase();moveManual(k,dir*P.handleStep*(CFG[P.machine].dia&&k==='x'?2:1));}
 // MDI: interpret the MDI buffer from the current position and modal state, then animate the tool (no cutting).
 function runMdi(){const text=P.mdi.trim();if(!text)return msg('MDI buffer is empty. Key in words, EOB, INSERT, then CYCLE START.');const c=cur(),s=c.seg||{};let r;
  try{if(P.machine==='lathe')r=LatheSim.simulate(text+'\n',{params:MS.lathe.params,offsets:MS.lathe.offsets,work:MS.lathe.work,tools:MS.lathe.tools,common:MS.common,start:{x:c.pos.x,z:c.pos.z},modal:{tool:s.tool||0,off:s.off||0,S:s.S||0,spindle:s.spindle||5,F:s.F||0}});
   else{const m=FanucMacro.needsMacro(text)?FanucMacro.execute(text,{machine:'mill',params:MS.mill.params,offsets:MS.mill.offsets,work:MS.mill.work,common:MS.common}):null;if(m?.error)throw new Error(m.error);const pr=parse(m?m.blocks:text,{start:c.pos,modal:{tool:s.tool||0,S:s.S||0,spindle:s.spindle,F:s.F||0}});r={segs:pr.s,notes:pr.notes,error:null};}}
  catch(e){return msg('MDI alarm: '+e.message);}
  if(r.error)return msg('MDI alarm: '+r.error);const list=r.segs.filter(g=>g.kind!=='stop'&&g.kind!=='tool');if(!list.length)return msg('MDI executed (modal / no motion).');
  P.mdiRun={list,i:0,t:0,seg:list[0]};let last=0;const tick=now=>{const run=P.mdiRun;if(!run)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;run.t+=dt*Number($('speed').value);
   while(run.i<list.length){const g=list[run.i],d=RT.duration({n:1},g);if(run.t<d){const f=d>0&&Number.isFinite(d)?run.t/d:1;const p={};for(const k of ['x','y','z'])if(g.a[k]!==undefined)p[k]=g.a[k]+(g.b[k]-g.a[k])*f;globalThis.manualPos=p;run.seg=g;break;}run.t-=d;run.i++;}
   if(run.i>=list.length){const g=list.at(-1);globalThis.manualPos={...g.b};P.mdiRun=null;msg('MDI block(s) completed.');}redraw();if(P.mdiRun)requestAnimationFrame(tick);};requestAnimationFrame(tick);}
 // ---------- editing (called by keypad.js before its own INSERT / ALTER / DELETE / INPUT) ----------
 function intercept(key,value,eob,status){
  if(P.screen!=='PROG'){if(key==='INPUT'){inputCell(value,false);return 'consumed';}status.textContent=`${key} edits the program only on the PROG screen.`;return 'blocked';}
  if(P.mode==='MDI'){if(key==='DELETE'){P.mdi='';render();return 'consumed';}if(!value&&!eob)return 'blocked';P.mdi+=(P.mdi&&!/\n$/.test(P.mdi)?' ':'')+value+(eob?';\n':'');render();status.textContent='Key-in added to the MDI program.';return 'consumed';}
  if(P.mode!=='EDIT'){status.textContent='Program editing needs EDIT mode (mode select: EDIT).';msg('Program edit refused: select EDIT mode.');return 'blocked';}
  if(key==='DELETE'&&/^O\d{1,4}$/i.test(value)){const o=Number(value.slice(1));MS.deleteProgram(P.machine,o);msg(`Program O${String(o).padStart(4,'0')} deleted from the directory.`);return 'consumed';}
  if(key==='INSERT'&&/^O\d{1,4}$/i.test(value)&&!eob&&!/\S/.test(source.value)){return undefined;}
  return undefined;}
 function canEdit(){return P.screen==='PROG'&&P.mode==='EDIT';}
 function search(dir){const word=buffer.value.trim().toUpperCase();if(!word)return false;
  if(/^O\d{1,4}$/.test(word)&&P.mode!=='MDI'){const o=Number(word.slice(1));const lib=MS.library(P.machine);const re=new RegExp('^\\s*[O:]0*'+o+'\\b','im');const inText=re.exec(source.value);
   if(inText){source.setSelectionRange(inText.index+inText[0].search(/\S/),inText.index+inText[0].search(/\S/));}
   else if(lib.has(o)){source.value=lib.get(o);source.setSelectionRange(0,0);$('load').click();}
   else{msg(`PS0071 DATA NOT FOUND · O${String(o).padStart(4,'0')} is not in memory`);return true;}
   msg(`Program search O${String(o).padStart(4,'0')} found.`);}
  else{const text=source.value.toUpperCase();const from=source.selectionEnd;let at=-1;const re=new RegExp('(^|[\\s;])'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[\\s;(])','gm');let m;const hits=[];while((m=re.exec(text)))hits.push(m.index+m[1].length);
   at=dir>0?hits.find(i=>i>=from+(text.startsWith(word,from)?1:0)):hits.filter(i=>i<source.selectionStart).at(-1);if(at===undefined){msg(`PS0071 DATA NOT FOUND · ${word}`);return true;}source.setSelectionRange(at,at);}
  buffer.value='';buffer.dispatchEvent(new Event('input'));source.dispatchEvent(new Event('select'));return true;}
 pad.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!panel.classList.contains('cnc-editor-mode'))return;const k=b.getAttribute('aria-label');if((k==='↓'||k==='↑')&&buffer.value.trim()&&P.screen==='PROG'){e.stopImmediatePropagation();search(k==='↓'?1:-1);}},true);
 // ---------- offset / parameter cell input ----------
 function inputCell(value,add){if(!P.sel)return msg('Select a cell first (click it), key in a value, then INPUT.');const v=Number(value);if(!Number.isFinite(v))return msg('Enter a number to input.');const [table,key,f]=P.sel.split('|');const s=st();
  if(table==='param'){if(!P.pwe)return msg('SW0100 Parameter write is disabled · set PARAMETER WRITE = 1 on OFS/SET > SETTING');if(P.mode!=='MDI')return msg('Parameters can be written only in MDI mode (or emergency stop).');const n=Number(key),cur=s.params.get(n);
   if(f==='-'){s.params.set(n,add?(cur||0)+v:v);}else{const arr=Array.isArray(cur)?cur.slice():[cur];arr[Number(f)]=add?(arr[Number(f)]||0)+v:v;s.params.set(n,arr);}}
  else if(table==='common'){const n=Number(key);MS.common.set(n,add?(MS.common.get(n)||0)+v:v);}
  else if(table==='work'){const w=s.work[key]||(s.work[key]={});w[f]=add?(w[f]||0)+v:v;}
  else if(table==='h'||table==='d'){const o=s.offsets[table],r=o[key]||(o[key]={geom:0,wear:0});r[f]=add?r[f]+v:v;}
  else if(table==='geom'||table==='wear'){const o=s.offsets[table],r=o[key]||(o[key]={x:0,z:0,r:0,t:0});r[f]=f==='t'?Math.round(v):add?r[f]+v:v;if(table==='geom'&&(f==='r'||f==='t')){const t=MS.lathe.tools.find(t=>t.id===Number(key));if(t){if(f==='r')t.noseR=v;else t.tip=Math.round(v);}}}
  else if(table==='setting'){if(key==='pwe'){P.pwe=v?1:0;if(P.pwe)msg('SW0100 PARAMETER WRITE ENABLE (alarm shown while PWE = 1, as on the control)');}}
  MS.persist();buffer.value='';buffer.dispatchEvent(new Event('input'));render();if(table!=='setting'&&table!=='common')$('load').click();}
 // ---------- screens ----------
 const SOFT={POS:['ABS','REL','ALL','ORIGIN'],PROG:['PROGRAM','DIR','O SRCH','SAVE'],SYSTEM:['PARAM']};
 function softFor(){if(P.screen==='OFS/SET')return P.machine==='lathe'?['GEOM','WEAR','SHIFT','WORK','SETTING','MACRO','INPUT','+INPUT']:['OFFSET','WORK','SETTING','MACRO','INPUT','+INPUT'];if(P.screen==='SYSTEM')return ['PARAM','INPUT','+INPUT'];if(P.screen==='PROG'&&P.mode==='MDI')return ['MDI','CLEAR'];return SOFT[P.screen]||[];}
 function cell(table,key,f,v,digits=3){const id=`${table}|${key}|${f}`;return `<td class="cell${P.sel===id?' sel':''}" data-cell="${id}">${typeof v==='number'?v.toFixed(digits):esc(v??'')}</td>`;}
 function render(){const sub=P.sub[P.screen==='OFS/SET'?'OFS':P.screen];for(const b of fkeys.children)b.classList.toggle('on',b.dataset.fkey===P.screen);
  soft.innerHTML=softFor().map(k=>`<button type="button" data-soft="${k}" class="${k===sub?'on':''}">${k}</button>`).join('');
  const hdr=strip.querySelector('strong'),mode=strip.querySelector('span');
  const showText=P.screen==='PROG'&&P.mode!=='MDI'&&P.sub.PROG!=='DIR';screen.hidden=showText;
  hdr.textContent=P.screen==='PROG'?(P.mode==='MDI'?'PROGRAM (MDI)':P.sub.PROG==='DIR'?'PROGRAM DIRECTORY':'PROGRAM'):P.screen==='POS'?{ABS:'ACTUAL POSITION (ABSOLUTE)',REL:'ACTUAL POSITION (RELATIVE)',ALL:'ACTUAL POSITION'}[P.sub.POS]||'ACTUAL POSITION':P.screen==='OFS/SET'?({OFFSET:'TOOL OFFSET (H / D)',GEOM:'TOOL OFFSET (GEOMETRY)',WEAR:'TOOL OFFSET (WEAR)',SHIFT:'WORK SHIFT',WORK:'WORK COORDINATES',SETTING:'SETTING (HANDY)',MACRO:'VARIABLE'}[P.sub.OFS]):P.screen==='SYSTEM'?'PARAMETER':'ALARM / MESSAGE';
  mode.textContent=`${P.mode} · ${CFG[P.machine].name} ${P.machine==='lathe'?'TURNING':'MILLING'}`;
  if(showText)return;screen.innerHTML=screenHTML();}
 function screenHTML(){const s=st(),ax=CFG[P.machine].axes;
  if(P.screen==='PROG'&&P.mode==='MDI')return `<pre class="mdi">O0000 (MDI) ;\n${esc(P.mdi)}${P.mdiRun?'\n>> EXECUTING':''}</pre><p class="hint">Key in words, EOB, INSERT; then CYCLE START. DELETE clears.</p>`;
  if(P.screen==='PROG'){const lib=MS.library(P.machine);const inText=[...source.value.matchAll(/^\s*[O:](\d{1,4})/gim)].map(m=>Number(m[1]));const all=[...new Set([...inText,...lib.keys()])].sort((a,b)=>a-b);
   return `<table class="grid"><tr><th>O-NO.</th><th>WHERE</th><th>SIZE</th><th>COMMENT</th><th></th></tr>${all.map(o=>{const t=lib.get(o);const where=inText.includes(o)?(t?'EDITOR + MEMORY':'EDITOR'):'MEMORY';const txt=t||source.value;const cm=(new RegExp('[O:]0*'+o+'\\s*\\(([^)]*)\\)','i').exec(txt)||[])[1]||'';return `<tr><td>O${String(o).padStart(4,'0')}</td><td>${where}</td><td>${(t||'').length||'—'}</td><td>${esc(cm)}</td><td>${t?`<button type="button" data-open="${o}">LOAD</button><button type="button" data-del="${o}">DEL</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="5">No programs. Use SAVE to store the editor program under its O number.</td></tr>'}</table><p class="hint">Search: key in O1234 then ↓ (EDIT/MEM). Delete: EDIT mode, key in O1234, DELETE.</p>`;}
  if(P.screen==='POS'){const c=cur(),p=c.pos,g=c.seg||{},m=machinePos(p),rel={};for(const a of ax){const k=a.toLowerCase();rel[k]=(p[k]||0)-(P.rel[k]||0);}
   const dtg={};if(g.b&&running())for(const a of ax){const k=a.toLowerCase();dtg[k]=(g.b[k]||0)-(p[k]||0);}
   const block=(title,o)=>`<div class="posblk"><h4>${title}</h4>${ax.map(a=>`<div class="big"><b>${a}</b>${fmt(o[a.toLowerCase()]||0)}</div>`).join('')}</div>`;
   const big=P.sub.POS==='ALL'?`<div class="posall">${block('RELATIVE',rel)}${block('ABSOLUTE',p)}${block('MACHINE',m)}${block('DISTANCE TO GO',dtg)}</div>`:block(P.sub.POS==='REL'?'RELATIVE':'ABSOLUTE',P.sub.POS==='REL'?rel:p);
   const rpm=g.spindle===5||!g.spindle?0:(g.rpm||g.S||0)*RT.state.spindleOv/100;const feed=g.rapid?'RAPID':(g.rate||g.F||0).toFixed(g.perRev&&!g.rate?3:0);
   const t=(P.machine==='lathe'?LatheView.elapsed?.():null)??0;
   return big+`<div class="posfoot">ACT.F ${feed} ${g.feedMode===95||g.feedMode===99?'(per rev → mm/min)':'mm/min'} · S ${rpm.toFixed(0)} · T${String(g.tool||0).padStart(2,'0')}${P.machine==='lathe'?String(g.off||0).padStart(2,'0'):''}${P.machine==='lathe'&&CFG.lathe.dia?' · X = DIAMETER':''}<br>PART COUNT ${MS.common.get(3901)||0} · RUN TIME ${RT.fmtTime(t)} · ${P.machine==='lathe'?'CYCLE '+RT.fmtTime(LatheView.res?.cycleTime??NaN):''}</div>`;}
  if(P.screen==='OFS/SET'){const sub=P.sub.OFS;
   if(sub==='OFFSET'){const o=s.offsets,ids=[...new Set([...Object.keys(o.h),...Object.keys(o.d)].map(Number))].sort((a,b)=>a-b);return `<table class="grid"><tr><th>NO.</th><th>H GEOM</th><th>H WEAR</th><th>D GEOM</th><th>D WEAR</th></tr>${ids.map(n=>`<tr><td>${String(n).padStart(3,'0')}</td>${cell('h',n,'geom',o.h[n]?.geom??0)}${cell('h',n,'wear',o.h[n]?.wear??0)}${cell('d',n,'geom',o.d[n]?.geom??0)}${cell('d',n,'wear',o.d[n]?.wear??0)}</tr>`).join('')}</table>`;}
   if(sub==='GEOM'||sub==='WEAR'){const o=s.offsets[sub.toLowerCase()],ids=Object.keys(o).map(Number).sort((a,b)=>a-b);return `<table class="grid"><tr><th>${sub==='GEOM'?'G':'W'} NO.</th><th>X (DIA)</th><th>Z</th><th>R</th><th>T</th></tr>${ids.map(n=>`<tr><td>${sub[0]} ${String(n).padStart(3,'0')}</td>${cell(sub.toLowerCase(),n,'x',o[n].x)}${cell(sub.toLowerCase(),n,'z',o[n].z)}${cell(sub.toLowerCase(),n,'r',o[n].r)}${cell(sub.toLowerCase(),n,'t',o[n].t,0)}</tr>`).join('')}</table><p class="hint">Txxyy: xx selects the tool, yy this offset row. Geometry R/T also update the tool table.</p>`;}
   if(sub==='SHIFT'){const w=s.work.shift||(s.work.shift={x:0,z:0});return `<table class="grid"><tr><th></th><th>SHIFT VALUE</th></tr><tr><td>X (DIA)</td>${cell('work','shift','x',w.x)}</tr><tr><td>Z</td>${cell('work','shift','z',w.z)}</tr></table><p class="hint">Work shift moves every work coordinate system (system variables #2501 X / #2601 Z).</p>`;}
   if(sub==='WORK'){const keys=['ext',54,55,56,57,58,59];return `<table class="grid"><tr><th>NO.</th>${ax.map(a=>`<th>${a}</th>`).join('')}</tr>${keys.map((k,i)=>`<tr><td>${String(i).padStart(2,'0')} ${k==='ext'?'EXT':'G'+k}</td>${ax.map(a=>cell('work',k,a.toLowerCase(),s.work[k]?.[a.toLowerCase()]??0)).join('')}</tr>`).join('')}</table>`;}
   if(sub==='SETTING')return `<table class="grid"><tr><td>PARAMETER WRITE (PWE)</td>${cell('setting','pwe','-',P.pwe,0)}<td>0: disable · 1: enable</td></tr><tr><td>BLOCK SKIP</td><td>${RT.state.blockSkip?1:0}</td><td>operator panel switch</td></tr><tr><td>OPTIONAL STOP</td><td>${RT.state.optStop?1:0}</td><td>operator panel switch</td></tr><tr><td>INPUT UNIT</td><td>MM</td><td>G21</td></tr></table>`;
   if(sub==='MACRO'){const rows=[];for(const n of [...Array.from({length:100},(_,i)=>100+i),...Array.from({length:100},(_,i)=>500+i)]){const v=MS.common.get(n);rows.push(`<tr><td>#${n}</td>${cell('common',n,'v',v==null?'':v,4)}</tr>`);}return `<table class="grid"><tr><th>NO.</th><th>DATA</th></tr>${rows.join('')}</table><p class="hint">#100–#199 clear at power off on a real control; #500–#999 are retained (saved here).</p>`;}}
  if(P.screen==='SYSTEM'){const m=P.machine==='lathe'?4:3;return `<table class="grid"><tr><th>NO.</th><th>NAME</th>${ax.map(a=>`<th>${a}</th>`).join('')}<th>UNIT</th></tr>${MD.PARAM_DEFS.map(d=>{const v=s.params.get(d[0]);const per=Array.isArray(d[m]);return `<tr><td>${String(d[0]).padStart(4,'0')}</td><td class="pname">${esc(d[1])}</td>${per?ax.map((a,i)=>cell('param',d[0],i,Array.isArray(v)?v[i]:v,d[2]==='bits'?0:3)).join(''):cell('param',d[0],'-',Array.isArray(v)?v[0]:v,d[2]==='bits'?0:3)+ax.slice(1).map(()=>'<td></td>').join('')}<td>${esc(d[2])}</td></tr>`;}).join('')}</table><p class="hint">Write: OFS/SET › SETTING › PWE = 1, MDI mode, select a cell, key in, INPUT.</p>`;}
  return `<pre class="mdi">${esc(P.messages.join('\n')||'NO ALARM / MESSAGE')}</pre>`;}
 screen.addEventListener('click',e=>{const c=e.target.closest('[data-cell]');if(c){P.sel=c.dataset.cell;render();return;}const o=e.target.closest('[data-open]');if(o){const t=MS.library(P.machine).get(Number(o.dataset.open));source.value=t;P.sub.PROG='PROGRAM';$('load').click();render();return;}const d=e.target.closest('[data-del]');if(d){if(P.mode!=='EDIT')return msg('Deleting a program needs EDIT mode.');MS.deleteProgram(P.machine,Number(d.dataset.del));render();}});
 fkeys.onclick=e=>{const b=e.target.closest('[data-fkey]');if(!b)return;P.screen=b.dataset.fkey;P.sel=null;if(P.screen==='PROG'&&P.sub.PROG==='DIR'&&false)P.sub.PROG='PROGRAM';render();};
 soft.onclick=e=>{const b=e.target.closest('[data-soft]');if(!b)return;const k=b.dataset.soft;
  if(k==='INPUT'||k==='+INPUT'){inputCell(buffer.value.trim(),k==='+INPUT');return;}
  if(k==='ORIGIN'){const p=cur().pos;for(const a of CFG[P.machine].axes)P.rel[a.toLowerCase()]=p[a.toLowerCase()]||0;msg('Relative coordinates set to 0 (ORIGIN).');}
  else if(k==='O SRCH'){if(!search(1))msg('Key in O and the program number, then O SRCH (or ↓).');return render();}
  else if(k==='SAVE'){const m=/^\s*[O:](\d{1,4})/im.exec(source.value);if(!m)return msg('The editor program needs an O number (e.g. O1000) before SAVE.');MS.saveProgram(P.machine,Number(m[1]),source.value);msg(`Program O${m[1].padStart(4,'0')} stored in memory.`);P.sub.PROG='DIR';}
  else if(k==='CLEAR'){P.mdi='';}
  else if(k==='MDI'){}
  else if(P.screen==='OFS/SET')P.sub.OFS=k;else P.sub[P.screen]=k;P.sel=null;render();};
 // ---------- operator panel ----------
 function setMode(m){if(P.mode===m)return;if(m!=='MEM'&&running()){setRunning(false);msg('Mode change stops automatic operation (FEED HOLD).');}P.mode=m;if(m==='MEM'&&globalThis.manualPos&&!P.mdiRun){globalThis.manualPos=null;redraw();}if(m==='MDI'&&P.screen!=='PROG')P.screen='PROG';render();refresh(true);}
 op.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.mode)return setMode(b.dataset.mode);
  if(b.dataset.toggle){const k=b.dataset.toggle;RT.state[k]=!RT.state[k];if(k==='blockSkip')$('load').click();refresh(true);render();return;}
  if(b.id==='cnc-start')return cycleStart();
  if(b.id==='cnc-hold'){if(running()){setRunning(false);msg('FEED HOLD · press CYCLE START to resume');}else if(P.mdiRun){P.mdiRun=null;msg('FEED HOLD · MDI stopped');}refresh(true);return;}
  if(b.id==='cnc-reset'){setRunning(false);P.mdiRun=null;globalThis.manualPos=null;$('reset').click();msg('RESET · program rewound');redraw();return;}
  if(b.id==='cnc-jograpid'){P.jogRapid=!P.jogRapid;refresh(true);return;}
  if(b.id==='cnc-mpgm')return mpg(-1);if(b.id==='cnc-mpgp')return mpg(1);});
 function cycleStart(){if(P.mode==='MEM'){if(running())return;if(globalThis.manualPos){globalThis.manualPos=null;}setRunning(true);refresh(true);return;}
  if(P.mode==='MDI')return runMdi();msg(`CYCLE START ignored in ${P.mode} mode (select MEM or MDI).`);}
 $('cnc-feedov').onchange=e=>{RT.state.feedOv=Number(e.target.value);refresh(true);};
 $('cnc-rapidov').onchange=e=>{const v=e.target.value;RT.state.rapidOv=v==='F0'?'F0':Number(v);refresh(true);};
 $('cnc-spov').onchange=e=>{RT.state.spindleOv=Number(e.target.value);if(P.machine==='lathe')LatheView.hud(true);else updateHUD();refresh(true);};
 $('cnc-haxis').onchange=e=>P.handleAxis=e.target.value;$('cnc-hstep').onchange=e=>P.handleStep=Number(e.target.value);
 // ---------- indicators (throttled, text only) ----------
 const ind=$('cnc-ind');let lastInd='',lastT=0;
 function refresh(force){const now=performance.now();if(!force&&now-lastT<200)return;lastT=now;
  for(const b of op.querySelectorAll('[data-mode]'))b.classList.toggle('on',b.dataset.mode===P.mode);
  for(const b of op.querySelectorAll('[data-toggle]'))b.classList.toggle('on',!!RT.state[b.dataset.toggle]);
  $('cnc-start').classList.toggle('on',running()||!!P.mdiRun);$('cnc-hold').classList.toggle('on',!running()&&!P.mdiRun&&(P.machine==='lathe'?LatheView.position>0&&LatheView.position<LatheView.samples.length:position>0&&position<samples.length));$('cnc-jograpid').classList.toggle('on',P.jogRapid);
  const c=cur(),g=c.seg||{};const sp=g.spindle===3?'CW M03':g.spindle===4?'CCW M04':'STOP M05';const rpm=g.spindle===3||g.spindle===4?(g.rpm||g.S||0)*RT.state.spindleOv/100:0;
  const tool=P.machine==='lathe'?`TURRET T${String(g.tool||0).padStart(2,'0')}${String(g.off||0).padStart(2,'0')}`:`TOOL T${g.tool||0} H${g.H||0} D${g.D||0}`;
  const html=`<span class="lamp ${rpm?'on':''}">SPINDLE ${sp} ${rpm.toFixed(0)} rpm</span><span class="lamp ${g.coolant?'on':''}">COOLANT ${g.coolant?'M08':'M09'}</span><span class="lamp">${tool}</span>${CFG[P.machine].axes.map(a=>`<span class="lamp ${P.ref[a.toLowerCase()]?'on':''}">ZRN ${a}</span>`).join('')}<span class="lamp ${P.pwe?'alarm':''}">${P.pwe?'SW0100':'NO ALARM'}</span><span class="lamp">F ${RT.state.feedOv}% · R ${RT.state.rapidOv==='F0'?'F0':RT.state.rapidOv+'%'} · S ${RT.state.spindleOv}%</span>`;
  if(html!==lastInd){ind.innerHTML=html;lastInd=html;}
  if(P.screen==='POS'&&!screen.hidden)screen.innerHTML=screenHTML();}
 setInterval(()=>{if(panel.classList.contains('cnc-editor-mode'))refresh(false);},250);
 // the lathe view draws the tool at the manual position too
 const cur0=LatheView.current.bind(LatheView);LatheView.current=function(){const c=cur0(),m=globalThis.manualPos;if(!m||!c||globalThis.simMode!=='lathe')return c;const tv=LatheSim.TIPV[c.s.tipDir]||[0,0],R=c.s.noseR||0;return {...c,tip:{x:m.x,z:m.z},c:{a:m.z-tv[1]*R,b:m.x/2-tv[0]*R}};};
 function setMachine(m){P.machine=m;P.mdiRun=null;P.rel={x:0,y:0,z:0};P.ref={};P.sel=null;if(m==='mill'&&P.sub.OFS!=='OFFSET'&&!['WORK','SETTING','MACRO'].includes(P.sub.OFS))P.sub.OFS='OFFSET';if(m==='lathe'&&P.sub.OFS==='OFFSET')P.sub.OFS='GEOM';buildAxes();render();refresh(true);api.machine=m;}
 $('paramsetup').onclick=()=>{if(!panel.classList.contains('cnc-editor-mode'))$('editor-cnc').click();P.screen='SYSTEM';P.sel=null;render();};
 $('paramreset').onclick=()=>{if(!confirm('Reset '+(P.machine==='lathe'?'turning':'milling')+' parameters and work offsets to the defaults?'))return;MS.resetParams(P.machine);render();$('load').click();msg('Parameters and work offsets reset to defaults.');};
 const api={P,intercept,canEdit,refresh,render,setMachine,setMode,search,inputCell,cycleStart,machine:'mill',get mode(){return P.mode;}};globalThis.CncPanel=api;
 const style=document.createElement('style');style.textContent=`
 .panel:not(.cnc-editor-mode) .cnc-fkeys,.panel:not(.cnc-editor-mode) .cnc-softkeys,.panel:not(.cnc-editor-mode) .cnc-operator,.panel:not(.cnc-editor-mode) .cnc-screen{display:none!important}.cnc-screen[hidden]{display:none!important}
 .cnc-fkeys,.cnc-softkeys{display:flex;flex-wrap:wrap;gap:3px;margin:6px 9px 0}.cnc-softkeys{margin:0 9px;padding:4px;background:#1b2730;border-left:5px solid #363c3e;border-right:5px solid #363c3e}
 .cnc-fkeys button,.cnc-softkeys button,.cnc-operator button{font:600 10px Segoe UI,sans-serif;padding:5px 7px;border:1px solid #3c3a35;border-radius:3px;background:#e9e6dc;color:#26231d;cursor:pointer}.cnc-softkeys button{background:#33424d;color:#dce8e0;border-color:#51626e}
 .cnc-fkeys button.on,.cnc-softkeys button.on{background:#f7d35b;color:#2a2205}.cnc-operator button.on{background:#ffd34d;box-shadow:0 0 6px #ffd34d}
 .cnc-screen{position:absolute;inset:0;z-index:5;overflow:auto;background:#0b1821;color:#e2f4e6;font:12px/1.45 Consolas,monospace;padding:8px 10px}.cnc-screen table.grid{border-collapse:collapse;width:100%}.cnc-screen th{color:#f7d35b;text-align:right;font-weight:600;padding:2px 6px;border-bottom:1px solid #2c4252}.cnc-screen td{padding:2px 6px;text-align:right;border-bottom:1px solid #15283a}.cnc-screen td:first-child,.cnc-screen td.pname{text-align:left}.cnc-screen td.pname{color:#a7c0b0;font-size:11px}
 .cnc-screen td.cell{cursor:pointer}.cnc-screen td.cell.sel{background:#b6edb8;color:#102819}.cnc-screen .hint{color:#8fa79a;font-size:11px}.cnc-screen pre.mdi{margin:0;white-space:pre-wrap}.cnc-screen button{font:10px Segoe UI;padding:2px 5px;margin-left:3px}
 .posblk h4{margin:4px 0;color:#f7d35b;font:600 12px Consolas}.posblk .big{font:600 24px/1.25 Consolas,monospace;white-space:pre}.posblk .big b{display:inline-block;width:1.2em;color:#9ad1ff}.posall{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}.posall .big{font-size:15px}.posfoot{margin-top:8px;color:#bcd2c4;border-top:1px solid #2c4252;padding-top:5px}
 .cnc-operator{margin:0 9px 8px;padding:7px;background:linear-gradient(145deg,#cfcabd,#b8b2a3);border:1px solid #6c675c;border-radius:5px;display:grid;gap:5px;font:600 10px Segoe UI,sans-serif;color:#26231d}
 .op-row{display:flex;flex-wrap:wrap;gap:4px;align-items:center}.op-label{min-width:44px}.op-sep{width:8px}.op-row select{font:600 10px Segoe UI;padding:2px}.op-start{background:#4fb35a!important;color:#fff!important}.op-start.on{box-shadow:0 0 8px #5fe36c!important}.op-hold{background:#e0a33a!important}
 .op-ind .lamp{padding:3px 6px;border-radius:3px;background:#5b5850;color:#e8e3d4;font:600 10px Consolas,monospace}.op-ind .lamp.on{background:#2f8f3d;color:#fff}.op-ind .lamp.alarm{background:#c62f2f;color:#fff}`;document.head.append(style);
 setMachine(globalThis.simMode||'mill');
})();
