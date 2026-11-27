'use strict';
// Custom Macro B template library (Macros menu). Pure data + text generation so the tests run it in Node.
// Body tokens: {X} … {Z} = the local variable of that G65 argument (argument specification I: A=#1 … Z=#26),
// {L1}…{L9} = GOTO labels, {D1} {D2} = WHILE/DO loop numbers. Temporaries use #27–#33 (locals that no argument sets).
// A template renders either inline (#24=… assignments + body at the cursor) or as a G65 call plus an O9xxx subprogram.
(function(root){
const ARG={A:1,B:2,C:3,I:4,J:5,K:6,D:7,E:8,F:9,H:11,M:13,Q:17,R:18,S:19,T:20,U:21,V:22,W:23,X:24,Y:25,Z:26};
const LETTERS=Object.keys(ARG);
const p=(k,label,def,unit='mm',opt={})=>({k,label,def,unit,...opt});
// setup: blocks a host program needs before the call (tool, spindle, work offset); shown as a hint and used by the tests.
const MILL_SETUP=t=>[`T${t}M6`,'G0X0Y0S1800M3',`G43Z25.H${t}M8`];
const TEMPLATES=[
 {id:'bolt-circle',machine:'mill',o:9110,name:'Bolt-hole circle',setup:MILL_SETUP(7),
  desc:'Drills H holes equally spaced on a circle of diameter D around X Y, starting at angle A (degrees from +X, counter-clockwise). Q > 0 pecks with G83, Q = 0 drills with G81. R-point K, depth Z (work coordinates).',
  params:[p('X','Circle centre X',0),p('Y','Circle centre Y',0),p('D','Bolt circle diameter',60),p('A','Start angle',15,'°'),p('H','Number of holes',6,'',{int:true,min:1,max:360}),p('Z','Hole depth Z',-12),p('K','R-point Z',2),p('Q','Peck depth (0 = G81)',3),p('F','Feed',120,'mm/min')],
  body:['IF[{H} LT 1]GOTO{L9}','#30=360/{H}(PITCH ANGLE)','#31=0(HOLE INDEX)','WHILE[#31 LT {H}]DO{D1}','#32={A}+#31*#30','#27={X}+{D}/2*COS[#32]','#28={Y}+{D}/2*SIN[#32]','IF[{Q} GT 0]GOTO{L1}','G99G81X#27Y#28Z{Z}R{K}F{F}','GOTO{L2}','N{L1} G99G83X#27Y#28Z{Z}R{K}Q{Q}F{F}','N{L2} #31=#31+1','END{D1}','N{L9} G80','G0Z[{K}+10.]']},
 {id:'rect-pocket',machine:'mill',o:9120,name:'Rectangular pocket',setup:MILL_SETUP(2),
  desc:'Clears an I × J rectangular pocket centred on X Y down to Z in steps of K, with concentric passes (stepover Q % of the tool diameter T). Plunges straight at the centre (centre-cutting end mill), feed E for plunges, F for cutting. Clearance plane R.',
  params:[p('X','Pocket centre X',0),p('Y','Pocket centre Y',0),p('I','Pocket length X',40),p('J','Pocket width Y',30),p('Z','Pocket floor Z',-6),p('K','Depth per pass',2),p('T','Tool diameter',12),p('Q','Stepover',60,'%'),p('R','Clearance plane Z',2),p('E','Plunge feed',150,'mm/min'),p('F','Cutting feed',600,'mm/min')],
  body:['#27={I}/2-{T}/2(MAX X OFFSET OF THE TOOL CENTRE)','#28={J}/2-{T}/2','IF[#27 LT 0]GOTO{L8}','IF[#28 LT 0]GOTO{L8}','#29={T}*{Q}/100(STEPOVER)','#31=#27','IF[#28 GT #31]THEN#31=#28','#32=FUP[#31/#29](RINGS)','IF[#32 LT 1]THEN#32=1','#30=0(CURRENT DEPTH)','G0X{X}Y{Y}','G0Z{R}','WHILE[#30 GT {Z}]DO{D1}','#30=#30-{K}','IF[#30 LT {Z}]THEN#30={Z}','G1Z#30F{E}','#33=1','WHILE[#33 LE #32]DO{D2}','G1X[{X}-#27*#33/#32]Y[{Y}-#28*#33/#32]F{F}','X[{X}+#27*#33/#32]','Y[{Y}+#28*#33/#32]','X[{X}-#27*#33/#32]','Y[{Y}-#28*#33/#32]','#33=#33+1','END{D2}','G1X{X}Y{Y}','END{D1}','G0Z{R}','GOTO{L9}','N{L8} #3000=1(POCKET SMALLER THAN TOOL)','N{L9} G0Z{R}']},
 {id:'circ-pocket',machine:'mill',o:9130,name:'Circular pocket',setup:MILL_SETUP(2),
  desc:'Clears a circular pocket of diameter D centred on X Y down to Z in steps of K, with concentric full circles (G3, climb milling) at Q % stepover of the tool diameter T. Clearance plane R.',
  params:[p('X','Pocket centre X',0),p('Y','Pocket centre Y',0),p('D','Pocket diameter',40),p('Z','Pocket floor Z',-5),p('K','Depth per pass',2.5),p('T','Tool diameter',12),p('Q','Stepover',60,'%'),p('R','Clearance plane Z',2),p('E','Plunge feed',150,'mm/min'),p('F','Cutting feed',600,'mm/min')],
  body:['#27={D}/2-{T}/2(MAX RADIUS OF THE TOOL CENTRE)','IF[#27 LE 0]GOTO{L8}','#29={T}*{Q}/100','#32=FUP[#27/#29]','#30=0','G0X{X}Y{Y}','G0Z{R}','WHILE[#30 GT {Z}]DO{D1}','#30=#30-{K}','IF[#30 LT {Z}]THEN#30={Z}','G1Z#30F{E}','#33=1','WHILE[#33 LE #32]DO{D2}','#31=#27*#33/#32','G1X[{X}+#31]Y{Y}F{F}','G3X[{X}+#31]Y{Y}I-#31J0','#33=#33+1','END{D2}','G1X{X}Y{Y}','END{D1}','G0Z{R}','GOTO{L9}','N{L8} #3000=1(POCKET SMALLER THAN TOOL)','N{L9} G0Z{R}']},
 {id:'facing',machine:'mill',o:9140,name:'Facing pattern (zigzag)',setup:MILL_SETUP(1),
  desc:'Faces an I × J area whose front-left corner is X Y at height Z, in zigzag passes along X with Q % stepover of the cutter diameter T. Runs off the part by half the cutter plus 5 mm on both ends. Clearance plane R.',
  params:[p('X','Front-left corner X',-50),p('Y','Front-left corner Y',-40),p('I','Length X',100),p('J','Width Y',80),p('Z','Face height Z',-0.5),p('T','Cutter diameter',63),p('Q','Stepover',70,'%'),p('R','Clearance plane Z',5),p('F','Feed',800,'mm/min')],
  body:['#27={X}-{T}/2-5.(X START, OFF THE PART)','#28={X}+{I}+{T}/2+5.(X END)','#29={T}*{Q}/100','#32=FUP[{J}/#29](PASSES - 1)','IF[#32 LT 1]THEN#32=1','#30=0','G0X#27Y{Y}','G0Z{R}','G1Z{Z}F{F}','WHILE[#30 LE #32]DO{D1}','#31={Y}+{J}*#30/#32','G1Y#31','G1X#28','#33=#27','#27=#28','#28=#33','#30=#30+1','END{D1}','G0Z{R}']},
 {id:'peck-drill',machine:'mill',o:9150,name:'Peck drilling loop',setup:MILL_SETUP(7),
  desc:'Drills one hole at X Y with a programmed peck loop (no canned cycle): pecks of Q, full retract to the R-point after each peck, rapid back to K above the last depth. Call it again with G65 for more holes.',
  params:[p('X','Hole X',20),p('Y','Hole Y',0),p('Z','Hole depth Z',-20),p('Q','Peck depth',4),p('R','R-point Z',2),p('K','Rapid clearance',0.5),p('F','Feed',150,'mm/min')],
  body:['G0X{X}Y{Y}','G0Z{R}','#27={R}(CURRENT DEPTH)','WHILE[#27 GT {Z}]DO{D1}','#29=#27+{K}','IF[#29 GT {R}]THEN#29={R}','#27=#27-{Q}','IF[#27 LT {Z}]THEN#27={Z}','G0Z#29','G1Z#27F{F}','G0Z{R}','END{D1}']},
 {id:'probe-edge',machine:'mill',o:9160,name:'Probe an X edge (G31)',setup:['T12M6','G0X0Y0','G43Z25.H12'],
  desc:'Touch-probe cycle with the T12 ball probe: from X Y it lowers to depth Z with a protected G31 move, then searches D (+1 or −1) towards an X edge with G31 for up to Q. The skip position #5061 (ball centre X) is compensated by the stylus radius (T = diameter) and stored as the edge in common variable #140, the search start in #141. Without contact G31 runs the full distance and #5061 is its end point. Clearance plane R.',
  params:[p('X','Start X (beside the part)',-70),p('Y','Start Y',0),p('Z','Probe depth Z',-5),p('D','Direction (+1 / −1)',1,'',{min:-1,max:1}),p('Q','Search distance',25),p('T','Stylus diameter',6),p('R','Clearance plane Z',10),p('F','Probe feed',300,'mm/min')],
  body:['G0X{X}Y{Y}','G0Z{R}','G31Z{Z}F[{F}*3](PROTECTED MOVE DOWN)','G31X[{X}+{D}*{Q}]F{F}','#27=#5061(SKIP POSITION X)','#140=#27+{D}*{T}/2(EDGE X)','#141={X}','G0X{X}','G0Z{R}']},
 {id:'part-counter',machine:'both',o:9170,name:'Part counter (#3901)',
  desc:'Counts parts: adds 1 to the parts counter #3901. H > 0 also sets the required parts #3902. When the count reaches #3902 it stops with an operator message (#3006); H = 0 keeps the current #3902 (0 = no limit). Put it just before M30.',
  params:[p('H','Required parts (0 = keep)',100,'',{int:true,min:0,max:99999999})],
  body:['IF[{H} GT 0]THEN#3902={H}','#3901=#3901+1(PARTS COUNTED)','IF[#3902 EQ 0]GOTO{L9}','IF[#3901 LT #3902]GOTO{L9}','#3006=1(REQUIRED PARTS REACHED)','N{L9} #27=#3901']},
 {id:'lathe-rough',machine:'lathe',o:9210,name:'OD multi-pass roughing loop',setup:['T0101','G96S200M3','G0X60.Z5.M8'],
  desc:'Straight OD roughing with a WHILE loop: from stock diameter X down to U plus a finishing allowance K (on diameter), D per side each pass, from Z start W to Z end Z. Retracts R (radius) at the end of each pass and rapids back to W. Use G70/finish pass afterwards.',
  params:[p('X','Stock diameter',50),p('U','Target diameter',36),p('K','Finish allowance (Ø)',0.5),p('D','Depth of cut per side',2),p('W','Start Z',2),p('Z','End Z',-30),p('R','Retract (radius)',1),p('F','Feed',0.25,'mm/rev')],
  body:['#27={X}(CURRENT DIAMETER)','#28={U}+{K}(LAST ROUGH DIAMETER)','G0X[{X}+2*{R}]Z{W}','WHILE[#27 GT #28]DO{D1}','#27=#27-2*{D}','IF[#27 LT #28]THEN#27=#28','G0X#27','G1Z{Z}F{F}','G1X[#27+2*{R}]','G0Z{W}','END{D1}','G0X[{X}+2*{R}]']},
 {id:'lathe-groove',machine:'lathe',o:9220,name:'Grooving loop (several grooves)',setup:['T0404','G97S800M3','G0X60.Z5.M8'],
  desc:'Cuts H grooves to root diameter X, the first at Z, the next every W (negative = towards the chuck). Grooves wider than the insert T get side-by-side plunges (80 % overlap of the insert) up to width U. Dwell E seconds at the bottom, clearance diameter C.',
  params:[p('Z','First groove Z (right flank)',-12),p('W','Groove pitch',-10),p('H','Number of grooves',3,'',{int:true,min:1,max:100}),p('X','Root diameter',38),p('U','Groove width',5),p('T','Insert width',3),p('C','Clearance diameter',54),p('E','Dwell at the bottom',0.2,'s'),p('F','Feed',0.06,'mm/rev')],
  body:['#30=0(GROOVE INDEX)','#33=FUP[[{U}-{T}]/[{T}*0.8]](EXTRA PLUNGES)','IF[#33 LT 0]THEN#33=0','#29=#33','IF[#29 LT 1]THEN#29=1','WHILE[#30 LT {H}]DO{D1}','#31={Z}+#30*{W}','#32=0','WHILE[#32 LE #33]DO{D2}','G0X{C}Z[#31-[{U}-{T}]*#32/#29]','G1X{X}F{F}','G4X{E}','G0X{C}','#32=#32+1','END{D2}','#30=#30+1','END{D1}']},
 {id:'lathe-thread',machine:'lathe',o:9230,name:'Thread repeat (G92 pass loop)',setup:['T0606','G97S600M3','G0X50.Z5.M8'],
  desc:'Cuts an OD thread with G92 passes from a WHILE loop: major diameter X, end Z, lead F, thread height K (radius, 0.6134 × pitch for ISO metric), first depth D with degressive depths D × √n, then Q spring passes at the final diameter. Starts from W.',
  params:[p('X','Major diameter',40),p('Z','Thread end Z',-22),p('F','Lead (pitch)',2,'mm'),p('K','Thread height (radius)',1.227),p('D','First pass depth (radius)',0.35),p('Q','Spring passes',1,'',{int:true,min:0,max:10}),p('W','Start Z',5)],
  body:['#30=1(PASS)','#31=0(DEPTH)','G0X[{X}+4.]Z{W}','WHILE[#31 LT {K}]DO{D1}','#31={D}*SQRT[#30]','IF[#31 GT {K}]THEN#31={K}','G92X[{X}-2*#31]Z{Z}F{F}','#30=#30+1','END{D1}','#32=0','WHILE[#32 LT {Q}]DO{D2}','G92X[{X}-2*{K}]Z{Z}F{F}','#32=#32+1','END{D2}','G80(CANCEL G92)','G0X[{X}+4.]Z{W}']},
 {id:'lathe-probe-face',machine:'lathe',o:9240,name:'Probe the part face Z (G31)',setup:['T0101','G97S500M5','G0X60.Z10.'],
  desc:'Probing-style stub for a touch probe or tool setter: at diameter X it moves from Z start W towards the chuck for up to Q, stops at contact with G31 and stores the skip position Z (#5062) in #142 and the difference to the expected face Z in #143. Contact is with the active tool outline (here the T01 insert nose). Feeds per minute (G98) and returns to G99. Without contact G31 runs the full distance and #5062 is its end point.',
  params:[p('X','Probe diameter',20),p('W','Start Z',5),p('Q','Search distance',6),p('Z','Expected face Z',0),p('F','Probe feed',100,'mm/min')],
  body:['G0X{X}Z{W}','G98(FEED PER MINUTE FOR THE PROBE)','G31Z[{W}-{Q}]F{F}','#142=#5062(SKIP POSITION Z)','#143=#142-{Z}(FACE ERROR)','G0Z{W}','G99']},
];
const fmt=v=>{const n=Number(v);if(!Number.isFinite(n))return '0';const s=Math.abs(n-Math.round(n))<1e-9?String(Math.round(n))+'.':String(+n.toFixed(4));return s==='-0.'?'0.':s;};
function forMachine(m,user=[]){return [...TEMPLATES,...user].filter(t=>t.machine===m||t.machine==='both');}
function byId(id,user=[]){return [...TEMPLATES,...user].find(t=>t.id===id)||null;}
function values(t,v={}){const o={};for(const q of t.params){const x=v[q.k]!==undefined&&v[q.k]!==''?Number(v[q.k]):q.def;o[q.k]=Number.isFinite(x)?x:q.def;}return o;}
function check(t,v){const errs=[];for(const q of t.params){const x=v[q.k];if(!Number.isFinite(x))errs.push(q.label+': not a number');else{if(q.int&&!Number.isInteger(x))errs.push(q.label+': whole number');if(q.min!==undefined&&x<q.min)errs.push(q.label+': at least '+q.min);if(q.max!==undefined&&x>q.max)errs.push(q.label+': at most '+q.max);}}return errs;}
// Program numbers and sequence numbers already in use (in the text and the program directory).
function usedO(text,dir=[]){const s=new Set(dir.map(Number));for(const m of String(text).matchAll(/^\s*[O:](\d+)/gim))s.add(Number(m[1]));return s;}
function freeO(text,dir,pref=9100){const u=usedO(text,dir);for(let o=Math.max(9000,Math.min(9999,pref));o<=9999;o++)if(!u.has(o))return o;for(let o=9000;o<9999;o++)if(!u.has(o))return o;return null;}
function usedN(text){const s=new Set();for(const m of String(text).replace(/\([^()]*\)/g,'').matchAll(/(?:^|[^A-Z#])N\s*(\d+)/gim))s.add(Number(m[1]));return s;}
function expand(t,labels,loops){return t.body.map(line=>line.replace(/\{([A-Z])\}/g,(m,k)=>ARG[k]?'#'+ARG[k]:m).replace(/\{L(\d)\}/g,(_,i)=>String(labels[i])).replace(/\{D(\d)\}/g,(_,i)=>String(loops[i])));}
function labelsIn(t){const s=new Set();for(const l of t.body)for(const m of l.matchAll(/\{L(\d)\}/g))s.add(Number(m[1]));return [...s].sort();}
// Render one template. mode 'inline' | 'g65'. opt: {text (current program, for free O/N numbers), dir (directory O numbers), o}.
function render(t,v,mode='g65',opt={}){const val=values(t,v),errs=check(t,val);const used=labelsIn(t),loops={1:1,2:2,3:3},title=t.name.toUpperCase().replace(/[()]/g,'').slice(0,40);
 if(mode==='inline'){const taken=usedN(opt.text||''),labels={};let n=8000;for(const i of used){while(taken.has(n))n+=10;labels[i]=n;taken.add(n);n+=10;}
  const lines=[`(MACRO ${title} - INLINE)`,...t.params.map(q=>`#${ARG[q.k]}=${fmt(val[q.k])}(${q.k} ${q.label.toUpperCase().replace(/[()]/g,'').slice(0,28)})`),...expand(t,labels,loops),`(END ${title})`];
  return {mode,call:lines.join('\n'),sub:'',o:null,errs,locals:t.params.map(q=>'#'+ARG[q.k]).concat(['#27–#33'])};}
 const o=opt.o||freeO(opt.text||'',opt.dir||[],t.o||9100);const labels={};used.forEach((i,j)=>labels[i]=(j+1)*10);
 const call=`G65P${String(o).padStart(4,'0')}${t.params.map(q=>q.k+fmt(val[q.k])).join('')}(${title})`;
 const sub=[`O${String(o).padStart(4,'0')}(${title})`,...expand(t,labels,loops),'M99'].join('\n');
 if(o==null||!Number.isInteger(o)||o<1||o>9999)errs.push('O number must be 1–9999');else if(usedO(opt.text||'',opt.dir||[]).has(o))errs.push(`O${String(o).padStart(4,'0')} is already used in this program or the program directory`);
 return {mode,call,sub,o,errs};}
// Put a rendered macro into a program: the call/inline block at `at` (on its own lines), the subprogram after the
// last block (before a closing %). Returns {text, cursor}.
function insert(text,at,r){text=String(text);at=Math.max(0,Math.min(text.length,at|0));let a=text.slice(0,at),b=text.slice(at);
 const ls=a.lastIndexOf('\n')+1;if(a.slice(ls).trim()){const le=b.indexOf('\n');if(le<0){a=text;b='';}else{a=a+b.slice(0,le+1);b=b.slice(le+1);}}
 else{b=a.slice(ls)+b;a=a.slice(0,ls);}
 if(a&&!a.endsWith('\n'))a+='\n';const block=r.call+'\n';let out=a+block+b;const cursor=(a+block).length;
 if(r.sub){const m=/\n%[ \t]*(\r?\n\s*)?$/.exec(out);const tail=m?out.slice(m.index):'';let head=m?out.slice(0,m.index):out.replace(/\s+$/,'');out=head+'\n'+r.sub+(tail||'\n');}
 return {text:out,cursor};}
// User macros: stored as JSON; validated on save and import.
const LIMITS={name:48,desc:600,params:20,body:120,line:200};
function sanitize(m){if(!m||typeof m!=='object')throw Error('Not a macro object');const name=String(m.name||'').trim().slice(0,LIMITS.name);if(!name)throw Error('Macro needs a name');
 const machine=['mill','lathe','both'].includes(m.machine)?m.machine:null;if(!machine)throw Error(name+': machine must be mill, lathe or both');
 const params=(Array.isArray(m.params)?m.params:[]).slice(0,LIMITS.params).map(q=>{const k=String(q.k||'').toUpperCase();if(!ARG[k])throw Error(name+': argument '+k+' is not a G65 letter ('+LETTERS.join(' ')+')');const def=Number(q.def);if(!Number.isFinite(def))throw Error(name+': '+k+' default must be a number');return {k,label:String(q.label||k).slice(0,40),def,unit:String(q.unit||'').slice(0,8)};});
 if(new Set(params.map(q=>q.k)).size!==params.length)throw Error(name+': an argument letter is used twice');
 const body=(Array.isArray(m.body)?m.body:String(m.body||'').split(/\r?\n/)).map(l=>String(l).replace(/\s+$/,'').slice(0,LIMITS.line)).filter(l=>l.trim()).slice(0,LIMITS.body);if(!body.length)throw Error(name+': empty body');
 if(body.some(l=>/^\s*[O:]\d/i.test(l)||/\bM\s*(30|0?2)\b|\bM\s*99\b/i.test(l.replace(/\([^()]*\)/g,''))))throw Error(name+': the body must not contain O numbers, M30/M02 or M99 (they are added on insert)');
 const o=Number(m.o);return {id:'user-'+String(m.id||name).toLowerCase().replace(/^user-/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40),user:true,machine,name,desc:String(m.desc||'').slice(0,LIMITS.desc),params,body,o:Number.isInteger(o)&&o>=9000&&o<=9999?o:9500};}
function exportJSON(list){return JSON.stringify({format:'fanucsim-macros',version:1,macros:list.map(({user,...m})=>m)},null,1);}
function importJSON(json,existing=[]){const d=typeof json==='string'?JSON.parse(json):json;const arr=Array.isArray(d)?d:d&&d.format==='fanucsim-macros'?d.macros:null;if(!Array.isArray(arr))throw Error('Not a FANUC Simulator macro file');
 const out=[...existing],ids=new Set(out.map(m=>m.id).concat(TEMPLATES.map(t=>t.id)));let added=0;
 for(const raw of arr){const m=sanitize(raw);let id=m.id,i=2;while(ids.has(id)){const same=out.findIndex(x=>x.id===id&&x.name===m.name);if(same>=0){out[same]=m;id=null;break;}id=m.id+'-'+i++;}if(id===null){added++;continue;}m.id=id;ids.add(id);out.push(m);added++;}
 return {list:out,added};}
const api={ARG,LETTERS,TEMPLATES,forMachine,byId,values,check,render,insert,freeO,usedO,usedN,sanitize,exportJSON,importJSON,fmt};
if(typeof module!=='undefined')module.exports=api;else root.MacroTemplates=api;
})(typeof globalThis!=='undefined'?globalThis:this);
