import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const M=require('../src/nc/macro.js'),{parse}=require('../src/simulation/program.js'),K=require('../src/nc/skip.js'),D=require('../src/nc/machine.js'),L=require('../src/lathe/lathe.js'),T=require('../src/macros/templates.js');
const tool=id=>D.MILL_TOOLS.find(t=>t.id===id);
const near=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: ${a} vs ${b}`);
// Mill blank 100 × 80 × 30, X0 Y0 at the centre, Z0 on top (the stock dialog default).
const BLANK={x0:-50,x1:50,y0:-40,y1:40,top:0,bottom:-30};
function mill(src,{work,blank=BLANK}={}){const w=work||D.defaultWork('mill'),common=new Map();const run=b=>parse(b,{work:w}).s;
 const m=M.execute(src,{machine:'mill',work:w,common,skip:blank?K.millHost({blank:K.makeBlank(blank),parse:run,toolFor:tool,cuts:t=>t.type!=='probe'}):null});
 return {m,segs:run(m.blocks),common,v:n=>common.get(n)};}
const HEAD='G21G17G40G49G80G90G54\nT12M6\nG0G43Z25.H12\n';

test('mill G31 stops at the blank walls in X+, X-, Y+, Y- (ball probe Ø6 centre = wall ∓ 3)',()=>{
 const {m,v,segs}=mill(HEAD+`G0X-70.Y0Z-5.\nG31X-30.F300\n#100=#5061\nG0X-70.\nG0Z10.\nX70.Y0\nG0Z-5.\nG31X30.\n#101=#5061\nG0X70.\nZ10.\nX0Y-60.\nZ-5.\nG31Y0\n#102=#5062\nG0Y-60.\nZ10.\nX0Y60.\nZ-5.\nG31Y0\n#103=#5062\n#104=#5061\n#105=#5063\nG0Y60.\nM30`);
 assert.equal(m.error,null);assert.deepEqual([v(100),v(101),v(102),v(103)],[-53,53,-43,43]);assert.equal(v(104),0);assert.equal(v(105),-5);
 const sk=segs.filter(s=>s.skip);assert.equal(sk.length,4);assert.ok(sk.every(s=>s.skip.contact));assert.equal(sk[0].b.x,-53,'the move ends at the contact');
 const next=segs[segs.indexOf(sk[0])+1];assert.equal(next.a.x,-53,'the following block starts from the skip point');});

test('mill G31 Z- touches the top and the floor of an earlier cut; flat and ball tips',()=>{
 let r=mill(HEAD+'G0X0Y0Z10.\nG31Z-20.F200\n#100=#5063\nM30');assert.equal(r.v(100),0,'ball tip on the top face');
 // T2 Ø12 end mill cuts a 1 mm deep slot from X-20 to X20; the probe then touches the slot floor and the uncut top beside it.
 r=mill('G21G90G54\nT2M6\nG0G43Z25.H2\nG0X-20.Y0Z5.\nG1Z-1.F300\nX20.\nG0Z25.\nT12M6\nG0G43Z25.H12\nG0X0Y0\nG31Z-20.F200\n#100=#5063\nG0Z10.\nX0Y20.\nG31Z-20.\n#101=#5063\nG0Z10.\nX0Y0\nZ-0.5\nG31X40.\n#102=#5061\nM30');
 near(r.v(100),-1,0.01,'slot floor');assert.equal(r.v(101),0,'uncut top');near(r.v(102),26-Math.sqrt(9-2.5**2),0.4,'slot end wall at X26 (X20 + cutter radius): the Ø6 ball, tip 0.5 below the top edge, touches the edge at 1.66 from its axis; grid ±1 cell');
 r=mill('G21G90G54\nT2M6\nG0G43Z25.H2\nG0X20.Y20.Z10.\nG31Z-20.F200\n#100=#5063\nM30');assert.equal(r.v(100),0,'flat end mill: tip touches the top');});

test('mill G31 without contact runs the full distance; #5061+ hold the end point; G91 works',()=>{
 const r=mill(HEAD+'G0X-70.Y0Z-5.\nG31X-60.F300\n#100=#5061\nG91G31X-5.\n#101=#5061\nG90\nG0Z10.\nM30');
 assert.equal(r.v(100),-60);assert.equal(r.v(101),-65);const sk=r.segs.filter(s=>s.skip);assert.ok(sk.every(s=>!s.skip.contact));assert.equal(sk[1].b.x,-65);
 assert.ok(r.segs.length>0&&parse(r.m.blocks,{}).notes.some(n=>/no contact/.test(n)));
 const bare=mill(HEAD+'G0X-70.Y0Z-5.\nG31X-30.F300\n#100=#5061\nM30',{blank:null});assert.equal(bare.v(100),-30,'no stock model: full distance');});

