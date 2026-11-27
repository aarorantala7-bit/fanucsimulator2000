'use strict';
// Hybrid display backend: the existing CPU mesh and lighting values feed WebGL2.
// Stock data, program handling and the software renderer are unchanged.
let hybrid=null, hybridFailed=false, backendLabel='CPU', hybridReason='Not initialized';
function createHybrid(){
 const cv=document.createElement('canvas');
 const gl=cv.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true,depth:false,powerPreference:'high-performance'});
 if(!gl)throw Error('WebGL 2 unavailable');
 const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}return s;};
 const program=(vs,fs)=>{const v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;};
 const meshProgram=program(`#version 300 es
 precision highp float;
 layout(location=0) in vec4 vertex;
 uniform vec2 center, ratio, angle, tilt;
 uniform float depthRange;
 out float tone;
 void main(){vec2 p=vertex.xy-center;float u=p.x*angle.x-p.y*angle.y;float v=p.x*angle.y+p.y*angle.x;gl_Position=vec4(u*ratio.x,-0.1+(v*tilt.x+vertex.z*tilt.y)*ratio.y,(v*tilt.y-vertex.z*tilt.x)/depthRange,1.0);tone=vertex.w;}
 `,`#version 300 es
 precision highp float;in float tone;uniform vec3 material;out vec4 color;void main(){color=vec4(material*tone,1.);}`);
 const postProgram=program(`#version 300 es
 precision highp float;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`,
 `#version 300 es
 precision highp float;precision highp sampler2D;
 uniform sampler2D colors, depths;uniform ivec2 size;uniform float depthRange, worldStep;uniform bool outlines;out vec4 color;
 float d(ivec2 p){if(any(lessThan(p,ivec2(0)))||any(greaterThanEqual(p,size)))return 1.;return texelFetch(depths,p,0).r;}
 float crease(float a,float b,float c){if(a>=1.||c>=1.)return 0.;float l=(b-a)*depthRange*2.,r=(c-b)*depthRange*2.;float cr=abs(r-l)*worldStep,dt=worldStep*worldStep+l*r;if(dt>0.&&cr<=dt*0.8770679)return 0.;return atan(cr,dt);}
 void main(){ivec2 p=ivec2(gl_FragCoord.xy);color=texelFetch(colors,p,0);if(color.a<0.5||!outlines)return;float b=d(p);float a=0.;if(d(p+ivec2(1,0))>=1.||d(p-ivec2(1,0))>=1.||d(p+ivec2(0,1))>=1.||d(p-ivec2(0,1))>=1.)a=.18;
 float t=max(crease(d(p-ivec2(3,0)),b,d(p+ivec2(3,0))),crease(d(p-ivec2(0,3)),b,d(p+ivec2(0,3))));a=max(a,.14*clamp((t-.72)/.5,0.,1.));color.rgb*=1.-a;}`);
 const loc=(p,names)=>Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)]));
 const mu=loc(meshProgram,['center','ratio','angle','tilt','depthRange','material']),pu=loc(postProgram,['colors','depths','size','depthRange','worldStep','outlines']);
 const vao=gl.createVertexArray(),buffer=gl.createBuffer(),postVao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,16,0);gl.bindVertexArray(null);
 const fbo=gl.createFramebuffer(),color=gl.createTexture(),depth=gl.createTexture();
 const maxSize=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
 const h={cv,gl,meshProgram,postProgram,mu,pu,vao,buffer,postVao,fbo,color,depth,maxSize,W:0,H:0,mesh:null,st:null,count:0,key:'',lost:false};
 cv.addEventListener('webglcontextlost',e=>{e.preventDefault();h.lost=true;hybridReason='WebGL context lost';dirty=true;});
 cv.addEventListener('webglcontextrestored',()=>{if(hybrid===h){hybrid=null;hybridFailed=false;dirty=true;}});
 return h;
}
function resizeHybrid(h,W,H){
 const {gl,cv,fbo,color,depth}=h;if(h.W===W&&h.H===H)return;
 cv.width=W;cv.height=H;h.W=W;h.H=H;h.key='';
 gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
 const tex=(t,internal,format,type,attachment)=>{gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,internal,W,H,0,format,type,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,attachment,gl.TEXTURE_2D,t,0);};
 tex(color,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,gl.COLOR_ATTACHMENT0);tex(depth,gl.DEPTH_COMPONENT24,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,gl.DEPTH_ATTACHMENT);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Framebuffer incomplete');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}
