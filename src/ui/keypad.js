'use strict';
// Text-entry panel only; no controller or machine controls.
(function setupEditorKeypad(){
 const editor=document.getElementById('source'),panel=editor.closest('.panel');
 const toggle=document.createElement('button');toggle.type='button';toggle.id='keypad-toggle';toggle.textContent='CNC keypad';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','editor-keypad');panel.querySelector('.panelhead').append(toggle);
 const pad=document.createElement('section');pad.id='editor-keypad';pad.hidden=true;pad.setAttribute('aria-label','Virtual text-entry keypad');
 pad.innerHTML='<div class="keypad-head"><strong>EDITOR KEYPAD</strong><small>Text entry only</small><button type="button" id="keypad-close" aria-label="Hide keypad">×</button></div><div class="keypad-grid"></div>';
 panel.querySelector('.programbody').after(pad);const grid=pad.querySelector('.keypad-grid');
 function show(active){pad.hidden=!active;toggle.setAttribute('aria-expanded',String(active));toggle.classList.toggle('primary',active);editor.inputMode=active?'none':'text';}
 toggle.onclick=()=>show(pad.hidden);pad.querySelector('#keypad-close').onclick=()=>show(false);
 function change(value,a=editor.selectionStart,b=editor.selectionEnd){editor.setRangeText(value,a,b,'end');editor.dispatchEvent(new Event('input',{bubbles:true}));editor.focus({preventScroll:true});}
 function move(key){const text=editor.value,a=editor.selectionStart,b=editor.selectionEnd;let n=a;const start=text.lastIndexOf('\n',a-1)+1;let end=text.indexOf('\n',a);if(end===-1)end=text.length;
  if(key==='←')n=a===b?Math.max(0,a-1):a;else if(key==='→')n=a===b?Math.min(text.length,b+1):b;else if(key==='HOME')n=start;else if(key==='END')n=end;else if(key==='↑'&&start>0){const prev=text.lastIndexOf('\n',start-2)+1;n=Math.min(start-1,prev+a-start);}else if(key==='↓'&&end<text.length){const next=text.indexOf('\n',end+1);n=Math.min(next===-1?text.length:next,end+1+a-start);}editor.focus({preventScroll:true});editor.setSelectionRange(n,n);}
 function add(label,action,kind=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=kind;b.setAttribute('aria-label',label);b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=action;grid.append(b);}
 // Recreate the visual grouping of the supplied panel; alternate keys are editor shortcuts only.
 const keys=[['O','N','G','P','7','8','9'],['X','Z','C','Y','4','5','6'],['U','W','H','V','1','2','3'],['M','S','T','L','-','0','.'],['I','K','R','F','/','EOB','CAN']];
 const alternates={O:'(',N:')',G:'E',P:'Q',X:'A',Z:'B',C:'D',Y:'?',U:'_',W:'J',H:'#',V:'%',M:';',S:'=',T:'*',L:'+',I:'[',K:']',R:'&',F:' '};
 let shifted=false;const altButtons=[];
 function shift(on){shifted=on;shiftButton.setAttribute('aria-pressed',String(on));for(const [button,main,alt] of altButtons){button.querySelector('.key-main').textContent=on?alt:main;button.querySelector('.key-alt').textContent=on?main:alt;}}
 for(const row of keys)for(const ch of row){const alt=alternates[ch];add(ch,()=>{if(ch==='CAN'){const a=editor.selectionStart,b=editor.selectionEnd;if(a!==b)change('',a,b);else if(a>0)change('',a-1,a);}else change(ch==='EOB'?'\n':shifted&&alt?alt:ch);if(shifted)shift(false);},row.indexOf(ch)>=4?'number-key':'letter-key');const button=grid.lastElementChild;if(alt){button.innerHTML='';const main=document.createElement('span'),secondary=document.createElement('small');main.className='key-main';secondary.className='key-alt';main.textContent=ch;secondary.textContent=alt===' '?'SP':alt;button.append(main,secondary);altButtons.push([button,ch,alt===' '?'SP':alt]);}}
 add('SHIFT',()=>shift(!shifted),'function-key');const shiftButton=grid.lastElementChild;shiftButton.setAttribute('aria-pressed','false');
 add('SPACE',()=>change(' '),'function-key');add('⌫',()=>{let a=editor.selectionStart,b=editor.selectionEnd;if(a===b)a=Math.max(0,a-1);if(a!==b)change('',a,b);},'function-key');
 add('DELETE',()=>{const a=editor.selectionStart;let b=editor.selectionEnd;if(a===b)b=Math.min(editor.value.length,b+1);if(a!==b)change('',a,b);},'function-key');
 for(const k of ['←','↑','↓','→','HOME','END'])add(k,()=>move(k),'navigation-key');
 const style=document.createElement('style');style.textContent=`
 #keypad-toggle{font-size:11px;padding:5px 9px;margin-left:auto;white-space:nowrap}
 #editor-keypad[hidden]{display:none!important}
 #editor-keypad{background:linear-gradient(145deg,#77736b,#55524b);border:1px solid #49453f;border-radius:5px;padding:12px;flex:0 0 auto;min-width:0;max-height:52vh;overflow:auto;color:#fff7dc}
 .keypad-head{display:flex;align-items:center;gap:7px;margin-bottom:10px;font:600 11px Segoe UI,sans-serif;letter-spacing:1px}.keypad-head small{margin-left:auto;font-size:10px;color:#e3ded1;letter-spacing:0}.keypad-head button{padding:2px 8px}
 .keypad-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) 10px repeat(3,minmax(0,1fr));gap:6px;max-width:620px;margin:auto}.keypad-grid button{position:relative;min-width:0;padding:3px 0;height:38px;border:1px solid #c5b68b;border-bottom:4px solid #81745b;border-radius:3px;background:linear-gradient(#fff6d2,#e9d7a0);color:#514a37;font:600 15px Segoe UI,sans-serif;box-shadow:0 2px 3px #28251e77;touch-action:manipulation}.keypad-grid button:active,.keypad-grid button[aria-pressed=true]{transform:translateY(1px);background:#f6e0a0;border-bottom-width:2px}.keypad-grid .number-key{background:linear-gradient(#fff8d6,#eddcb0);grid-column:auto}.keypad-grid button:nth-child(7n+5):nth-child(-n+35){grid-column:6}.keypad-grid .key-alt{position:absolute;right:3px;bottom:2px;font-size:9px;color:#847655}.keypad-grid .function-key,.keypad-grid .navigation-key{background:linear-gradient(#ffe6bc,#d8b781);font-size:10px}.keypad-grid .function-key{grid-column:span 2}.keypad-grid .navigation-key{grid-column:auto;margin-top:3px}.keypad-grid button:nth-child(7n):nth-child(-n+35){grid-column:8}.keypad-grid button:nth-child(36){grid-column:1/span 2}.keypad-grid button:nth-child(37){grid-column:3/span 2}.keypad-grid button:nth-child(38){grid-column:6/span 1}.keypad-grid button:nth-child(39){grid-column:7/span 2}.keypad-grid button:nth-child(40){grid-column:1}.keypad-grid button:nth-child(44){grid-column:6}
 @media(max-width:760px){#editor-keypad{max-height:none;padding:8px}.keypad-grid{gap:4px;grid-template-columns:repeat(4,minmax(0,1fr)) 6px repeat(3,minmax(0,1fr))}.keypad-grid button{height:36px;font-size:13px}.keypad-grid .key-alt{font-size:8px}.keypad-grid .function-key,.keypad-grid .navigation-key{font-size:9px}#keypad-toggle{padding:5px 7px}}
 `;document.head.append(style);
})();
// Use real identifiers as terminology, not invented CNC syntax.
const renderRefWordsBefore029=renderRefWords;
renderRefWords=function(row,el){renderRefWordsBefore029(row,el);const box=el('example');const pre=box.querySelector('.ref-code-card');if(pre)pre.textContent=row[0];const labels=box.querySelectorAll('.ref-example-label');if(labels[0])labels[0].textContent='Code identifier';if(labels[1])labels[1].textContent='Reference identifier only; not a complete program or validated controller syntax.';};
document.getElementById('ref-query').dispatchEvent(new Event('input'));
