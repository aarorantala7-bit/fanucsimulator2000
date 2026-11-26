'use strict';
// Non-executable reference cards. User-supplied terminology is not controller validation.
const referenceCardTerms={
 G76:{context:'Turning reference · single-line variant in the supplied example',terms:[['X','Thread minor diameter (geometry term)'],['Z','Thread endpoint (geometry term)'],['I','Taper (geometry term)'],['K','Thread depth (geometry term)'],['D','First-pass depth (process term)'],['A','Thread angle (geometry term)'],['F','Thread pitch (geometry term)']],example:'ILLUSTRATE THREAD_PROFILE\nLABEL CORE_DIAMETER\nLABEL AXIAL_ENDPOINT\nLABEL TAPER\nLABEL THREAD_ANGLE\nLABEL PITCH',note:'These labels describe the supplied turning reference only. Milling G76 is a different controller concept (fine boring). Not a validated syntax specification.'},
 G00:{example:'ILLUSTRATE POINT_CONNECTION\nSTYLE DASHED'},
 G01:{example:'ILLUSTRATE LINE_SEGMENT\nLABEL POINT_A\nLABEL POINT_B'},
 G02:{example:'ILLUSTRATE CIRCLE_ARC\nLABEL CENTER\nLABEL RADIUS'},
 G03:{example:'ILLUSTRATE CIRCLE_ARC\nLABEL CENTER\nLABEL RADIUS'},
 G90:{example:'ILLUSTRATE SHARED_ORIGIN\nLABEL ABSTRACT_POINT'},
 G91:{example:'ILLUSTRATE RELATIVE_DISPLACEMENT\nLABEL ABSTRACT_POINTS'},
 G96:{example:'ILLUSTRATE SURFACE_RATE_CONCEPT'},
 G97:{example:'ILLUSTRATE ROTATION_RATE_CONCEPT'},
};
const priorRenderRefWords027=renderRefWords;
renderRefWords=function(row,el){
 priorRenderRefWords027(row,el);
 const card=referenceCardTerms[row[0]],study=referenceStudies[row[0]],box=el('words'),example=el('example');
 const entries=card?.terms||study?.[3]||refWordCards[row[0]]||[];
 const words=entries.flatMap(([key,value])=>key.split(/\s*\/\s*/).map(letter=>[letter,value]));
 box.replaceChildren();
 if(card?.context){const p=document.createElement('p');p.className='ref-context';p.textContent=card.context;box.append(p);}
 if(words.length){const table=document.createElement('table');table.className='ref-word-table';const head=table.createTHead().insertRow();for(const label of ['Letter','Meaning']){const th=document.createElement('th');th.textContent=label;head.append(th);}const body=table.createTBody();for(const [key,value] of words){const tr=body.insertRow();tr.insertCell().textContent=key;tr.insertCell().textContent=value;}box.append(table);}else{const p=document.createElement('p');p.textContent='No additional address-letter annotations are documented in this entry. This does not establish that the controller accepts none.';box.append(p);}
 if(card?.note){const p=document.createElement('p');p.className='ref-context';p.textContent=card.note;box.append(p);}
 const caption=document.createElement('strong');caption.className='ref-example-label';caption.textContent='Illustration example · pseudocode';
 const pre=document.createElement('pre');pre.className='ref-code-card';pre.textContent='REFERENCE '+row[0]+'\n'+(card?.example||`ILLUSTRATE ${row[1].toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')}\nLABEL ${row[0]}_REFERENCE`);
 const note=document.createElement('small');note.className='ref-example-label';note.textContent='Display-only pseudocode, not CNC syntax. No command sequence or machine settings.';
 example.append(caption,pre,note);
};
const referenceCardsStyle=document.createElement('style');referenceCardsStyle.textContent='.ref-word-table{border-collapse:collapse;width:100%;font-size:12px}.ref-word-table th,.ref-word-table td{text-align:left;padding:7px 9px;border-bottom:1px solid #dce4ec;vertical-align:top}.ref-word-table th{background:#eef3f8;color:#263f59}.ref-word-table td:first-child{width:70px;font-weight:600;color:#176ac2;font-family:Consolas,monospace}.ref-context{font-size:11px;color:#53677b;line-height:1.5}.ref-code-card{white-space:pre-wrap;overflow-wrap:anywhere;background:#15191e;color:#d3e7f5;border:1px solid #283a4c;padding:12px;border-radius:5px;font:12px/1.7 Consolas,monospace;margin:8px 0}.ref-example-label{display:block;margin-top:12px}';document.head.append(referenceCardsStyle);
document.querySelector('#ref-words').previousElementSibling.textContent='Associated letters · documented terminology';
document.querySelector('#ref-example').previousElementSibling.textContent='Example and explanation';
document.getElementById('ref-query').dispatchEvent(new Event('input'));
