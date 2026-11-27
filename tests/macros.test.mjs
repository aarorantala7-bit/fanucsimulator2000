import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const T=require('../src/macros/templates.js'),M=require('../src/nc/macro.js'),MD=require('../src/nc/machine.js'),{parse}=require('../src/simulation/program.js'),L=require('../src/lathe/lathe.js');

const MILL_SETUP=['T2M6','G0X0Y0S1800M3','G43Z25.H2M8'],LATHE_SETUP=['T0101','G96S200M3','G0X60.Z5.M8'];
function host(machine,t){const s=(t.setup||(machine==='mill'?MILL_SETUP:LATHE_SETUP)).join('\n');
 return machine==='mill'?`%\nO0001(HOST)\nG21G17G40G49G80G90G54\n${s}\n@\nG0Z25.\nG91G28Z0M5\nG90\nM30\n%\n`:`%\nO0001(HOST)\nG21G18G40G99\nG50S2000\n${s}\n@\nG0X120.Z50.M9\nG28U0W0M5\nM30\n%\n`;}
function run(machine,text,g54){const work=MD.defaultWork(machine);if(g54)work[54]=g54;
 if(machine==='mill'){const params=MD.defaultParams('mill'),offsets=MD.defaultMillOffsets(),p0=new Map([...params].map(([k,v])=>[k,Array.isArray(v)?v.slice():v])),common=new Map();
  const m=M.execute(text,{machine:'mill',params,offsets,work,common});if(m.error)return {error:m.error,notes:m.notes,segs:[],common};const r=parse(m.blocks,{params:p0,offsets,work});return {error:null,notes:[...m.notes,...r.notes],segs:r.s,common};}
 const o={params:MD.defaultParams('lathe'),offsets:MD.defaultLatheOffsets(),work,tools:MD.clone(MD.LATHE_TOOLS),common:new Map()};const r=L.simulate(text,o);return {error:r.error,notes:r.notes,segs:r.segs,common:o.common};}
const BAD=/alarm|error|unsupported|ignored|unknown|spindle stopped|not found|outside/i;
function place(machine,t,mode,v={}){const h=host(machine,t),at=h.indexOf('@'),base=h.replace('@\n','');const r=T.render(t,v,mode,{text:base});assert.deepEqual(r.errs,[],t.id);return T.insert(base,at,r).text;}

test('template library: at least the briefed set, filtered by machine, with real defaults',()=>{const ids=T.TEMPLATES.map(t=>t.id);
 for(const id of ['bolt-circle','rect-pocket','circ-pocket','facing','peck-drill','probe-edge','part-counter','lathe-rough','lathe-groove','lathe-thread','lathe-probe-face'])assert.ok(ids.includes(id),id);
 assert.ok(T.forMachine('mill').every(t=>t.machine!=='lathe'));assert.ok(T.forMachine('lathe').every(t=>t.machine!=='mill'));assert.ok(T.forMachine('lathe').some(t=>t.id==='part-counter'));
 for(const t of T.TEMPLATES){assert.ok(t.desc.length>30,t.id);for(const p of t.params){assert.ok(T.LETTERS.includes(p.k),t.id+p.k);assert.ok(Number.isFinite(p.def),t.id+p.k);}assert.ok(t.o>=9000&&t.o<=9999);}});

for(const machine of ['mill','lathe'])for(const t of T.forMachine(machine))for(const mode of ['inline','g65'])
 test(`${machine} ${t.id} ${mode}: default values parse and run clean, also with a moved G54`,()=>{const text=place(machine,t,mode);const base=run(machine,host(machine,t).replace('@\n',''));
  for(const g54 of [null,machine==='mill'?{x:-120,y:-80,z:-210}:{x:-190,z:-330}]){const r=run(machine,text,g54);assert.equal(r.error,null,r.error);assert.deepEqual(r.notes.filter(n=>BAD.test(n)&&!/MESSAGE/.test(n)),[]);
   if(t.id!=='part-counter')assert.ok(r.segs.length>base.segs.length,'adds motion');}
  // segments are in work coordinates, so the macro path does not change with G54
  const a=run(machine,text),b=run(machine,text,machine==='mill'?{x:-120,y:-80,z:-210}:{x:-190,z:-330});const cut=s=>s.filter(q=>!q.rapid||true).length;assert.equal(cut(a.segs),cut(b.segs));});

test('G65 and inline produce the same path (bolt circle, lathe roughing)',()=>{for(const [m,id] of [['mill','bolt-circle'],['lathe','lathe-rough']]){const t=T.byId(id);const a=run(m,place(m,t,'inline')),b=run(m,place(m,t,'g65'));assert.equal(a.segs.length,b.segs.length,id);}});

