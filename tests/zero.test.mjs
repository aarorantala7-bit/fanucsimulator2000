import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const RT=require('../src/sim/runtime.js'),{zoomPan}=require('../src/ui/touch.js');
const wa={x0:-478.5,x1:478.5,y0:-201.25,y1:46.25,depth:66,work:{x:870,y:225,z:60}};

test('mill work zero: manual size, default = X0 Y0 at the centre, Z0 on top',()=>{assert.deepEqual(RT.placeMillStock({x:100,y:80,z:30},null,null),{x0:-50,x1:50,y0:-40,y1:40,top:0,bottom:-30,outside:false});
 assert.deepEqual(RT.placeMillStock({x:100,y:80,z:30},null,{mode:'corner',z:0}),{x0:0,x1:100,y0:0,y1:80,top:0,bottom:-30,outside:false});
 const c=RT.placeMillStock({x:100,y:80,z:30},null,{mode:'custom',x:20,y:10,z:2});assert.deepEqual([c.x0,c.x1,c.y0,c.y1,c.top,c.bottom],[-20,80,-10,70,2,-28]);});

test('mill auto stock respects the chosen zero',()=>{const c=RT.placeMillStock(null,wa,{mode:'center'});assert.equal(c.x0,-c.x1);assert.equal(c.y0,-c.y1);assert.equal(c.y1,201.25,'symmetric about Y0, covers the cut');assert.equal(c.bottom,-66);assert.equal(c.top,0);
 const f=RT.placeMillStock(null,wa,{mode:'fit'});assert.deepEqual([f.x0,f.x1,f.y0,f.y1],[wa.x0,wa.x1,wa.y0,wa.y1],'fit = cut area only (PR #5 behaviour)');
 const k=RT.placeMillStock(null,wa,{mode:'corner'});assert.deepEqual([k.x0,k.y0],[0,0]);assert.ok(k.outside,'cut area left of the corner is reported');
 const t=RT.placeMillStock(null,wa,{mode:'center',z:5});assert.equal(t.top,5);assert.equal(t.bottom,-66);});

test('lathe work zero: X0 on the centreline, Z0 on the part face / stock front / custom',()=>{const w={od:59.5,length:50,face:2.5,work:{od:54,length:45}};
 assert.deepEqual(RT.placeLatheStock(w,null,10),{od:59.5,length:50,face:2.5});assert.deepEqual(RT.placeLatheStock(w,{mode:'front'},10),{od:59.5,length:50,face:0});
 assert.deepEqual(RT.placeLatheStock(w,{mode:'custom',z:3},10),{od:59.5,length:53,face:3});});

test('pinch zoom keeps the point under the fingers fixed, two-finger pan moves by the midpoint delta',()=>{// screen x = base + pan + world*scale
 const base=200,pan=30,scale=2,world=40,px=base+pan+world*scale,k=2.5;const pan2=zoomPan(pan,base,px,k,0);assert.ok(Math.abs(base+pan2+world*scale*k-px)<1e-9);
 assert.equal(zoomPan(pan,base,px,1,15),pan+15);});

test('multi-file index has an inline load-failure notice; the standalone build strips it',()=>{const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<div id="loadfail"[^>]*style="display:block/);assert.match(html,/\.\.\/index\.html/);assert.match(html,/https:\/\/aarorantala7-bit\.github\.io\/fanucsimulator2000\//);
 assert.ok(html.indexOf('boot-js')<html.indexOf('<link rel="stylesheet"'),'load check runs before the stylesheet');
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');const re=/<!--loadcheck-->[\s\S]*?<!--\/loadcheck-->/g;assert.ok(build.includes('<!--loadcheck-->'));
 const out=html.replace(re,'');assert.ok(!/loadfail|boot-js/.test(out));
 assert.match(readFileSync(new URL('../src/ui/import-dialog.js',import.meta.url),'utf8'),/__fanucReady=true/);});
