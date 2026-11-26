'use strict';
// Shared visual layout and text inspection, independent of geometry playback.
(()=>{
 const e=id=>document.getElementById(id),g=e('turning-workspace'),mode=e('workspace-mode');
 const layout=g.querySelector('.turn-layout'),left=layout.querySelector('.turn-card'),right=layout.querySelector('.turn-demo-info'),editor=right.querySelector('.turn-editor47'),doc=editor.querySelector('.turn-document'),src=e('turn-source');
 const view=left.querySelector('.turn-view47'),svg=e('turn-body').ownerSVGElement,controls=view.querySelector('.turn-view-controls'),bar=left.querySelector('.turn-playback');
 const header=(title,tag)=>{const h=document.createElement('div');h.className='panelhead';h.innerHTML='<strong>'+title+'</strong><span class="muted">'+tag+'</span>';return h;};
 left.classList.add('panel');right.classList.add('panel');left.querySelector('h3').remove();right.querySelector('h3').remove();left.prepend(header('3D visualization','Turning · shape study'));right.prepend(header('Program','Text editor'));
 const viewport=document.createElement('div');viewport.className='viewport turn-viewport48';view.before(viewport);viewport.append(view,svg);bar.classList.add('transport');bar.append(e('turn-demo-tool'),e('turn-demo-status'));left.querySelector('#turn-spin').hidden=true;
 editor.querySelector('h3').remove();doc.className='programbody';const actions=editor.querySelector('.buttons');actions.hidden=true;right.append(doc);right.append(actions);
 const foot=document.createElement('div');foot.className='programfoot';foot.innerHTML='<button id="turn-load" class="primary">Inspect text</button><small id="turn-inspect-summary">Read-only text · no execution</small>';right.append(foot);
 const detail=document.createElement('div');detail.className='turn-line-detail';detail.setAttribute('aria-live','polite');right.append(detail);editor.hidden=true;right.querySelector('.turn-demo-text').hidden=true;right.querySelector(':scope > .buttons').hidden=true;
 const split=document.createElement('div');split.className='splitter';split.setAttribute('role','separator');split.setAttribute('aria-label','Resize Turning panels');split.setAttribute('aria-orientation','vertical');left.after(split);
 split.addEventListener('pointerdown',ev=>{split.setPointerCapture(ev.pointerId);});split.addEventListener('pointermove',ev=>{if(!split.hasPointerCapture(ev.pointerId))return;const r=layout.getBoundingClientRect();const fraction=Math.max(.35,Math.min(.79,(ev.clientX-r.left)/r.width));layout.style.setProperty('--turn-left',fraction*100+'%');});
 function inspect(){const rows=src.value.split('\n'),row=src.value.slice(0,src.selectionStart).split('\n').length-1,raw=rows[row]||'';const tokens=raw.match(/\([^)]*\)|[A-Za-z][+-]?(?:\d+(?:\.\d*)?|\.\d+)|\S+/g)||[];e('turn-inspect-summary').textContent=rows.length+' lines · '+rows.filter(x=>x.trim()).length+' nonempty · text only';detail.replaceChildren();const label=document.createElement('span');label.textContent='Line '+(row+1)+' · ';detail.append(label);for(const word of tokens.slice(0,64)){const t=document.createElement('code');t.textContent=word;t.className=/^\(/.test(word)?'comment':/^[GM]/i.test(word)?'identifier':'word';detail.append(t);}if(!tokens.length)detail.append('Empty');}
 for(const event of ['input','click','keyup','select'])src.addEventListener(event,inspect);e('turn-load').onclick=inspect;
 const fileMenu=e('open').parentElement,macroIds=['macrodemo','nestedmacro','multimacro','paramdemo','draftdemo','materialdemo','combineddemo'];
 for(const [id,target] of [['open','turn-doc-open'],['saveprogram','turn-doc-save'],['demo','turn-demo']])e(id).addEventListener('click',ev=>{if(mode.value!=='turning')return;ev.preventDefault();ev.stopImmediatePropagation();fileMenu.closest('details')?.removeAttribute('open');e(target).click();},true);
 function update(){const turning=mode.value==='turning';for(const id of macroIds)e(id).hidden=turning;e('turn-demo').hidden=true;if(turning)inspect();}mode.addEventListener('change',update);update();
 const speed=e('turn-speed');const fast=document.createElement('option');fast.value='5';fast.textContent='5×';speed.append(fast);bar.querySelector('label').firstChild.textContent='Playback ';
 const style=document.createElement('style');style.textContent=`#turning-workspace{padding:14px 18px 10px;min-height:0;overflow:visible;height:calc(100vh - 151px);display:flex;flex-direction:column}#turning-workspace .turn-head,#turning-workspace .turn-note{display:none}#turning-workspace .turn-layout{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,var(--turn-left,65%)) 7px minmax(0,1fr);gap:0}#turning-workspace .turn-layout>.panel{padding:0;border-radius:6px;min-height:0;overflow:hidden}#turning-workspace .turn-viewport48{display:flex;flex-direction:column;min-height:150px}#turning-workspace .turn-view47{flex:1;min-height:0;margin:0;display:flex;flex-direction:column;gap:0}#turning-workspace .turn-view-controls{flex:0 0 auto;padding:5px 9px;gap:5px}#turning-workspace .turn-view-controls button{flex:0 0 auto}#turn-mesh{flex:1;min-height:0;height:0;width:100%;border:0;border-radius:0}#turn-view-hint{padding:3px 9px}#turning-workspace .turn-viewport48>svg{flex:1;min-height:0;max-height:none}#turning-workspace .turn-playback{margin:0}#turning-workspace .turn-playback .buttons{margin:0}#turning-workspace .programbody textarea{height:100%;min-width:0}#turning-workspace #turn-line-numbers{white-space:pre;overflow:hidden;text-align:right;background:#202528;color:#9aa6ad;min-width:34px;padding:13px 6px;font:13px/1.65 Consolas,monospace}#turning-workspace [hidden],.dropdown button[hidden]{display:none!important}.turn-line-detail{font:11px/1.6 Consolas,monospace;display:flex;flex-wrap:wrap;gap:4px;padding:7px 10px;max-height:75px;overflow:auto;border-top:1px solid var(--edge);color:var(--muted)}.turn-line-detail code{background:#edf0f4;padding:0 4px;border-radius:2px;color:#364b5a}.turn-line-detail code.identifier{color:#175895}.turn-line-detail code.comment{color:#64786b}@media(max-width:760px){#turning-workspace{height:auto;padding:10px}#turning-workspace .turn-layout{display:flex;flex-direction:column;gap:10px}#turning-workspace .turn-viewport48{height:390px;flex:auto}#turning-workspace .programbody textarea{height:340px;flex:auto}#turning-workspace .turn-layout>.panel{flex:auto}}`;document.head.append(style);inspect();
})();

