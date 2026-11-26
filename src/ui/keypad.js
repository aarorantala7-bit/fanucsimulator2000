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
 for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')add(ch,()=>change(ch));
 for(const ch of '0123456789')add(ch,()=>change(ch),'number-key');
 for(const ch of ['#','[',']','(',')','+','-','*','/','.','=',',',';','%','_'])add(ch,()=>change(ch),'symbol-key');
 for(const k of ['←','↑','↓','→','HOME','END'])add(k,()=>move(k),'edit-key');
 add('SPACE',()=>change(' '),'wide-key');add('ENTER',()=>change('\n'),'wide-key');
 add('⌫',()=>{let a=editor.selectionStart,b=editor.selectionEnd;if(a===b)a=Math.max(0,a-1);if(a!==b)change('',a,b);},'edit-key');
 add('DEL',()=>{const a=editor.selectionStart;let b=editor.selectionEnd;if(a===b)b=Math.min(editor.value.length,b+1);if(a!==b)change('',a,b);},'edit-key');
 const style=document.createElement('style');style.textContent=`
 #keypad-toggle{font-size:11px;padding:5px 9px;margin-left:auto;white-space:nowrap}
 #editor-keypad[hidden]{display:none!important}
 #editor-keypad{background:#e4e0d7;border-top:1px solid #a6a49d;padding:9px;flex:0 0 auto;min-width:0;max-height:48vh;overflow:auto;color:#292d32}
 .keypad-head{display:flex;align-items:center;gap:7px;margin-bottom:7px;font:600 11px Segoe UI,sans-serif;letter-spacing:.5px}.keypad-head small{margin-left:auto;font-size:10px;color:#555;letter-spacing:0}.keypad-head button{padding:2px 8px}
 .keypad-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px}.keypad-grid button{min-width:0;padding:4px 0;height:29px;border:1px solid #99978e;border-bottom:3px solid #8b8980;border-radius:4px;background:#f9f8f3;color:#20272d;font:600 12px Consolas,monospace;touch-action:manipulation}.keypad-grid button:active{border-bottom-width:1px;transform:translateY(1px);background:#fff4bc}.keypad-grid .number-key{background:#f7efc6}.keypad-grid .symbol-key{background:#e6ecf0}.keypad-grid .edit-key,.keypad-grid .wide-key{background:#394550;color:#fff;border-color:#29333b;font-size:10px}.keypad-grid .wide-key{grid-column:span 2}
 @media(max-width:760px){#editor-keypad{max-height:none}.keypad-grid button{height:35px}#keypad-toggle{padding:5px 7px}}
 `;document.head.append(style);
})();
// Use real identifiers as terminology, not invented CNC syntax.
const renderRefWordsBefore029=renderRefWords;
renderRefWords=function(row,el){renderRefWordsBefore029(row,el);const box=el('example');const pre=box.querySelector('.ref-code-card');if(pre)pre.textContent=row[0];const labels=box.querySelectorAll('.ref-example-label');if(labels[0])labels[0].textContent='Code identifier';if(labels[1])labels[1].textContent='Reference identifier only; not a complete program or validated controller syntax.';};
document.getElementById('ref-query').dispatchEvent(new Event('input'));
