'use strict';
// File ▸ Import from photo… / Import WinCAM / NC file… / Export WinCAM (.cnc)…
// Photo import: several images (camera or files, ordered, reorderable) → canvas preprocessing → OCR with the
// vendored Tesseract.js (loaded lazily on first use) → NcCleanup per page → page de-dupe → editable preview →
// appended after the last imported block. Nothing leaves the browser.
const ImportDialog=(()=>{
const VENDOR={script:'vendor/tesseract/tesseract.min.js',worker:'vendor/tesseract/worker.min.js',core:'vendor/tesseract/',lang:'vendor/tessdata'};
const abs=p=>new URL(p,location.href).href;
// WebAssembly SIMD probe (same bytes as wasm-feature-detect). The core build is chosen here so that only the
// two vendored builds are ever requested (tesseract.js would otherwise ask for a relaxed-SIMD build).
const hasSimd=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));}catch(e){return false;}};
let pages=[],worker=null,loading=null,lastImport=null,wincamMeta=null,busy=false;
const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);for(const k of kids)e.append(k);return e;};
function buildUi(){
 const file=$('open').parentElement;const hr=document.createElement('hr');
 const bPhoto=el('button',{id:'photoimport',textContent:'Import from photo…'}),bWin=el('button',{id:'wincamimport',textContent:'Import WinCAM / NC file…'}),bExp=el('button',{id:'wincamexport',textContent:'Export WinCAM (.cnc)…'});
 $('saveprogram').after(hr,bPhoto,bWin,bExp);
 document.body.append(el('input',{type:'file',id:'wincamfile',accept:'.cnc,.nc,.txt,.ncc,.tap,.iso',hidden:true}));
 const d=el('dialog',{id:'photodialog'});d.innerHTML=`<h2>Import program from photos</h2>
<section><p class="muted">Photograph the control's program screen (or pick screenshots). Several pages are read in the order below; lines repeated across consecutive pages are dropped. OCR runs in this browser — nothing is uploaded.</p>
<div class="photobuttons"><label class="photobtn">📷 Take photo<input type="file" id="photocamera" accept="image/*" capture="environment" hidden></label><label class="photobtn">🖼 Choose images<input type="file" id="photofiles" accept="image/*" multiple hidden></label><button id="photoclear">Clear</button></div>
<ol id="photolist" class="photolist"></ol>
<div class="settingsrow"><label><input type="checkbox" id="photoprep" checked> Enhance (grayscale, invert dark screens, threshold)</label><button id="photoocr" class="primary" disabled>Read text</button></div>
<div id="photostatus" role="status" class="muted"></div></section>
<section><h2>Preview — check and edit before appending</h2><textarea id="photopreview" spellcheck="false" rows="12" placeholder="Recognized program text appears here."></textarea><details><summary class="muted">Cleanup log</summary><div id="photonotes" class="readout photonotes"></div></details></section>
<div class="closebar"><button id="photoappend" class="primary" disabled>Append to program</button><button data-close="photodialog">Close</button></div>`;
 document.body.append(d);d.querySelector('[data-close]').onclick=()=>d.close();
 const st=document.createElement('style');st.textContent=`#photodialog{width:min(720px,calc(100vw - 24px));box-sizing:border-box}.photobuttons{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.photobtn{background:#e8edf3;border-radius:4px;padding:7px 11px;cursor:pointer;font-size:13px}.photobtn:hover{background:#d8e2ef}.photolist{list-style:none;padding:0;margin:0;display:grid;gap:6px}.photolist li{display:flex;align-items:center;gap:8px;border:1px solid var(--edge);border-radius:5px;padding:5px}.photolist img{width:72px;height:48px;object-fit:cover;border-radius:3px;background:#222}.photolist .pname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.photolist button{padding:4px 8px;font-size:12px}#photopreview{width:100%;box-sizing:border-box;font:12px/1.5 Consolas,'Courier New',monospace;resize:vertical}.importnote{display:flex;gap:8px;align-items:center;padding:7px 12px;border-top:1px solid var(--edge);background:#fff8e6;font-size:12px;color:#5d4a1c}.importnote span{flex:1}.importnote button{padding:3px 8px;font-size:12px}.tooluse{color:var(--muted);font-weight:400}.photonotes{max-height:140px;overflow:auto;font:11px/1.5 monospace;white-space:pre-wrap}`;document.head.append(st);
 bPhoto.onclick=()=>{renderList();d.showModal();};
 $('photocamera').onchange=e=>addFiles(e.target.files);$('photofiles').onchange=e=>addFiles(e.target.files);
 $('photoclear').onclick=()=>{pages.forEach(p=>URL.revokeObjectURL(p.url));pages=[];renderList();};
 $('photoocr').onclick=()=>runOcr();$('photoappend').onclick=appendPreview;$('photopreview').oninput=()=>{$('photoappend').disabled=!$('photopreview').value.trim();};
 bWin.onclick=()=>$('wincamfile').click();$('wincamfile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await openWincam(f);};
 bExp.onclick=exportWincam;
 // Generic File ▸ Open: read bytes so windows-1252 files (Ä/Ö in WinCAM comments) decode correctly.
 $('file').onchange=async()=>{const f=$('file').files[0];$('file').value='';if(!f)return;if(f.size>2e6){$('diagnostics').textContent='File exceeds the 2 MB viewer limit.';return;}try{await openWincam(f,true);}catch(err){$('diagnostics').textContent='Unable to read file.';}};
}
async function openWincam(f,generic){if(f.size>2e6){$('diagnostics').textContent='File exceeds the 2 MB viewer limit.';return;}
 const dec=WinCam.decode(await f.arrayBuffer());const im=WinCam.importText(dec.text);wincamMeta={...im.meta,encoding:dec.encoding,name:f.name};
 const note=applyTools(im.text);globalThis.onProgramOpened?.();setSource(im.text);lastImport=null;
 const head=`Imported ${f.name} (${dec.encoding}, ${im.meta.eol==='\r\n'?'CRLF':'LF'}${im.meta.oNumber?`, O${im.meta.oNumber}`:''}).`;
 if(!generic)$('diagnostics').textContent=head+(note?'\n'+note:'');else if(note)$('diagnostics').textContent+=(($('diagnostics').textContent?'\n':'')+note);showNote(note);}
// List the program's tools in the current machine's tool table (T number, H/D or offset numbers, first call, name
// from the comment after the call). Geometry is never read from the program: new tools get the simulator defaults.
let programTools=null;
function applyTools(text){const machine=globalThis.simMode==='lathe'?'lathe':'mill';const list=WinCam.listTools(text,machine);programTools={machine,list};if(!list.length)return '';const added=[];
 if(machine==='lathe'){const MS=globalThis.MachineState;if(!MS)return '';const lib=MS.lathe.tools;for(const t of list){let e=lib.find(x=>x.id===t.id);if(!e){const def=(globalThis.MachineData?.LATHE_TOOLS||[]).find(x=>x.id===t.id);e=def?JSON.parse(JSON.stringify(def)):{id:t.id,name:'T'+t.id,type:'od',shape:'C',angle:80,kappa:95,noseR:0.4,tip:3,edge:12,width:0};lib.push(e);lib.sort((a,b)=>a.id-b.id);added.push(t.id);}if(t.name)e.name=t.name;
   for(const o of t.offsets){MS.lathe.offsets.geom[o]??={x:0,z:0,r:e.noseR||0,t:e.tip??3};MS.lathe.offsets.wear[o]??={x:0,z:0,r:0,t:0};}}MS.persist();globalThis.LatheView?.renderTools?.();}
 else if(typeof tools!=='undefined'&&typeof toolDefaults==='function'){for(const t of list){if(!tools.has(t.id)){tools.set(t.id,toolDefaults(t.id));added.push(t.id);}if(t.name)tools.get(t.id).name=t.name;}if(typeof saveMillTools==='function')saveMillTools();if(typeof renderTools==='function')renderTools();}
 const desc=t=>`T${t.id}${t.name?` "${t.name}"`:''} (${[t.h.length?'H'+t.h.join('/H'):'',t.d.length?'D'+t.d.join('/D'):'',t.offsets.length?'offset '+t.offsets.join('/'):''].filter(Boolean).join(' ')||'no offset'}, first at ${WinCam.firstBlock(t)})`;
 return `Tools in the program: ${list.map(desc).join(', ')}. Geometry (diameter, radius, length) uses the simulator defaults${added.length?` (new: T${added.join(', T')})`:''}; edit it by hand in Setup ▸ Tool library.`;}
function showNote(text){let n=$('importnote');if(!text){n?.remove();return;}if(!n){n=el('div',{id:'importnote',className:'importnote',role:'status'});$('source').closest('.panel').querySelector('.programfoot').before(n);}
 n.replaceChildren(el('span',{textContent:text}),Object.assign(el('button',{textContent:'Tool library…'}),{onclick:()=>{if(globalThis.simMode==='lathe'&&globalThis.LatheView?.openTools)LatheView.openTools();else $('tooldialog').showModal();}}),Object.assign(el('button',{textContent:'✕',title:'Dismiss'}),{onclick:()=>n.remove()}));}
// Tool cards show what the imported program uses: H/D (mill) or offset numbers (lathe) and the first call.
function annotateCards(){if(!programTools)return;const byId=new Map(programTools.list.map(t=>[t.id,t]));
 for(const head of document.querySelectorAll('#tools .toolcard summary, #ltools .ltool-card h4')){const m=/^T0*(\d+)/.exec(head.textContent);const t=m&&byId.get(+m[1]);head.querySelector('.tooluse')?.remove();if(!t)continue;
  head.append(el('small',{className:'tooluse',textContent:` · in program: ${[t.h.length?'H'+t.h.join('/H'):'',t.d.length?'D'+t.d.join('/D'):'',t.offsets.length?'offset '+t.offsets.join('/'):''].filter(Boolean).join(' ')||'no offset'} · first ${WinCam.firstBlock(t)}`}));}}
function hookToolTables(){if(typeof renderTools==='function'){const orig=renderTools;renderTools=function(...a){const r=orig.apply(this,a);annotateCards();return r;};}
 const LV=globalThis.LatheView;if(LV?.renderTools){const o=LV.renderTools;LV.renderTools=function(...a){const r=o.apply(this,a);annotateCards();return r;};}}
function setSource(text){$('source').value=text;$('source').dispatchEvent(new Event('input'));$('load').click();}
function exportWincam(){const text=$('source').value;const meta=wincamMeta||{};const out=WinCam.exportText(text,meta);const bytes=WinCam.encode(out,meta.encoding==='utf-8'?'utf-8':'windows-1252');
 const blob=new Blob([bytes],{type:'text/plain'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=WinCam.fileName(out);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);ImportDialog.lastExport=out;}
function addFiles(list){for(const f of list){if(!/^image\//.test(f.type)&&!/\.(png|jpe?g|webp|bmp|gif|heic)$/i.test(f.name))continue;pages.push({file:f,name:f.name||'photo',url:URL.createObjectURL(f)});}renderList();}
function renderList(){const ol=$('photolist');ol.textContent='';pages.forEach((p,i)=>{const li=el('li',{},el('img',{src:p.url,alt:`Page ${i+1}`}),el('span',{className:'pname',textContent:`${i+1}. ${p.name}`}));
 const mk=(t,title,fn,dis)=>{const b=el('button',{textContent:t,title,disabled:!!dis});b.onclick=fn;return b;};
 li.append(mk('↑','Move up',()=>{[pages[i-1],pages[i]]=[pages[i],pages[i-1]];renderList();},i===0),mk('↓','Move down',()=>{[pages[i+1],pages[i]]=[pages[i],pages[i+1]];renderList();},i===pages.length-1),mk('✕','Remove',()=>{URL.revokeObjectURL(p.url);pages.splice(i,1);renderList();}));ol.append(li);});
 $('photoocr').disabled=!pages.length||busy;}
const status=t=>{$('photostatus').textContent=t;};
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.append(s);});}
async function getWorker(){if(worker)return worker;if(loading)return loading;
 loading=(async()=>{if(location.protocol==='file:')throw new Error('Photo OCR needs the app served over http(s) (browsers block workers on file://). Run e.g. "python3 -m http.server" in the app folder.');
  if(typeof WebAssembly!=='object')throw new Error('This browser has no WebAssembly support.');
  if(!globalThis.Tesseract){status('Loading OCR engine (first use, ~7 MB)…');await loadScript(VENDOR.script);}
  const w=await Tesseract.createWorker('eng',1,{workerPath:abs(VENDOR.worker),corePath:abs(VENDOR.core+(hasSimd()?'tesseract-core-simd-lstm.wasm.js':'tesseract-core-lstm.wasm.js')),langPath:abs(VENDOR.lang),gzip:true,cacheMethod:'none',logger:m=>{if(m.status)status(`${m.status}${m.progress?` ${Math.round(m.progress*100)}%`:''}`);}});
  await w.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});worker=w;return w;})();
 try{return await loading;}finally{loading=null;}}
