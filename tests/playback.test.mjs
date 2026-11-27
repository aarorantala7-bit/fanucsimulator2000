import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const M=require('../src/nc/macro.js'),MD=require('../src/nc/machine.js'),{parse}=require('../src/simulation/program.js'),RT=require('../src/sim/runtime.js'),L=require('../src/lathe/lathe.js'),D=require('../src/ui/demos.js');
const fresh=()=>({params:MD.defaultParams('lathe'),offsets:MD.defaultLatheOffsets(),work:MD.defaultWork('lathe'),tools:MD.clone(MD.LATHE_TOOLS),common:new Map()});
function mill(text){const params=MD.defaultParams('mill'),offsets=MD.defaultMillOffsets(),work=MD.defaultWork('mill');const p0=new Map([...params].map(([k,v])=>[k,Array.isArray(v)?v.slice():v]));
 if(M.needsMacro(text)){const m=M.execute(text,{machine:'mill',params,offsets,work,common:new Map()});return parse(m.blocks,{params:p0,offsets,work}).s;}return parse(text,{params,offsets,work}).s;}
const near=(a,b,e=1e-3,msg)=>assert.ok(Math.abs(a-b)<=e,`${msg||''} ${a} ≈ ${b}`);
const lathe=id=>{const o=fresh();const r=L.simulate(D.byId(id).text,o);return {r,o};};

test('thread extraction: G76 demo gives pitch, Z range and depth',()=>{const {r,o}=lathe('lathe-thread');const t=L.threads(r,o.tools);assert.equal(t.length,1);const th=t[0];
 assert.equal(th.cycle,'G76');assert.equal(th.lead,1.5);assert.equal(th.id,false);near(th.z0,-25,1e-6,'z0');near(th.z1,4.8268,1e-3,'z1 (incl. chamfer pull-out start)');
 near(th.root,18.376,1e-6,'minor Ø');near(th.crest,19.85,1e-6,'major Ø');near(th.height,0.812,1e-9,'G76 K');near(th.depth,0.737,1e-6,'radial depth');assert.equal(th.passes.length,8);
 assert.ok(th.passes.every((p,i,a)=>!i||p.x<=a[i-1].x),'passes go monotonically deeper');});

test('thread extraction: G92 (macro demo) gives pitch, Z range and depth',()=>{const {r,o}=lathe('lathe-macro');const t=L.threads(r,o.tools);assert.equal(t.length,1);const th=t[0];
 assert.equal(th.cycle,'G92');assert.equal(th.lead,2);near(th.z0,-22,1e-6);near(th.z1,5,1e-6);near(th.root,37.5464,1e-6);near(th.crest,40,1e-6);near(th.depth,1.2268,1e-6);});

test('no threads reported for programs without G32/G92/G76',()=>{const {r,o}=lathe('lathe-g71');assert.deepEqual(L.threads(r,o.tools),[]);});

test('render polylines merge collinear moves, keep corners and groups apart',()=>{const P=(x,y,z)=>({x,y,z});const segs=[{a:P(0,0,0),b:P(1,0,0)},{a:P(1,0,0),b:P(2,0,0)},{a:P(2,0,0),b:P(2,1,0)},{a:P(2,1,0),b:P(0,0,5),rapid:true}];
 const out=new Map(RT.polylines(segs,s=>s.rapid?'r':'f',(s,k)=>[s[k].x,s[k].y,s[k].z]));assert.deepEqual(out.get('f'),[[[0,0,0],[2,0,0],[2,1,0]]]);assert.deepEqual(out.get('r'),[[[2,1,0],[0,0,5]]]);});

test('auto stock (mill): WinCAM bounds come from feed moves at/below Z0 + tool radius, then the margin',()=>{const segs=mill(readFileSync(new URL('./fixtures/wincam-sample.cnc',import.meta.url),'latin1'));
 const w0=RT.millWorkArea(segs,()=>5,0),w=RT.millWorkArea(segs,()=>5,10);assert.deepEqual(w0.work,{x:870,y:225,z:60});
 near(w0.x0,-435,1,'x0');near(w0.x1,435,1,'x1');near(w0.y0,-190,1,'y0');near(w0.y1,35,1,'y1');
 near(w.x1-w.x0,870*1.1,1e-6,'10 % larger in X');near(w.y1-w.y0,225*1.1,1e-6,'10 % larger in Y');near(w.depth,66,1e-6,'depth +10 %');
 const end=segs.at(-1).b;assert.ok(end.y>w.y1&&end.z>0,'G28/home position (Y200 Z350) is outside the stock and ignored');});

test('auto stock (lathe): OD from the largest cut Ø, length from the cut Z range',()=>{const {r}=lathe('lathe-g71');const a=RT.latheWorkArea(r.segs,0),b=RT.latheWorkArea(r.segs,10);
 assert.ok(a.work.od>0&&a.work.length>0);near(b.od,a.work.od*1.1,0.6,'OD +10 %');near(b.length,a.work.length*1.1,0.6,'length +10 %');});

test('demo stock follows its own program number only',()=>{assert.equal(RT.programNumber('%\r\nO0003(2/4/4.5/5/8MM BLOKI)\r\n'),'O3');assert.equal(RT.programNumber(D.byId('mill-macro').text),'O1002');assert.equal(RT.programNumber('G0 X0'),null);});

test('end positions unchanged by block playback / adaptive arcs (WinCAM, heavy mill, all demos end where they start/finish)',()=>{const w=mill(readFileSync(new URL('./fixtures/wincam-sample.cnc',import.meta.url),'latin1')).at(-1).b;assert.deepEqual([w.x,w.y,w.z].map(v=>+v.toFixed(6)),[0,200,350]);
 const h=mill(readFileSync(new URL('./fixtures/heavy_mill.nc',import.meta.url),'utf8')).at(-1).b;assert.deepEqual([h.x,h.y,h.z].map(v=>+v.toFixed(6)),[0,-5,5]);
 const s=mill(D.byId('mill-plain').text);const b=RT.makeBlocks(s);assert.equal(b.at(-1).i,s.length-1,'last block ends on the last segment');});
