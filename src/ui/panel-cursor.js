'use strict';
// Persistent visual text cursor for the read-only CNC Panel editor.
(function setupPanelCursor(){
 const source=document.getElementById('source'),body=source.parentElement,panel=source.closest('.panel'),pad=document.getElementById('editor-keypad');
 const cursor=document.createElement('span');cursor.id='cnc-text-cursor';cursor.hidden=true;cursor.setAttribute('aria-hidden','true');body.append(cursor);
 const ruler=document.createElement('span');ruler.setAttribute('aria-hidden','true');ruler.style.cssText='position:fixed;visibility:hidden;pointer-events:none;white-space:pre;left:0;top:0;padding:0;border:0;';document.body.append(ruler);
 const style=document.createElement('style');style.textContent='#cnc-text-cursor{position:absolute;z-index:3;display:block;pointer-events:none;background:#b6edb8;color:#102819;box-shadow:0 0 4px #a2e9b66b;white-space:pre;overflow:hidden;text-align:left;}#cnc-text-cursor[hidden]{display:none!important}.cnc-editor-mode #source{caret-color:transparent!important}';document.head.append(style);
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
   cursor.style.left=(source.offsetLeft+left)+'px';cursor.style.top=(source.offsetTop+top)+'px';cursor.style.width=Math.min(w,Math.max(0,source.clientWidth-left))+'px';cursor.style.height=lh+'px';cursor.style.font=s.font;cursor.style.lineHeight=lh+'px';cursor.textContent=highlight;
 }
 for(const event of ['input','click','keyup','select','focus'])source.addEventListener(event,()=>paint(true));
 source.addEventListener('scroll',()=>paint());pad.addEventListener('click',()=>paint(true));
 document.addEventListener('selectionchange',()=>{if(document.activeElement===source)paint(true);});
 new MutationObserver(()=>paint(true)).observe(panel,{attributes:true,attributeFilter:['class']});
 new ResizeObserver(()=>paint()).observe(source);
 document.getElementById('load').addEventListener('click',()=>queueMicrotask(()=>paint(true)));
 paint();
})();