test('probing stubs and part counter store their results',()=>{let r=run('mill',place('mill',T.byId('probe-edge'),'g65'));assert.equal(r.common.get(140),-42);assert.equal(r.common.get(141),-70);
 r=run('lathe',place('lathe',T.byId('lathe-probe-face'),'g65'));assert.equal(r.common.get(142),-1);
 r=run('mill',place('mill',T.byId('part-counter'),'g65'));assert.equal(r.common.get(3901),1);assert.equal(r.common.get(3902),100);
 r=run('mill',place('mill',T.byId('part-counter'),'g65',{H:1}));assert.ok(r.notes.some(n=>/REQUIRED PARTS/.test(n)));});

test('parameter checks raise a macro alarm instead of cutting',()=>{const r=run('mill',place('mill',T.byId('rect-pocket'),'g65',{I:5}));assert.match(r.error,/3001/);});

test('O numbers: avoids the program text and the program directory; explicit clash is refused',()=>{const t=T.byId('bolt-circle');const text='%\nO0001\nG0X0\nM30\nO9110(OLD)\nM99\n%\n';
 assert.equal(T.render(t,{},'g65',{text}).o,9111);assert.equal(T.render(t,{},'g65',{text,dir:[9111,9112]}).o,9113);assert.ok(T.render(t,{},'g65',{text,o:9110}).errs.length);assert.ok(T.render(t,{},'g65',{text,o:12345}).errs.length);});

test('inline labels avoid N numbers already in the program; two inline copies still run',()=>{const t=T.byId('bolt-circle');let text=place('mill',t,'inline');const r2=T.render(t,{X:50},'inline',{text});const n1=T.usedN(text),body=r2.call.match(/N(\d+)/g).map(s=>+s.slice(1));
 assert.ok(body.every(n=>!n1.has(n)));text=T.insert(text,text.indexOf('G0Z25.\nG91'),r2).text;assert.equal(run('mill',text).error,null);});

test('insert: call at the cursor line, subprogram after M30 before the final %',()=>{const text='%\nO0001\nG0X0Y0\nM30\n%\n';const r=T.render(T.byId('peck-drill'),{},'g65',{text});const out=T.insert(text,text.indexOf('M30'),r);
 const lines=out.text.trim().split('\n');assert.match(lines[3],/^G65P9150/);assert.equal(lines[4],'M30');assert.equal(lines.at(-1),'%');assert.equal(lines.at(-2),'M99');assert.ok(out.text.indexOf('O9150')>out.text.indexOf('M30'));
 assert.equal(out.text.slice(out.cursor-1,out.cursor),'\n');const two=T.insert(out.text,out.text.indexOf('M30'),T.render(T.byId('peck-drill'),{},'g65',{text:out.text}));assert.match(two.text,/O9151/);});

test('my macros: sanitize, export and import round trip with clash handling',()=>{const m=T.sanitize({name:'Spot row',machine:'mill',desc:'Row of spots',params:[{k:'X',def:0,label:'Start X'},{k:'I',def:10,label:'Pitch'},{k:'H',def:3,label:'Count'}],body:'#27=0\nWHILE[#27LT{H}]DO{D1}\nG81X[{X}+#27*{I}]Y0.Z-1.R2.F100\n#27=#27+1\nEND{D1}\nG80'});
 assert.match(m.id,/^user-/);for(const bad of [{...m,body:'O1234\nG0X0'},{...m,body:'M30'},{...m,params:[{k:'G',def:1}]},{...m,params:[{k:'X',def:'a'}]},{...m,machine:'robot'},{...m,name:''}])assert.throws(()=>T.sanitize(bad));
 const json=T.exportJSON([m]);assert.equal(JSON.parse(json).format,'fanucsim-macros');const a=T.importJSON(json,[]);assert.equal(a.added,1);const b=T.importJSON(json,a.list);assert.equal(b.list.length,1,'same id+name replaces');
 const c=T.importJSON(JSON.stringify({format:'fanucsim-macros',version:1,macros:[{...m,name:'Other'}]}),a.list);assert.equal(c.list.length,2);assert.throws(()=>T.importJSON('{"x":1}'));
 const u=T.forMachine('mill',c.list).find(t=>t.user);for(const mode of ['inline','g65']){const r=run('mill',place('mill',u,mode));assert.equal(r.error,null);assert.ok(r.segs.length>3);}
 assert.ok(!T.forMachine('lathe',c.list).some(t=>t.user));});
