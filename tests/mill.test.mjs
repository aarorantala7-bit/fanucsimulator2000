import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const M=require('../src/nc/macro.js'),MD=require('../src/nc/machine.js'),{parse}=require('../src/simulation/program.js'),D=require('../src/ui/demos.js');
// Same path as the browser load handler (src/ui/main.js): macro executor when needed, then the mill interpreter.
function load(text){const params=MD.defaultParams('mill'),offsets=MD.defaultMillOffsets(),work=MD.defaultWork('mill');const p0=new Map([...params].map(([k,v])=>[k,Array.isArray(v)?v.slice():v]));
 if(M.needsMacro(text)){const m=M.execute(text,{machine:'mill',params,offsets,work,common:new Map()});const r=parse(m.blocks,{params:p0,offsets,work});return {macroError:m.error,notes:[...m.notes,...r.notes],segs:r.s};}
 const r=parse(text,{params,offsets,work});return {macroError:null,notes:r.notes,segs:r.s};}
const bad=n=>/error|alarm|unsupported|stopped|not found|invalid/i.test(n);

test('mill demos run without errors',()=>{for(const d of D.forMachine('mill')){const r=load(d.text);assert.equal(r.macroError,null,d.id);assert.ok(r.segs.length>5,d.id);assert.ok(!r.notes.some(bad),d.id+': '+r.notes.join(' | '));}});

test('plain legacy mill program still parses (raster + arcs)',()=>{const r=load(readFileSync(new URL('./fixtures/heavy_mill.nc',import.meta.url),'utf8'));assert.ok(r.segs.length>800);assert.ok(!r.notes.some(bad),r.notes.join('|'));});

test('ordered parameter changes: G10 L52 rapid rate applies only to later rapids',()=>{const r=load('G21 G90 G54\nG0 X0 Y0 Z50.\nG0 X300.\nG10 L52\nN1420 P1 R6000\nG11\nG0 X0\nM30\n');const rap=r.segs.filter(s=>s.rapid&&Math.abs(s.b.x-s.a.x)===300);assert.equal(rap.length,2);assert.ok(rap[1].t100>rap[0].t100*4,`slower after the write (${rap[0].t100} → ${rap[1].t100})`);});

test('cutter compensation follows the D register',()=>{const prog=d=>`G21 G90 G54\nT2 M6\nG43 Z10. H2\nG0 X-20. Y-20.\nG1 Z-2. F300\nG41 G1 X0 Y0 D${d}\nY40.\nX40.\nG40 G1 X60. Y60.\nM30\n`;const a=load(prog(2)),b=load(prog(3));const ya=a.segs.find(s=>s.line===8),yb=b.segs.find(s=>s.line===8);assert.ok(ya&&yb);assert.notEqual(ya.a.x.toFixed(3),yb.a.x.toFixed(3));assert.ok(Math.abs(ya.a.x+6)<1e-6,'Ø12 tool runs 6 mm left of the wall: '+ya.a.x);});

test('Aaro\'s WinCAM program runs end to end (CRLF, %, GOTO4 → N4, G41/G40 D2, G43 H, G91 G28, M46/M50)',()=>{const raw=readFileSync(new URL('./fixtures/wincam-sample.cnc',import.meta.url),'latin1');assert.ok(raw.includes('\r\n'),'fixture keeps CRLF');
 const r=load(raw);assert.equal(r.macroError,null,r.macroError);assert.ok(!r.notes.some(bad),r.notes.join(' | '));assert.ok(r.segs.length>1000);
 const lines=new Set(r.segs.map(s=>s.line));assert.ok(!lines.has(19)&&!lines.has(210),'roughing blocks after GOTO4 are skipped');assert.ok(lines.has(30)&&lines.has(240),'execution resumes at each next N4');
 assert.ok(r.notes.some(n=>/M46/.test(n))&&r.notes.some(n=>/M50/.test(n)),'machine-specific M codes are noted');assert.ok(r.notes.some(n=>/Line 419: Program end/.test(n)),'reaches M30');
 assert.ok(r.segs.some(s=>s.comp===41||s.comp==='G41'||s.D===2),'G41 D2 active somewhere');
 const g55=r.segs.filter(s=>s.line>=197);assert.ok(g55.length>100,'second setup (G55) runs');});

test('non-ASCII text inside comments is fine',()=>{const r=load('%\r\nO0001(KÄÄNTÖ PÄÄTY ÅÖ €)\r\nG90 G54 G0 X0 Y0 (SIVU – ÄÄRI)\r\nG1 X10. F100\r\nM30\r\n%\r\n');assert.ok(!r.notes.some(bad),r.notes.join('|'));assert.equal(r.segs.filter(s=>!s.rapid&&s.len>0).length,1);});
