'use strict';
// Family labels are catalog-inspired; geometry is synthetic, not manufacturer data.
const virtualCatalog = {
  'Default': [['Milling','Flat end mill','flat'],['Milling','Ball nose','ball'],['Milling','Corner radius mill','round'],['Milling','Face mill (approx.)','flat'],['Milling','Shoulder mill (approx.)','flat'],['Milling','Roughing mill (approx.)','flat'],['Milling','High feed mill (approx.)','round'],['Holemaking','Twist drill','point'],['Holemaking','Spot drill','point'],['Holemaking','Reamer (approx.)','flat'],['Holemaking','Indexable drill (approx.)','point'],['Finishing','Chamfer profile','point'],['Finishing','Countersink profile','point']],
  'ISCAR': [['Milling','FINISHRED','flat'],['Milling','MULTI-MASTER','round'],['Milling','SUMO-MILL T290','flat'],['Holemaking','SUMOCHAM','point']],
  'Kennametal': [['Milling','HARVI','flat'],['Milling','GOmill PRO','flat'],['Milling','Mill 4-11','flat'],['Holemaking','KenTIP FS','point'],['Holemaking','KSEM','point']],
  'Sandvik Coromant': [['Milling','CoroMill Plura','flat'],['Milling','CoroMill 390','flat'],['Holemaking','CoroDrill 860','point']],
  'Walter': [['Milling','MC230 Advance','flat'],['Milling','MD340 Supreme','flat'],['Holemaking','DC118 Supreme','point'],['Holemaking','DC180 Supreme','point']],
  'Seco': [['Milling','Jabro','flat'],['Holemaking','Perfomax','point'],['Holemaking','X-Tip','point']],
  'Mitsubishi Materials': [['Milling','VQ','flat'],['Holemaking','MVS','point'],['Holemaking','MVE','point']],
  'OSG': [['Milling','A Brand AE-VMS','flat'],['Milling','A Brand AE-VMSX','flat'],['Holemaking','A Brand ADO','point']],
  'Dormer Pramet': [['Milling','S9xx','flat'],['Milling','SSO12','round'],['Holemaking','Force X','point'],['Holemaking','A108','point']]
};
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
function toolDefaults(id){return {name:'Virtual tool '+id,shape:'flat',width:5,body:15,shank:5,shankLength:10,holder:12,holderLength:8,tip:2.5,corner:1,manufacturer:'Default',category:'Milling',family:'Flat end mill'};}
function buildTools(old){tools=new Map([...old].map(([id,t])=>[id,{...toolDefaults(id),...t}]));const ids=[...new Set(segs.map(s=>s.tool))].sort((a,b)=>a-b);for(const id of ids){if(tools.has(id))continue;const t=toolDefaults(id);if(mode==='demo'){t.shape=id===2?'ball':id===3?'point':'flat';t.width=id===1?7:id===2?6:4;t.shank=t.width;}tools.set(id,t);}renderTools();}
function renderTools(){const div=$('tools');div.replaceChildren();for(const [id,t] of [...tools].sort((a,b)=>a[0]-b[0])){const card=document.createElement('details');card.className='toolcard';card.open=tools.size<=3;const summary=document.createElement('summary');summary.textContent='T'+id+' · '+t.name;const fields=document.createElement('div');fields.className='toolfields';const field=(label,key,type,options)=>{const l=document.createElement('label');l.textContent=label;const el=document.createElement(type==='select'?'select':'input');el.setAttribute('aria-label','T'+id+' '+label);if(type==='select'){for(const [v,n]of options){const o=document.createElement('option');o.value=v;o.textContent=n;el.append(o);}}else{el.type=type;if(type==='number'){el.min='.1';el.max='1000';el.step='.1';}else el.maxLength=40;}el.value=t[key];el.onchange=()=>{playing=false;t[key]=type==='number'?clamp(Number(el.value)||toolDefaults(id)[key],.1,1000):el.value;el.value=t[key];summary.textContent='T'+id+' · '+t.name;rebuildStock(position);};l.append(el);fields.append(l);};field('Name','name','text');field('Shape','shape','select',[['flat','Flat end'],['ball','Ball end'],['round','Corner radius'],['point','Pointed end']]);for(const [l,k]of [['Body diameter','width'],['Body length','body'],['Shank diameter','shank'],['Shank length','shankLength'],['Holder diameter','holder'],['Holder length','holderLength'],['Point height (point only)','tip'],['Corner radius (rounded only)','corner']])field(l,k,'number');card.append(summary);presetFields(id,t,fields,summary,card);card.append(fields);div.append(card);}}
$('addtool').onclick=()=>{let id=1;while(tools.has(id))id++;if(tools.size>=40)return;tools.set(id,toolDefaults(id));renderTools();};
