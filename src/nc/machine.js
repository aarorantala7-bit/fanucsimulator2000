'use strict';
// Machine data shared by the simulator, the CNC panel and the macro executor:
// parameter tables, default tool libraries and offset tables for Milling and Turning.
// Values are realistic examples for a FANUC 0i-F class control, not data from a specific machine.
(function(root){
// Parameter definitions: [number, name, unit/notes, mill default, lathe default]. Arrays are per axis
// (mill X,Y,Z / lathe X,Z). Bit parameters are stored as integers.
const PARAM_DEFS=[
 [1401,'Rapid traverse type (bit1 LRP: 0 = non-linear dogleg, 1 = linear interpolation)','bits',2,2],
 [1420,'Rapid traverse rate per axis','mm/min',[30000,30000,24000],[20000,24000]],
 [1421,'F0 rate of rapid traverse override per axis','mm/min',[1000,1000,1000],[800,800]],
 [1422,'Maximum cutting feedrate (all axes)','mm/min',10000,8000],
 [1423,'JOG feedrate per axis','mm/min',[1260,1260,1260],[1000,1000]],
 [1424,'Manual rapid traverse rate per axis','mm/min',[10000,10000,8000],[8000,10000]],
 [1240,'Reference position (machine coordinates) per axis','mm',[0,0,0],[0,0]],
 [1320,'Stored stroke limit 1 positive per axis (machine)','mm',[10,10,10],[10,10]],
 [1321,'Stored stroke limit 1 negative per axis (machine)','mm',[-610,-410,-510],[-420,-620]],
 [1620,'Rapid traverse linear accel/decel time constant per axis','ms',[100,100,120],[80,100]],
 [1622,'Cutting feed accel/decel time constant per axis','ms',[32,32,32],[24,24]],
 [3401,'bit0 DPI: 1 = calculator-type decimal point (X10 = 10 mm), 0 = X10 means 0.010 mm','bits',1,1],
 [3402,'bit0 G01: 1 = G01 modal at reset, 0 = G00','bits',0,0],
 [3741,'Maximum spindle speed gear 1','rpm',12000,4000],
 [3772,'Maximum spindle speed (clamp for all modes)','rpm',12000,4000],
 [5130,'Thread chamfering amount for G92 (0.1 x lead)','0.1 lead',0,0],
 [5132,'G71/G72 depth of cut (set by G71 U / G72 W first block)','mm',0,2],
 [5133,'G71/G72 escape amount (set by G71/G72 R)','mm',0,0.5],
 [5135,'G73 relief in X (radius, set by G73 U)','mm',0,3],
 [5136,'G73 relief in Z (set by G73 W)','mm',0,0],
 [5137,'G73 division count (set by G73 R)','times',0,3],
 [5139,'G74/G75 return amount (set by G74/G75 R)','mm',0,0.5],
 [5140,'G76 minimum depth of cut (set by G76 Q, radius)','mm',0,0.1],
 [5141,'G76 finishing allowance (set by G76 R)','mm',0,0.05],
 [5142,'G76 finishing repetitions (set by G76 P first 2 digits)','times',0,2],
 [5143,'G76 tool nose angle (set by G76 P last 2 digits)','deg',0,60],
 [6711,'Number of machined parts (#3901)','parts',0,0],
 [6713,'Number of required parts (#3902)','parts',0,0]
];
function defaultParams(machine){const i=machine==='lathe'?4:3;return new Map(PARAM_DEFS.map(d=>[d[0],Array.isArray(d[i])?d[i].slice():d[i]]));}
// Default work offsets. Machine = work + G54 (+ lathe work shift). Lathe X is diameter.
function defaultWork(machine){return machine==='lathe'?{ext:{x:0,z:0},54:{x:-260,z:-410},55:{x:-260,z:-380},56:{x:0,z:0},57:{x:0,z:0},58:{x:0,z:0},59:{x:0,z:0},shift:{x:0,z:0}}
 :{ext:{x:0,y:0,z:0},54:{x:-300,y:-200,z:-350},55:{x:-150,y:-200,z:-350},56:{x:0,y:0,z:0},57:{x:0,y:0,z:0},58:{x:0,y:0,z:0},59:{x:0,y:0,z:0}};}
// Lathe insert shapes (ISO): included angle and typical holder entering angle.
const INSERTS={C:{angle:80,label:'C 80° rhombic',kappa:95},D:{angle:55,label:'D 55° rhombic',kappa:93},V:{angle:35,label:'V 35° rhombic',kappa:93},W:{angle:80,label:'W 80° trigon',kappa:95},T:{angle:60,label:'T 60° triangle',kappa:91},S:{angle:90,label:'S 90° square',kappa:45},R:{angle:180,label:'R round',kappa:90}};
// Lathe tools: type od|id|groove|part|thread-od|thread-id|drill. noseR and tip mirror the offset page.
const LATHE_TOOLS=[
 {id:1,name:'OD rough CNMG 120408',type:'od',shape:'C',angle:80,kappa:95,noseR:0.8,tip:3,edge:12.9,width:0},
 {id:2,name:'OD finish DNMG 150604',type:'od',shape:'D',angle:55,kappa:93,noseR:0.4,tip:3,edge:15.5,width:0},
 {id:3,name:'OD profile VNMG 160402',type:'od',shape:'V',angle:35,kappa:93,noseR:0.2,tip:3,edge:16.6,width:0},
 {id:4,name:'OD groove 3.0 mm',type:'groove',shape:'G',angle:0,kappa:90,noseR:0.2,tip:3,edge:12,width:3},
 {id:5,name:'Parting blade 2.5 mm',type:'part',shape:'G',angle:0,kappa:90,noseR:0.1,tip:3,edge:25,width:2.5},
 {id:6,name:'OD thread 16ER 60° ISO',type:'thread-od',shape:'TH',angle:60,kappa:90,noseR:0.1,tip:8,edge:8,width:0},
 {id:7,name:'ID boring bar CCMT 09T304',type:'id',shape:'C',angle:80,kappa:95,noseR:0.4,tip:2,edge:9.7,width:0,minBore:16},
 {id:8,name:'ID thread 11IR 60° ISO',type:'thread-id',shape:'TH',angle:60,kappa:90,noseR:0.1,tip:6,edge:6,width:0,minBore:14},
 {id:9,name:'Drill Ø20 118°',type:'drill',shape:'DR',angle:118,kappa:59,noseR:0,tip:0,edge:80,width:20},
 {id:10,name:'ID rough WNMG 080408',type:'id',shape:'W',angle:80,kappa:95,noseR:0.8,tip:2,edge:8.7,width:0,minBore:25},
 {id:11,name:'OD copy RCMT 1204 (round)',type:'od',shape:'R',angle:180,kappa:90,noseR:6,tip:3,edge:12,width:0},
 {id:12,name:'OD 91° TNMG 160408',type:'od',shape:'T',angle:60,kappa:91,noseR:0.8,tip:3,edge:16.5,width:0},
 {id:13,name:'Face/chamfer SNMG 120408 45°',type:'od',shape:'S',angle:90,kappa:45,noseR:0.8,tip:3,edge:12.7,width:0},
 {id:14,name:'Centre drill A3.15',type:'drill',shape:'DR',angle:118,kappa:59,noseR:0,tip:0,edge:12,width:3.15}
];
// Example geometry offsets (as measured on a machine) for the lathe offset page.
function defaultLatheOffsets(){const geom={},wear={};for(const t of LATHE_TOOLS){geom[t.id]={x:-180-t.id*3.125,z:-320-t.id*7.5,r:t.noseR,t:t.tip};wear[t.id]={x:0,z:0,r:0,t:0};}return {geom,wear};}
// Mill tools follow the existing virtual tool model (shape flat|ball|round|point, width = diameter).
const MILL_TOOLS=[
 {id:1,name:'Face mill Ø63 (5 inserts)',type:'face',shape:'round',width:63,corner:0.8,body:8,shank:40,shankLength:30,holder:63,holderLength:40,tip:0,pointAngle:0,length:95},
 {id:2,name:'Flat end mill Ø12 4FL',type:'endmill',shape:'flat',width:12,corner:0,body:26,shank:12,shankLength:40,holder:32,holderLength:45,tip:0,pointAngle:0,length:110},
 {id:3,name:'Flat end mill Ø6 3FL',type:'endmill',shape:'flat',width:6,corner:0,body:13,shank:6,shankLength:38,holder:25,holderLength:45,tip:0,pointAngle:0,length:96},
 {id:4,name:'Ball nose Ø8 R4',type:'ball',shape:'ball',width:8,corner:4,body:16,shank:8,shankLength:44,holder:25,holderLength:45,tip:0,pointAngle:0,length:105},
 {id:5,name:'Bull nose Ø10 R1',type:'bull',shape:'round',width:10,corner:1,body:22,shank:10,shankLength:40,holder:32,holderLength:45,tip:0,pointAngle:0,length:107},
 {id:6,name:'Spot drill Ø10 90°',type:'spot',shape:'point',width:10,corner:0,body:20,shank:10,shankLength:30,holder:32,holderLength:45,tip:5,pointAngle:90,length:95},
 {id:7,name:'Drill Ø8.5 118° (M10 tap drill)',type:'drill',shape:'point',width:8.5,corner:0,body:60,shank:8.5,shankLength:30,holder:32,holderLength:45,tip:2.55,pointAngle:118,length:135},
 {id:8,name:'Tap M10x1.5',type:'tap',shape:'flat',width:10,corner:0,body:24,shank:8,shankLength:50,holder:36,holderLength:55,tip:0,pointAngle:0,length:129,pitch:1.5},
 {id:9,name:'Reamer Ø10 H7',type:'reamer',shape:'flat',width:10,corner:0,body:38,shank:10,shankLength:40,holder:32,holderLength:45,tip:0,pointAngle:0,length:123},
 {id:10,name:'Fine boring bar Ø20-26',type:'boring',shape:'flat',width:20,corner:0.4,body:30,shank:16,shankLength:40,holder:50,holderLength:60,tip:0,pointAngle:0,length:130},
 {id:11,name:'Chamfer mill Ø12 90°',type:'chamfer',shape:'point',width:12,corner:0,body:10,shank:12,shankLength:40,holder:32,holderLength:45,tip:6,pointAngle:90,length:95}
];
function defaultMillOffsets(){const h={},d={};for(const t of MILL_TOOLS){h[t.id]={geom:t.length,wear:0};d[t.id]={geom:t.width/2,wear:0};}return {h,d};}
function pointHeight(diameter,angle){return angle>0&&angle<180?(diameter/2)/Math.tan(angle*Math.PI/360):0;}
const clone=o=>JSON.parse(JSON.stringify(o));
// Storage helpers (browser only). Keys are versioned so a reset can drop them cleanly.
const KEY='fs2000.';
function load(name,fallback){try{const s=root.localStorage?.getItem(KEY+name);return s?JSON.parse(s):fallback;}catch{return fallback;}}
function save(name,value){try{root.localStorage?.setItem(KEY+name,JSON.stringify(value));}catch{}}
function remove(name){try{root.localStorage?.removeItem(KEY+name);}catch{}}
const paramsToJSON=m=>[...m];const paramsFromJSON=(a,machine)=>{const m=defaultParams(machine);if(Array.isArray(a))for(const [k,v] of a)if(m.has(k))m.set(k,v);return m;};
function createState(){const st={
  mill:{params:paramsFromJSON(load('params.mill'),'mill'),offsets:load('offsets.mill',null)||defaultMillOffsets(),work:load('work.mill',null)||defaultWork('mill'),tools:load('tools.mill',null)},
  lathe:{params:paramsFromJSON(load('params.lathe'),'lathe'),offsets:load('offsets.lathe',null)||defaultLatheOffsets(),work:load('work.lathe',null)||defaultWork('lathe'),tools:load('tools.lathe',null)||clone(LATHE_TOOLS),stock:load('stock.lathe',null)||{type:'bar',od:50,bore:0,length:80,face:1}},
  common:new Map(load('common',[])),
  persist(){for(const m of ['mill','lathe']){save('params.'+m,paramsToJSON(st[m].params));save('offsets.'+m,st[m].offsets);save('work.'+m,st[m].work);}save('tools.lathe',st.lathe.tools);save('stock.lathe',st.lathe.stock);if(st.mill.tools)save('tools.mill',st.mill.tools);save('common',[...st.common].filter(([k,v])=>k>=500&&v!==null));},
  library(m){const lib=load('programs.'+m,{});return new Map(Object.entries(lib).map(([k,v])=>[Number(k),v]));},
  saveProgram(m,o,text){const lib=load('programs.'+m,{});lib[o]=text;save('programs.'+m,lib);},
  deleteProgram(m,o){const lib=load('programs.'+m,{});delete lib[o];save('programs.'+m,lib);},
  resetTools(m){if(m==='lathe'){st.lathe.tools=clone(LATHE_TOOLS);st.lathe.offsets=defaultLatheOffsets();}else{st.mill.tools=null;st.mill.offsets=defaultMillOffsets();remove('tools.mill');}st.persist();},
  resetParams(m){st[m].params=defaultParams(m);st[m].work=defaultWork(m);st.persist();}};return st;}
const api={createState,PARAM_DEFS,defaultParams,defaultWork,INSERTS,LATHE_TOOLS,MILL_TOOLS,defaultLatheOffsets,defaultMillOffsets,pointHeight,clone,load,save,remove,paramsToJSON,paramsFromJSON};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else{root.MachineData=api;root.MachineState=createState();}
})(typeof globalThis!=='undefined'?globalThis:this);