test('mill #5061-#5063 are work coordinates: a moved G54 gives the same values, #5021 machine values shift',()=>{
 const work=D.defaultWork('mill');work[54]={x:-123.4,y:-56.7,z:-210};
 const a=mill(HEAD+'G0X-70.Y0Z-5.\nG31X-30.F300\n#100=#5061\n#101=#5063\n#102=#5021\nM30'),b=mill(HEAD+'G0X-70.Y0Z-5.\nG31X-30.F300\n#100=#5061\n#101=#5063\n#102=#5021\nM30',{work});
 assert.deepEqual([b.v(100),b.v(101)],[a.v(100),a.v(101)]);assert.equal(b.v(100),-53);near(b.v(102)-a.v(102),-123.4-(D.defaultWork('mill')[54].x),1e-9,'machine position follows G54');});

test('mill probe uses the material state after earlier cuts (probe never cuts, the cutter does)',()=>{
 const r=mill('G21G90G54\nT2M6\nG0G43Z25.H2\nG0X-60.Y0Z5.\nG1Z-5.F300\nX-40.\nG0Z25.\nT12M6\nG0G43Z25.H12\nG0X-70.Y0\nZ-5.\nG31X-20.F300\n#100=#5061\nG0X-70.\nG31X-20.\n#101=#5061\nM30');
 near(r.v(100),-37,0.4,'wall left by the Ø12 cutter at X-40 (+6) minus the probe radius');assert.equal(r.v(101),r.v(100),'the probe did not remove material');});

const LS={od:50,bore:0,length:80,face:0};
function lathe(src,o={}){const common=new Map();const r=L.simulate(src,{common,skipStock:LS,...o});return {r,v:n=>common.get(n)};}
const LHEAD='G21G18G40G99\nT0101\nG97S500M3\nG98\n';
test('lathe G31 Z- touches the face, X- touches the OD (insert nose outline), the next block continues there',()=>{
 const {r,v}=lathe(LHEAD+'G0X20.Z5.\nG31Z-3.F100\n#100=#5062\n#101=#5061\nG0Z5.\nG0X60.Z-10.\nG31X30.\n#102=#5061\n#103=#5062\nG0X60.\nM30');
 assert.equal(r.error,null);near(v(100),0,0.003,'face Z0');assert.equal(v(101),20);near(v(102),50,0.004,'OD 50');assert.equal(v(103),-10);
 const sk=r.segs.filter(s=>s.skip);assert.equal(sk.length,2);assert.ok(sk.every(s=>s.skip.contact));const n=r.segs[r.segs.indexOf(sk[0])+1];near(n.a.z,v(100),1e-9,'continues from the skip point');
 assert.ok(r.notes.some(x=>/G31 skip: contact/.test(x)));});
test('lathe G31: turned diameter, no contact, moved G54',()=>{
 // turn Ø40 over Z0..-20 first; the probe at Z-10 then finds Ø40, at Z-30 still Ø50
 const src=LHEAD.replace('G98\n','')+'G0X52.Z2.\nG1X40.F0.2\nZ-20.\nX52.\nG0Z5.\nG98\nG0X60.Z-10.\nG31X20.F100\n#100=#5061\nG0X60.\nZ-30.\nG31X20.\n#101=#5061\nG0X60.\nZ5.\nX20.\nG31Z3.\n#102=#5062\nM30';
 const a=lathe(src);near(a.v(100),40,0.004,'turned diameter');near(a.v(101),50,0.004,'uncut OD');assert.equal(a.v(102),3,'no contact: end point');
 const work=D.defaultWork('lathe');work[54]={x:-150,z:-333};const b=lathe(src,{work});assert.deepEqual([b.v(100),b.v(101),b.v(102)],[a.v(100),a.v(101),a.v(102)]);
 const bare=L.simulate(LHEAD+'G0X20.Z5.\nG31Z-3.F100\n#100=#5062\nM30',{common:new Map()});assert.equal(bare.error,null);});

test('probe templates measure real contact: mill X edge (#140/#141) and lathe face (#142/#143)',()=>{
 for(const mode of ['g65','inline']){
  const t=T.byId('probe-edge'),host='%\nO0001\nG21G17G40G49G80G90G54\n'+t.setup.join('\n')+'\n@\nG0Z25.\nM30\n%\n';const base=host.replace('@\n','');
  const text=T.insert(base,host.indexOf('@'),T.render(t,{},mode,{text:base})).text;const r=mill(text);assert.equal(r.m.error,null);
  assert.equal(r.v(140),-50,'edge = blank wall X-50');assert.equal(r.v(141),-70);
  const r2=mill(text,{blank:{...BLANK,x0:-47.5}});assert.equal(r2.v(140),-47.5);
  const lt=T.byId('lathe-probe-face'),lh='%\nO0001\nG21G18G40G99\n'+lt.setup.join('\n')+'\n@\nG0X120.Z50.\nM30\n%\n',lb=lh.replace('@\n','');
  const lx=T.insert(lb,lh.indexOf('@'),T.render(lt,{},mode,{text:lb})).text;const q=lathe(lx,{skipStock:{...LS,face:1.5}});assert.equal(q.r.error,null);
  near(q.v(142),1.5,0.003,'face at Z1.5');near(q.v(143),1.5,0.003,'error to the expected Z0');}});
