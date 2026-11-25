'use strict';
// Display-only rasterizer: no grid edges, per-vertex lighting and depth testing.
const surfaceCanvas=document.createElement('canvas'),surfaceCtx=surfaceCanvas.getContext('2d');
let surfacePixels=null,surfaceDepth=null,cacheStock=null,cacheRevision=-1,cacheView='',meshStock=null,meshRevision=-1,mesh=null;
const renderStats={triangles:0,ms:0,hits:0,meshMs:0};
function surfaceGeometry(st){
  if(meshStock===st&&meshRevision===surfaceRevision){renderStats.meshMs=0;return mesh;}
  const meshStart=performance.now();
  const nx=st.nx,ny=st.ny,C=nx+2,R=ny+2;
  const xs=Float64Array.from({length:C},(_,i)=>i===0?st.x0:i===C-1?st.x1:st.x0+(i-.5)*st.dx);
  const ys=Float64Array.from({length:R},(_,i)=>i===0?st.y0:i===R-1?st.y1:st.y0+(i-.5)*st.dy);
  let display=st.h;const passes=Number($('smoothing').value);if(passes){let source=st.h;const tmp=new Float32Array(nx*ny),out=new Float32Array(nx*ny);for(let pass=0;pass<passes;pass++){for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let v=0;for(let k=-2;k<=2;k++)v+=source[y*nx+clamp(x+k,0,nx-1)]*[1,4,6,4,1][k+2];tmp[y*nx+x]=v/16;}for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let v=0;for(let k=-2;k<=2;k++)v+=tmp[clamp(y+k,0,ny-1)*nx+x]*[1,4,6,4,1][k+2];out[y*nx+x]=v/16;}source=out;}display=out;}
  const at=(i,j)=>display[clamp(j,0,ny-1)*nx+clamp(i,0,nx-1)];
  const sample=(x,y)=>{const u=clamp((x-st.x0)/st.dx-.5,0,nx-1),v=clamp((y-st.y0)/st.dy-.5,0,ny-1),i=Math.floor(u),j=Math.floor(v),f=u-i,g=v-j;return (at(i,j)*(1-f)+at(i+1,j)*f)*(1-g)+(at(i,j+1)*(1-f)+at(i+1,j+1)*f)*g;};
  const shade=z=>1-.12*clamp(-z/Math.max(1,st.extent*.15),0,1);
  const lighting=$('lighting').value;
  const light=(nx,ny,nz,z)=>{
    const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
    if(lighting==='original')return (.44+.56*Math.max(0,-.43*nx+.35*ny+.83*nz))*shade(z);
    // Predominantly ambient illumination with a gentle directional component.
    // The vertical component distinguishes walls from floors without emphasizing tiny facets.
    const matte=lighting==='flat';
    return (matte?.86:.80)+(matte?.095:.13)*Math.max(0,nz)+(matte?.025:.065)*(-.55*nx+.45*ny+.35*nz)-.035*clamp(-z/Math.max(1,st.extent*.15),0,1);
  };
  const heights=new Float64Array(C*R),lights=new Float64Array(C*R);
  const radius=lighting==='original'?.5:2.5, reach=Math.ceil(radius)+1;
  for(let j=0;j<R;j++)for(let i=0;i<C;i++){
    const x=xs[i],y=ys[j],k=j*C+i,z=at(i-1,j-1);
    heights[k]=z;
    // Exact flat-region fast path; retain original normal calculation near contours.
    if(at(i-1-reach,j-1)===z&&at(i-1+reach,j-1)===z&&at(i-1,j-1-reach)===z&&at(i-1,j-1+reach)===z&&at(i-1-Math.floor(radius),j-1)===z&&at(i-1+Math.floor(radius),j-1)===z&&at(i-1,j-1-Math.floor(radius))===z&&at(i-1,j-1+Math.floor(radius))===z&&at(i-1-Math.ceil(radius),j-1)===z&&at(i-1+Math.ceil(radius),j-1)===z&&at(i-1,j-1-Math.ceil(radius))===z&&at(i-1,j-1+Math.ceil(radius))===z&&i>0&&i<C-1&&j>0&&j<R-1){lights[k]=light(0,0,1,z);}
    else {
      const gx=(sample(x+st.dx*radius,y)-sample(x-st.dx*radius,y))/(2*radius*st.dx),gy=(sample(x,y+st.dy*radius)-sample(x,y-st.dy*radius))/(2*radius*st.dy);lights[k]=light(-gx,-gy,1,z);}
  }
  // Merge only coplanar, identically lit patches. Curved and detailed areas retain every sample.
  const quads=[];
  function tile(i,j,ii,jj){const a=j*C+i,z=heights[a],l=lights[a];let flat=true;
    scan:for(let y=j;y<=jj;y++)for(let x=i;x<=ii;x++){const k=y*C+x;if(heights[k]!==z||lights[k]!==l){flat=false;break scan;}}
    if(flat||((ii-i)===1&&(jj-j)===1)){quads.push(a,j*C+ii,jj*C+ii,jj*C+i);return;}
    const m=i+Math.floor((ii-i)/2),n=j+Math.floor((jj-j)/2);
    if(ii-i>1&&jj-j>1){tile(i,j,m,n);tile(m,j,ii,n);tile(i,n,m,jj);tile(m,n,ii,jj);}
    else if(ii-i>1){tile(i,j,m,jj);tile(m,j,ii,jj);}
    else {tile(i,j,ii,n);tile(i,n,ii,jj);}
  }
  for(let j=0;j<R-1;j+=16)for(let i=0;i<C-1;i+=16)tile(i,j,Math.min(i+16,C-1),Math.min(j+16,R-1));
  mesh={xs,ys,C,R,heights,lights,quads,light};meshStock=st;meshRevision=surfaceRevision;renderStats.meshMs=performance.now()-meshStart;return mesh;
}
function renderSmoothStock(st,project,w,h){
  const start=performance.now(),W=Math.max(1,Math.round(w*1.6)),H=Math.max(1,Math.round(h*1.6));
  const key=[w,h,yaw,pitch,zoom].join('|');
  if(cacheStock===st&&cacheRevision===surfaceRevision&&cacheView===key){renderStats.hits++;ctx.drawImage(surfaceCanvas,0,0,w,h);renderStats.ms=performance.now()-start;return;}
  if(surfaceCanvas.width!==W||surfaceCanvas.height!==H||!surfacePixels){surfaceCanvas.width=W;surfaceCanvas.height=H;surfacePixels=surfaceCtx.createImageData(W,H);surfaceDepth=new Float32Array(W*H);}
  const rgba=surfacePixels.data;rgba.fill(0);surfaceDepth.fill(Infinity);const sx=W/w,sy=H/h;
  const {xs,ys,C,R,heights,lights,quads,light}=surfaceGeometry(st);
  const projected=new Array(C*R);let triangles=0,minX=W,maxX=-1,minY=H,maxY=-1;
  const vertex=(x,y,z,l)=>{const p=project({x,y,z});return {x:p.x*sx,y:p.y*sy,d:p.d,l};};
  const v=k=>projected[k]||(projected[k]=vertex(xs[k%C],ys[Math.floor(k/C)],heights[k],lights[k]));
  function tri(a,b,c){const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-8)return;
    const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(W-1,Math.ceil(Math.max(a.x,b.x,c.x))),y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(H-1,Math.ceil(Math.max(a.y,b.y,c.y)));
    if(x0>x1||y0>y1)return;triangles++; minX=Math.min(minX,x0);maxX=Math.max(maxX,x1);minY=Math.min(minY,y0);maxY=Math.max(maxY,y1);
    const ux=(b.y-c.y)/den,uy=(c.x-b.x)/den,vx=(c.y-a.y)/den,vy=(a.x-c.x)/den;
    const u0=ux*(x0+.5-c.x)+uy*(y0+.5-c.y),v0=vx*(x0+.5-c.x)+vy*(y0+.5-c.y);
    const ad=a.d-c.d,bd=b.d-c.d,al=a.l-c.l,bl=b.l-c.l;
    for(let y=y0;y<=y1;y++){
      let u=u0+(y-y0)*uy,v=v0+(y-y0)*vy;
      // Clip scanline by the three barycentric half-planes before walking pixels.
      let lo=0,hi=x1-x0,valid=true;
      for(let k=0;k<3;k++){const q=k===0?u:k===1?v:1-u-v, step=k===0?ux:k===1?vx:-ux-vx;
        if(step>1e-14)lo=Math.max(lo,(-.000011-q)/step);
        else if(step< -1e-14)hi=Math.min(hi,(-.000011-q)/step);
        else if(q<-.000011){valid=false;break;}}
      if(!valid||lo>hi)continue;
      const from=Math.max(0,Math.ceil(lo)),to=Math.min(x1-x0,Math.floor(hi));
      u+=ux*from;v+=vx*from;let i=y*W+x0+from;
      for(let x=from;x<=to;x++,u+=ux,v+=vx,i++){
        if(u<-.00001||v<-.00001||1-u-v<-.00001)continue;
        const d=c.d+u*ad+v*bd;if(d>=surfaceDepth[i])continue;surfaceDepth[i]=d;
        const l=c.l+u*al+v*bl,o=i*4;rgba[o]=Math.round(190*l);rgba[o+1]=Math.round(204*l);rgba[o+2]=Math.round(216*l);rgba[o+3]=255;
      }
    }
  }
  const quad=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d);};
  for(let i=0;i<quads.length;i+=4)quad(v(quads[i]),v(quads[i+1]),v(quads[i+2]),v(quads[i+3]));
  const wall=(a,b,nx,ny)=>{const ax=xs[a%C],ay=ys[Math.floor(a/C)],bx=xs[b%C],by=ys[Math.floor(b/C)],az=heights[a],bz=heights[b],z=st.bottom,l=light(nx,ny,0,z);quad(vertex(ax,ay,az,light(nx,ny,0,az)),vertex(bx,by,bz,light(nx,ny,0,bz)),vertex(bx,by,z,l),vertex(ax,ay,z,l));};
  function edge(start,step,count,nx,ny){let a=0;while(a<count-1){let b=a+1;if(heights[start+a*step]===heights[start+b*step])while(b<count-1&&heights[start+(b+1)*step]===heights[start+a*step])b++;wall(start+a*step,start+b*step,nx,ny);a=b;}}
  edge(0,1,C,0,-1);edge((R-1)*C,1,C,0,1);edge(0,C,R,-1,0);edge(C-1,C,R,1,0);
  if($('sharpedges').checked){
    // Screen-space, depth-tested outlines. Detect silhouettes and significant changes
    // in depth slope, rather than drawing triangle or sample-grid edges.
    const ds=surfaceDepth,origin=project({x:0,y:0,z:0}),unit=project({x:1,y:0,z:0});
    const unitY=project({x:0,y:1,z:0});
    const pxPerUnit=Math.max(.001,Math.hypot(unit.x-origin.x,unit.y-origin.y,unitY.x-origin.x,unitY.y-origin.y)/Math.sqrt(1+Math.sin(pitch)**2)*sx);
    const r=3,worldStep=r/pxPerUnit;
    const step2=worldStep*worldStep, tanThreshold=Math.tan(.72);
    const crease=(a,b,c)=>{if(!Number.isFinite(a)||!Number.isFinite(c))return 0;
      const left=b-a,right=c-b, cross=Math.abs(right-left)*worldStep,dot=step2+left*right;
      // Reject shallow angles without expensive inverse trigonometry.
      if(dot>0&&cross<=dot*tanThreshold)return 0;
      return Math.atan2(cross,dot);};
    for(let y=Math.max(1,minY);y<=Math.min(H-2,maxY);y++)for(let x=Math.max(1,minX);x<=Math.min(W-2,maxX);x++){
      const i=y*W+x,d=ds[i];if(!Number.isFinite(d))continue;
      let alpha=(!Number.isFinite(ds[i-1])||!Number.isFinite(ds[i+1])||!Number.isFinite(ds[i-W])||!Number.isFinite(ds[i+W]))?.18:0;
      if(x>=r&&x<W-r&&y>=r&&y<H-r){
        const turn=Math.max(crease(ds[i-r],d,ds[i+r]),crease(ds[i-r*W],d,ds[i+r*W]));
        // Threshold rejects shallow changes; use a subdued, antialiased-like line.
        alpha=Math.max(alpha,.14*clamp((turn-.72)/.50,0,1));
      }
      if(alpha){const o=i*4;rgba[o]*=1-alpha;rgba[o+1]*=1-alpha;rgba[o+2]*=1-alpha;}
    }
  }
  surfaceCtx.putImageData(surfacePixels,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(surfaceCanvas,0,0,w,h);
  cacheStock=st;cacheRevision=surfaceRevision;cacheView=key;renderStats.triangles=triangles;renderStats.ms=performance.now()-start;
}
