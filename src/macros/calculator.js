'use strict';
// Independent arithmetic sandbox. No connection to the program parser, motion, or stock.
function calculateParameters(source){
  const vars=Object.create(null), descriptions=Object.create(null), trace=[];
  const fail=message=>{throw Error(message);};
  const finite=n=>{if(!Number.isFinite(n)||Math.abs(n)>1e12)fail('Number outside calculator range');return n;};
  const variable=n=>{n=Number(n);if(!Number.isInteger(n)||n<1||n>999)fail('Use numbered variables #1 through #999');return n;};
  function expression(str){
    const t=[];let rest=str.trim().toUpperCase();
    while(rest){const m=rest.match(/^(?:\s+|#\d+|(?:\d+(?:\.\d*)?|\.\d+)|[A-Z]+|[+*\/\-\[\]])/);if(!m)fail('Unknown expression token');if(m[0].trim())t.push(m[0]);rest=rest.slice(m[0].length);if(t.length>256)fail('Expression too long');}
    let i=0;const take=()=>t[i++];const expect=x=>{if(take()!==x)fail('Expected '+x);};
    const f={SIN:x=>Math.sin(x*Math.PI/180),COS:x=>Math.cos(x*Math.PI/180),TAN:x=>Math.tan(x*Math.PI/180),ABS:Math.abs,SQRT:Math.sqrt,ROUND:Math.round};
    function atom(){const a=take();if(a==='-'||a==='+')return finite((a==='-'?-1:1)*atom());if(a==='['){const n=sum();expect(']');return n;}if(a?.startsWith('#')){const k=variable(a.slice(1));if(!Object.hasOwn(vars,k))fail('Undefined variable #'+k);return vars[k];}if(Object.hasOwn(f,a)){expect('[');const n=sum();expect(']');return finite(f[a](n));}if(a&&/^\d|^\.\d/.test(a))return finite(Number(a));fail('Expected a number, variable or function');}
    function product(){let n=atom();while(t[i]==='*'||t[i]==='/'){const op=take(),b=atom();n=finite(op==='*'?n*b:n/b);}return n;}
    function sum(){let n=product();while(t[i]==='+'||t[i]==='-'){const op=take(),b=product();n=finite(op==='+'?n+b:n-b);}return n;}
    const n=sum();if(i!==t.length)fail('Unexpected expression token');return n;
  }
  function condition(str){const m=str.match(/^\[(.*)\]$/);if(!m)fail('Expected bracketed condition');const c=m[1].match(/^(.+?)\s*(LT|GT|EQ|NE|LE|GE)\s*(.+)$/i);if(!c)fail('Expected comparison');const a=expression(c[1]),b=expression(c[3]);return {LT:a<b,GT:a>b,EQ:a===b,NE:a!==b,LE:a<=b,GE:a>=b}[c[2].toUpperCase()];}
  const raw=source.split(/\r?\n/);if(raw.length>500||source.length>50000)fail('Calculator input limit');
  const rows=raw.map((line,i)=>({line:i+1,comment:[...line.matchAll(/\(([^()]*)\)/g)].map(m=>m[1]).join(' '),code:line.replace(/\([^()]*\)/g,'').trim().toUpperCase()}));
  const stack=[];
  for(let i=0;i<rows.length;i++){
    const r=rows[i];if(!r.code)continue;let m;
    if((m=r.code.match(/^#(\d+)\s*=\s*(.+)$/))){r.kind='set';r.key=variable(m[1]);r.expr=m[2];}
    else if((m=r.code.match(/^IF\s*(\[.*\])\s*THEN\s*#(\d+)\s*=\s*(.+)$/))){r.kind='if';r.cond=m[1];r.key=variable(m[2]);r.expr=m[3];}
    else if((m=r.code.match(/^WHILE\s*(\[.*\])\s*DO\s*([1-9])$/))){r.kind='while';r.cond=m[1];r.id=m[2];if(stack.length>=5||stack.some(j=>rows[j].id===r.id))fail('Line '+r.line+': loop nesting limit or duplicate label');stack.push(i);}
    else if((m=r.code.match(/^END\s*([1-9])$/))){r.kind='end';const j=stack.pop();if(j===undefined||rows[j].id!==m[1])fail('Line '+r.line+': unmatched END');r.start=j;rows[j].end=i;}
    else fail('Line '+r.line+': calculation statements only; no CNC commands or program execution');
  }
  if(stack.length)fail('Unclosed calculation loop');
  let budget=0;
  for(let i=0;i<rows.length;){const r=rows[i];if(++budget>2000)fail('Calculation step limit (2000)');try{
    if(!r.kind){i++;continue;}
    let next=i+1;
    if(r.kind==='set'||r.kind==='if'){if(r.kind==='set'||condition(r.cond)){vars[r.key]=expression(r.expr);if(r.comment&&!descriptions[r.key])descriptions[r.key]=r.comment;}}
    else if(r.kind==='while'){if(!condition(r.cond))next=r.end+1;}
    else if(r.kind==='end')next=r.start;
    trace.push({line:r.line,code:r.code,vars:{...vars},descriptions:{...descriptions}});i=next;
  }catch(e){fail('Line '+r.line+': '+e.message);}}
  return trace;
}
const parameterExamples={Arithmetic:'#1 = 4 (Sample number)\n#2 = [#1 * 3 + 2] (Calculated value)\n#3 = SQRT[#2] (Square root)\n#4 = SIN[30] (Degree-based sine)',Condition:'#1 = 7 (Sample number)\n#2 = 0 (Result)\nIF [#1 GT 5] THEN #2 = 1',Loop:'#1 = 0 (Counter)\n#2 = 0 (Sum)\nWHILE [#1 LT 4] DO1\n#1 = [#1 + 1]\n#2 = [#2 + #1]\nEND1'};
function setupParameterCalculator(){
  const dialog=document.createElement('dialog');dialog.id='parameterdialog';dialog.style.width='min(720px,calc(100vw - 32px))';
  dialog.innerHTML='<h2>Macro parameter calculator</h2><p>Independent arithmetic sandbox. Values do not affect tool paths, stock, or CNC programs.</p><section><label>Example <select id="par-example"></select></label><textarea id="par-source" aria-label="Calculation input" spellcheck="false" style="width:100%;height:180px;margin-top:10px;font:13px Consolas,monospace"></textarea><div class="buttons"><button id="par-run" class="primary">Evaluate</button><button id="par-prev">Previous</button><button id="par-next">Next</button><span id="par-count"></span></div><input id="par-step" type="range" min="0" max="0" value="0" style="width:100%" aria-label="Calculation step"><p id="par-status" role="status"></p><table style="width:100%;text-align:left"><thead><tr><th>Variable</th><th>Value</th><th>Description</th></tr></thead><tbody id="par-values"></tbody></table></section><div class="closebar"><button id="par-close">Close</button></div>';
  document.body.append(dialog);const el=id=>document.getElementById('par-'+id);let steps=[],at=0;
  const render=()=>{const row=steps[at-1];el('step').max=steps.length;el('step').value=at;el('count').textContent=at+' / '+steps.length;el('prev').disabled=at===0;el('next').disabled=at>=steps.length;el('values').replaceChildren();el('status').textContent=row?'Line '+row.line+' · '+row.code:'Initial values (empty)';if(row)for(const [key,value] of Object.entries(row.vars)){const tr=document.createElement('tr');for(const v of ['#'+key,Number(value.toPrecision(10)).toString(),row.descriptions[key]||'']){const td=document.createElement('td');td.textContent=v;tr.append(td);}el('values').append(tr);}};
  const run=()=>{steps=[];at=0;try{steps=calculateParameters(el('source').value);render();}catch(e){render();el('status').textContent=e.message;}};
  for(const k of Object.keys(parameterExamples))el('example').add(new Option(k,k));el('example').onchange=()=>{el('source').value=parameterExamples[el('example').value];run();};el('run').onclick=run;el('prev').onclick=()=>{at=Math.max(0,at-1);render();};el('next').onclick=()=>{at=Math.min(steps.length,at+1);render();};el('step').oninput=()=>{at=Number(el('step').value);render();};el('source').oninput=()=>{steps=[];at=0;render();el('status').textContent='Input changed. Evaluate again.';};el('close').onclick=()=>dialog.close();el('example').onchange();
  const button=document.createElement('button');button.textContent='Parameter calculator…';button.onclick=()=>dialog.showModal();document.querySelector('[data-dialog="macrodialog"]').after(button);
}
if(typeof document!=='undefined')setupParameterCalculator();
