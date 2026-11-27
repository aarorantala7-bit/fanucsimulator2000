'use strict';
// Family labels are catalog-inspired; geometry is synthetic, not manufacturer data.
const virtualCatalog = {
  'Default': [['Milling','Flat end mill','flat'],['Milling','Ball nose','ball'],['Milling','Corner radius mill','round'],['Milling','Face mill (approx.)','flat'],['Milling','Shoulder mill (approx.)','flat'],['Milling','Roughing mill (approx.)','flat'],['Milling','High feed mill (approx.)','round'],['Holemaking','Twist drill','point'],['Holemaking','Spot drill','point'],['Holemaking','Reamer (approx.)','flat'],['Holemaking','Indexable drill (approx.)','point'],['Finishing','Chamfer profile','point'],['Finishing','Countersink profile','point'],['Finishing','Finishing end mill','flat'],['Finishing','Finishing ball nose','ball'],['Finishing','Bull nose','round'],['Finishing','Barrel-shaped mill','barrel'],['Finishing','Tapered ball nose','taperball'],['Finishing','Finishing face mill','flat'],['Angle mills','Chamfer mill','angle'],['Angle mills','Single-angle mill','angle'],['Angle mills','Double-angle mill','doubleangle'],['Angle mills','Dovetail mill','dovetail'],['Angle mills','Tapered end mill','taper'],['Angle mills','V-profile mill','vprofile'],['Disk cutters','Slitting saw','disk'],['Disk cutters','Side-and-face mill','disk'],['Disk cutters','T-slot mill','tslot'],['Disk cutters','Slotting disk','disk'],['Disk cutters','Rounded-profile disk','rounddisk'],['Disk cutters','Angle-profile disk','angleddisk'],['Special profiles','Lollipop mill','sphere'],['Special profiles','Spherical mill','sphere'],['Special profiles','Undercut mill','undercut'],['Special profiles','Form mill','form'],['Special profiles','Corner-rounding mill','cornerform']],
  'ISCAR': [['Milling','FINISHRED','flat'],['Milling','MULTI-MASTER','round'],['Milling','SUMO-MILL T290','flat'],['Holemaking','SUMOCHAM','point']],
  'Kennametal': [['Milling','HARVI','flat'],['Milling','GOmill PRO','flat'],['Milling','Mill 4-11','flat'],['Holemaking','KenTIP FS','point'],['Holemaking','KSEM','point']],
  'Sandvik Coromant': [['Milling','CoroMill Plura','flat'],['Milling','CoroMill 390','flat'],['Holemaking','CoroDrill 860','point']],
  'Walter': [['Milling','MC230 Advance','flat'],['Milling','MD340 Supreme','flat'],['Holemaking','DC118 Supreme','point'],['Holemaking','DC180 Supreme','point']],
  'Seco': [['Milling','Jabro','flat'],['Holemaking','Perfomax','point'],['Holemaking','X-Tip','point']],
  'Mitsubishi Materials': [['Milling','VQ','flat'],['Holemaking','MVS','point'],['Holemaking','MVE','point']],
  'OSG': [['Milling','A Brand AE-VMS','flat'],['Milling','A Brand AE-VMSX','flat'],['Holemaking','A Brand ADO','point']],
  'Dormer Pramet': [['Milling','S9xx','flat'],['Milling','SSO12','round'],['Holemaking','Force X','point'],['Holemaking','A108','point']]
};

// Stylized display silhouettes only, expressed as unitless axial/radial proportions.
const previewProfiles={
  barrel:[[0,.38],[.08,.58],[.22,.82],[.42,.98],[.55,1],[.72,.92],[.9,.67],[1,.48]],
  taperball:[[0,0],[.06,.25],[.12,.36],[.2,.42],[1,1]],
  angle:[[0,.35],[.55,1],[.72,1],[1,.45]],
  doubleangle:[[0,.28],[.5,1],[1,.28]],
  dovetail:[[0,1],[.62,.42],[1,.42]],
  taper:[[0,.45],[1,1]],
  vprofile:[[0,0],[.72,1],[1,1]],
  disk:[[0,.30],[.35,.30],[.35,1],[.57,1],[.57,.30],[1,.30]],
  tslot:[[0,1],[.28,1],[.28,.28],[1,.28]],
  rounddisk:[[0,.30],[.33,.30],[.36,.76],[.43,.95],[.5,1],[.57,.95],[.64,.76],[.67,.30],[1,.30]],
  angleddisk:[[0,.30],[.32,.30],[.5,1],[.64,.7],[.68,.30],[1,.30]],
  sphere:[[0,0],[.08,.53],[.18,.85],[.3,1],[.42,.92],[.54,.68],[.60,.30],[1,.30]],
  undercut:[[0,.65],[.12,1],[.35,1],[.47,.32],[1,.32]],
  form:[[0,.35],[.16,.74],[.32,.74],[.46,.50],[.60,.92],[.75,.92],[1,.35]],
  cornerform:[[0,1],[.12,.70],[.25,.50],[.42,.37],[.65,.35],[1,.35]]
};
function isVisualOnlyTool(t){return !!t&&Object.hasOwn(previewProfiles,t.shape);}
function visualProfileLabel(t){return isVisualOnlyTool(t)?'Shape preview only — stock removal unavailable for this profile.':'Virtual surface profile — approximate visualization only.';}