'use strict';
// Text-entry panel only; no machine controls. EOB markers never modify editor text.
(function setupEditorKeypad(){
 const editor=document.getElementById('turn-source'),panel=editor.closest('.panel'),body=editor.parentElement;
 editor.setAttribute('autocorrect','off');editor.setAttribute('autocapitalize','off');editor.setAttribute('autocomplete','off');editor.wrap='off';
 const head=panel.querySelector('.panelhead'),toggle=document.createElement('button');toggle.type='button';toggle.id='turn-keypad-toggle';toggle.textContent='CNC keypad';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','turn-editor-keypad');head.append(toggle);
 const eobLabel=document.createElement('label');eobLabel.className='eob-option';const eob=document.createElement('input');eob.type='checkbox';eob.id='turn-show-eob';eobLabel.append(eob,document.createTextNode('Show EOB (;)'));head.append(eobLabel);
 const mirror=document.createElement('pre');mirror.className='eob-mirror';mirror.setAttribute('aria-hidden','true');body.prepend(mirror);
 function syncMarkers(){body.classList.toggle('eob-visible',eob.checked);mirror.hidden=!eob.checked;if(!eob.checked)return;const text=editor.value;mirror.replaceChildren();const lines=text.split('\n');for(let i=0;i<lines.length;i++){mirror.append(document.createTextNode(lines[i]));if(i<lines.length-1){if(!/;\s*$/.test(lines[i])){const mark=document.createElement('span');mark.textContent=';';mirror.append(mark);}mirror.append(document.createTextNode('\n'));}}mirror.style.transform=`translate(${-editor.scrollLeft}px,${-editor.scrollTop}px)`;}
 eob.onchange=syncMarkers;editor.addEventListener('input',syncMarkers);editor.addEventListener('scroll',()=>{mirror.style.transform=`translate(${-editor.scrollLeft}px,${-editor.scrollTop}px)`;});document.getElementById('turn-load').addEventListener('click',()=>queueMicrotask(syncMarkers));
 const pad=document.createElement('section');pad.id='turn-editor-keypad';pad.hidden=true;pad.setAttribute('aria-label','Virtual text-entry keypad');pad.innerHTML='<div class="keypad-head"><strong>EDITOR KEYPAD</strong><small>Text entry only</small><button type="button" id="turn-keypad-close" aria-label="Hide keypad">×</button></div><div class="keypad-grid"></div>';
 body.after(pad);const grid=pad.querySelector('.keypad-grid');
 const entry=document.createElement('div');entry.className='keypad-entry';entry.hidden=true;entry.innerHTML='<label for="turn-keypad-buffer">INPUT BUFFER</label><div class="keypad-input-line"><span class="buffer-prompt" aria-hidden="true">&gt;</span><textarea id="turn-keypad-buffer" rows="1" readonly inputmode="none" spellcheck="false" aria-label="Pending text"></textarea><span id="turn-keypad-eob-mark" hidden>;</span></div><small id="turn-keypad-status" role="status">Type with the keypad, then INSERT, INPUT or ALTER.</small>';pad.before(entry);
 const buffer=entry.querySelector('#turn-keypad-buffer'),eobMark=entry.querySelector('#turn-keypad-eob-mark'),status=entry.querySelector('#turn-keypad-status');
 buffer.addEventListener('input',()=>{const a=buffer.selectionStart,b=buffer.selectionEnd;buffer.value=buffer.value.toUpperCase();buffer.setSelectionRange(a,b);});
 let pendingEob=false;
 function markEob(on){pendingEob=on;eobMark.hidden=!on;const key=grid.querySelector('[aria-label="EOB"]');if(key)key.setAttribute('aria-pressed',String(on));}
 function pending(value){if(pendingEob){status.textContent='EOB pending. Press INSERT or INPUT, or CAN to cancel.';return;}const a=buffer.selectionStart,b=buffer.selectionEnd;buffer.setRangeText(formatTextInsert(buffer.value,value,a,b),a,b,'end');status.textContent='Pending text updated.';}
 function eobKey(){markEob(true);status.textContent='EOB (;) pending. Press INSERT or INPUT to commit and move to the next row.';}
 function cancelKey(){if(pendingEob){markEob(false);status.textContent='EOB cancelled.';return;}const a=buffer.selectionStart,b=buffer.selectionEnd;buffer.setRangeText('',a===b?Math.max(0,a-1):a,b,'end');status.textContent='Pending text updated.';}
 function textAction(key){let a=editor.selectionStart,b=editor.selectionEnd;const v=buffer.value;if((key==='ALTER'||key==='DELETE')&&a===b&&panel.classList.contains('cnc-editor-mode')){const text=editor.value,start=a-text.slice(0,a).split('\n').at(-1).length;let end=text.indexOf('\n',a);if(end<0)end=text.length;const word=[...text.slice(start,end).matchAll(/\S+/g)].find(m=>a-start>=m.index&&a-start<m.index+m[0].length);if(word){a=start+word.index;b=a+word[0].length;}}if(key==='DELETE'){if(a!==b){change('',a,b);status.textContent='Highlighted text deleted.';}else{status.textContent='No highlighted word to delete.';}return;}if(pendingEob&&key==='ALTER'){status.textContent='Press INSERT or INPUT to commit the pending EOB.';return;}if(!v&&!pendingEob){status.textContent='Enter pending text first.';return;}if(key==='ALTER'&&a===b){status.textContent='Highlight a word to replace; use INSERT at an empty cursor.';return;}const ending=pendingEob,stop=key==='INSERT'?a:b;change(formatBufferedCommit(v,a,stop,ending),a,stop);buffer.value='';buffer.setSelectionRange(0,0);markEob(false);status.textContent=ending?'Line committed. Ready for the next row.':key==='ALTER'?'Selected text replaced.':'Pending text inserted.';}


 function show(active){pad.hidden=!active;entry.hidden=!active;toggle.setAttribute('aria-expanded',String(active));toggle.classList.toggle('primary',active);editor.inputMode=active?'none':'text';}
 toggle.onclick=()=>show(pad.hidden);pad.querySelector('#turn-keypad-close').onclick=()=>show(false);
 // Shared text formatting only. No interpretation or generation of machine instructions.
 function formatTextInsert(text,value,a,b){
   value=value.toUpperCase();
   if(!/^[A-Z]$/.test(value)||a!==b)return value;
   const before=text.slice(0,a),after=text.slice(b);
   if(after&&!/^[\n\t ]/.test(after))return value;
   const line=before.slice(before.lastIndexOf('\n')+1);
   if(/^(?:[A-Z][+-]?(?:\d+(?:\.\d*)?|\.\d+)[ \t]+)*[A-Z][+-]?(?:\d+(?:\.\d*)?|\.\d+)$/i.test(line))return ' '+value;
   return value;
 }
 // Separate complete plain text words across buffer commits; leave expressions and comments alone.
 function formatBufferedCommit(value,a,b,ending){
   if(!value)return ending?'\n':'';
   const word=/^[A-Z][+-]?(?:\d+(?:\.\d*)?|\.\d+)$/i;
   const simple=line=>line.trim()!==''&&line.trim().split(/[ \t]+/).every(x=>word.test(x));
   const left=editor.value.slice(0,a).split('\n').at(-1),right=editor.value.slice(b).split('\n')[0];
   if(simple(value)){
     if(simple(left)&&!/[ \t]$/.test(left)&&!/^\s/.test(value))value=' '+value;
     if(!ending&&simple(right)&&!/^\s/.test(right)&&!/[ \t]$/.test(value))value+=' ';
   }
   return value+(ending?'\n':'');
 }
 function formatInsert(value,a,b){return formatTextInsert(editor.value,value,a,b);}
 function change(value,a=editor.selectionStart,b=editor.selectionEnd){editor.setRangeText(formatInsert(value,a,b),a,b,'end');editor.dispatchEvent(new Event('input',{bubbles:true}));editor.focus({preventScroll:true});}
 editor.addEventListener('beforeinput',e=>{
   if(e.isComposing||!e.cancelable)return;
   if(e.inputType==='insertText'&&typeof e.data==='string'){
     const a=editor.selectionStart,b=editor.selectionEnd,formatted=formatInsert(e.data,a,b);
     if(formatted!==e.data){e.preventDefault();change(e.data,a,b);}
   }
 });
 // Capture before the live preview listener. Paste and native input share uppercase formatting.
 function uppercaseEditor(){const value=editor.value,upper=value.toUpperCase();if(value===upper)return;const a=editor.selectionStart,b=editor.selectionEnd,dir=editor.selectionDirection;const top=editor.scrollTop,left=editor.scrollLeft;editor.value=upper;editor.setSelectionRange(value.slice(0,a).toUpperCase().length,value.slice(0,b).toUpperCase().length,dir);editor.scrollTop=top;editor.scrollLeft=left;}
 editor.addEventListener('input',e=>{if(!e.isComposing)uppercaseEditor();},true);
 editor.addEventListener('compositionend',()=>{uppercaseEditor();editor.dispatchEvent(new Event('input',{bubbles:true}));});
 function move(key){const text=editor.value,a=editor.selectionStart,b=editor.selectionEnd;let n=a;const start=a===0?0:text.lastIndexOf('\n',a-1)+1;let end=text.indexOf('\n',a);if(end===-1)end=text.length;
 if(key==='←'||key==='→'){
   const stops=[];let offset=0;
   for(const line of text.split('\n')){for(const m of line.matchAll(/\S+/g))stops.push(offset+m.index);stops.push(offset+line.length);offset+=line.length+1;}
   n=key==='←'?(stops.filter(x=>x<a).at(-1)??0):(stops.find(x=>x>b)??text.length);
 }else if(key==='↑'||key==='↓'||key==='PAGE ↑'||key==='PAGE ↓'){const lines=text.split('\n'),row=text.slice(0,a).split('\n').length-1,col=a-start;const page=Math.max(1,Math.floor(editor.clientHeight/parseFloat(getComputedStyle(editor).lineHeight))-1);const delta=key==='↑'?-1:key==='↓'?1:key==='PAGE ↑'?-page:page;const target=Math.max(0,Math.min(lines.length-1,row+delta));n=lines.slice(0,target).reduce((s,v)=>s+v.length+1,0)+Math.min(col,lines[target].length);}
 editor.focus({preventScroll:true});editor.setSelectionRange(n,n);if(key==='PAGE ↑'||key==='PAGE ↓')editor.scrollTop+=key==='PAGE ↑'?-editor.clientHeight:editor.clientHeight;}
 function add(label,action,row,col,kind=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=kind;b.style.gridRow=row;b.style.gridColumn=col;b.setAttribute('aria-label',label);b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=action;grid.append(b);return b;}
 const keys=[['O','N','G','P','7','8','9'],['X','Z','C','Y','4','5','6'],['U','W','H','V','1','2','3'],['M','S','T','L','-','0','.'],['I','K','R','F','/','EOB','CAN']];
 const alternates={O:'(',N:')',G:'E',P:'Q',X:'A',Z:'B',C:'D',Y:'?',U:'_',W:'J',H:'#',V:'%',M:';',S:'=',T:'*',L:'+',I:'[',K:']',R:'&',F:' '};let shifted=false;const altButtons=[];
 function shift(on){shifted=on;shiftButton.setAttribute('aria-pressed',String(on));for(const [button,main,alt] of altButtons){button.querySelector('.key-main').textContent=on?alt:main;button.querySelector('.key-alt').textContent=on?main:alt;}}
 const shiftButton=add('SHIFT',()=>shift(!shifted),5,1,'function-key');shiftButton.setAttribute('aria-pressed','false');
 keys.forEach((row,i)=>row.forEach((ch,j)=>{const alt=alternates[ch];const button=add(ch,()=>{if(ch==='EOB')eobKey();else if(ch==='CAN')cancelKey();else if(pendingEob)status.textContent='EOB pending. Press INSERT or INPUT, or CAN to cancel.';else pending(shifted&&alt?alt:ch);if(shifted)shift(false);},i+1,j<4?j+2:j+3,j>=4?'number-key':'letter-key');if(ch==='EOB')button.setAttribute('aria-pressed','false');if(alt){button.innerHTML='';const main=document.createElement('span'),secondary=document.createElement('small');main.className='key-main';secondary.className='key-alt';main.textContent=ch;secondary.textContent=alt===' '?'SP':alt;button.append(main,secondary);altButtons.push([button,ch,alt===' '?'SP':alt]);}}));
 for(const [key,row] of [['ALTER',1],['INSERT',2],['DELETE',3],['INPUT',5]])add(key,()=>textAction(key),row,11,'function-key edit-key');
 for(const [k,r,c] of [['PAGE ↑',6,2],['PAGE ↓',7,2],['←',7,3],['↑',6,4],['↓',7,4],['→',7,5]])add(k,()=>move(k),r,c,'navigation-key');
 const style=document.createElement('style');style.textContent=`
 #turn-keypad-toggle{font-size:11px;padding:5px 8px;margin-left:auto;white-space:nowrap}.eob-option{display:flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap}.eob-option input{margin:0}
 .programbody{position:relative}.programbody .eob-mirror{position:absolute;left:0;top:0;z-index:0;margin:0;padding:13px 12px;border:0;background:none;white-space:pre;overflow:visible;font:13px/1.65 Consolas,'Courier New',monospace;tab-size:4;color:transparent;pointer-events:none;max-width:none;max-height:none;width:max-content}.eob-mirror span{color:#839c85}.programbody textarea{position:relative;z-index:1}.programbody.eob-visible textarea{background:transparent}
 #turn-editor-keypad[hidden]{display:none!important}#turn-editor-keypad{background:linear-gradient(145deg,#77736b,#55524b);border:1px solid #49453f;border-radius:5px;padding:10px;flex:0 0 auto;min-width:0;max-height:52vh;overflow:auto;color:#fff7dc}
 .keypad-head{display:flex;align-items:center;gap:7px;margin-bottom:10px;font:600 11px Segoe UI,sans-serif;letter-spacing:1px}.keypad-head small{margin-left:auto;font-size:10px;color:#e3ded1;letter-spacing:0}.keypad-head button{padding:2px 8px}
 .keypad-grid{display:grid;grid-template-columns:minmax(0,.95fr) repeat(4,minmax(0,1fr)) 6px repeat(3,minmax(0,1fr)) 6px minmax(0,1.35fr);gap:5px;max-width:700px;margin:auto}.keypad-grid button{position:relative;min-width:0;padding:3px 0;height:38px;border:1px solid #c5b68b;border-bottom:4px solid #81745b;border-radius:3px;background:linear-gradient(#fff6d2,#e9d7a0);color:#514a37;font:600 15px Segoe UI,sans-serif;box-shadow:0 2px 3px #28251e77;touch-action:manipulation}.keypad-grid button:active,.keypad-grid button[aria-pressed=true]{transform:translateY(1px);background:#f6e0a0;border-bottom-width:2px}.keypad-grid .number-key{background:linear-gradient(#fff8d6,#eddcb0)}.keypad-grid .key-alt{position:absolute;right:3px;bottom:2px;font-size:9px;color:#847655}.keypad-grid .function-key,.keypad-grid .navigation-key{background:linear-gradient(#ffe6bc,#d8b781);font-size:10px}.keypad-grid .navigation-key{margin-top:3px}.keypad-grid button[aria-label=EOB],.keypad-grid button[aria-label=CAN]{font-size:10px}
 @media(max-width:760px){#turn-editor-keypad{max-height:none;padding:6px}.keypad-grid{gap:3px;grid-template-columns:minmax(0,.95fr) repeat(4,minmax(0,1fr)) 4px repeat(3,minmax(0,1fr)) 4px minmax(0,1.35fr)}.keypad-grid button{height:35px;font-size:12px}.keypad-grid .key-alt{font-size:7px;right:2px}.keypad-grid .function-key,.keypad-grid .navigation-key{font-size:8px}.keypad-grid button[aria-label=EOB],.keypad-grid button[aria-label=CAN]{font-size:8px}#turn-keypad-toggle{padding:5px 6px}.panelhead:has(#turn-keypad-toggle){flex-wrap:wrap;gap:5px}}
 .keypad-entry{display:grid;grid-template-columns:1fr;gap:4px;margin-bottom:8px;font-size:11px}.keypad-entry label{color:#fff7dc}.keypad-entry label:first-child{display:flex;align-items:center;gap:5px}.keypad-entry textarea{width:100%;min-height:42px;max-height:90px;resize:vertical;background:#151b21;color:#d3e6da;border:1px solid #b1aa98;border-radius:3px;padding:5px;font:12px Consolas,monospace;box-sizing:border-box}.keypad-entry small{color:#fff7dc;min-height:1em}.keypad-grid .edit-key{font-size:10px}@media(max-width:480px){.keypad-grid .edit-key{font-size:7px;letter-spacing:-.4px}.keypad-grid{gap:2px}}

 .keypad-entry[hidden]{display:none!important}.keypad-entry{flex:0 0 auto;margin:0;padding:7px 9px;background:#181e24;border-top:1px solid #49545d;gap:4px;color:#d6e4d9}.keypad-entry label{font:600 10px Segoe UI,sans-serif;color:#a7b6bd;letter-spacing:.7px}.keypad-input-line{display:flex;align-items:center;gap:6px;background:#10161a;border:1px solid #778881;padding:3px 7px;min-width:0}.keypad-input-line .buffer-prompt{color:#a1c9a4;font:14px monospace}.keypad-entry textarea{flex:1;min-width:0;width:auto;min-height:23px;height:23px;max-height:23px;resize:none;padding:2px 0;background:transparent;color:#d8f0dd;border:none;outline:none;white-space:pre;overflow-x:auto;font:13px/19px Consolas,monospace}.keypad-entry small{color:#b2c1b7;font-size:10px}.keypad-input-line #turn-keypad-eob-mark{color:#f5d98a;font:600 15px monospace}.keypad-input-line #turn-keypad-eob-mark[hidden]{display:none}
 `;document.head.append(style);syncMarkers();
})();