// Grayscale → invert dark (FANUC black/green) screens → Otsu threshold; small photos are upscaled for OCR.
async function preprocess(file,enhance){const bmp=await createImageBitmap(file);let scale=Math.min(1,2400/Math.max(bmp.width,bmp.height));if(Math.max(bmp.width,bmp.height)<1000)scale=Math.min(3,1400/Math.max(bmp.width,bmp.height));
 const c=document.createElement('canvas');c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(bmp,0,0,c.width,c.height);bmp.close?.();
 if(!enhance)return c;const img=g.getImageData(0,0,c.width,c.height),d=img.data,n=d.length/4,gray=new Uint8Array(n),hist=new Uint32Array(256);let sum=0;
 for(let i=0;i<n;i++){const v=(d[i*4]*0.299+d[i*4+1]*0.587+d[i*4+2]*0.114)|0;gray[i]=v;hist[v]++;sum+=v;}
 const invert=sum/n<110;let best=0,thr=128,wB=0,sB=0;const total=n,sAll=hist.reduce((a,h,i)=>a+h*i,0);for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=total-wB;if(!wF)break;sB+=t*hist[t];const mB=sB/wB,mF=(sAll-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>best){best=v;thr=t;}}
 for(let i=0;i<n;i++){let v=gray[i]>thr?255:0;if(invert)v=255-v;d[i*4]=d[i*4+1]=d[i*4+2]=v;d[i*4+3]=255;}g.putImageData(img,0,0);return c;}
