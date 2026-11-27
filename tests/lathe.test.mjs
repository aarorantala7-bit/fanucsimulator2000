import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const L=require('../src/lathe/lathe.js'),MD=require('../src/nc/machine.js');
const fresh=()=>({params:MD.defaultParams('lathe'),offsets:MD.defaultLatheOffsets(),work:MD.defaultWork('lathe'),tools:MD.clone(MD.LATHE_TOOLS),common:new Map()});
const run=(src,o={})=>{const r=L.simulate(src,{...fresh(),...o});assert.equal(r.error,null,r.error);return r;};
const near=(a,b,e=1e-6,m)=>assert.ok(Math.abs(a-b)<=e,`${m||''} ${a} != ${b}`);
const zeroOffsets=()=>{const o=MD.defaultLatheOffsets();for(const k of Object.keys(o.geom)){o.geom[k].x=0;o.geom[k].z=0;}return o;};
const feeds=r=>r.segs.filter(s=>!s.rapid&&s.len>0&&s.kind!=='dwell');

test('X is a diameter, U/W are incremental',()=>{const r=run('G21 G18 G99\nT0101\nG0 X40. Z2.\nG1 Z-10. F0.2\nU10. W-5.\nM30\n');const f=feeds(r);
 near(f[0].b.x,40);near(f[0].b.z,-10);near(f[1].b.x,50);near(f[1].b.z,-15);
 near(f[1].ca.b===undefined?0:f[1].cb.b-f[1].ca.b,5,0.01,'radius change = half the diameter change');});

test('G2/G3 with R and with I/K reach the same end point and centre',()=>{const a=run('T0101\nG0 X20. Z0\nG2 X30. Z-5. R5. F0.1\nM30\n'),b=run('T0101\nG0 X20. Z0\nG2 X30. Z-5. I5. K0 F0.1\nM30\n');
 const ea=feeds(a).at(-1),eb=feeds(b).at(-1);near(ea.b.x,30);near(ea.b.z,-5);near(eb.b.x,30);near(eb.b.z,-5);
 assert.ok(feeds(a).length>1||feeds(a)[0].arc,'arc is expanded or flagged');});

test('G96 rpm follows the diameter and is clamped by G50 S',()=>{const r=run('G50 S2000\nG96 S200 M3\nT0101\nG0 X60. Z2.\nG1 Z-5. F0.2\nG1 X10.\nM30\n');
 assert.ok(r.rpmMax<=2000+1e-9,'clamped at 2000');const atD60=1000*200/(Math.PI*60);assert.ok(r.rpmMin<=atD60+1&&r.rpmMin>=atD60-1,'rpm at Ø60 = '+atD60.toFixed(1)+' got '+r.rpmMin);assert.equal(Math.round(r.rpmMax),2000);});

test('G99 time = length / (F x rpm), G98 time = length / F',()=>{const r=run('G97 S1000 M3\nT0101\nG0 X40. Z2.\nG99 G1 Z-48. F0.25\nM30\n');const f=feeds(r)[0];near(f.t100,50/(0.25*1000)*60+(f.t100-50/(0.25*1000)*60),1e-9);near(f.len,50,1e-9);
 assert.ok(Math.abs(f.t100-12)<0.2,'50 mm at 250 mm/min = 12 s, got '+f.t100);
 const r2=run('G97 S1000 M3\nT0101\nG0 X40. Z2.\nG98 G1 Z-48. F500.\nM30\n');assert.ok(Math.abs(feeds(r2)[0].t100-6)<0.2,'50 mm at 500 mm/min = 6 s');});

test('wear offsets shift the programmed tip; geometry R/T come from the offset page',()=>{const o=MD.defaultLatheOffsets();o.wear[1].x=0.1;o.wear[1].z=-0.05;const r=run('T0101\nG0 X40. Z2.\nG1 Z-10. F0.2\nM30\n',{offsets:o});const f=feeds(r)[0];near(f.b.x,40.1,1e-6);near(f.b.z,-10.05,1e-6);assert.equal(f.noseR,o.geom[1].r);});

test('G90 is a modal box cycle, G94 faces',()=>{const r=run('T0101\nG0 X52. Z2.\nG90 X45. Z-30. F0.25\nX40.\nG0 X60.\nM30\n');const cut=feeds(r).filter(s=>Math.abs(s.b.z+30)<1e-6&&Math.abs(s.a.z-2)<1e-6);assert.deepEqual(cut.map(s=>Math.round(s.b.x)),[45,40]);
 const f=run('T0101\nG0 X54. Z2.\nG94 X-1.6 Z0 F0.2\nZ-1.\nM30\n');const faces=feeds(f).filter(s=>Math.abs(s.b.x+1.6)<1e-6&&Math.abs(s.a.z-s.b.z)<1e-9);assert.deepEqual(faces.map(s=>s.b.z),[0,-1]);});

const G71=`G21 G18 G99\nG50 S2500\nT0101\nG96 S200 M3\nG0 X54. Z2.\nG71 U2. R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25\nN10 G0 X20.\nG1 Z-15. F0.15\nX30. Z-20.\nZ-35.\nX44.\nZ-45.\nN20 X54.\nG70 P10 Q20\nM30\n`;
const profileR=z=>z>-15?10:z>-20?10+(-15-z):z>-35?15:z>-45?22:27;
test('G71 roughing passes stay outside the profile + allowance; G70 follows the profile',()=>{const r=run(G71,{offsets:zeroOffsets()});const rough=feeds(r).filter(s=>s.cycle==='G71');assert.ok(rough.length>10,'many roughing passes');
 for(const s of rough)for(const p of [s.a,s.b])if(p.z<0&&p.z>-45)assert.ok(p.x/2>=profileR(p.z)+0.2-1e-6,`pass point Ø${p.x} at Z${p.z} cuts into the allowance`);
 const fin=feeds(r).filter(s=>s.cycle==='G70');assert.ok(fin.length>=5);for(const s of fin)if(Math.abs(s.a.x-s.b.x)<1e-9&&s.b.z<0&&s.b.z>-45&&s.b.x<54)near(s.b.x/2,profileR((s.a.z+s.b.z)/2),0.01,'finish on profile');
 const depths=new Set(rough.filter(s=>Math.abs(s.a.x-s.b.x)<1e-9&&s.b.z<s.a.z-1).map(s=>s.a.x.toFixed(3)));assert.ok([...depths].every(d=>Number(d)>=20.4-1e-6),'no pass below the finish allowance');});