function uploadHybrid(h,st,m){
 if(h.mesh===m&&h.st===st)return;
 const {xs,ys,C,R,heights,lights,quads,light}=m;
 // Preallocate top faces and a worst-case outer wall buffer. Upload only used bytes.
 const need=(quads.length/4+2*(C+R))*24;if(!h.vbuf||h.vbuf.length<need)h.vbuf=new Float32Array(Math.ceil(need*1.25));const verts=h.vbuf;/* reused across uploads */let n=0;
 const point=(x,y,z,l)=>{verts[n++]=x;verts[n++]=y;verts[n++]=z;verts[n++]=l;};
 const v=k=>point(xs[k%C],ys[Math.floor(k/C)],heights[k],lights[k]);
 for(let i=0;i<quads.length;i+=4){const a=quads[i],b=quads[i+1],c=quads[i+2],d=quads[i+3];v(a);v(b);v(c);v(a);v(c);v(d);}
 const wall=(a,b,nx,ny)=>{const ax=xs[a%C],ay=ys[Math.floor(a/C)],bx=xs[b%C],by=ys[Math.floor(b/C)],az=heights[a],bz=heights[b],z=st.bottom,l=light(nx,ny,0,z),al=light(nx,ny,0,az),bl=light(nx,ny,0,bz);point(ax,ay,az,al);point(bx,by,bz,bl);point(bx,by,z,l);point(ax,ay,az,al);point(bx,by,z,l);point(ax,ay,z,l);};
 function edge(start,step,count,nx,ny){let a=0;while(a<count-1){let b=a+1;if(heights[start+a*step]===heights[start+b*step])while(b<count-1&&heights[start+(b+1)*step]===heights[start+a*step])b++;wall(start+a*step,start+b*step,nx,ny);a=b;}}
 edge(0,1,C,0,-1);edge((R-1)*C,1,C,0,1);edge(0,C,R,-1,0);edge(C-1,C,R,1,0);
 h.gl.bindBuffer(h.gl.ARRAY_BUFFER,h.buffer);h.gl.bufferData(h.gl.ARRAY_BUFFER,verts.subarray(0,n),h.gl.DYNAMIC_DRAW);h.count=n/4;h.mesh=m;h.st=st;h.key='';
}
let hqTimer=0;
function renderHybridStock(st,project,w,h){
 const start=performance.now();if(w<1||h<1)return false;
 if($('backend').value==='cpu'){hybridReason='Software selected';return false;}
 if(hybridFailed)return false;
 try{
  if(!hybrid)hybrid=createHybrid();const g=hybrid,gl=g.gl;if(g.lost||gl.isContextLost())return false;
  // Perf LOD: render at 1x while orbiting or playing, at the full supersample once idle.
  const moving=!!drag||playing;if(moving){clearTimeout(hqTimer);hqTimer=setTimeout(()=>{dirty=true;},180);}
  const supersample=moving?Math.min(1,g.maxSize/w,g.maxSize/h):Math.min(cadSampleScale(w,h),g.maxSize/w,g.maxSize/h);const W=Math.max(1,Math.round(w*supersample)),H=Math.max(1,Math.round(h*supersample));resizeHybrid(g,W,H);
  const m=surfaceGeometry(st);uploadHybrid(g,st,m);
  const key=[w,h,W,H,yaw,pitch,zoom,$('sharpedges').checked].join('|');
  if(g.key!==key){
   const scale=Math.min(w,h)*.70/Math.max(st.extent,Math.abs(st.bottom)*1.5,st.maxZ*1.3)*zoom,range=Math.max(1,(st.extent+Math.abs(st.bottom)+Math.abs(st.maxZ)+1)*2);
   gl.viewport(0,0,W,H);gl.bindFramebuffer(gl.FRAMEBUFFER,g.fbo);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.useProgram(g.meshProgram);gl.bindVertexArray(g.vao);gl.uniform2f(g.mu.center,st.cx,st.cy);gl.uniform2f(g.mu.ratio,2*scale/w,2*scale/h);gl.uniform2f(g.mu.angle,Math.cos(yaw),Math.sin(yaw));gl.uniform2f(g.mu.tilt,Math.sin(pitch),Math.cos(pitch));gl.uniform1f(g.mu.depthRange,range);gl.uniform3fv(g.mu.material,cadMaterial().map(x=>x/255));gl.drawArrays(gl.TRIANGLES,0,g.count);
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.DEPTH_TEST);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(g.postProgram);gl.bindVertexArray(g.postVao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,g.color);gl.uniform1i(g.pu.colors,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,g.depth);gl.uniform1i(g.pu.depths,1);gl.uniform2i(g.pu.size,W,H);gl.uniform1f(g.pu.depthRange,range);gl.uniform1f(g.pu.worldStep,3/Math.max(.001,scale*W/w));gl.uniform1i(g.pu.outlines,$('sharpedges').checked?1:0);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(null);g.key=key;
  g.layerKey='';}else renderStats.hits++;
  // Perf: composite (with the soft shadow blur) into a cached 2D layer only when the GL image changed; frames just blit it.
  const lk=[w,h,ctx.getTransform().a,$('softshadow').checked].join('|');if(g.layerKey===''&&g.key!==g.layerFor){/* GL image changed this frame (orbit): blit it directly, cache only once it stays still */g.layerFor=g.key;compositeStock(g.cv,w,h);}else if(g.layerKey!==lk){const L=g.layer||(g.layer=document.createElement('canvas'));const d=ctx.getTransform().a;L.width=Math.round(w*d);L.height=Math.round(h*d);const lc=L.getContext('2d');lc.setTransform(d,0,0,d,0,0);lc.clearRect(0,0,w,h);lc.imageSmoothingEnabled=true;lc.imageSmoothingQuality='high';if($('softshadow').checked){lc.shadowColor='rgba(42,56,74,0.23)';lc.shadowBlur=18;lc.shadowOffsetY=8;}lc.drawImage(g.cv,0,0,w,h);g.layerKey=lk;ctx.drawImage(g.layer,0,0,w,h);}else ctx.drawImage(g.layer,0,0,w,h);renderStats.triangles=g.count/3;renderStats.ms=performance.now()-start;backendLabel='WebGL 2';hybridReason='WebGL 2 active (browser may use software graphics)';return true;
 }catch(e){hybridFailed=true;hybridReason='Fallback: '+String(e.message||e).slice(0,180);console.warn('Hybrid renderer:',e);return false;}
}
