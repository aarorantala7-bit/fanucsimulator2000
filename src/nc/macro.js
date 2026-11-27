'use strict';
// FANUC Custom Macro B style executor (simulation only).
// Turns program text into an ordered list of executed NC blocks with variables substituted.
// Supports #variables (local #1-#33 per G65 frame, common #100-#199 / #500-#999), arithmetic and
// functions, IF[..]GOTO / IF[..]THEN, GOTO, WHILE[..]DOm/ENDm, G65 P.. L.. argument spec I,
// M98 P.. L.. subprograms, M99 return, G10 L52 parameter writes, G10 offset writes, PRM[] reads
// and the common system variables (#3000 alarm, #3006 message, #4001-#4120 modal, #5001+ positions,
// #2xxx tool offsets, #52xx work offsets). Data changes are emitted in order as {set:...} blocks.
(function(root){
const ARG={A:1,B:2,C:3,I:4,J:5,K:6,D:7,E:8,F:9,H:11,M:13,Q:17,R:18,S:19,T:20,U:21,V:22,W:23,X:24,Y:25,Z:26};
const FUNCS=['SIN','COS','TAN','ASIN','ACOS','ATAN','SQRT','SQR','ABS','BIN','BCD','ROUND','RND','FIX','FUP','LN','EXP','POW','ADP','PRM'];
const LIMITS={macroDepth:5,totalDepth:15,blocks:250000,lines:400000};
class MacroError extends Error{constructor(line,msg){super('Line '+line+': '+msg);this.line=line;}}
const DEC='XYZUWIJKRFABCE';
const wordValue=(k,v,expr)=>{if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(expr))return expr;const t=fmt(v);return DEC.includes(k)&&!t.includes('.')?t+'.':t;};
const fmt=v=>{if(!Number.isFinite(v))return '0';let s=(Math.round(v*1e6)/1e6).toFixed(6).replace(/\.?0+$/,'');if(s==='-0')s='0';if(!s.includes('.')&&Math.abs(v)>=0)s=s;return s;};
function needsMacro(src){return /\bG\s*0*31(?!\d)|#|\bIF\s*\[|\bWHILE\s*\[|\bGOTO|\bG\s*65\b|\bM\s*98\b|\bG\s*10\b|PRM\s*\[|\bEND\s*\d/i.test(src.replace(/\([^()]*\)/g,''))||(src.match(/^\s*O\d+/gim)||[]).length>1;}
// Split a file into programs keyed by O number. Text before the first O is program 0.
function splitPrograms(src){const lines=src.split(/\r?\n/),progs=new Map();let cur={o:0,lines:[]};progs.set(0,cur);
 lines.forEach((raw,i)=>{const m=raw.match(/^\s*[O:](\d+)/i);if(m){cur={o:Number(m[1]),lines:[]};progs.set(cur.o,cur);}cur.lines.push({raw,line:i+1});});
 if(!progs.get(0).lines.some(l=>l.raw.replace(/\([^()]*\)/g,'').replace(/[%\s;]/g,'')))progs.delete(0);
 return progs;}
function stripComment(s){let msg='';const out=s.replace(/\(([^()]*)\)/g,(_,t)=>{msg=msg||t.trim();return '';});return {text:out,msg};}

function createExecutor(opt={}){
 const machine=opt.machine==='lathe'?'lathe':'mill';
 const params=opt.params||new Map();// Map<number, number|number[]>
 const offsets=opt.offsets||{};// lathe: {geom:{n:{x,z,r,t}},wear:{...}} mill: {h:{n:{geom,wear}},d:{...}}
 const work=opt.work||{};// {54:{x,y,z},...,ext:{...},shift:{x,z}}
 const common=opt.common||new Map();// persistent #100-#199 and #500-#999
 const notes=[];const out=[];const trace=[];
 const pos={x:0,y:0,z:0};let absolute=true,modal={g1:0,g3:90,f:0,s:0,t:0,h:0,d:0,wcs:54,g17:machine==='lathe'?18:17};let blocks=0,steps=0;const t0=0;let simTime=0;
 const axes=machine==='lathe'?['X','Z']:['X','Y','Z'];
 const skipPos=[0,0,0,0,0,0];// #5061-#5066: work position at the last G31 skip (or its end point without contact)
 let frame=null;
 function param(n,axis){const v=params.get(n);if(v===undefined)return null;if(Array.isArray(v))return axis?(v[axis-1]??null):v[0];return v;}
 function offsetTable(kind){return offsets[kind]||(offsets[kind]={});}
 function sysRead(n,line){
  if(n>=1&&n<=33)throw new MacroError(line,'internal');
  if(n===3000||n===3006)return null;
  if(n===3001)return Math.round(simTime*1000);if(n===3002)return simTime/3600;
  if(n===3011)return 20261127;if(n===3012)return 120000;
  if(n===3901)return common.get(3901)??0;if(n===3902)return common.get(3902)??0;
  if(n===4001)return modal.g1;if(n===4002)return modal.g17;if(n===4003)return absolute?90:91;if(n===4014)return modal.wcs;
  if(n===4109)return modal.f;if(n===4119)return modal.s;if(n===4120)return modal.t;if(n===4111)return modal.h;if(n===4107)return modal.d;
  if(n>=5001&&n<=5003){const k=['x',machine==='lathe'?'z':'y','z'][n-5001];if(machine==='lathe'&&n===5003)return 0;return pos[k];}
  if(n>=5021&&n<=5023){const k=['x',machine==='lathe'?'z':'y','z'][n-5021];if(machine==='lathe'&&n===5023)return 0;const w=work[modal.wcs]||{};return pos[k]+(w[k]||0);}
  if(n>=5041&&n<=5043)return sysRead(n-40,line);
  if(n>=5061&&n<=5066)return skipPos[n-5061];
  if(n>=5201&&n<=5340){const idx=Math.floor((n-5201)/20),axis=(n-5201)%20;const key=idx===0?'ext':String(53+idx);if(idx>6||axis>=axes.length)return 0;const w=work[key]||{};return w[axes[axis].toLowerCase()]||0;}
  if(machine==='lathe'){
   const map=[[2001,'wear','x'],[2101,'wear','z'],[2201,'wear','r'],[2301,'wear','t'],[2701,'geom','x'],[2801,'geom','z'],[2901,'geom','r'],[2401,'geom','t']];
   for(const [base,kind,k] of map)if(n>=base&&n<base+64){const o=offsetTable(kind)[n-base+1];return o?o[k]||0:0;}
   if(n===2501)return (work.shift||{}).x||0;if(n===2601)return (work.shift||{}).z||0;
  }else{
   const map=[[2001,'h','geom'],[2201,'h','wear'],[2401,'d','geom'],[2601,'d','wear'],[11001,'h','geom'],[10001,'h','wear'],[13001,'d','geom'],[12001,'d','wear']];
   for(const [base,kind,k] of map)if(n>=base&&n<base+200){const o=offsetTable(kind)[n-base+1];return o?o[k]||0:0;}
  }
  if((n>=100&&n<=199)||(n>=500&&n<=999))return common.has(n)?common.get(n):null;
  throw new MacroError(line,'Variable #'+n+' is not available in this simulator');
 }
 function sysWrite(n,v,line,msg){
  if(n===3000){throw new MacroError(line,'MACRO ALARM '+(3000+(v|0))+(msg?' '+msg:''));}
  if(n===3006){notes.push('Line '+line+': MESSAGE STOP '+(msg||''));out.push({stop:'message',line,text:msg||''});return;}
  if(n===3901||n===3902){common.set(n,v);return;}
  if((n>=100&&n<=199)||(n>=500&&n<=999)){common.set(n,v);return;}
  if(n>=5201&&n<=5340){const idx=Math.floor((n-5201)/20),axis=(n-5201)%20;const key=idx===0?'ext':String(53+idx);if(idx>6||axis>=axes.length)throw new MacroError(line,'Bad work offset variable #'+n);const k=axes[axis].toLowerCase();(work[key]||(work[key]={}))[k]=v;out.push({set:{table:'work',key,axis:k,value:v},line});return;}
  if(machine==='lathe'){
   const map=[[2001,'wear','x'],[2101,'wear','z'],[2201,'wear','r'],[2301,'wear','t'],[2701,'geom','x'],[2801,'geom','z'],[2901,'geom','r'],[2401,'geom','t']];
   for(const [base,kind,k] of map)if(n>=base&&n<base+64){const id=n-base+1,t=offsetTable(kind);(t[id]||(t[id]={x:0,z:0,r:0,t:0}))[k]=v;out.push({set:{table:kind,key:id,axis:k,value:v},line});return;}
   if(n===2501||n===2601){const k=n===2501?'x':'z';(work.shift||(work.shift={}))[k]=v;out.push({set:{table:'work',key:'shift',axis:k,value:v},line});return;}
  }else{
   const map=[[2001,'h','geom'],[2201,'h','wear'],[2401,'d','geom'],[2601,'d','wear'],[11001,'h','geom'],[10001,'h','wear'],[13001,'d','geom'],[12001,'d','wear']];
   for(const [base,kind,k] of map)if(n>=base&&n<base+200){const id=n-base+1,t=offsetTable(kind);(t[id]||(t[id]={geom:0,wear:0}))[k]=v;out.push({set:{table:kind,key:id,axis:k,value:v},line});return;}
  }
  throw new MacroError(line,'Variable #'+n+' is read-only or not available');
 }
 // ----- expression parser over a token string -----
 function evaluator(frame,line){
  function get(n){n=Math.round(n);if(n===0)return null;if(n>=1&&n<=33)return frame.locals[n]??null;if(n<0)throw new MacroError(line,'Negative variable number');return sysRead(n,line);}
  function parse(str){let i=0;const s=str;
   const peekWord=w=>s.startsWith(w,i);
   const ws=()=>{while(s[i]===' ')i++;};
   function expect(c){ws();if(s[i]!==c)throw new MacroError(line,'Expected "'+c+'" in expression');i++;}
   function number(){const m=/^(?:\d+(?:\.\d*)?|\.\d+)/.exec(s.slice(i));if(!m)throw new MacroError(line,'Bad number in expression');i+=m[0].length;return Number(m[0]);}
   function varref(){i++;ws();let n;if(s[i]==='['){i++;n=compare();expect(']');}else if(s[i]==='#'){n=varref();}else n=number();if(n===null)n=0;return get(n);}
   function primary(){ws();const c=s[i];
    if(c==='['){i++;const v=compare();expect(']');return v;}
    if(c==='#')return varref();
    if(/[\d.]/.test(c))return number();
    for(const f of FUNCS)if(peekWord(f)&&/[\[ ]/.test(s[i+f.length]||'')){i+=f.length;ws();expect('[');
      if(f==='POW'||f==='PRM'||(f==='ATAN'&&/,/.test(s.slice(i,s.indexOf(']',i)+1)))){const a=compare();let b=null;ws();if(s[i]===','){i++;b=compare();}expect(']');
        if(f==='POW')return Math.pow(a??0,b??0);if(f==='PRM'){const v=param(Math.round(a??0),b===null?0:Math.round(b));if(v===null)throw new MacroError(line,'Parameter '+Math.round(a)+' is not in the parameter table');return v;}
        return deg(Math.atan2(a??0,b??0));}
      const a=compare();expect(']');
      if(f==='ATAN'){ws();if(s[i]==='/'){i++;ws();expect('[');const b=compare();expect(']');return deg(Math.atan2(a??0,b??0));}return deg(Math.atan(a??0));}
      return fn(f,a??0);}
    throw new MacroError(line,'Unexpected "'+(s.slice(i,i+8)||'end')+'" in expression');}
   function unary(){ws();if(s[i]==='-'){i++;const v=unary();return -(v??0);}if(s[i]==='+'){i++;return unary();}return primary();}
   function term(){let v=unary();for(;;){ws();if(s[i]==='*'){i++;v=(v??0)*(unary()??0);}else if(s[i]==='/'){i++;const d=unary()??0;if(d===0)throw new MacroError(line,'Division by zero (alarm 112)');v=(v??0)/d;}else if(peekWord('AND')){i+=3;v=((v??0)&(unary()??0));}else if(peekWord('MOD')){i+=3;const d=unary()??0;if(d===0)throw new MacroError(line,'MOD by zero');v=(v??0)%d;}else break;}return v;}
   function sum(){let v=term();for(;;){ws();if(s[i]==='+'){i++;v=(v??0)+(term()??0);}else if(s[i]==='-'){i++;v=(v??0)-(term()??0);}else if(peekWord('OR')){i+=2;v=((v??0)|(term()??0));}else if(peekWord('XOR')){i+=3;v=((v??0)^(term()??0));}else break;}return v;}
   function compare(){const a=sum();ws();const m=/^(EQ|NE|GT|GE|LT|LE)/.exec(s.slice(i));if(!m)return a;i+=2;const b=sum();
    const op=m[1];if(op==='EQ')return eq(a,b)?1:0;if(op==='NE')return eq(a,b)?0:1;const x=a??0,y=b??0;return (op==='GT'?x>y:op==='GE'?x>=y:op==='LT'?x<y:x<=y)?1:0;}
   const v=compare();ws();if(i<s.length)throw new MacroError(line,'Unexpected "'+s.slice(i,i+8)+'" in expression');return v;}
  return {parse,get};
 }
 const deg=r=>{let d=r*180/Math.PI;if(d<0)d+=360;return d;};
 const eq=(a,b)=>a===null||b===null?a===b:Math.abs(a-b)<1e-9;
 function fn(f,a){const r=a*Math.PI/180;switch(f){case 'SIN':return Math.sin(r);case 'COS':return Math.cos(r);case 'TAN':return Math.tan(r);
  case 'ASIN':return Math.asin(a)*180/Math.PI;case 'ACOS':return Math.acos(a)*180/Math.PI;case 'SQRT':case 'SQR':return Math.sqrt(a);case 'ABS':return Math.abs(a);
  case 'ROUND':case 'RND':return Math.sign(a)*Math.round(Math.abs(a));case 'FIX':return Math.trunc(a);case 'FUP':return a<0?Math.floor(a):Math.ceil(a);
  case 'LN':return Math.log(a);case 'EXP':return Math.exp(a);case 'BIN':{let s=0,m=1;for(let n=a|0;n;n>>=4,m*=10)s+=(n&15)*m;return s;}case 'BCD':return parseInt(String(a|0),16);case 'ADP':return a;}return 0;}
 // Find the expression extent following a word letter: number, #var, [expr], -#var.
 function scanValue(s,i){const start=i;if(s[i]==='-'||s[i]==='+')i++;
  if(s[i]==='['){let d=0;for(;i<s.length;i++){if(s[i]==='[')d++;else if(s[i]===']'){d--;if(!d){i++;break;}}}}
  else if(s[i]==='#'){i++;while(s[i]==='#')i++;if(s[i]==='['){let d=0;for(;i<s.length;i++){if(s[i]==='[')d++;else if(s[i]===']'){d--;if(!d){i++;break;}}}}else while(/[\d.]/.test(s[i]||''))i++;}
  else while(/[\d.]/.test(s[i]||''))i++;
  return [s.slice(start,i),i];}
 function words(s,ev,line){const list=[];let i=0;while(i<s.length){const c=s[i];if(c===' '){i++;continue;}if(!/[A-Z]/.test(c))throw new MacroError(line,'Unrecognized syntax near "'+s.slice(i,i+10)+'"');
   const [expr,j]=scanValue(s,i+1);if(!expr){throw new MacroError(line,'Address '+c+' has no value');}
   const v=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(expr)?Number(expr):ev.parse(expr);list.push([c,v,expr]);i=j;}return list;}
 return {run,out,notes,trace};
 function run(src,library){
  const progs=splitPrograms(src);if(library)for(const [o,t] of library){if(!progs.has(o)){const p=splitPrograms(t);for(const [k,v] of p)if(!progs.has(k))progs.set(k,v);}}
  const main=[...progs.values()][0];if(!main)return {blocks:out,notes,trace};
  const stack=[];frame={prog:main,pc:0,locals:new Array(34).fill(null),loops:[],repeat:1,kind:'main',start:0,macroDepth:0};
  let paramMode=false;
  const emit=(text,l,extra={})=>{if(++blocks>LIMITS.blocks)throw new MacroError(l.line,'Executed block limit reached ('+LIMITS.blocks+')');const b={text,line:l.line,raw:l.raw.trim(),prog:frame.prog.o,depth:stack.length,ti:trace.length,...extra};out.push(b);trace.push({line:l.line,expanded:text,vars:snapshot(),loops:frame.loops.map(x=>'WHILE DO'+x.id+' @ line '+frame.prog.lines[x.pc].line)});};
  const snapshot=()=>{const v={};for(let k=1;k<=33;k++)if(frame.locals[k]!==null)v['#'+k]=fmt(frame.locals[k]);for(const [k,x] of common)if(x!==null&&k<1000&&Object.keys(v).length<40)v['#'+k]=fmt(x);return v;};
  // FANUC searches forward from the GOTO block first, then from the program start (so repeated N numbers resolve to the next one).
  function findN(prog,n,line,from=-1){const re=new RegExp('^\\s*/?\\s*N0*'+n+'(?!\\d)','i');let idx=prog.lines.findIndex((l,i)=>i>from&&re.test(l.raw));if(idx<0)idx=prog.lines.findIndex(l=>re.test(l.raw));if(idx<0)throw new MacroError(line,'Sequence number N'+n+' not found (alarm 128)');return idx;}
  function call(o,l,kind,locals,repeat){const prog=progs.get(o);if(!prog)throw new MacroError(l.line,'Program O'+String(o).padStart(4,'0')+' not found (alarm 76/78)');
   const md=frame.macroDepth+(kind==='G65'?1:0);if(kind==='G65'&&md>LIMITS.macroDepth)throw new MacroError(l.line,'Macro call nesting exceeds '+LIMITS.macroDepth+' levels (alarm 077)');
   if(stack.length+1>LIMITS.totalDepth)throw new MacroError(l.line,'Subprogram nesting exceeds '+LIMITS.totalDepth+' levels (alarm 077)');
   stack.push(frame);frame={prog,pc:1,locals:kind==='G65'?locals:frame.locals,loops:[],repeat:repeat,kind,start:1,macroDepth:md};}
  while(frame){
   if(++steps>LIMITS.lines)throw new MacroError(frame.prog.lines[Math.min(frame.pc,frame.prog.lines.length-1)]?.line||0,'Execution limit reached; possible endless loop');
   if(frame.pc>=frame.prog.lines.length){if(frame.kind==='main')break;if(--frame.repeat>0){frame.pc=frame.start;continue;}frame=stack.pop();if(frame)frame.pc++;continue;}
   const l=frame.prog.lines[frame.pc];const ev=evaluator(frame,l.line);
   let {text,msg}=stripComment(l.raw);text=text.toUpperCase().replace(/\t/g,' ').replace(/;\s*$/,'').trim();
   if(text.includes(';'))text=text.split(';')[0].trim();
   if(!text||text==='%'||/^[O:]\d+$/.test(text.replace(/\s/g,''))){frame.pc++;continue;}
   if(text.startsWith('/')){if(opt.blockSkip!==false){frame.pc++;continue;}text=text.slice(1).trim();}
   // Leading sequence number
   let nnum=null;const nm=/^N\s*(\d+)\s*/.exec(text);if(nm&&!/^N\s*\d+\s*[PR]/.test(text)||nm&&!paramMode){nnum=Number(nm[1]);if(!paramMode)text=text.slice(nm[0].length);}
   const compact=text.replace(/\s+/g,' ').trim();const nos=compact.replace(/ /g,'');
   if(paramMode){if(/^G11/.test(nos)){paramMode=false;frame.pc++;continue;}
     const w=words(compact,ev,l.line);const N=w.find(x=>x[0]==='N'),R=w.find(x=>x[0]==='R'),P=w.find(x=>x[0]==='P');if(!N||!R)throw new MacroError(l.line,'G10 L52 needs N(parameter) and R(value)');
     const no=Math.round(N[1]),axis=P?Math.round(P[1]):0;const cur=params.get(no);if(axis){const arr=Array.isArray(cur)?cur.slice():[cur??0,cur??0,cur??0];arr[axis-1]=R[1];params.set(no,arr);}else params.set(no,R[1]);
     out.push({set:{table:'param',key:no,axis,value:R[1]},line:l.line});frame.pc++;continue;}
   if(!nos){frame.pc++;continue;}
   // Macro statements
   let m;
   if((m=/^IF\[(.*)\](GOTO|THEN)(.*)$/.exec(nos))){const cond=bracketSplit(nos.slice(2),l.line);const c=ev.parse(cond.inner);const rest=cond.rest;
     if(/^GOTO/.test(rest)){if(c){const n=ev.parse(rest.slice(4));frame.pc=findN(frame.prog,Math.round(n),l.line,frame.pc);frame.loops=frame.loops.filter(x=>x.pc<frame.pc);continue;}frame.pc++;continue;}
     if(/^THEN/.test(rest)){if(c)assign(rest.slice(4),ev,l,msg);frame.pc++;continue;}}
   if((m=/^GOTO(.+)$/.exec(nos))){const n=ev.parse(m[1]);if(n===null)throw new MacroError(l.line,'GOTO with vacant target');frame.pc=findN(frame.prog,Math.round(n),l.line,frame.pc);continue;}
   if((m=/^WHILE\[/.exec(nos))){const cond=bracketSplit(nos.slice(5),l.line);const dm=/^DO([1-3])$/.exec(cond.rest);if(!dm)throw new MacroError(l.line,'WHILE needs DO1-DO3');const id=Number(dm[1]);
     if(ev.parse(cond.inner)){if(!frame.loops.some(x=>x.pc===frame.pc)){if(frame.loops.length>=3)throw new MacroError(l.line,'WHILE nesting deeper than 3');frame.loops.push({id,pc:frame.pc});}frame.pc++;continue;}
     frame.loops=frame.loops.filter(x=>x.pc!==frame.pc);let k=frame.pc+1,depth=0;for(;k<frame.prog.lines.length;k++){const t=stripComment(frame.prog.lines[k].raw).text.toUpperCase().replace(/\s/g,'');if(new RegExp('^(N\\d+)?DO'+id+'$').test(t)||/^(N\d+)?WHILE\[.*DO/.test(t)&&t.endsWith('DO'+id))depth++;if(new RegExp('^(N\\d+)?END'+id+'$').test(t)){if(!depth)break;depth--;}}
     if(k>=frame.prog.lines.length)throw new MacroError(l.line,'END'+id+' not found for WHILE (alarm 128)');frame.pc=k+1;continue;}
   if((m=/^DO([1-3])$/.exec(nos))){frame.loops.push({id:Number(m[1]),pc:frame.pc});frame.pc++;continue;}
   if((m=/^END([1-3])$/.exec(nos))){const id=Number(m[1]);const loop=[...frame.loops].reverse().find(x=>x.id===id);if(!loop)throw new MacroError(l.line,'END'+id+' without matching DO'+id);frame.pc=loop.pc;continue;}
   if(nos.startsWith('#')){assign(nos,ev,l,msg);frame.pc++;continue;}
   if(/^(POPEN|PCLOS|DPRNT|BPRNT)/.test(nos)){notes.push('Line '+l.line+': '+nos.slice(0,5)+' output ignored');frame.pc++;continue;}
   // NC block with possible expressions
   const w=words(compact,ev,l.line);const gs=w.filter(x=>x[0]==='G').map(x=>x[1]);
   if(gs.includes(65)||gs.includes(66)){if(gs.includes(66))throw new MacroError(l.line,'Modal macro call G66 is not supported');const P=w.find(x=>x[0]==='P');if(!P)throw new MacroError(l.line,'G65 needs P (program number)');const L=w.find(x=>x[0]==='L');
     const locals=new Array(34).fill(null);for(const [k,v] of w){if(k==='G'||k==='P'||k==='L'||k==='N'||k==='O')continue;if(!(k in ARG))throw new MacroError(l.line,'Address '+k+' cannot be a G65 argument');if(v!==null)locals[ARG[k]]=v;}
     emit('(G65 P'+P[1]+')',l,{call:P[1]});call(Math.round(P[1]),l,'G65',locals,L?Math.round(L[1]):1);continue;}
   const ms=w.filter(x=>x[0]==='M').map(x=>x[1]);
   if(gs.includes(10)){const L=w.find(x=>x[0]==='L');const lv=L?Math.round(L[1]):(machine==='lathe'?null:null);
     if(lv===52){paramMode=true;frame.pc++;continue;}
     applyG10(w,lv,l);frame.pc++;continue;}
   if(gs.includes(11)){frame.pc++;continue;}
   if(ms.includes(98)){const P=w.find(x=>x[0]==='P');if(!P)throw new MacroError(l.line,'M98 needs P');const L=w.find(x=>x[0]==='L');let o=Math.round(P[1]),rep=L?Math.round(L[1]):1;if(!L&&o>9999&&!progs.has(o)){rep=Math.floor(o/10000);o=o%10000;}
     const rest=w.filter(x=>!['M','P','L','N'].includes(x[0])||x[0]==='M'&&x[1]!==98);if(rest.length)emit(rest.map(x=>x[0]+fmt(x[1])).join(' '),l);emit('(M98 P'+o+')',l,{call:o});call(o,l,'M98',null,Math.max(1,rep));continue;}
   if(ms.includes(99)){const P=w.find(x=>x[0]==='P');if(frame.kind==='main'){notes.push('Line '+l.line+': M99 in main program; simulation ends (would loop forever)');emit('M30',l,{end:true});break;}
     if(--frame.repeat>0){frame.pc=frame.start;continue;}const back=stack.pop();frame=back;if(P){frame.pc=findN(frame.prog,Math.round(P[1]),l.line);}else frame.pc++;continue;}
   // Normal NC block: substitute values, omit vacant words
   const parts=[];for(const [k,v,expr] of w){if(v===null)continue;parts.push(k+wordValue(k,v,expr));}
   const skip=gs.includes(31);
   track(w);
   const text2=(nnum!==null?'N'+nnum+' ':'')+parts.join(' ');
   if(parts.length)emit(text2,l,{n:nnum});
   if(skip&&parts.length)g31(out[out.length-1],l);
   if(ms.some(x=>x===30||x===2)&&frame.kind==='main'){break;}
   frame.pc++;
  }
  return {blocks:out,notes,trace,params,offsets,work,common};
 }
 function bracketSplit(s,line){if(s[0]!=='[')throw new MacroError(line,'Expected [');let d=0;for(let i=0;i<s.length;i++){if(s[i]==='[')d++;else if(s[i]===']'){d--;if(!d)return {inner:s.slice(1,i),rest:s.slice(i+1)};}}throw new MacroError(line,'Unbalanced brackets');}
 function assign(s,ev,l,msg){const eqi=s.indexOf('=');if(eqi<0)throw new MacroError(l.line,'Expected = in assignment');const lhs=s.slice(0,eqi),rhs=s.slice(eqi+1);
  let n;if(/^#\d+$/.test(lhs))n=Number(lhs.slice(1));else n=ev.parse(lhs.replace(/^#/,'')+'');if(/^#\[/.test(lhs))n=ev.parse(lhs.slice(1));else if(/^##/.test(lhs))n=ev.get(Number(lhs.slice(2)));
  n=Math.round(n);if(!rhs)throw new MacroError(l.line,'Missing value in assignment');const v=ev.parse(rhs);
  if(n>=1&&n<=33){currentFrame().locals[n]=v;return;}if(n===0)throw new MacroError(l.line,'#0 is read-only');sysWrite(n,v,l.line,msg);}
 function currentFrame(){return frame;}
 // G31 (one-shot): the host (opt.skip) runs the blocks so far, searches the move for contact with the material and returns
 // the stop point {x,y,z, contact} in work coordinates; without a host the move runs its full distance. The block keeps
 // the stop point (block.skip) so the interpreters end the move there, and #5061+ read it (FANUC: end point if no contact).
 function g31(b,l){let r=null;if(typeof opt.skip==='function')r=opt.skip({blocks:out,block:b,line:l.line});
  const end=r||{x:pos.x,y:pos.y,z:pos.z,contact:false,full:true};
  for(const a of ['x','y','z'])if(Number.isFinite(end[a]))pos[a]=Math.round(end[a]*1000)/1000||0;// IS-B: 0.001 mm
  axes.forEach((a,i)=>{skipPos[i]=pos[a.toLowerCase()];});
  if(r)b.skip={x:pos.x,y:pos.y,z:pos.z,contact:!!r.contact};}
 function track(w){for(const [k,v] of w){if(v===null)continue;if(k==='G'){if([0,1,2,3,32,33].includes(v))modal.g1=v;else if(v===90&&machine==='mill')absolute=true;else if(v===91&&machine==='mill')absolute=false;else if(v>=54&&v<=59)modal.wcs=v;else if([17,18,19].includes(v))modal.g17=v;}
   else if(k==='F')modal.f=v;else if(k==='S')modal.s=v;else if(k==='T')modal.t=v;else if(k==='H')modal.h=v;else if(k==='D')modal.d=v;}
  for(const [k,v] of w){if(v===null)continue;const a=k.toLowerCase();
   if(machine==='lathe'){if(k==='X'||k==='Z')pos[a]=v;else if(k==='U')pos.x+=v;else if(k==='W')pos.z+=v;}
   else if(k==='X'||k==='Y'||k==='Z')pos[a]=absolute?v:pos[a]+v;}}
 function applyG10(w,L,l){const g=k=>{const x=w.find(y=>y[0]===k);return x?x[1]:null;};const P=g('P');
  if(L===2||L===20){const key=P===0?'ext':String(53+Math.round(P||1));const wk=work[key]||(work[key]={});for(const a of axes){const v=g(a);if(v!==null){wk[a.toLowerCase()]=v;out.push({set:{table:'work',key,axis:a.toLowerCase(),value:v},line:l.line});}}return;}
  if(machine==='lathe'){if(P===null)throw new MacroError(l.line,'G10 needs P (offset number)');let id=Math.round(P),kind='wear';if(id>=10000){kind='geom';id-=10000;}if(id===0){const s=work.shift||(work.shift={});for(const [a,ia] of [['X','U'],['Z','W']]){const v=g(a),iv=g(ia);if(v!==null)s[a.toLowerCase()]=v;if(iv!==null)s[a.toLowerCase()]=(s[a.toLowerCase()]||0)+iv;out.push({set:{table:'work',key:'shift',axis:a.toLowerCase(),value:s[a.toLowerCase()]||0},line:l.line});}return;}
   const t=offsetTable(kind),o=t[id]||(t[id]={x:0,z:0,r:0,t:0});for(const [a,ia,k] of [['X','U','x'],['Z','W','z'],['R','C','r'],['Q',null,'t']]){const v=g(a),iv=ia?g(ia):null;if(v!==null)o[k]=v;if(iv!==null)o[k]+=iv;if(v!==null||iv!==null)out.push({set:{table:kind,key:id,axis:k,value:o[k]},line:l.line});}return;}
  const map={10:['h','geom'],11:['h','wear'],12:['d','geom'],13:['d','wear'],1:['h','geom']};const m=map[L];if(!m||P===null)throw new MacroError(l.line,'G10 L'+L+' is not supported (use L2, L10-L13 or L52)');const R=g('R');if(R===null)throw new MacroError(l.line,'G10 needs R');const t=offsetTable(m[0]),o=t[Math.round(P)]||(t[Math.round(P)]={geom:0,wear:0});o[m[1]]=R;out.push({set:{table:m[0],key:Math.round(P),axis:m[1],value:R},line:l.line});}
}
// Public entry: returns {blocks, notes, trace, error, params, offsets, work, common}
function execute(src,opt={}){const ex=createExecutor(opt);try{const r=ex.run(src,opt.library);return {...r,error:null};}catch(e){if(e instanceof MacroError)return {blocks:ex.out,notes:[...ex.notes,e.message],trace:ex.trace,error:e.message,params:opt.params,offsets:opt.offsets,work:opt.work,common:opt.common};throw e;}}
const api={execute,needsMacro,splitPrograms,LIMITS,ARG,format:fmt,MacroError};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FanucMacro=api;
})(typeof globalThis!=='undefined'?globalThis:this);