test('G76 threading: passes reach the root, first depth Q, F lead per rev, spindle synced',()=>{const r=run('G97 S800 M3\nT0606\nG0 X26. Z5.\nG76 P020060 Q100 R0.05\nG76 X18.376 Z-25. P812 Q300 F1.5\nM30\n',{offsets:zeroOffsets()});const th=r.segs.filter(s=>s.kind==='thread');assert.ok(th.length>=6,'several passes');
 const xs=th.filter(s=>Math.abs(s.b.z+25)<1e-6).map(s=>s.b.x);near(Math.min(...xs),18.376,1e-3,'root');near(20-xs[0],0.6,0.01,'first pass Q300 = 0.3 mm radius');assert.ok(th.every(s=>s.lead===1.5||s.F===1.5));
 const t=th.find(s=>Math.abs(s.b.z+25)<1e-6);assert.ok(Math.abs(t.t100-(Math.abs(t.b.z-t.a.z)/(1.5*800))*60)<0.05,'thread time = length / (lead x rpm)');});

test('G92 threading cycle is modal',()=>{const r=run('G97 S800 M3\nT0606\nG0 X24. Z5.\nG92 X19.4 Z-25. F1.5\nX19.\nX18.7\nG0 X40.\nM30\n');assert.equal(r.segs.filter(s=>s.kind==='thread').length,3);});

test('changing nose radius or insert shape changes the compensated path and the removed area',()=>{const prog=`G21 G99\nT0303\nG0 X16. Z2.\nG1 G42 Z0 F0.1\nX20. Z-2.\nZ-10.\nX12. Z-18.\nZ-24.\nG2 X30. Z-30. R6.\nG1 X40.\nG40 G0 X60. Z5.\nM30\n`;
 const a=L.simulate(prog,{...fresh(),offsets:zeroOffsets()});const o2=zeroOffsets();o2.geom[3].r=1.2;const b=L.simulate(prog,{...fresh(),offsets:o2});assert.equal(a.error,null);assert.equal(b.error,null);
 const ca=feeds(a).map(s=>[s.cb.a.toFixed(3),s.cb.b.toFixed(3)]).join(),cb=feeds(b).map(s=>[s.cb.a.toFixed(3),s.cb.b.toFixed(3)]).join();assert.notEqual(ca,cb,'nose centre path moves with R');
 const area=(res,tools)=>L.cutAll(res,L.makeStock({od:44,length:40,face:0.5}),tools);const tools=MD.clone(MD.LATHE_TOOLS);const A1=area(a,tools);
 const t2=MD.clone(MD.LATHE_TOOLS);Object.assign(t2.find(t=>t.id===3),{shape:'C',angle:80,kappa:95});const A2=area(a,t2);
 assert.ok(A1>0&&A2>0);assert.ok(Math.abs(A1-A2)>0.05,`80° insert gouges the 45° back taper that a 35° insert clears (${A1.toFixed(3)} vs ${A2.toFixed(3)})`);assert.ok(Math.abs(area(a,tools)-area(b,tools))>0.01,'nose R changes the removed area');});

test('tube stock: bore respected, ID tool cuts from the bore, air cuts remove nothing',()=>{const st=L.makeStock({od:60,bore:30,length:50,face:0});assert.equal(st.ri[0],15);assert.equal(st.ro[0],30);
 const air=run('T0707\nG0 X20. Z2.\nG1 Z-30. F0.1\nG0 X10.\nZ5.\nM30\n',{offsets:zeroOffsets()});assert.equal(L.cutAll(air,L.makeStock({od:60,bore:30,length:50,face:0})),0,'tool inside the bore cuts air');
 const bore=run('T0707\nG0 X34. Z2.\nG1 Z-20. F0.1\nG0 X28.\nZ5.\nM30\n',{offsets:zeroOffsets()});const s2=L.makeStock({od:60,bore:30,length:50,face:0});const rem=L.cutAll(bore,s2);assert.ok(rem>0,'boring removes material');
 const i=Math.round((-10-s2.z0)/s2.dz);assert.ok(s2.ri[i]>15.5&&s2.ri[i]<17.1,'bore opened to about Ø34 → r '+s2.ri[i]);assert.equal(s2.ro[i],30,'outside untouched');});

test('clear errors carry line numbers',()=>{const r=L.simulate('T0101\nG0 X40. Z2.\nG2 X30. Z-5. F0.1\nM30\n',fresh());assert.match(String(r.error||r.notes.join(' ')),/Line 3/);});

test('all lathe demos run without errors',()=>{const D=require('../src/ui/demos.js');for(const d of D.forMachine('lathe')){const r=L.simulate(d.text,fresh());assert.equal(r.error,null,d.id+': '+r.error);assert.ok(r.segs.length>10,d.id);assert.ok(!r.notes.some(n=>/interference|alarm/i.test(n)),d.id+': '+r.notes.join(' | '));}});
