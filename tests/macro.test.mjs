import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const M=require('../src/nc/macro.js'),MD=require('../src/nc/machine.js');
const run=(src,o={})=>{const common=new Map();const r=M.execute(src,{machine:'mill',params:MD.defaultParams('mill'),offsets:MD.defaultMillOffsets(),work:MD.defaultWork('mill'),common,...o});return {...r,common};};
const text=r=>r.blocks.filter(b=>b.text!==undefined).map(b=>b.text.trim()).filter(Boolean);

test('local and common variables, arithmetic and functions',()=>{const r=run('#1=3\n#2=[#1*4+2]/7\n#100=SQRT[16]+ABS[-2]\n#101=SIN[30]\n#102=ROUND[2.6]+FIX[2.9]+FUP[2.1]\nG0 X#1 Y#2\nM30\n');
 assert.equal(r.error,null);assert.equal(r.common.get(100),6);assert.ok(Math.abs(r.common.get(101)-0.5)<1e-12);assert.equal(r.common.get(102),3+2+3);assert.ok(text(r).some(t=>/^G0 X3\.? Y2\.?$/.test(t)),text(r).join('|'));});

test('vacant variables omit the word',()=>{const r=run('G0 X10. Y#5\nM30\n');assert.equal(r.error,null);assert.ok(text(r).includes('G0 X10.'),text(r).join('|'));});

test('IF [..] GOTO and IF [..] THEN',()=>{const r=run('#1=0\nN10 #1=#1+1\nIF [#1 LT 5] GOTO10\n#100=#1\nIF [#1 EQ 5] THEN #101=1\nM30\n');assert.equal(r.common.get(100),5);assert.equal(r.common.get(101),1);});

test('WHILE DO END loop runs the expected number of times',()=>{const r=run('#1=0\n#2=0\nWHILE [#1 LT 4] DO1\nG1 X#1 F100\n#2=#2+#1\n#1=#1+1\nEND1\n#100=#2\nM30\n');assert.equal(r.error,null);assert.equal(r.common.get(100),0+1+2+3);assert.equal(text(r).filter(t=>t.startsWith('G1')).length,4);});

test('G65 arguments map to locals (A #1, B #2, I #4, X #24, Z #26) and locals are per call',()=>{const r=run('#1=99\nG65 P9001 A1. B2. I4. X24. Z-26.\n#100=#1\nM30\nO9001\n#101=#1+#2+#4+#24+#26\n#102=[#3 EQ #0]\nM99\n');assert.equal(r.error,null);assert.equal(r.common.get(101),1+2+4+24-26);assert.equal(r.common.get(100),99,'caller locals untouched');});

test('nested macro calls work and runaway recursion stops at the depth limit',()=>{const r=run('G65 P9002 A3.\n#100=#110\nM30\nO9002\n#110=#110+1\nIF [#1 LE 1] GOTO99\nG65 P9002 A[#1-1]\nN99 M99\n');assert.equal(r.error,null);assert.equal(r.common.get(100),3);
 const bad=run('G65 P9003\nM30\nO9003\nG65 P9003\nM99\n');assert.match(String(bad.error),/nest|depth|level/i);});

test('GOTO without brackets jumps forward to the next matching N block',()=>{const r=run('#100=0\nGOTO4\n#100=1\nN4 #101=1\nGOTO4\n#100=2\nN4 #102=1\nM30\n');assert.equal(r.error,null);assert.equal(r.common.get(100),0);assert.equal(r.common.get(101),1);assert.equal(r.common.get(102),1);});

test('missing sequence number gives a line-numbered alarm',()=>{const r=run('G0 X0\nGOTO77\nM30\n');assert.match(String(r.error),/Line 2.*N77/);});

test('system variables: #3901 parts, #5001 position, #4001 modal, work offset #5221',()=>{const r=run('G90 G1 X12. Y3. F100\n#100=#5001\n#101=#4001\n#102=#5221\nM30\n');assert.equal(r.common.get(100),12);assert.equal(r.common.get(101),1);assert.equal(r.common.get(102),-300);});

test('G10 L52 parameter writes are emitted as ordered data blocks',()=>{const r=run('G10 L52\nN1420 P1 R12000\nG11\nG0 X1.\nG10 L52\nN1420 P1 R30000\nG11\nM30\n');const sets=r.blocks.filter(b=>b.set&&b.set.table==='param').map(b=>b.set.value);assert.deepEqual(sets,[12000,30000]);});
