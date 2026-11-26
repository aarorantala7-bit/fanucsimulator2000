'use strict';
// Text-entry panel only; no machine controls. EOB markers never modify editor text.
(function setupEditorKeypad(){
 const editor=document.getElementById('source'),panel=editor.closest('.panel'),body=editor.parentElement;
 editor.setAttribute('autocorrect','off');editor.setAttribute('autocapitalize','off');editor.setAttribute('autocomplete','off');editor.wrap='off';
 const head=panel.querySelector('.panelhead'),toggle=document.createElement('button');toggle.type='button';toggle.id='keypad-toggle';toggle.textContent='CNC keypad';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','editor-keypad');head.append(toggle);
 const eobLabel=document.createElement('label');eobLabel.className='eob-option';const eob=document.createElement('input');eob.type='checkbox';eob.id='show-eob';eobLabel.append(eob,document.createTextNode('Show EOB (;)'));head.append(eobLabel);
 const mirror=document.createElement('pre');mirror.className='eob-mirror';mirror.setAttribute('aria-hidden','true');body.prepend(mirror);
 function syncMarkers(){body.classList.toggle('eob-visible',eob.checked);mirror.hidden=!eob.checked;if(!eob.checked)return;const text=editor.value;mirror.replaceChildren();const lines=text.split('\n');for(let i=0;i<lines.length;i++){mirror.append(document.createTextNode(lines[i]));if(i<lines.length-1){if(!/;\s*$/.test(lines[i])){const mark=document.createElement('span');mark.textContent=';';mirror.append(mark);}mirror.append(document.createTextNode('\n'));}}mirror.style.transform=`translate(${-editor.scrollLeft}px,${-editor.scrollTop}px)`;}
 eob.onchange=syncMarkers;editor.addEventListener('input',syncMarkers);editor.addEventListener('scroll',()=>{mirror.style.transform=`translate(${-editor.scrollLeft}px,${-editor.scrollTop}px)`;});document.getElementById('load').addEventListener('click',()=>queueMicrotask(syncMarkers));
 const pad=document.createElement('section');pad.id='editor-keypad';pad.hidden=true;pad.setAttribute('aria-label','Virtual text-entry keypad');pad.innerHTML='<div class="keypad-head"><strong>EDITOR KEYPAD</strong><small>Text entry only</small><button type="button" id="keypad-close" aria-label="Hide keypad">×</button></div><div class="keypad-grid"></div>';
 body.after(pad);const grid=pad.querySelector('.keypad-grid');
 function show(active){pad.hidden=!active;toggle.setAttribute('aria-expanded',String(active));toggle.classList.toggle('primary',active);editor.inputMode=active?'none':'text';}
 toggle.onclick=()=>show(pad.hidden);pad.querySelector('#keypad-close').onclick=()=>show(false);
 // Shared text formatting only. No interpretation or generation of machine instructions.
 function formatInsert(value,a,b){
   value=value.toUpperCase();
   if(!/^[A-Z]$/.test(value)||a!==b)return value;
   const before=editor.value.slice(0,a),after=editor.value.slice(b);
   if(after&&!/^[\n\t ]/.test(after))return value;
   const line=before.slice(before.lastIndexOf('\n')+1);
   if(/^(?:[A-Z][+-]?(?:\d+(?:\.\d*)?|\.\d+)[ \t]+)*[A-Z][+-]?(?:\d+(?:\.\d*)?|\.\d+)$/i.test(line))return ' '+value;
   return value;
 }
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
 if(key==='←')n=a===b?Math.max(0,a-1):a;else if(key==='→')n=a===b?Math.min(text.length,b+1):b;else if(key==='↑'||key==='↓'||key==='PAGE ↑'||key==='PAGE ↓'){const lines=text.split('\n'),row=text.slice(0,a).split('\n').length-1,col=a-start;const page=Math.max(1,Math.floor(editor.clientHeight/parseFloat(getComputedStyle(editor).lineHeight))-1);const delta=key==='↑'?-1:key==='↓'?1:key==='PAGE ↑'?-page:page;const target=Math.max(0,Math.min(lines.length-1,row+delta));n=lines.slice(0,target).reduce((s,v)=>s+v.length+1,0)+Math.min(col,lines[target].length);}
 editor.focus({preventScroll:true});editor.setSelectionRange(n,n);if(key==='PAGE ↑'||key==='PAGE ↓')editor.scrollTop+=key==='PAGE ↑'?-editor.clientHeight:editor.clientHeight;}
 function add(label,action,row,col,kind=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=kind;b.style.gridRow=row;b.style.gridColumn=col;b.setAttribute('aria-label',label);b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=action;grid.append(b);return b;}
 const keys=[['O','N','G','P','7','8','9'],['X','Z','C','Y','4','5','6'],['U','W','H','V','1','2','3'],['M','S','T','L','-','0','.'],['I','K','R','F','/','EOB','CAN']];
 const alternates={O:'(',N:')',G:'E',P:'Q',X:'A',Z:'B',C:'D',Y:'?',U:'_',W:'J',H:'#',V:'%',M:';',S:'=',T:'*',L:'+',I:'[',K:']',R:'&',F:' '};let shifted=false;const altButtons=[];
 function shift(on){shifted=on;shiftButton.setAttribute('aria-pressed',String(on));for(const [button,main,alt] of altButtons){button.querySelector('.key-main').textContent=on?alt:main;button.querySelector('.key-alt').textContent=on?main:alt;}}
 const shiftButton=add('SHIFT',()=>shift(!shifted),5,1,'function-key');shiftButton.setAttribute('aria-pressed','false');
 keys.forEach((row,i)=>row.forEach((ch,j)=>{const alt=alternates[ch];const button=add(ch,()=>{if(ch==='CAN'){const a=editor.selectionStart,b=editor.selectionEnd;if(a!==b)change('',a,b);else if(a>0)change('',a-1,a);}else change(ch==='EOB'?'\n':shifted&&alt?alt:ch);if(shifted)shift(false);},i+1,j<4?j+2:j+3,j>=4?'number-key':'letter-key');if(alt){button.innerHTML='';const main=document.createElement('span'),secondary=document.createElement('small');main.className='key-main';secondary.className='key-alt';main.textContent=ch;secondary.textContent=alt===' '?'SP':alt;button.append(main,secondary);altButtons.push([button,ch,alt===' '?'SP':alt]);}}));
 for(const [k,r,c] of [['PAGE ↑',6,2],['PAGE ↓',7,2],['←',7,3],['↑',6,4],['↓',7,4],['→',7,5]])add(k,()=>move(k),r,c,'navigation-key');
 const style=document.createElement('style');style.textContent=`
 #keypad-toggle{font-size:11px;padding:5px 8px;margin-left:auto;white-space:nowrap}.eob-option{display:flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap}.eob-option input{margin:0}
 .programbody{position:relative}.programbody .eob-mirror{position:absolute;left:0;top:0;z-index:0;margin:0;padding:13px 12px;border:0;background:none;white-space:pre;overflow:visible;font:13px/1.65 Consolas,'Courier New',monospace;tab-size:4;color:transparent;pointer-events:none;max-width:none;max-height:none;width:max-content}.eob-mirror span{color:#839c85}.programbody textarea{position:relative;z-index:1}.programbody.eob-visible textarea{background:transparent}
 #editor-keypad[hidden]{display:none!important}#editor-keypad{background:linear-gradient(145deg,#77736b,#55524b);border:1px solid #49453f;border-radius:5px;padding:10px;flex:0 0 auto;min-width:0;max-height:52vh;overflow:auto;color:#fff7dc}
 .keypad-head{display:flex;align-items:center;gap:7px;margin-bottom:10px;font:600 11px Segoe UI,sans-serif;letter-spacing:1px}.keypad-head small{margin-left:auto;font-size:10px;color:#e3ded1;letter-spacing:0}.keypad-head button{padding:2px 8px}
 .keypad-grid{display:grid;grid-template-columns:minmax(0,.95fr) repeat(4,minmax(0,1fr)) 6px repeat(3,minmax(0,1fr));gap:5px;max-width:620px;margin:auto}.keypad-grid button{position:relative;min-width:0;padding:3px 0;height:38px;border:1px solid #c5b68b;border-bottom:4px solid #81745b;border-radius:3px;background:linear-gradient(#fff6d2,#e9d7a0);color:#514a37;font:600 15px Segoe UI,sans-serif;box-shadow:0 2px 3px #28251e77;touch-action:manipulation}.keypad-grid button:active,.keypad-grid button[aria-pressed=true]{transform:translateY(1px);background:#f6e0a0;border-bottom-width:2px}.keypad-grid .number-key{background:linear-gradient(#fff8d6,#eddcb0)}.keypad-grid .key-alt{position:absolute;right:3px;bottom:2px;font-size:9px;color:#847655}.keypad-grid .function-key,.keypad-grid .navigation-key{background:linear-gradient(#ffe6bc,#d8b781);font-size:10px}.keypad-grid .navigation-key{margin-top:3px}.keypad-grid button[aria-label=EOB],.keypad-grid button[aria-label=CAN]{font-size:10px}
 @media(max-width:760px){#editor-keypad{max-height:none;padding:6px}.keypad-grid{gap:3px;grid-template-columns:minmax(0,.95fr) repeat(4,minmax(0,1fr)) 4px repeat(3,minmax(0,1fr))}.keypad-grid button{height:35px;font-size:12px}.keypad-grid .key-alt{font-size:7px;right:2px}.keypad-grid .function-key,.keypad-grid .navigation-key{font-size:8px}.keypad-grid button[aria-label=EOB],.keypad-grid button[aria-label=CAN]{font-size:8px}#keypad-toggle{padding:5px 6px}.panelhead:has(#keypad-toggle){flex-wrap:wrap;gap:5px}}
 `;document.head.append(style);syncMarkers();
})();
// Use real identifiers as terminology, not invented CNC syntax.
const renderRefWordsBefore029=renderRefWords;
renderRefWords=function(row,el){renderRefWordsBefore029(row,el);const box=el('example');const pre=box.querySelector('.ref-code-card');if(pre)pre.textContent=row[0];const labels=box.querySelectorAll('.ref-example-label');if(labels[0])labels[0].textContent='Code identifier';if(labels[1])labels[1].textContent='Reference identifier only; not a complete program or validated controller syntax.';};
document.getElementById('ref-query').dispatchEvent(new Event('input'));
