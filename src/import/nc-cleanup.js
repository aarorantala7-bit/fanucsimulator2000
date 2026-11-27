'use strict';
// NC-aware cleanup of OCR text from photos of a CNC program screen, page de-duplication and
// "append after the last imported block". Pure functions (no DOM), UMD so the tests run them in Node.
(function(root){
const ADDR='ABCDEFGHIJKLMNPQRSTUVWXYZ';// O is handled separately (program number at the start of a block)
// Letters OCR confuses with digits inside a number, and digits it confuses with address letters.
const L2D={O:'0',o:'0',Q:'0',D:'0',I:'1',l:'1','|':'1',i:'1',L:'1',S:'5',s:'5',B:'8',Z:'2',z:'2',G:'6',g:'9',T:'7'};
const D2L={'0':'O','5':'S','8':'B','2':'Z','1':'I','6':'G'};
const KEYWORD=/#|\[|\b(IF|WHILE|GOTO|THEN|DO\d|END\d|SIN|COS|TAN|ATAN|SQRT|ABS|ROUND|FIX|FUP|POPEN|DPRNT|BPRNT|PCLOS)/i;
// Screen clutter: status rows, headers, soft-key bars, clock, mode lamps.
const CLUTTER=[/^\s*(PROGRAM|PROG|PRGRM|EDIT|MEM|MDI|JOG|HND|HANDLE|REF|ZRN|AUTO|TAPE|RMT|BG-EDIT|DIR|DIRECTORY)\b(?![\s\S]*\d+\.)/i,
 /^\s*\*{2,}|\*{3}\s*\*{3}/,/\b\d{1,2}:\d{2}:\d{2}\b/,/^\s*[\[(<]\s*(PRGRM|PROG|PROGRAM|LIB|DIR|C\.A\.P|OPRT|CHECK|BG-EDT|O\s*SRH|REWIND|\(OPRT\))\b/i,
 /^\s*(\[[^\]]*\]\s*){2,}$/,/^\s*(ACT\.?\s*F|ACTUAL|RUN TIME|CYCLE TIME|PART COUNT|PARTS|MEMORY|USED|FREE|ALM|ALARM|BAT|EMG|STRT|MTN|DWL|FIN|LSK)\b/i,
 /^\s*(ABSOLUTE|RELATIVE|MACHINE|DISTANCE TO GO)\b/i,/^\s*[>_]?\s*$/,/^\s*(S\s*0+\s*T\s*0+|>\s*_?)\s*$/i,/^\s*O\d{1,5}\s+N\d{1,5}\s*$/i];
function isClutter(line){const t=line.trim();if(!t)return false;if(/^\(.*\)$/.test(t)||t==='%')return false;return CLUTTER.some(r=>r.test(t));}
// Split code and comments: comments are kept verbatim (any text, Finnish letters included).
function splitComments(line){const parts=[];let i=0,code='';while(i<line.length){const c=line[i];if(c==='('){const j=line.indexOf(')',i);const end=j<0?line.length:j+1;if(code)parts.push({code});code='';parts.push({comment:line.slice(i,end)+(j<0?')':'')});i=end;continue;}code+=c;i++;}if(code)parts.push({code});return parts;}
// Fix one code fragment with the word grammar: ADDRESS [sign] digits [. digits].
function fixCode(code,first,notes){let s=code.replace(/[‐‑‒–—−]/g,'-').replace(/[“”"']/g,'').replace(/[°]/g,'');
 s=s.replace(/\bG[O0o]T[O0o]\s*(?=[0-9#\[])/gi,'GOTO');if(KEYWORD.test(s))return s.replace(/(?<=[0-9.])[Oo](?=[0-9.\]+\-*\/,)]|$)/g,'0').replace(/(?<=[#0-9.])[l|](?=[0-9.\]+\-*\/,)]|$)/g,'1').toUpperCase().replace(/\s+/g,' ').trim();
 let out='',i=0,state='addr',num='',lastAddr='';const n=s.length;
 const flush=()=>{if(state==='num'){out+=num;num='';}state='addr';};
 const startNumber=k=>{let j=k;if(s[j]==='-'||s[j]==='+')j++;return j<n&&(/[0-9.]/.test(s[j])||(!!L2D[s[j]]&&!/[A-Z]/.test(s[j]==='O'?'':s[j])&&(j+1>=n||/[0-9.\s;A-Z]/.test(s[j+1])))||(s[j]==='O'&&(j+1>=n||/[0-9.\s;A-Z]/.test(s[j+1]))));};
 while(i<n){let c=s[i];
  if(state==='addr'){
   if(c===' '||c==='\t'){out+=' ';i++;continue;}
   if(c===';'||c==='*'){i++;continue;}// EOB marks from the screen
   if(/[a-z]/.test(c)&&ADDR.includes(c.toUpperCase())&&startNumber(i+1)){c=c.toUpperCase();}
   if(c==='l'||c==='|'){c='I';}
   const atStart=first&&!out.trim();
   if((c==='0'||c==='o'||c==='Q'||c==='D'||c===':')&&atStart&&/[0-9OoIl]/.test(s[i+1]||'')){notes.push(`"${c}" at the start of a block → O (program number)`);c='O';}
   if(c==='O'&&!atStart&&!/^(P|M98|M99|G65)/.test(lastAddr)){/* O mid-block is never an address: read as 0 */notes.push('mid-block O → 0');out+='0';i++;continue;}
   if(/[0-9]/.test(c)){// a digit where an address letter must be
    const prev=out.at(-1)||'';if(prev===' '||!out.length||/[\s]/.test(prev)){const m=D2L[c];if(m&&startNumber(i+1)&&!(c==='0'&&!atStart)){notes.push(`"${c}" at an address position → ${m}`);c=m;}else{out+=c;i++;continue;}}else{out+=c;i++;continue;}}
   if(c==='O'||ADDR.includes(c)){out+=c;lastAddr=c;i++;if(c==='M'||c==='P'||c==='G')lastAddr=c;state='num';num='';continue;}
   if(c===','||c==='.'){out+=c==='.'?'.':'';i++;continue;}
   out+=c;i++;continue;}
  // state num
  if(/[0-9]/.test(c)){num+=c;i++;continue;}
  if((c==='-'||c==='+')&&num===''){num+=c==='-'?'-':'';i++;continue;}
  if(c==='.'||c===','){if(!num.includes('.'))num+='.';i++;continue;}
  if(c===' '&&num===''){i++;continue;}
  const asDigit=L2D[c];
  if(asDigit){const isAddr=ADDR.includes(c)&&c!=='D'&&c!=='Q'&&c!=='G'&&c!=='T'&&c!=='L'&&startNumber(i+1);// "X10Z5": Z starts a word
   const strongAddr=ADDR.includes(c)&&(c==='G'||c==='D'||c==='Q'||c==='T'||c==='L')&&startNumber(i+1)&&num!==''&&num!=='-';
   if(!isAddr&&!strongAddr){notes.push(`"${c}" inside a number → ${asDigit}`);num+=asDigit;i++;continue;}}
  flush();}
 flush();return out.replace(/\s+/g,' ').trim();}
// Strip a leading screen line number ("0012  G1X10", "12 G1 X10") and cursor marks.
function stripScreenMarks(line,numbered){let t=line.replace(/\u00a0/g,' ').replace(/[█▌▐■□▶►]/g,'').replace(/^\s*[>»›]+\s*/,'').replace(/_+\s*$/,'');
 t=numbered?t.replace(/^\s*\d{1,5}\s+(?=\S)/,''):t.replace(/^\s*\d{1,5}\s{2,}(?=[A-Za-z%(:#\/])/,'');return t;}
function cleanLine(line,first,notes,numbered){const t=stripScreenMarks(line,numbered);if(!t.trim())return '';if(t.trim()==='%')return '%';
 const parts=splitComments(t);let out='';let block=first;
 for(const p of parts){if(p.comment){out+=p.comment;continue;}const code=fixCode(p.code,block&&!out.trim(),notes);if(code)out+=(out&&!out.endsWith(' ')&&/[A-Z0-9.]$/.test(out)&&code[0]!==' '&&p!==parts[0]?'':'')+code;}
 return out.replace(/\s*;\s*$/,'').replace(/\s+$/,'');}
// opts.spacing: 'keep' (default) keeps the OCR spacing between words, 'compact' removes it, 'spaced' puts one space between words.
function cleanOcrText(raw,opts={}){const notes=[];const lines=String(raw).replace(/\r\n?/g,'\n').split('\n');const out=[];let dropped=0;
 // The screen shows its own line numbers when most lines start with a bare number and a space.
 const body=lines.filter(l=>l.trim()&&!isClutter(l));const numbered=body.length>1&&body.filter(l=>/^\s*[>»›]?\s*\d{1,5}\s+\S/.test(l)).length>=body.length*0.5;if(numbered)notes.push('screen line numbers removed');
 for(const line of lines){if(isClutter(line)){dropped++;continue;}let c=cleanLine(line,true,notes,numbered);if(!c){continue;}
  if(opts.spacing==='compact')c=c.replace(/(\([^)]*\))|\s+/g,(m,cm)=>cm||'');
  else if(opts.spacing==='spaced')c=c.replace(/(\([^)]*\))|([A-Z][-+]?[0-9.]+)(?=[A-Z#(])/g,(m,cm,w)=>cm||w+' ');
  out.push(c);}
 return {text:out.join('\n'),lines:out,notes:[...new Set(notes)],dropped};}
// ---- page de-duplication: the longest suffix of page n equal to a prefix of page n+1 is dropped from page n+1 ----
const norm=l=>l.replace(/\s+/g,'').replace(/;$/,'').toUpperCase();
function near(a,b){if(a===b)return true;if(Math.min(a.length,b.length)<6)return false;if(Math.abs(a.length-b.length)>1)return false;// one OCR edit allowed on longer lines
 let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}return e+(a.length-i)+(b.length-j)<=1;}
// A single-line overlap is accepted only for a distinctive line (sequence number, comment or 10+ characters):
// WinCAM-style programs repeat short blocks like "G0Z20" constantly.
const distinctive=l=>/N\d|\(|^O\d/.test(l)||l.length>=10;
function overlap(prev,next){const max=Math.min(prev.length,next.length);for(let k=max;k>=1;k--){let ok=true;for(let t=0;t<k;t++)if(!near(norm(prev[prev.length-k+t]),norm(next[t]))){ok=false;break;}if(ok&&(k>=2||distinctive(norm(next[0]))))return k;}return 0;}
function dedupePages(pages){const all=[];const removed=[];pages.forEach((p,idx)=>{const lines=(Array.isArray(p)?p:String(p).split('\n')).filter(l=>l.trim()!=='');if(idx===0){all.push(...lines);return;}const k=overlap(all,lines);removed.push(k);all.push(...lines.slice(k));});return {lines:all,text:all.join('\n'),removed};}
// ---- append after the last imported block ----
// state = {end, text} from the previous import; if the editor still holds that text there, append after it,
// otherwise append at the end of the program (before a closing % line).
function appendImport(doc,text,state){let at;if(state&&state.end<=doc.length&&doc.slice(state.end-state.text.length,state.end)===state.text)at=state.end;
 else{const m=/\n?%\s*$/.exec(doc);at=m&&doc.trim()!=='%'?m.index:doc.length;}
 const before=doc.slice(0,at),after=doc.slice(at);const sep=before&&!before.endsWith('\n')?'\n':'';const ins=sep+text.replace(/\n+$/,'')+(after&&!after.startsWith('\n')?'\n':'');
 const out=before+ins+after;return {doc:out,state:{end:at+ins.length-(after&&!after.startsWith('\n')?1:0),text:ins.replace(/\n$/,'').slice(sep.length)}};}
const api={cleanOcrText,cleanLine:(l,n=[])=>cleanLine(l,true,n),isClutter,dedupePages,overlap,appendImport};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NcCleanup=api;
})(typeof globalThis!=='undefined'?globalThis:this);