function presetFields(id,t,fields,summary,card){
  const box=document.createElement('div');box.className='presetfields';
  const make=(label,values)=>{const l=document.createElement('label');l.textContent=label;const e=document.createElement('select');e.setAttribute('aria-label','T'+id+' '+label);for(const v of values)e.add(new Option(v,v));l.append(e);box.append(l);return e;};
  const maker=make('Manufacturer',Object.keys(virtualCatalog)),cat=make('Category',[]),family=make('Family / preset',[]);
  maker.value=Object.hasOwn(virtualCatalog,t.manufacturer)?t.manufacturer:'Default';
  const fill=(select,values,preferred)=>{select.replaceChildren(...values.map(v=>new Option(v,v)));if(values.includes(preferred))select.value=preferred;};
  const families=preferred=>fill(family,virtualCatalog[maker.value].filter(p=>p[0]===cat.value).map(p=>p[1]),preferred);
  const categories=(preferred,preset)=>{fill(cat,[...new Set(virtualCatalog[maker.value].map(p=>p[0]))],preferred);families(preset);};
  categories(t.category,t.family);maker.onchange=()=>categories();cat.onchange=()=>families();
  const apply=document.createElement('button');apply.textContent='Apply visual preset';apply.type='button';apply.onclick=()=>{const p=virtualCatalog[maker.value].find(p=>p[0]===cat.value&&p[1]===family.value);if(!p)return;playing=false;Object.assign(t,{manufacturer:maker.value,category:p[0],family:p[1],name:p[1],shape:p[2]});summary.textContent='T'+id+' · '+t.name;rebuildStock(position);renderTools();};box.append(apply);
  const note=document.createElement('small');note.textContent='Visual profile only. Keeps your custom dimensions; not a catalog specification.';box.append(note);card.append(box);
}
function toolDefaults(id){const lib=globalThis.MachineData?.MILL_TOOLS.find(t=>t.id===id);if(lib){const {id:_,type,...g}=lib;return {manufacturer:'Default',category:type==='drill'||type==='spot'||type==='tap'||type==='reamer'||type==='boring'?'Holemaking':'Milling',family:lib.name,kind:type,...g};}return {name:'Virtual tool '+id,shape:'flat',width:5,body:15,shank:5,shankLength:10,holder:12,holderLength:8,tip:2.5,corner:1,manufacturer:'Default',category:'Milling',family:'Flat end mill'};}
function buildTools(old){const saved=globalThis.MachineState?.mill.tools||{};tools=new Map([...old].map(([id,t])=>[id,{...toolDefaults(id),...t}]));for(const [id,t] of Object.entries(saved))if(!tools.has(+id))tools.set(+id,{...toolDefaults(+id),...t});const ids=[...new Set([...segs.map(s=>s.tool),...(globalThis.MachineData?.MILL_TOOLS||[]).map(t=>t.id)])].sort((a,b)=>a-b);for(const id of ids){if(tools.has(id))continue;tools.set(id,toolDefaults(id));}renderTools();}
function saveMillTools(){const MS=globalThis.MachineState;if(!MS)return;MS.mill.tools=Object.fromEntries([...tools].map(([id,t])=>[id,t]));for(const [id,t] of tools){const h=MS.mill.offsets.h[id]||(MS.mill.offsets.h[id]={geom:0,wear:0}),d=MS.mill.offsets.d[id]||(MS.mill.offsets.d[id]={geom:0,wear:0});if(t.length)h.geom=t.length;d.geom=t.width/2;}MS.persist();}
function renderTools(){const div=$('tools');div.replaceChildren();for(const [id,t] of [...tools].sort((a,b)=>a[0]-b[0])){const card=document.createElement('details');card.className='toolcard';card.open=tools.size<=3;const summary=document.createElement('summary');summary.textContent='T'+id+' · '+t.name;const fields=document.createElement('div');fields.className='toolfields';const field=(label,key,type,options)=>{const l=document.createElement('label');l.textContent=label;const el=document.createElement(type==='select'?'select':'input');el.setAttribute('aria-label','T'+id+' '+label);if(type==='select'){for(const [v,n]of options){const o=document.createElement('option');o.value=v;o.textContent=n;el.append(o);}}else{el.type=type;if(type==='number'){el.min='.1';el.max='1000';el.step='.1';}else el.maxLength=40;}el.value=t[key];el.onchange=()=>{playing=false;t[key]=type==='number'?clamp(Number(el.value)||toolDefaults(id)[key]||0,key==='corner'?0:.1,1000):el.value;if(key==='pointAngle'||(key==='width'&&t.pointAngle))t.tip=MachineData.pointHeight(t.width,t.pointAngle);if(t.shape==='ball')t.corner=t.width/2;if(t.shape==='round')t.corner=Math.min(t.corner,t.width/2);el.value=t[key];saveMillTools();summary.textContent='T'+id+' · '+t.name;profileNote.textContent=visualProfileLabel(t);rebuildStock(position);};l.append(el);fields.append(l);};field('Name','name','text');field('Shape','shape','select',[['flat','Flat end'],['ball','Ball end'],['round','Corner radius'],['point','Pointed end'],...Object.keys(previewProfiles).map(k=>[k,({taperball:'Tapered ball',doubleangle:'Double angle',vprofile:'V profile',tslot:'T-slot',rounddisk:'Rounded disk',angleddisk:'Angled disk',cornerform:'Corner rounding'})[k]||k[0].toUpperCase()+k.slice(1)])]);for(const [l,k]of [['Body diameter','width'],['Body length','body'],['Shank diameter','shank'],['Shank length','shankLength'],['Holder diameter','holder'],['Holder length','holderLength'],['Point height (point only)','tip'],['Point angle ° (drills, spot, chamfer)','pointAngle'],['Corner radius (bull nose; ball = Ø/2)','corner'],['Overall length (H offset)','length']])field(l,k,'number');const profileNote=document.createElement('p');profileNote.className='profile-note';profileNote.textContent=visualProfileLabel(t);card.append(summary);presetFields(id,t,fields,summary,card);card.append(fields,profileNote);div.append(card);}}
$('addtool').insertAdjacentHTML('afterend','<button id="resettools" title="Restore the default mill tool library and offsets">Reset to defaults</button>');$('resettools').onclick=()=>{globalThis.MachineState?.resetTools('mill');tools=new Map();buildTools(new Map());rebuildStock(position);};
$('addtool').onclick=()=>{let id=1;while(tools.has(id))id++;if(tools.size>=40)return;tools.set(id,toolDefaults(id));renderTools();};

