'use strict';
// Read-only conceptual glossary; no controller instructions or runnable examples.
const codeReference = [
 ['G00','Positioning category','Geometry','A dashed connection illustrates the positioning category in this viewer.','dash','Path display'],
 ['G01','Linear interpolation','Geometry','A straight segment represents linear interpolation.','line','Path display'],
 ['G02','Circular interpolation','Geometry','Circular geometry, distinguished by arc orientation.','arc','XY arc display'],
 ['G03','Circular interpolation','Geometry','Circular geometry, distinguished by arc orientation.','arc2','XY arc display'],
 ['G17','XY plane','Geometry','A plane label in a Cartesian coordinate system.','plane','Recognized label'],
 ['G20','Inch units','Notation','A unit convention for numerical dimensions.','units','Recognized notation'],
 ['G21','Metric units','Notation','A unit convention for numerical dimensions.','units','Recognized notation'],
 ['G90','Absolute notation','Notation','Coordinates expressed relative to a shared origin.','origin','Recognized notation'],
 ['G91','Incremental notation','Notation','Coordinates expressed as relative displacements.','relative','Recognized notation'],
 ['G40','Compensation category','Controller concepts','A controller compensation-related label. Actual controller compensation is not modeled.','state','Not modeled'],
 ['G49','Tool offset category','Controller concepts','A controller offset-related label. Actual controller offsets are not modeled.','state','Not modeled'],
 ['G80','Cycle category','Controller concepts','A cycle-related controller label. Actual machining cycles are not modeled.','state','Not modeled'],
 ['G94','Rate notation','Controller concepts','A rate-related controller label. Process rates are not modeled.','state','Not modeled'],
 ['M00','Program pause category','Program flow','A pause symbol illustrates program flow terminology.','pause','Not modeled'],
 ['M01','Optional pause category','Program flow','An optional pause is a program-flow concept.','pause','Not modeled'],
 ['M02','Program end','Program flow','An end marker illustrates the end of a program.','end','Preview end marker'],
 ['M30','Program end category','Program flow','A program-end label; controller-specific behavior is not modeled.','end','Preview end marker'],
 ['M03','Spindle-related category','Machine concepts','A spindle-related machine function label. No spindle control is simulated.','state','Not modeled'],
 ['M04','Spindle-related category','Machine concepts','A spindle-related machine function label. No spindle control is simulated.','state','Not modeled'],
 ['M05','Spindle-related category','Machine concepts','A spindle-related machine function label. No spindle control is simulated.','state','Not modeled'],
 ['M06','Tool selection category','Machine concepts','A tool-related function label. Only virtual model selection is represented.','state','Visual model only'],
 ['M07','Coolant-related category','Machine concepts','A coolant-related machine function label. Fluid systems are not modeled.','state','Not modeled'],
 ['M08','Coolant-related category','Machine concepts','A coolant-related machine function label. Fluid systems are not modeled.','state','Not modeled'],
 ['M09','Coolant-related category','Machine concepts','A coolant-related machine function label. Fluid systems are not modeled.','state','Not modeled']
];
// Abstract annotation cards, not executable blocks or operating instructions.
codeReference.push(
 ['G96','Constant surface speed concept','Machine concepts','A rotational-motion concept in which the surface speed is the constant quantity. Not simulated.','surfaceConcept','Not modeled'],
 ['G97','Constant rotational speed concept','Machine concepts','A rotational-motion concept in which rotational speed is the constant quantity. Not simulated.','rotationConcept','Not modeled']
);
const refWordCards={
 G00:[['G','Category identifier'],['X / Y / Z','Cartesian axis labels in the abstract scene']],
 G01:[['G','Geometry category identifier'],['X / Y / Z','Cartesian coordinate labels']],
 G02:[['G','Geometry category identifier'],['X / Y / Z','Cartesian coordinate labels'],['I / J','Arc geometry notation; interpretation is controller-specific']],
 G03:[['G','Geometry category identifier'],['X / Y / Z','Cartesian coordinate labels'],['I / J','Arc geometry notation; interpretation is controller-specific']],
 G17:[['G','Plane category identifier'],['X / Y','Axes in the illustrated plane']],
 G20:[['G','Unit convention identifier']],G21:[['G','Unit convention identifier']],
 G90:[['G','Notation category identifier'],['X / Y / Z','Cartesian coordinates relative to an origin in the diagram']],
 G91:[['G','Notation category identifier'],['X / Y / Z','Relative displacements in the diagram']],
 G96:[['G','Mode identifier'],['S','Speed-related notation; meaning depends on the controller and context']],
 G97:[['G','Mode identifier'],['S','Speed-related notation; meaning depends on the controller and context']]
};
const refConceptExamples={G00:'A dashed connection between two abstract points.',G01:'An abstract straight line connects point A to point B.',G02:'An arc joins two points in a sketch.',G03:'An arc joins two points in a sketch.',G17:'A sheet represents a coordinate plane.',G90:'A point is located relative to a shared origin.',G91:'A displacement is illustrated between two points.',G96:'Compare a constant surface-rate concept with a constant rotational-rate concept. No machine settings are represented.',G97:'A rotating symbol illustrates an unchanged rotation-rate concept. No machine settings are represented.'};
const refArt={dash:'<path d="M65 120 L255 45" stroke-dasharray="7 6"/><circle cx="65" cy="120" r="5"/><circle cx="255" cy="45" r="5"/>',line:'<path d="M65 120 L255 45"/><circle cx="65" cy="120" r="5"/><circle cx="255" cy="45" r="5"/>',arc:'<path d="M65 120 Q155 5 255 120"/><circle cx="65" cy="120" r="5"/><circle cx="255" cy="120" r="5"/>',arc2:'<path d="M65 45 Q155 160 255 45"/><circle cx="65" cy="45" r="5"/><circle cx="255" cy="45" r="5"/>',plane:'<path d="M60 100 L160 40 L260 100 L160 150 Z" fill="#dcebf6"/><path d="M160 150 V25 M60 100 H260"/>',units:'<path d="M65 100 H255 M65 85 V115 M255 85 V115 M110 95 V105 M160 85 V115 M210 95 V105"/>',origin:'<path d="M65 30 V135 H270 M65 135 L225 55"/><circle cx="65" cy="135" r="5"/><circle cx="225" cy="55" r="5"/>',relative:'<path d="M65 120 L145 90 L230 50"/><circle cx="65" cy="120" r="5"/><circle cx="145" cy="90" r="5"/><circle cx="230" cy="50" r="5"/>',state:'<rect x="100" y="45" width="120" height="80" rx="10"/><path d="M125 72 H195 M125 88 H195 M125 104 H175"/>',pause:'<rect x="135" y="45" width="14" height="80" rx="3" fill="#3478bd"/><rect x="171" y="45" width="14" height="80" rx="3" fill="#3478bd"/>',end:'<rect x="130" y="55" width="60" height="60" rx="5" fill="#3478bd"/>'};
refArt.surfaceConcept='<circle cx="160" cy="85" r="45"/><path d="M160 40 H242"/><text x="160" y="155" text-anchor="middle" font-size="13" stroke="none" fill="#3478bd">Surface-rate concept</text>';
refArt.rotationConcept='<circle cx="160" cy="85" r="45"/><path d="M160 40 A45 45 0 0 1 205 85" stroke-dasharray="5 4"/><text x="160" y="155" text-anchor="middle" font-size="13" stroke="none" fill="#3478bd">Rotation-rate concept</text>';
function refWords(row){return refWordCards[row[0]]||[[row[0][0],row[0][0]==='M'?'Machine/program function identifier':'Controller concept identifier']];}
function renderRefWords(row,el){
 const box=el('words');box.replaceChildren();
 for(const [letter,description] of refWords(row)){const item=document.createElement('div'),key=document.createElement('strong'),desc=document.createElement('span');item.style.cssText='display:grid;grid-template-columns:74px 1fr;gap:8px;padding:8px 0;border-bottom:1px solid #dce4ec';key.textContent=letter;key.style.color='#176ac2';desc.textContent=description;item.append(key,desc);box.append(item);}
 el('example').textContent=refConceptExamples[row[0]]||'The diagram illustrates the terminology, not a runnable command.';
}
function setupCodeReference(){
 const dlg=document.createElement('dialog');dlg.id='codedialog';dlg.style.width='min(760px,calc(100vw - 32px))';
 dlg.innerHTML='<h2>G / M code reference</h2><p>Read-only terminology and conceptual diagrams. Meanings vary by controller; not operating guidance.</p><section><div class="buttons"><input id="ref-query" aria-label="Search codes" placeholder="Search G01, arc, program end…" style="flex:1;min-width:0"><select id="ref-filter" aria-label="Code type"><option value="all">All codes</option><option value="G">G codes</option><option value="M">M codes</option></select></div><p id="ref-count" role="status"></p><div style="display:grid;grid-template-columns:minmax(105px,1fr) minmax(0,2fr);gap:12px"><div id="ref-list" style="max-height:330px;overflow:auto;display:grid;align-content:start;gap:4px"></div><div id="ref-details"><h3 id="ref-title"></h3><p id="ref-category"></p><svg id="ref-graphic" viewBox="0 0 320 170" aria-label="Conceptual diagram" style="width:100%;background:#f2f6fa;border-radius:5px"></svg><p id="ref-description"></p><p id="ref-support"></p><h3>Word meanings</h3><div id="ref-words"></div><h3>Conceptual example</h3><p id="ref-example"></p><small>Isolated labels and sketches only; not a machine program.</small></div></div></section><div class="closebar"><button id="ref-close">Close</button></div>';
 document.body.append(dlg);const el=id=>document.getElementById('ref-'+id);let selected='G00';
 function show(row){selected=row[0];el('details').hidden=false;el('title').textContent=row[0]+' · '+row[1];el('category').textContent=row[2];el('description').textContent=row[3];el('support').textContent='Offline viewer: '+row[5];renderRefWords(row,el);el('graphic').innerHTML='<g stroke="#3478bd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">'+refArt[row[4]]+'</g>';for(const b of el('list').children)b.setAttribute('aria-pressed',String(b.dataset.code===selected));}
 function render(){const q=el('query').value.trim().toLowerCase(),norm=q.replace(/^([gm])0+(?=\d)/,'$1'),type=el('filter').value;const rows=codeReference.filter(r=>(type==='all'||r[0][0]===type)&&([...r,...refWords(r).flat(),refConceptExamples[r[0]]||''].join(' ').toLowerCase().includes(q)||r[0].toLowerCase().replace(/^([gm])0+(?=\d)/,'$1')===norm));el('list').replaceChildren();el('count').textContent=rows.length+' of '+codeReference.length+' entries';for(const row of rows){const b=document.createElement('button');b.dataset.code=row[0];b.textContent=row[0]+' · '+row[1];b.style.textAlign='left';b.onclick=()=>show(row);el('list').append(b);}if(rows.length)show(rows.find(r=>r[0]===selected)||rows[0]);else el('details').hidden=true;}
 el('query').oninput=render;el('filter').onchange=render;el('close').onclick=()=>dlg.close();const button=document.createElement('button');button.textContent='G / M code reference…';button.onclick=()=>{render();dlg.showModal();el('query').focus();};document.querySelector('[data-dialog="aboutdialog"]').before(button);render();
}
if(typeof document!=='undefined')setupCodeReference();
