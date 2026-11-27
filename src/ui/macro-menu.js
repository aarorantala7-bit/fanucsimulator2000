'use strict';
// Macros menu: insert Custom Macro B templates (src/macros/templates.js) into the program, inline or as G65 + O9xxx.
// Works on the shared #source editor in both the text editor and the CNC panel (EDIT mode there).
(function setupMacroMenu(){
 const T=globalThis.MacroTemplates,$=id=>document.getElementById(id),KEY='fanucsim.macros.user';
 const machine=()=>globalThis.simMode==='lathe'?'lathe':'mill';
 let user=[];try{user=T.importJSON(localStorage.getItem(KEY)||'[]').list;}catch{user=[];}
 const saveUser=()=>{try{localStorage.setItem(KEY,JSON.stringify(user.map(({user:_,...m})=>m)));}catch{}};
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
 const dir=()=>{try{return [...(globalThis.MachineState?.library?.(machine())?.keys?.()||[])].map(Number);}catch{return [];}};
 const d=document.createElement('dialog');d.id='macrodlg';d.setAttribute('aria-label','Insert macro');
 d.innerHTML=`<h2>Macros · Custom Macro B <small id="mac-machine"></small></h2>
 <section class="mac-top"><label>Template<select id="mac-list"></select></label><p id="mac-desc" class="mac-desc"></p><p id="mac-setup" class="mac-setup"></p></section>
 <section class="mac-form"><div id="mac-params" class="mac-params"></div></section>
 <section class="mac-out"><div class="mac-mode"><label><input type="radio" name="mac-mode" value="g65" checked> G65 call + subprogram</label><label><input type="radio" name="mac-mode" value="inline"> Inline at the cursor</label><label class="mac-o">O<input id="mac-o" type="number" min="9000" max="9999" step="1"></label></div>
 <pre id="mac-preview" class="mac-preview" aria-label="Preview"></pre><p id="mac-msg" class="mac-msg" role="status"></p></section>
 <div class="mac-buttons"><button id="mac-insert" class="primary">Insert at cursor</button><button id="mac-save">Save as my macro…</button><button id="mac-delete">Delete my macro</button><button id="mac-close">Close</button></div>`;
 document.body.append(d);
 // My macro editor
 const e=document.createElement('dialog');e.id='macroedit';e.innerHTML=`<h2>My macro</h2><section class="mac-edit"><label>Name<input id="me-name" maxlength="48"></label><label>Machine<select id="me-machine"><option value="mill">Milling</option><option value="lathe">Turning</option><option value="both">Both</option></select></label><label class="wide">Description<input id="me-desc" maxlength="600"></label>
 <label class="wide">Arguments, one per line: LETTER default label (G65 letters ${T.LETTERS.join(' ')})<textarea id="me-params" rows="5" spellcheck="false"></textarea></label>
 <label class="wide">Body: {X} = the argument's variable (#24), {L1}… = GOTO labels, {D1}… = DO loop numbers, #27–#33 free for temporaries. No O number or M99 (added on insert).<textarea id="me-body" rows="9" spellcheck="false"></textarea></label><p id="me-err" class="mac-msg" role="alert"></p></section>
 <div class="mac-buttons"><button id="me-save" class="primary">Save to my macros</button><button id="me-cancel">Cancel</button></div>`;document.body.append(e);
 let cur=null,vals={};
 function list(){const m=machine(),sel=$('mac-list'),keep=cur?.id;const b=T.forMachine(m),u=T.forMachine(m,user).filter(t=>t.user);
  sel.innerHTML=`<optgroup label="Built-in">${b.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</optgroup>`+(u.length?`<optgroup label="My macros">${u.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</optgroup>`:'');
  sel.value=[...b,...u].some(t=>t.id===keep)?keep:b[0].id;$('mac-machine').textContent=m==='lathe'?'· Turning':'· Milling';pick(sel.value);}
 function pick(id){cur=T.byId(id,user);vals=T.values(cur);$('mac-desc').textContent=cur.desc||'';$('mac-setup').textContent=cur.setup?'Before the call (example): '+cur.setup.join(' · ')+'. Coordinates are in the active work offset (G54…, see Setup › Stock › Work zero).':'Coordinates are in the active work offset (G54…).';
  $('mac-params').innerHTML=cur.params.map(q=>`<label><span><b>${q.k}</b> ${esc(q.label)}${q.unit?' <i>'+esc(q.unit)+'</i>':''}</span><input type="number" step="any" data-k="${q.k}" value="${q.def}"></label>`).join('');
  for(const i of $('mac-params').querySelectorAll('input'))i.oninput=()=>{vals[i.dataset.k]=i.value===''?NaN:Number(i.value);preview();};
  $('mac-delete').disabled=!cur.user;$('mac-o').value=T.freeO(src().value,dir(),cur.o);preview();}
 const src=()=>$('source'),mode=()=>d.querySelector('input[name=mac-mode]:checked').value;
 function rendered(){return T.render(cur,vals,mode(),{text:src().value,dir:dir(),o:mode()==='g65'?Number($('mac-o').value)||undefined:undefined});}
 function editBlock(){const p=src().closest('.panel');if(p?.classList.contains('cnc-editor-mode')&&globalThis.CncPanel&&CncPanel.mode!=='EDIT')return 'CNC panel: select EDIT mode (MODE › EDIT) to insert into the program.';return '';}
 function preview(){const r=rendered();$('mac-o').disabled=mode()!=='g65';$('mac-preview').textContent=r.call+(r.sub?'\n\n… appended after the main program:\n'+r.sub:'');
  const block=editBlock(),warn=[];if(mode()==='inline'){warn.push('Inline sets '+r.locals.join(' ')+' in the current program level.');const open=openLoops();if(open.length)warn.push('The cursor is inside WHILE loop DO'+open.join('/DO')+'; inline loops use DO1/DO2 – use the G65 call here.');}
  $('mac-msg').textContent=[...r.errs,block,...warn].filter(Boolean).join(' ');$('mac-msg').classList.toggle('warning',!!(r.errs.length||block));$('mac-insert').disabled=!!(r.errs.length||block);}
 function openLoops(){const t=src().value.slice(0,src().selectionStart).replace(/\([^()]*\)/g,'');const st=[];for(const m of t.matchAll(/\bDO\s*(\d)|\bEND\s*(\d)/gi)){if(m[1])st.push(m[1]);else{const i=st.lastIndexOf(m[2]);if(i>=0)st.splice(i,1);}}return st;}
 $('mac-list').onchange=()=>pick($('mac-list').value);for(const r of d.querySelectorAll('input[name=mac-mode]'))r.onchange=preview;$('mac-o').oninput=preview;
 $('mac-close').onclick=()=>d.close();
 $('mac-insert').onclick=()=>{const r=rendered();if(r.errs.length||editBlock())return preview();const s=src(),at=s.selectionStart??s.value.length;const out=T.insert(s.value,at,r);s.value=out.text;s.focus();s.setSelectionRange(out.cursor,out.cursor);s.dispatchEvent(new Event('input',{bubbles:true}));
  $('mac-msg').classList.remove('warning');$('mac-msg').textContent=r.sub?`Inserted G65 P${String(r.o).padStart(4,'0')} and appended O${String(r.o).padStart(4,'0')}.`:'Inserted inline.';$('mac-o').value=T.freeO(s.value,dir(),cur.o);setTimeout(()=>d.close(),350);};
 $('mac-delete').onclick=()=>{if(!cur?.user||!confirm('Delete "'+cur.name+'" from my macros?'))return;user=user.filter(m=>m.id!==cur.id);saveUser();cur=null;list();};
 // Save: from the selected template (built-in or own) with the current values as defaults; edit before saving.
 $('mac-save').onclick=()=>{$('me-name').value=cur.user?cur.name:cur.name+' (my copy)';$('me-machine').value=cur.machine;$('me-desc').value=cur.desc||'';$('me-params').value=cur.params.map(q=>`${q.k} ${Number.isFinite(vals[q.k])?vals[q.k]:q.def} ${q.label}`).join('\n');$('me-body').value=cur.body.join('\n');$('me-err').textContent='';e.dataset.id=cur.user?cur.id:'';e.showModal();};
 $('me-cancel').onclick=()=>e.close();
 $('me-save').onclick=()=>{try{const params=$('me-params').value.split(/\r?\n/).filter(l=>l.trim()).map(l=>{const m=l.trim().match(/^([A-Za-z])\s*[= ]\s*(-?[\d.]+)\s*(.*)$/);if(!m)throw Error('Argument line "'+l.trim()+'": write LETTER default label');return {k:m[1].toUpperCase(),def:Number(m[2]),label:m[3]||m[1].toUpperCase()};});
  const m=T.sanitize({id:e.dataset.id||$('me-name').value,name:$('me-name').value,machine:$('me-machine').value,desc:$('me-desc').value,params,body:$('me-body').value,o:9500});
  const i=user.findIndex(x=>x.id===m.id);if(i>=0)user[i]=m;else{let id=m.id,n=2;while(user.some(x=>x.id===id)||T.byId(id))id=m.id+'-'+n++;m.id=id;user.push(m);}saveUser();cur=m;e.close();list();$('mac-msg').textContent='Saved to my macros (this browser).';}catch(err){$('me-err').textContent=err.message;}};
 // Export / import my macros as a JSON file.
 const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;document.body.append(file);
 $('macro-export').onclick=()=>{const blob=new Blob([T.exportJSON(user)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fanucsim-macros.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 $('macro-import').onclick=()=>file.click();
 file.onchange=async()=>{const f=file.files[0];file.value='';if(!f)return;try{if(f.size>500000)throw Error('File is larger than 500 kB');const r=T.importJSON(await f.text(),user);user=r.list;saveUser();openDlg();$('mac-msg').classList.remove('warning');$('mac-msg').textContent=`Imported ${r.added} macro${r.added===1?'':'s'}.`;}catch(err){openDlg();$('mac-msg').classList.add('warning');$('mac-msg').textContent='Import failed: '+err.message;}};
 function openDlg(){list();if(!d.open)d.showModal();}
 $('macro-open').onclick=openDlg;
 globalThis.MacroMenu={open:openDlg,get user(){return user;},refresh:list};
 const css=document.createElement('style');css.textContent=`#macrodlg,#macroedit{box-sizing:border-box;width:min(760px,calc(100vw - 20px));max-width:calc(100vw - 20px);padding:14px}
 #macrodlg h2 small{font-weight:400;color:var(--muted);font-size:13px}#macrodlg section,#macroedit section{margin:8px 0;padding:10px 12px}
 .mac-top label{display:grid;gap:4px;font-size:12px;color:var(--muted)}.mac-top select{width:100%}
 .mac-desc{height:4.6em;overflow:auto;margin:8px 0 4px;color:#303944;font-size:12px;line-height:1.5}.mac-setup{height:3em;overflow:auto;margin:0;font-size:11px;color:var(--muted)}
 .mac-params{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px 10px;height:150px;overflow:auto;align-content:start}
 .mac-params label{display:grid;gap:3px;font-size:11px;color:#46515e}.mac-params label span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mac-params i{color:var(--muted)}.mac-params input{width:100%;min-width:0;box-sizing:border-box;font-variant-numeric:tabular-nums}
 .mac-mode{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;font-size:12px;min-height:30px}.mac-o{display:flex;align-items:center;gap:4px;margin-left:auto}.mac-o input{width:10ch;min-width:10ch;box-sizing:content-box}
 .mac-preview{box-sizing:border-box;height:150px;margin:8px 0 4px;padding:8px;overflow:auto;background:#101010;color:#e8e8e8;font:12px/1.5 Consolas,monospace;border-radius:4px;white-space:pre}
 .mac-msg{height:3em;overflow:auto;margin:0;font-size:12px;color:#305a3a}.mac-msg.warning{color:#986024}
 .mac-buttons{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
 .mac-edit{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px}.mac-edit label{display:grid;gap:4px;font-size:12px;color:var(--muted)}.mac-edit .wide{grid-column:1/-1}.mac-edit textarea{height:auto;font:12px/1.5 Consolas,monospace;resize:vertical;background:#fff;color:#222}.mac-edit input,.mac-edit select{width:100%;box-sizing:border-box}
 @media(max-width:520px){.mac-params{grid-template-columns:repeat(2,minmax(0,1fr));height:156px}.mac-preview{height:112px}.mac-o{margin-left:0}}`;document.head.append(css);
})();