// Stable colors by virtual tool number. High contrast on the light CAD viewport.
const toolPalette=['#b07a16','#176ac2','#c44b36','#16836b','#8956b6','#b34b87','#347b98','#7b7e27'];
function toolPathColor(id){const n=Math.max(0,Math.trunc(Number(id)||0));return n<toolPalette.length?toolPalette[n]:`hsl(${Math.round((n*137.508)%360)} 67% 41%)`;}
function toolDisplayName(id){const t=tools.get(id);if(!t)return 'Virtual tool '+id;const maker=t.manufacturer&&t.manufacturer!=='Default'?t.manufacturer+' ':'';const name=t.name||t.family||'Virtual tool '+id;return maker+name+(t.family&&t.family!==name&&t.manufacturer!=='Default'?' ('+t.family+')':'')+(isVisualOnlyTool(t)?' · preview only':'');}
function ensureDemoTools(){for(const [id,manufacturer,family] of [[1,'Sandvik Coromant','CoroMill Plura'],[2,'ISCAR','MULTI-MASTER'],[3,'Kennametal','KenTIP FS']]){if(tools.has(id))continue;const preset=virtualCatalog[manufacturer].find(p=>p[1]===family);tools.set(id,{...toolDefaults(id),manufacturer,category:preset[0],family,name:family,shape:preset[2]});}}
