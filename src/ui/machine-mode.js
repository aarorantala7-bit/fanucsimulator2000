'use strict';
// One machine selector (Milling / Turning). Switching it swaps, together:
// the simulator + views, the CNC panel, the tool library, the stock setup and the G/M code library.
// Each machine keeps its own editor document; the choice is persisted.
(function setupMachineMode(){
 const MS=MachineState,KEY='fs2000.machine',DOC='fs2000.doc.';
 const store={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}}};
 const nav=document.querySelector('.menubar');
 const wrap=document.createElement('label');wrap.className='machine-select';wrap.innerHTML='Machine <select id="machinemode" aria-label="Machine type"><option value="mill">Milling (3-axis)</option><option value="lathe">Turning (2-axis lathe)</option></select>';nav.append(wrap);
 const sel=wrap.querySelector('select');
 // ---- demo menu (File) ----
 const demoBox=$('demomenu');
 for(const d of SimDemos.DEMOS){const b=document.createElement('button');b.type='button';b.dataset.machine=d.machine;b.dataset.demo=d.id;b.textContent=d.title;b.onclick=()=>loadDemo(d.id);demoBox.append(b);}
 function loadDemo(id){const d=SimDemos.byId(id);if(!d)return;if(d.machine!==globalThis.simMode)setSimMode(d.machine,{keepDoc:true});
  $('source').value=d.text;if(d.machine==='lathe'){if(d.stock)LatheView.setStock(d.stock);}else if(d.stock)stockConfig={x:d.stock.x,y:d.stock.y,z:d.stock.z,demo:SimRuntime.programNumber(d.text)};
  if(d.machine==='lathe')LatheView.demoO=d.stock?SimRuntime.programNumber(d.text):null;
  globalThis.manualPos=null;$('load').click();saveDoc();}
 // ---- transport delegation ----
 const orig={play:$('play').onclick,step:$('step').onclick,reset:$('reset').onclick,seek:$('seek').oninput,load:$('load').onclick};
 const lathe=()=>globalThis.simMode==='lathe';
 $('play').onclick=e=>{if(lathe()){if(editTimer!==null)return;LatheView.play();}else orig.play(e);};
 $('step').onclick=e=>{if(lathe()){if(editTimer!==null)return;LatheView.step();}else orig.step(e);};
 $('reset').onclick=e=>{if(lathe()){if(editTimer!==null)return;LatheView.reset();}else orig.reset(e);};
 $('seek').oninput=e=>{if(lathe()){if(editTimer!==null)return;LatheView.playing=false;LatheView.seek(Number(e.target.value));}else orig.seek(e);};
 $('load').onclick=e=>{if(lathe()){cancelProgramEdit();LatheView.load($('source').value);}else orig.load(e);saveDoc();globalThis.CncPanel?.refresh(true);};
 // ---- auto stock settings (margin %, keep manual size), shared by both machines ----
 try{const sv=JSON.parse(localStorage.getItem('fanucsim.stock')||'{}');if(sv.margin>=0)SimRuntime.state.stockMargin=+sv.margin;SimRuntime.state.keepManualStock=!!sv.keep;if(sv.zero&&['center','corner','custom','fit'].includes(sv.zero.mode))SimRuntime.state.millZero={mode:sv.zero.mode,x:+sv.zero.x||0,y:+sv.zero.y||0,z:+sv.zero.z||0};}catch{}
 const saveStockPrefs=()=>{try{localStorage.setItem('fanucsim.stock',JSON.stringify({margin:SimRuntime.state.stockMargin,keep:SimRuntime.state.keepManualStock,zero:SimRuntime.state.millZero}));}catch{}};
 globalThis.saveStockPrefs=saveStockPrefs;
 const syncStockUi=()=>{for(const e of document.querySelectorAll('.stockmargin'))e.value=SimRuntime.state.stockMargin;for(const e of document.querySelectorAll('.stockkeep'))e.checked=SimRuntime.state.keepManualStock;};
 for(const e of document.querySelectorAll('.stockmargin'))e.onchange=()=>{const v=Math.max(0,Math.min(200,Number(e.value)));if(!Number.isFinite(v))return;SimRuntime.state.stockMargin=v;saveStockPrefs();syncStockUi();
  if(lathe()){if(LatheView.autoStock){LatheView.load($('source').value);LatheView.fit();}}else if(stockConfig===null){applyStock(null);if(typeof stockPreview==='function')stockPreview();}};
 for(const e of document.querySelectorAll('.stockkeep'))e.onchange=()=>{SimRuntime.state.keepManualStock=e.checked;saveStockPrefs();syncStockUi();};
 syncStockUi();
 // A newly opened program gets an auto-sized blank unless "keep manual size" is on.
 globalThis.onProgramOpened=()=>{if(SimRuntime.state.keepManualStock)return;if(lathe())LatheView.autoStock=true;else stockConfig=null;};
 // ---- setup menu routing ----
 const toolBtn=document.querySelector('[data-dialog="tooldialog"]');if(toolBtn){toolBtn.removeAttribute('data-dialog');toolBtn.id='toolsetup';toolBtn.onclick=()=>lathe()?LatheView.openTools():$('tooldialog').showModal();}
 const millStock=$('stocksetup').onclick;$('stocksetup').onclick=e=>lathe()?LatheView.openStock():millStock(e);
 // ---- lathe view items ----
 for(const b of document.querySelectorAll('[data-lview]'))b.onclick=()=>{LatheView.view=b.dataset.lview;LatheView.fit();LatheView.dirty=true;};
 // ---- stop messages ----
 globalThis.onProgramStop=reason=>{const msg={M00:'M00 PROGRAM STOP · press CYCLE START to continue',M01:'M01 OPTIONAL STOP · press CYCLE START to continue','single-block':'SINGLE BLOCK · block finished, press CYCLE START',end:'Program end (M30 / M02) · cycle complete','feed-zero':'FEED OVERRIDE 0% · axes held',message:'#3006 operator message · press CYCLE START',hold:'FEED HOLD'}[reason]||String(reason);$('active').textContent=msg;globalThis.CncPanel?.refresh(true);};
 function saveDoc(){store.set(DOC+globalThis.simMode,$('source').value);}
 $('source').addEventListener('input',()=>{clearTimeout(saveDoc.t);saveDoc.t=setTimeout(saveDoc,400);});
 function setSimMode(m,opt={}){m=m==='lathe'?'lathe':'mill';const prev=globalThis.simMode;if(prev&&prev!==m&&!opt.initial)saveDoc();
  if(prev&&(prev==='lathe'?LatheView.playing:playing)){playing=false;LatheView.playing=false;}
  globalThis.simMode=m;document.body.dataset.machine=m;sel.value=m;store.set(KEY,m);globalThis.manualPos=null;
  LatheView.show(m==='lathe');document.querySelector('.panel .panelhead strong').textContent=m==='lathe'?'Turning visualization (XZ / revolved)':'3D visualization';
  for(const d of document.querySelectorAll('dialog[open]'))if(/tool|stock/.test(d.id))d.close();
  globalThis.CodeLibrary?.setMachine(m);globalThis.CncPanel?.setMachine(m);
  if(!opt.keepDoc){const doc=store.get(DOC+m);if(doc!=null&&doc.trim())$('source').value=doc;else{const d=SimDemos.forMachine(m)[0];$('source').value=d.text;if(m==='lathe'){LatheView.setStock(d.stock);LatheView.demoO=SimRuntime.programNumber(d.text);}else if(d.stock)stockConfig={...d.stock,demo:SimRuntime.programNumber(d.text)};}
   $('load').click();}
  if(m==='mill'){dirty=true;updateHUD();}else LatheView.dirty=true;}
 sel.onchange=()=>setSimMode(sel.value);
 globalThis.setSimMode=setSimMode;globalThis.loadDemo=loadDemo;
 // Snapshot used by the headless check: every machine-dependent part reports which machine it shows.
 globalThis.machineModeSnapshot=()=>({mode:globalThis.simMode,body:document.body.dataset.machine,selector:sel.value,
  view:$('lathecanvas').hidden?'mill':'lathe',panel:globalThis.CncPanel?.machine,library:globalThis.CodeLibrary?.machine,
  tools:lathe()?'lathe':'mill',toolDialog:lathe()?'lathetooldialog':'tooldialog',stockDialog:lathe()?'lathestockdialog':'stockdialog',
  demos:[...demoBox.children].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.dataset.machine)});
 const style=document.createElement('style');style.textContent=`.machine-select{margin-left:auto;display:flex;align-items:center;gap:6px;font:600 12px Segoe UI,sans-serif;color:#354555;padding:0 8px}.machine-select select{font:600 12px Segoe UI,sans-serif;padding:4px 6px;border:1px solid #9fb3c8;border-radius:4px;background:#fff;color:#175895}
 body[data-machine=lathe] .mill-only,body[data-machine=mill] .lathe-only,body[data-machine=lathe] #demomenu [data-machine=mill],body[data-machine=mill] #demomenu [data-machine=lathe]{display:none!important}#demomenu{display:contents}body[data-machine=lathe] #renderinfo{visibility:hidden}`;document.head.append(style);
 const start=store.get(KEY)==='lathe'?'lathe':'mill';setSimMode(start,{initial:true});
})();
