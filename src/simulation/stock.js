'use strict';
function makeStock(){if(stockConfig){const {x,y,z}=stockConfig,extent=Math.max(x,y,10),nx=clamp(Math.ceil(x/extent*320),10,320),ny=clamp(Math.ceil(y/extent*320),10,320);let maxZ=0;for(const s of segs)maxZ=Math.max(maxZ,s.a.z,s.b.z);return {x0:-x/2,x1:x/2,y0:-y/2,y1:y/2,nx,ny,dx:x/nx,dy:y/ny,bottom:-z,maxZ,extent,cx:0,cy:0,h:new Float32Array(nx*ny)};}let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=0,maxZ=0;for(const s of segs){for(const p of [s.a,s.b]){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)}}if(!segs.length){minX=minY=-25;maxX=maxY=25;}const pad=Math.max(8,Math.max(maxX-minX,maxY-minY)*.12);const x0=minX-pad,x1=maxX+pad,y0=minY-pad,y1=maxY+pad;const extent=Math.max(x1-x0,y1-y0,10);const nx=clamp(Math.ceil((x1-x0)/extent*320),10,320),ny=clamp(Math.ceil((y1-y0)/extent*320),10,320);return {x0,x1,y0,y1,nx,ny,dx:(x1-x0)/nx,dy:(y1-y0)/ny,bottom:Math.min(minZ-4,-extent*.12),maxZ,extent,cx:(x0+x1)/2,cy:(y0+y1)/2,h:new Float32Array(nx*ny)}}
function makeSamples(){samples=[];for(let i=0;i<segs.length;i++){const s=segs[i];const d=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y,s.b.z-s.a.z);const n=clamp(Math.ceil(d/Math.min(stock.dx,stock.dy)*1.8*54/320),1,100);for(let j=1;j<=n;j++){samples.push({p:lerp(s.a,s.b,j/n),i});if(samples.length>=100000)return;}}}
// Continuous swept 2D profile for the virtual surface. No machine control or process physics.
function cut(sample){
  const s=segs[sample.i],b=sample.p,t=tools.get(s.tool),last=samples[position-2],a=last&&last.i===sample.i?last.p:s.a;
  if(s.rapid||!t||Math.min(a.z,b.z)>=0)return;
  const r=t.width/2,rr=r*r,st=stock,vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z,ll=vx*vx+vy*vy;
  const loX=clamp(Math.floor((Math.min(a.x,b.x)-r-st.x0)/st.dx),0,st.nx-1),hiX=clamp(Math.floor((Math.max(a.x,b.x)+r-st.x0)/st.dx),0,st.nx-1),loY=clamp(Math.floor((Math.min(a.y,b.y)-r-st.y0)/st.dy),0,st.ny-1),hiY=clamp(Math.floor((Math.max(a.y,b.y)+r-st.y0)/st.dy),0,st.ny-1);
  const cr=clamp(t.corner||1,.0001,r), profile=d2=>t.shape==='ball'?r-Math.sqrt(Math.max(0,rr-d2)):t.shape==='point'?Math.sqrt(d2)/r*t.tip:t.shape==='round'?cr-Math.sqrt(Math.max(0,cr*cr-Math.max(0,Math.sqrt(d2)-(r-cr))**2)):0;
  for(let y=loY;y<=hiY;y++)for(let x=loX;x<=hiX;x++){
    const px=st.x0+(x+.5)*st.dx-a.x,py=st.y0+(y+.5)*st.dy-a.y;
    let z;
    if(ll<1e-12){const d2=px*px+py*py;if(d2>rr)continue;z=Math.min(a.z,b.z)+profile(d2);}
    else{
      const center=(px*vx+py*vy)/ll,perp=(px-center*vx)**2+(py-center*vy)**2;
      if(perp>rr)continue;
      const half=Math.sqrt(Math.max(0,(rr-perp)/ll)),lo=Math.max(0,center-half),hi=Math.min(1,center+half);
      if(lo>hi)continue;
      if(Math.abs(vz)<1e-10){const u=clamp(center,lo,hi);z=a.z+profile(perp+ll*(u-center)**2);}
      else if(t.shape==='flat'){z=a.z+vz*(vz>0?lo:hi);}
      else {const f=u=>a.z+vz*u+profile(perp+ll*(u-center)**2);let l=lo,h=hi;for(let j=0;j<12;j++){const u=(2*l+h)/3,v=(l+2*h)/3;if(f(u)<f(v))h=v;else l=u;}z=Math.min(f(lo),f(hi),f((l+h)/2));}
    }
    const k=y*st.nx+x;const next=Math.fround(Math.max(st.bottom,Math.min(st.h[k],z)));if(next!==st.h[k]){st.h[k]=next;surfaceRevision++;}
  }
}
function rebuildStock(target){stock.h.fill(0);surfaceRevision++;position=0;advance(target);dirty=true;}
function advance(target){target=clamp(target,0,samples.length);if(target<position){stock.h.fill(0);surfaceRevision++;position=0}while(position<target)cut(samples[position++]);dirty=true;updateHUD();}
function install(s,notes,m){$('macrotrace').dataset.idx='';playing=false;mode=m;segs=s;const old=tools;buildTools(old);stock=makeStock();makeSamples();position=0;zoom=1;const diagnostic=[`${segs.length} path segments · ${tools.size} virtual tools`,...notes];if(samples.length>=100000)diagnostic.push('Playback sample limit reached; preview may be truncated.');$('diagnostics').textContent=diagnostic.join('\n');$('seek').max=samples.length;$('play').disabled=$('step').disabled=!samples.length;updateHUD();dirty=true;}