async function runOcr(){if(busy||!pages.length)return;busy=true;$('photoocr').disabled=true;$('photoappend').disabled=true;const texts=[],notes=[];
 try{const w=await getWorker();for(let i=0;i<pages.length;i++){status(`Reading page ${i+1} of ${pages.length}…`);const canvas=await preprocess(pages[i].file,$('photoprep').checked);const r=await w.recognize(canvas);const c=NcCleanup.cleanOcrText(r.data.text);texts.push(c.lines);notes.push(`Page ${i+1}: ${c.lines.length} lines, ${c.dropped} screen lines dropped${c.notes.length?'\n  '+c.notes.join('\n  '):''}`);}
  const dd=NcCleanup.dedupePages(texts);dd.removed.forEach((k,i)=>notes.push(`Pages ${i+1}→${i+2}: ${k} overlapping line${k===1?'':'s'} removed`));
  $('photopreview').value=dd.text;$('photonotes').textContent=notes.join('\n');status(`Done: ${dd.lines.length} lines from ${pages.length} page${pages.length===1?'':'s'}. Check the text, then append.`);$('photoappend').disabled=!dd.text.trim();}
 catch(e){status('OCR failed: '+(e&&e.message||e));}finally{busy=false;renderList();}}
function appendPreview(){const text=$('photopreview').value.replace(/\r\n?/g,'\n').trim();if(!text)return;const r=NcCleanup.appendImport($('source').value,text,lastImport);lastImport=r.state;setSource(r.doc);status('Appended to the program editor.');$('photodialog').close();}
if(typeof document!=='undefined'&&document.getElementById('open')){buildUi();hookToolTables();}
return {get pages(){return pages;},get meta(){return wincamMeta;},get programTools(){return programTools;},applyTools,getWorker,preprocess,exportWincam,lastExport:null};
})();
