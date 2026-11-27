'use strict';
// Camtek WinCAM NC program files (.cnc / .nc / .txt): ISO/FANUC text written by the WinCAM postprocessor,
// CRLF line ends, a "%" start and end line and an "O0003(COMMENT)" program line. Import keeps the file's own
// layout in `meta` so export writes it back byte for byte (trailing spaces included). UMD: Node tests + browser.
(function(root){
const CP1252_HI={0x80:0x20AC,0x82:0x201A,0x83:0x0192,0x84:0x201E,0x85:0x2026,0x86:0x2020,0x87:0x2021,0x88:0x02C6,0x89:0x2030,0x8A:0x0160,0x8B:0x2039,0x8C:0x0152,0x8E:0x017D,0x91:0x2018,0x92:0x2019,0x93:0x201C,0x94:0x201D,0x95:0x2022,0x96:0x2013,0x97:0x2014,0x98:0x02DC,0x99:0x2122,0x9A:0x0161,0x9B:0x203A,0x9C:0x0153,0x9E:0x017E,0x9F:0x0178};
const UNI2CP=Object.fromEntries(Object.entries(CP1252_HI).map(([k,v])=>[v,+k]));
// WinCAM runs on Finnish Windows: files without valid UTF-8 are windows-1252 (Ä/Ö in comments).
function decode(bytes){const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 try{const s=new TextDecoder('utf-8',{fatal:true}).decode(u8);return {text:s.replace(/^\uFEFF/,''),encoding:'utf-8',bom:s.charCodeAt(0)===0xFEFF};}catch(e){}
 let s='';for(const b of u8)s+=String.fromCharCode(CP1252_HI[b]||b);return {text:s,encoding:'windows-1252',bom:false};}
function encode(text,encoding='windows-1252'){if(encoding==='utf-8')return new TextEncoder().encode(text);const out=new Uint8Array(text.length);let i=0;for(const ch of text){const c=ch.codePointAt(0);out[i++]=c<256&&!(c>=0x80&&c<0xA0)?c:(UNI2CP[c]||0x3F);}return out.slice(0,i);}
// Text → editor text (LF) + the layout needed to write it back.
function importText(raw){const s=String(raw);const crlf=(s.match(/\r\n/g)||[]).length,lf=(s.match(/(^|[^\r])\n/g)||[]).length;
 const eol=crlf>=lf&&crlf>0?'\r\n':'\n';const finalNewline=/\n$/.test(s);
 const text=s.replace(/\r\n?/g,'\n').replace(/\n$/,'');const lines=text.split('\n');
 const percentStart=lines[0]!==undefined&&lines[0].trim()==='%';const percentEnd=lines.length>1&&lines[lines.length-1].trim()==='%';
 const oLine=lines.find(l=>/^\s*O\d+/.test(l));const m=oLine&&/^\s*O(\d+)\s*(\(([^)]*)\))?/.exec(oLine);
 return {text,meta:{format:'wincam',eol,finalNewline,percentStart,percentEnd,oNumber:m?m[1]:null,comment:m&&m[3]!==undefined?m[3]:null}};}
// Editor text → WinCAM file text: CRLF, "%" first and last lines, an O-number line with a comment, final CRLF.
function exportText(text,meta={}){const eol=meta.eol||'\r\n';let lines=String(text).replace(/\r\n?/g,'\n').replace(/\n+$/,'').split('\n');
 if(lines.length===1&&lines[0]==='')lines=[];
 while(lines.length&&lines[0].trim()==='')lines.shift();
 if(!lines.length||lines[0].trim()!=='%')lines.unshift('%');
 let oi=lines.findIndex(l=>/^\s*O\d+/.test(l));
 if(oi<0){const num=String(meta.oNumber||'0001').padStart(4,'0');lines.splice(1,0,`O${num}(${(meta.comment||'FANUC SIMULATOR').toUpperCase().replace(/[()]/g,'')})`);}
 else if(!/\(/.test(lines[oi]))lines[oi]=lines[oi].replace(/^(\s*O\d+)/,`$1(${(meta.comment||'FANUC SIMULATOR').toUpperCase().replace(/[()]/g,'')})`);
 if(lines.length<3||lines[lines.length-1].trim()!=='%'){if(!lines.slice(1).some(l=>/\bM(30|02|2|99)\b/.test(l)))lines.push('M30');lines.push('%');}
 return lines.join(eol)+(meta.finalNewline===false?'':eol);}
function fileName(text,fallback='program'){const m=/^\s*O(\d+)/m.exec(text);return (m?'O'+m[1]:fallback)+'.cnc';}
// Tools the program uses, for the tool table: T number, H/D numbers used while it is active (mill) or the
// offset numbers of Txxyy (lathe), the first block that calls it, and a name from a comment right after the call
// ("T3M6 (FACE MILL 50)", "T0303 (VNMG R0.4)"). WinCAM writes no tool geometry into the program, so none is read.
function listTools(text,machine='mill'){const lines=String(text).replace(/\r\n?/g,'\n').split('\n');const map=new Map();let cur=null;
 const get=id=>{if(!map.has(id))map.set(id,{id,name:null,h:[],d:[],offsets:[],first:null,calls:0});return map.get(id);};
 const add=(arr,v)=>{if(v>0&&!arr.includes(v))arr.push(v);};
 lines.forEach((line,i)=>{const code=line.replace(/\([^)]*\)?/g,m=>' '.repeat(m.length)).toUpperCase();if(/^\s*[\/]?\s*(IF|WHILE|#)/.test(code))return;
  const n=/^\s*\/?\s*N(\d+)/.exec(code);const words=[...code.matchAll(/([A-Z])\s*([-+]?\d*\.?\d+)/g)];
  for(const w of words){const a=w[1],v=w[2];
   if(a==='T'&&/^\d+$/.test(v)){let id=+v,ofs=0;if(machine==='lathe'){if(v.length>=3){id=Math.floor(+v/100);ofs=+v%100;}else{id=Math.floor(+v/10);ofs=+v%10;}}
    if(id<=0)continue;const t=get(id);t.calls++;if(!t.first)t.first={line:i+1,n:n?+n[1]:null};add(t.offsets,ofs);cur=t;
    if(!t.name){const m=/^\s*(?:[A-Z]\s*[-+]?[\d.]+\s*)*\(([^)]*)\)/i.exec(line.slice(w.index+w[0].length));if(m&&m[1].trim())t.name=m[1].trim();}}
   else if(cur&&machine!=='lathe'&&(a==='H'||a==='D')&&/^\d+$/.test(v))add(a==='H'?cur.h:cur.d,+v);}});
 return [...map.values()].sort((a,b)=>a.id-b.id);}
const firstBlock=t=>t.first?(t.first.n!=null?'N'+t.first.n:'line '+t.first.line):'';
const EXTENSIONS=['.cnc','.nc','.txt','.ncc','.tap','.iso'];
const api={decode,encode,importText,exportText,fileName,listTools,firstBlock,EXTENSIONS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WinCam=api;
})(typeof globalThis!=='undefined'?globalThis:this);
