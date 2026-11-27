import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../src/import/nc-cleanup.js'),W=require('../src/import/wincam.js');
const {parse}=require('../src/simulation/program.js');
const fixture=readFileSync(new URL('./fixtures/wincam-sample.cnc',import.meta.url));

test('OCR cleanup: a noisy photo of a FANUC program screen',()=>{
 const raw=['PROGRAM          O0003 N00000','0001 %','0002 00003(2/4/4.5/5/8MM BLOKI)','0003 T3M6 ;','0004 G9OG0Y1OO ;','0005 G43Z2OOH3 ;',
  '0006 5800M3(S900 N.350M MIN) ;','0007 G0X-43OY-l5 ;','0008 G0TO4','0009 G1X43OF11OO_','EDIT **** *** ***   12:04:31','[ PRGRM ][ LIB ][      ][ C.A.P ][(OPRT)]'].join('\n');
 const r=C.cleanOcrText(raw);
 assert.equal(r.text,['%','O0003(2/4/4.5/5/8MM BLOKI)','T3M6','G90G0Y100','G43Z200H3','S800M3(S900 N.350M MIN)','G0X-430Y-15','GOTO4','G1X430F1100'].join('\n'));
 assert.equal(r.dropped,3);assert.ok(r.notes.includes('screen line numbers removed'));
});
test('OCR cleanup: letter/digit confusions follow the word grammar',()=>{
 const cases={'N1O G0O X5O. Z2. ;':'N10 G00 X50. Z2.','G01 X12.5 Z-3.O F0.2 ;':'G01 X12.5 Z-3.0 F0.2','X-1O.5 25.':'X-10.5 Z5.',
  'G2 X1O. 2-4. 1-2.5 K0':'G2 X10. Z-4. I-2.5 K0','B9O.':'B90.','T0lOl':'T0101','X10S500':'X10S500','X1OZ5':'X10Z5','M98 P1OO1':'M98 P1001',
  'o0012':'O0012','G1 x10. z-5. f.2':'G1 X10. Z-5. F.2','G0G4OG8OZ1OO.M5':'G0G40G80Z100.M5','G90GOY100':'G90G0Y100','G9OG0Y1OO':'G90G0Y100','M3O':'M30','G41D2X5':'G41D2X5',
  'IF[#1LT1O]GOTO5':'IF[#1LT10]GOTO5','#l0=#1O+1':'#10=#10+1','(TYÖKALU 3 - ÖLJY)':'(TYÖKALU 3 - ÖLJY)','> G0 X5O.,Z2.;':'G0 X50.Z2.'};
 for(const [i,o] of Object.entries(cases))assert.equal(C.cleanLine(i),o,i);
 assert.equal(C.cleanOcrText('G0 X10. Z5. ;',{spacing:'compact'}).text,'G0X10.Z5.');
 assert.equal(C.cleanOcrText('G0X10.Z5.(A B)',{spacing:'spaced'}).text,'G0 X10. Z5. (A B)');
});
test('OCR cleanup output parses without errors',()=>{const r=C.cleanOcrText('O0001\n0001 G9OG54G0X0Y0\n0002 G43Z5OH1\n0003 G1Z-1.F1OO\n0004 X2O.\n0005 M3O');const p=parse(r.text);assert.ok(!p.error,p.error);});
test('page de-dupe: longest suffix of page n that is a prefix of page n+1',()=>{
 const r=C.dedupePages(['O1\nG0Z20\nN10G1X5\nG1Z-2.','N10G1X5\nG1Z-2.\nG0Z20\nM30']);
 assert.deepEqual(r.lines,['O1','G0Z20','N10G1X5','G1Z-2.','G0Z20','M30']);assert.deepEqual(r.removed,[2]);
 // a single short repeated block is not treated as overlap; one OCR slip on a long line still matches
 assert.deepEqual(C.dedupePages(['G0Z20\nX5','X5\nG1X6']).removed,[0]);
 assert.deepEqual(C.dedupePages(['A1\nG1X10.Y20.F100\nG1X15.Y25.','G1 X10. Y20. F100\nG1X15.Y26.\nM30']).removed,[2]);
 assert.deepEqual(C.dedupePages(['A\nN100G1X1','N100G1X1\nB','B\nC']).lines,['A','N100G1X1','B','B','C']);// N-numbered line counts alone; a bare 'B' does not
});
test('append after the last imported block',()=>{
 let a=C.appendImport('O1\nG0X0\n%','G1X1\nG1X2',null);assert.equal(a.doc,'O1\nG0X0\nG1X1\nG1X2\n%');
 a=C.appendImport(a.doc,'G1X3',a.state);assert.equal(a.doc,'O1\nG0X0\nG1X1\nG1X2\nG1X3\n%');
 a=C.appendImport('O1\nG0X0','G1X1',null);assert.equal(a.doc,'O1\nG0X0\nG1X1');
});
test('WinCAM fixture round-trips byte for byte',()=>{
 const d=W.decode(fixture);const im=W.importText(d.text);
 assert.equal(im.meta.eol,'\r\n');assert.equal(im.meta.oNumber,'0003');assert.equal(im.meta.comment,'2/4/4.5/5/8MM BLOKI');
 assert.ok(!im.text.includes('\r'));
 const out=Buffer.from(W.encode(W.exportText(im.text,im.meta),d.encoding));assert.ok(out.equals(fixture));
 assert.equal(W.fileName(im.text),'O0003.cnc');
});
test('WinCAM export of an editor program adds %, O-number line and CRLF',()=>{
 assert.equal(W.exportText('G0X1\nG1X2\nM30'),'%\r\nO0001(FANUC SIMULATOR)\r\nG0X1\r\nG1X2\r\nM30\r\n%\r\n');
 assert.equal(W.exportText('O12\nG0X1',{comment:'osa (a)'}),'%\r\nO12(OSA A)\r\nG0X1\r\nM30\r\n%\r\n');
});
test('WinCAM decode: windows-1252 comments and UTF-8',()=>{
 const cp=Uint8Array.from([...'(TY','\xd6','KALU)\r\n'].join('').split('').map(c=>c.charCodeAt(0)));
 assert.deepEqual(W.decode(cp),{text:'(TYÖKALU)\r\n',encoding:'windows-1252',bom:false});
 assert.deepEqual([...W.encode('(TYÖKALU)')],[...cp.slice(0,9)]);
 assert.equal(W.decode(new TextEncoder().encode('(TYÖ)')).encoding,'utf-8');
});
test('tool list: WinCAM mill fixture (T, H/D used, first call)',()=>{
 const list=W.listTools(W.importText(W.decode(fixture).text).text,'mill');
 assert.deepEqual(list.map(t=>({id:t.id,h:t.h,d:t.d,first:W.firstBlock(t),calls:t.calls,name:t.name})),[
  {id:2,h:[2],d:[2],first:'line 73',calls:2,name:null},{id:3,h:[3],d:[],first:'line 5',calls:2,name:null}]);
});
test('tool list: names from the comment after the call, H/D only from code',()=>{
 const list=W.listTools('N5 T3 M6 (FACE MILL 50)\nG43 H3 Z5 (H9 IS NOT AN OFFSET)\nN20 T4\nM6\nG41 D24 X0\nT3M6(OTHER NAME)','mill');
 assert.deepEqual(list.map(t=>[t.id,t.name,t.h,t.d,W.firstBlock(t)]),[[3,'FACE MILL 50',[3],[],'N5'],[4,null,[],[24],'N20']]);
});
test('tool list: lathe Txxyy (tool, offset numbers, names)',()=>{
 const lathe='%\nO0100(HOLKKI)\nN10 G28 U0 W0\nN20 T0101 (CNMG 120408 RAPPIO)\nG96 S200 M3\nN30 T0303(VNMG R0.4)\nG0 X40 Z2\nT0300\nN40 T0313\nT0505\nM30\n%';
 const list=W.listTools(lathe,'lathe');
 assert.deepEqual(list.map(t=>[t.id,t.name,t.offsets,W.firstBlock(t)]),[[1,'CNMG 120408 RAPPIO',[1],'N20'],[3,'VNMG R0.4',[3,13],'N30'],[5,null,[5],'line 10']]);
});
