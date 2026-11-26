'use strict';
// Document-linked visual timeline: no interpretation of command letters or values.
(()=>{
 const e=id=>document.getElementById(id),src=e('turn-source'),gutter=e('turn-line-numbers'),seek=e('turn-seek'),mode=e('workspace-mode'),step=e('turn-step'),reset=e('turn-reset');
 const detail=document.createElement('div');detail.className='turn-timeline-note';
 const label=document.createElement('span');label.id='turn-timeline-line';label.setAttribute('aria-live','off');
 const follow=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=true;follow.append(check,document.createTextNode(' Follow demo line'));detail.append(label,follow);e('turn-load').parentElement.after(detail);
 const style=document.createElement('style');style.textContent=`#turning-workspace #turn-line-numbers{position:relative;flex-shrink:0}#turn-line-numbers .turn-gutter-row{display:block;white-space:nowrap;line-height:inherit;padding:0 3px}#turn-line-numbers .turn-gutter-row.active{background:#b6edb8;color:#12291a;font-weight:bold;border-radius:2px}.turn-timeline-note{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;font-size:11px;border-top:1px solid var(--edge);color:var(--muted);flex-wrap:wrap}.turn-timeline-note label{display:flex;align-items:center;gap:4px;white-space:nowrap}.turn-timeline-note input{margin:0}`;document.head.append(style);
 let rows=[],visible=[],last=-1,cache=null,active=false;
 function rebuild(){cache=src.value;rows=cache.split('\n');visible=rows.map((t,i)=>t.trim()?i:-1).filter(i=>i>=0);if(!visible.length)visible=[0];const f=document.createDocumentFragment();for(let i=0;i<rows.length;i++){const span=document.createElement('span');span.className='turn-gutter-row';span.textContent=String(i+1);f.append(span);}gutter.replaceChildren(f);gutter.scrollTop=src.scrollTop;last=-1;}
 function index(){return Math.min(visible.length-1,Math.floor(Number(seek.value)/1000*visible.length));}
 function render(force=false){if(mode.value!=='turning'){active=false;return;}if(cache!==src.value||gutter.children.length!==rows.length)rebuild();const row=visible[index()]??0;if(!force&&active&&last===row)return;active=true;if(last>=0)gutter.children[last]?.classList.remove('active');gutter.children[row]?.classList.add('active');last=row;label.textContent='Visual demo · document line '+(row+1)+' / '+rows.length+' (not executed)';if(check.checked&&document.activeElement!==src){const st=getComputedStyle(src),h=parseFloat(st.lineHeight)||21.45,top=parseFloat(st.paddingTop)||0,y=row*h+top;if(y<src.scrollTop)src.scrollTop=Math.max(0,y-top);else if(y+h>src.scrollTop+src.clientHeight)src.scrollTop=y+h-src.clientHeight;gutter.scrollTop=src.scrollTop;}}
 function refresh(){rebuild();render(true);}
 src.addEventListener('input',refresh);src.addEventListener('scroll',()=>{gutter.scrollTop=src.scrollTop;});mode.addEventListener('change',()=>render(true));check.addEventListener('change',()=>render(true));
 // Step advances to the next nonempty text line on the independent visual timeline.
 step.addEventListener('click',ev=>{ev.preventDefault();ev.stopImmediatePropagation();if(cache!==src.value)rebuild();const next=index()+1;seek.value=next>=visible.length?1000:Math.ceil(next*1000/visible.length);seek.dispatchEvent(new Event('input',{bubbles:true}));render(true);},true);
 seek.addEventListener('input',()=>render(true));reset.addEventListener('click',()=>render(true));
 function loop(){render();requestAnimationFrame(loop);}refresh();requestAnimationFrame(loop);
})();
