'use strict';
// Illustrated geometry examples only. No machine command blocks, settings or cutting sequences.
const referenceStudies={
 G00:['Point-to-point geometry','Two abstract points are connected by a dashed line. The line is a visual convention, not a prediction of a machine trajectory.','dash', [['X','Horizontal axis'],['Y','Second planar axis'],['Z','Height axis']]],
 G01:['Straight segment','A straight segment connects two points in a drawing. Each coordinate axis contributes a component of the position.','line',[['X','Horizontal coordinate'],['Y','Second planar coordinate'],['Z','Height coordinate'],['F','Rate notation; context dependent']]],
 G02:['Circular geometry','The sketch identifies a circle center, an arc and its radius. This is geometric notation, not a controller-ready example.','arc',[['X / Y','Planar coordinates'],['I / J','Center-related notation; controller dependent'],['R','Radius notation; context dependent']]],
 G03:['Circular geometry','The same circle vocabulary applies regardless of orientation. The sketch does not specify controller motion.','arc2',[['X / Y','Planar coordinates'],['I / J','Center-related notation; controller dependent'],['R','Radius notation; context dependent']]],
 G76:['Milling and turning are different','In milling references this number is associated with fine boring. In turning references it may identify a threading cycle. The two sketches distinguish a circular opening from a threaded feature; the meanings are not interchangeable.','dual',[['G76','Controller-dependent cycle identifier']]],
 G81:['Circular opening','Top and section views depict a circular opening as an abstract feature. No cycle sequence is represented.','section'],
 G82:['Circular opening and time concept','A clock symbol distinguishes the time-related terminology from the geometry of the opening.','clockhole'],
 G83:['Circular opening','A section sketch identifies the surface and opening. It does not show a machining sequence.','section'],
 G84:['Threaded feature','A stylized helix represents thread geometry. It is not a toolpath or a cycle definition.','helix'],
 G85:['Circular opening','A top view and section distinguish the opening from the surrounding solid.','section'],
 G86:['Circular opening','A section view represents the associated feature category. Controller actions are not modeled.','section'],
 G87:['Circular opening','The geometry is shown without a tool or operating sequence.','section'],
 G88:['Circular opening','The diagram identifies a feature rather than the actions used to produce it.','section'],
 G89:['Circular opening','The section distinguishes the opening and the surrounding material.','section'],
 G96:['Surface and rotation concepts','The surface-rate concept is distinct from the rotational-rate concept. No spindle settings are shown.','surfaceConcept',[['S','Speed-related notation; controller dependent']]],
 G97:['Rotation concept','A circle represents rotation as a geometric concept. No spindle settings are shown.','rotationConcept',[['S','Speed-related notation; controller dependent']]],
 G90:['Absolute coordinates','The diagram labels a common origin and an abstract point.','origin',[['X / Y / Z','Cartesian position components']]],
 G91:['Relative coordinates','The diagram labels two abstract points and the displacement between them.','relative',[['X / Y / Z','Displacement components']]]
};
const studyLabel=(x,y,t)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" fill="#32536f" stroke="none">${t}</text>`;
Object.assign(refArt,{
 line:'<path d="M55 130 H275 M55 130 V25" stroke="#a9b9c9" stroke-width="1"/><path d="M90 110 L245 45"/><circle cx="90" cy="110" r="4" fill="#3478bd"/><circle cx="245" cy="45" r="4" fill="#3478bd"/>'+studyLabel(80,100,'A')+studyLabel(255,35,'B')+studyLabel(160,65,'Segment')+studyLabel(279,145,'X')+studyLabel(45,24,'Y'),
 arc:'<circle cx="160" cy="90" r="52" stroke="#a9b9c9" stroke-dasharray="4 4"/><path d="M108 90 A52 52 0 0 1 212 90"/><path d="M160 90 L160 38" stroke-width="1.3"/><circle cx="160" cy="90" r="3" fill="#3478bd"/>'+studyLabel(160,110,'Center')+studyLabel(178,63,'Radius')+studyLabel(160,24,'Arc'),
 arc2:'<circle cx="160" cy="80" r="52" stroke="#a9b9c9" stroke-dasharray="4 4"/><path d="M108 80 A52 52 0 0 0 212 80"/><path d="M160 80 L160 132" stroke-width="1.3"/><circle cx="160" cy="80" r="3" fill="#3478bd"/>'+studyLabel(160,67,'Center')+studyLabel(182,110,'Radius')+studyLabel(160,151,'Arc'),
 section:'<rect x="22" y="43" width="110" height="90" rx="4" fill="#dcebf6"/><circle cx="77" cy="88" r="25" fill="#f2f6fa"/><path d="M170 43 H298 V133 H170 Z M210 43 V133 M258 43 V133" fill="#dcebf6"/><rect x="210" y="43" width="48" height="90" fill="#f2f6fa"/><path d="M234 32 V143" stroke="#9aafbf" stroke-dasharray="4 4" stroke-width="1"/>'+studyLabel(77,27,'Top view')+studyLabel(234,27,'Section')+studyLabel(77,151,'Opening')+studyLabel(234,155,'Centerline'),
 dual:'<rect x="26" y="43" width="116" height="90" rx="5" fill="#dcebf6"/><circle cx="84" cy="88" r="28" fill="#f2f6fa"/><rect x="180" y="60" width="115" height="56" rx="7" fill="#dcebf6"/><path d="M190 60 L205 116 M210 60 L225 116 M230 60 L245 116 M250 60 L265 116 M270 60 L285 116"/>'+studyLabel(84,27,'Milling context')+studyLabel(238,27,'Turning context')+studyLabel(84,151,'Circular opening')+studyLabel(238,151,'Threaded feature')
});
const originalRefWords=renderRefWords;
renderRefWords=function(row,el){
 originalRefWords(row,el);const study=referenceStudies[row[0]],box=el('example');
 if(study?.[3]){el('words').replaceChildren();for(const [k,v] of study[3]){const d=document.createElement('div'),a=document.createElement('strong'),b=document.createElement('span');d.style.cssText='display:grid;grid-template-columns:74px 1fr;gap:8px;padding:8px 0;border-bottom:1px solid #dce4ec';a.textContent=k;a.style.color='#176ac2';b.textContent=v;d.append(a,b);el('words').append(d);}}
 box.replaceChildren();const heading=document.createElement('strong'),para=document.createElement('span');heading.style.cssText='display:block;margin-bottom:6px;color:#263f59';heading.textContent=study?.[0]||row[1]+' · illustrated concept';para.textContent=study?.[1]||row[3];box.append(heading,para);
 if(study)row[4]=study[2];
};
const refExampleStyle=document.createElement('style');refExampleStyle.textContent='#codedialog{width:min(900px,calc(100vw - 24px))!important}#ref-example{background:#eef4f9;padding:12px;border:1px solid #d7e1e9;border-radius:7px;line-height:1.55}#ref-details h3{margin-top:15px}#ref-list{max-height:430px!important}';document.head.append(refExampleStyle);
// Refresh the initially selected entry after upgrading the renderer.
document.getElementById('ref-query').dispatchEvent(new Event('input'));
