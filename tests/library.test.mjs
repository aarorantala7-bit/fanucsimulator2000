import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../src/ui/code-library.js');

test('the selector filters by machine and meanings never mix',()=>{const mill=C.list('mill'),lathe=C.list('lathe');assert.ok(mill.every(e=>e.machine==='mill'));assert.ok(lathe.every(e=>e.machine==='lathe'));
 const g76m=mill.find(e=>e.code==='G76'),g76t=lathe.find(e=>e.code==='G76');assert.match(g76m.title,/boring/i);assert.match(g76t.title,/thread/i);
 assert.deepEqual(g76t.ex,['G76 P020060 Q100 R0.05','G76 X18.376 Z-25.0 P812 Q300 F1.5']);assert.deepEqual(g76m.ex,['G98 G76 X50.0 Y30.0 Z-20.0 R2.0 Q0.1 P500 F80']);
 assert.equal(C.list('lathe','G71')[0].code,'G71');assert.equal(C.list('lathe','g071')[0]?.code,'G71');assert.ok(C.list('mill','','M').every(e=>e.code[0]==='M'));});

test('turning library covers the required codes',()=>{const need='G00 G01 G02 G03 G20 G21 G28 G32 G40 G41 G42 G50 G70 G71 G72 G73 G74 G75 G76 G90 G92 G94 G96 G97 G98 G99 M00 M01 M03 M04 M05 M08 M09 M30 M98 M99'.split(' ');const have=new Set(C.list('lathe').map(e=>e.code));assert.deepEqual(need.filter(c=>!have.has(c)),[]);});

test('every entry has a realistic example and explained addresses; no placeholders or disclaimers anywhere',()=>{for(const e of C.LIB){assert.ok(e.ex.length&&e.ex.every(l=>/^[A-Z#(]/.test(l)),e.code);assert.ok(e.words.length,e.code);}
 const src=readdirSync(new URL('../src/ui/',import.meta.url)).filter(f=>f.endsWith('.js')).map(f=>readFileSync(new URL('../src/ui/'+f,import.meta.url),'utf8')).join('\n');
 assert.ok(!src.includes('<value>'),'no <value> placeholder');assert.ok(!/fictional placeholder|not validated|supplied reference only|supplied screenshot/i.test(src),'no disclaimer text');});