'use strict';
// Two text editor presentations sharing the same document. No controller or machine functions.
(function setupEditorModes(){
 const source=document.getElementById('turn-source'),panel=source.closest('.panel'),head=panel.querySelector('.panelhead'),body=source.parentElement;
 const toggle=document.getElementById('turn-keypad-toggle'),pad=document.getElementById('turn-editor-keypad'),entry=panel.querySelector('.keypad-entry'),buffer=document.getElementById('turn-keypad-buffer');
 const modes=document.createElement('div');modes.className='editor-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','Editor mode');
 modes.innerHTML='<button type="button" id="turn-editor-normal">Normal</button><button type="button" id="turn-editor-cnc">CNC Panel</button>';head.insertBefore(modes,toggle);
 const strip=document.createElement('div');strip.className='cnc-display-header';strip.hidden=true;strip.innerHTML='<strong>PROGRAM</strong><span>EDIT · VIRTUAL</span><span id="turn-editor-position"></span>';body.before(strip);
 const foot=document.createElement('div');foot.className='cnc-display-footer';foot.hidden=true;foot.innerHTML='<span>TEXT EDITOR</span><span id="turn-editor-pending">READY</span><span>OFFLINE</span>';entry.after(foot);
 const normal=modes.querySelector('#turn-editor-normal'),cnc=modes.querySelector('#turn-editor-cnc');
 function update(){const active=!pad.hidden;panel.classList.toggle('cnc-editor-mode',active);strip.hidden=foot.hidden=!active;source.readOnly=active;normal.setAttribute('aria-pressed',String(!active));cnc.setAttribute('aria-pressed',String(active));const a=source.selectionStart,line=source.value.slice(0,a).split('\n');strip.querySelector('#turn-editor-position').textContent='LN '+line.length+' / COL '+(line.at(-1).length+1);foot.querySelector('#turn-editor-pending').textContent=buffer.value||!document.getElementById('turn-keypad-eob-mark').hidden?'PENDING INPUT':'READY';}
 function select(active){if(active===pad.hidden)toggle.click();update();}
 normal.onclick=()=>select(false);cnc.onclick=()=>select(true);toggle.hidden=true;pad.querySelector('#turn-keypad-close').hidden=true;
 new MutationObserver(update).observe(pad,{attributes:true,attributeFilter:['hidden']});
 for(const ev of ['input','click','keyup','select','focus'])source.addEventListener(ev,update);document.addEventListener('selectionchange',()=>{if(document.activeElement===source)update();});pad.addEventListener('click',update);document.getElementById('turn-load').addEventListener('click',()=>queueMicrotask(update));
 const style=document.createElement('style');style.textContent=`
 .editor-modes{display:inline-flex;gap:2px;background:#e6ebf0;border:1px solid #cbd4df;border-radius:5px;padding:2px;margin-left:auto}.editor-modes button{font-size:11px;white-space:nowrap;padding:5px 8px;background:transparent;border:0;border-radius:3px;color:#354555}.editor-modes button[aria-pressed=true]{background:#fff;color:#175895;box-shadow:0 1px 3px #0002;font-weight:600}#turn-keypad-toggle[hidden],#turn-keypad-close[hidden],.cnc-display-header[hidden],.cnc-display-footer[hidden]{display:none!important}
 .cnc-editor-mode{background:#66635d!important}.cnc-editor-mode .panelhead{background:#f0f2f4;flex-wrap:wrap;gap:5px}.cnc-editor-mode .programbody{margin:0 9px;background:#0b1821;border-left:5px solid #363c3e;border-right:5px solid #363c3e;min-height:120px}.cnc-editor-mode #turn-source{background:#0b1821;color:#e2f4e6;font:13px/1.65 Consolas,'Courier New',monospace;caret-color:#e2f4e6}.cnc-editor-mode .programbody.eob-visible #turn-source{background:transparent}.cnc-editor-mode #turn-source::selection{background:#b5d5bc;color:#172a20}.cnc-display-header,.cnc-display-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 9px 0;padding:6px 8px;border:5px solid #363c3e;border-bottom:0;background:#254053;color:#eaf2ed;font:600 11px Consolas,monospace;min-width:0}.cnc-display-footer{margin:0 9px 8px;background:#254053;border-top:0;border-bottom:5px solid #363c3e;font-size:10px}.cnc-editor-mode .keypad-entry{margin:0 9px;border-left:5px solid #363c3e;border-right:5px solid #363c3e;background:#0b1821}.cnc-editor-mode #turn-editor-keypad{margin:0 9px 8px;max-height:none;background:linear-gradient(145deg,#6d6b64,#53514c);border-color:#3b3933}.cnc-editor-mode .programfoot{background:#eceff1}.cnc-editor-mode .keypad-head{color:#f4e7c7}.cnc-editor-mode .keypad-head strong::before{content:'VIRTUAL ';}.cnc-editor-mode .keypad-grid button{height:32px}.cnc-editor-mode .keypad-head{margin-bottom:6px}@media(max-width:760px){.cnc-editor-mode .programbody{min-height:175px}.editor-modes{margin-left:0}.cnc-editor-mode #turn-editor-keypad{margin:0 5px 5px}.cnc-display-header,.cnc-display-footer{font-size:9px}.cnc-editor-mode .keypad-grid button{height:34px}}
 `;document.head.append(style);update();
})();

'use strict';
// Persistent visual text cursor for the read-only CNC Panel editor.
(function setupPanelCursor(){
 const source=document.getElementById('turn-source'),body=source.parentElement,panel=source.closest('.panel'),pad=document.getElementById('turn-editor-keypad');
 const cursor=document.createElement('span');cursor.id='turn-cnc-text-cursor';cursor.hidden=true;cursor.setAttribute('aria-hidden','true');body.append(cursor);
 const ruler=document.createElement('span');ruler.setAttribute('aria-hidden','true');ruler.style.cssText='position:fixed;visibility:hidden;pointer-events:none;white-space:pre;left:0;top:0;padding:0;border:0;';document.body.append(ruler);
 const style=document.createElement('style');style.textContent='#turn-cnc-text-cursor{position:absolute;z-index:3;display:block;pointer-events:none;background:#b6edb8;color:#102819;box-shadow:0 0 4px #a2e9b66b;white-space:pre;overflow:hidden;text-align:left;}@keyframes cnc-empty-blink{0%,100%{opacity:1}50%{opacity:0}}#turn-cnc-text-cursor.empty-block{animation:cnc-empty-blink 1s steps(1,end) infinite}@media(prefers-reduced-motion:reduce){#turn-cnc-text-cursor.empty-block{animation:none}}#turn-cnc-text-cursor[hidden]{display:none!important}.cnc-editor-mode #turn-source{caret-color:transparent!important}';document.head.append(style);
 let lastIndex=-1,lastValue=null,wasActive=false;
 function paint(reveal=false){
   const active=panel.classList.contains('cnc-editor-mode');if(!active){cursor.hidden=true;wasActive=false;return;}
   const s=getComputedStyle(source),a=source.selectionDirection==='backward'?source.selectionStart:source.selectionEnd,text=source.value;
   const before=text.slice(0,a),lines=before.split('\n'),rowStart=a-lines.at(-1).length,lh=parseFloat(s.lineHeight)||21.45;
   let rowEnd=text.indexOf('\n',a);if(rowEnd<0)rowEnd=text.length;
   const row=text.slice(rowStart,rowEnd),col=a-rowStart;
   const word=[...row.matchAll(/\S+/g)].find(m=>col>=m.index&&col<m.index+m[0].length);
   const prefix=row.slice(0,word?word.index:col),highlight=word?word[0]:' ';
   ruler.style.font=s.font;ruler.style.letterSpacing=s.letterSpacing;ruler.style.tabSize=s.tabSize;
   ruler.textContent=prefix;const x=ruler.getBoundingClientRect().width+parseFloat(s.paddingLeft);const y=(lines.length-1)*lh+parseFloat(s.paddingTop);
   ruler.textContent=highlight;const w=Math.max(2,ruler.getBoundingClientRect().width);
   if(reveal&&(a!==lastIndex||text!==lastValue||!wasActive)){
     if(y<source.scrollTop)source.scrollTop=y;
     else if(y+lh>source.scrollTop+source.clientHeight)source.scrollTop=y+lh-source.clientHeight;
     if(x<source.scrollLeft||w>source.clientWidth-parseFloat(s.paddingLeft))source.scrollLeft=x-parseFloat(s.paddingLeft);
     else if(x+w>source.scrollLeft+source.clientWidth)source.scrollLeft=x+w-source.clientWidth;
   }
   lastIndex=a;lastValue=text;wasActive=true;
   const left=x-source.scrollLeft,top=y-source.scrollTop;
   cursor.hidden=left<0||top<0||left>=source.clientWidth||top+lh>source.clientHeight+.5;
   cursor.style.left=(source.offsetLeft+left)+'px';cursor.style.top=(source.offsetTop+top)+'px';cursor.style.width=Math.min(w,Math.max(0,source.clientWidth-left))+'px';cursor.style.height=lh+'px';cursor.style.font=s.font;cursor.style.lineHeight=lh+'px';cursor.classList.toggle('empty-block',!word);cursor.textContent=highlight;
 }
 for(const event of ['input','click','keyup','select','focus'])source.addEventListener(event,()=>paint(true));
 source.addEventListener('scroll',()=>paint());pad.addEventListener('click',()=>paint(true));
 document.addEventListener('selectionchange',()=>{if(document.activeElement===source)paint(true);});
 new MutationObserver(()=>paint(true)).observe(panel,{attributes:true,attributeFilter:['class']});
 new ResizeObserver(()=>paint()).observe(source);
 document.getElementById('turn-load').addEventListener('click',()=>queueMicrotask(()=>paint(true)));
 paint();
})();
