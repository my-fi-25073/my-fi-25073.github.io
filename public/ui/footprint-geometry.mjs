import * as THREE from 'three';

export function arcPoints(g){
  const [a,b,c]=[g.start,g.mid,g.end],d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));
  if(Math.abs(d)<1e-10)throw Error('퇴화된 원호');
  const norm=p=>p[0]*p[0]+p[1]*p[1];
  const x=(norm(a)*(b[1]-c[1])+norm(b)*(c[1]-a[1])+norm(c)*(a[1]-b[1]))/d;
  const y=(norm(a)*(c[0]-b[0])+norm(b)*(a[0]-c[0])+norm(c)*(b[0]-a[0]))/d;
  const angles=[a,b,c].map(p=>Math.atan2(p[1]-y,p[0]-x)),tau=Math.PI*2,mod=n=>(n%tau+tau)%tau;
  let sweep=mod(angles[2]-angles[0]);if(mod(angles[1]-angles[0])>sweep+1e-7)sweep-=tau;
  const radius=Math.hypot(a[0]-x,a[1]-y),steps=Math.max(8,Math.ceil(Math.abs(sweep)*radius/.035));
  return Array.from({length:steps+1},(_,i)=>{const t=angles[0]+sweep*i/steps;return [x+radius*Math.cos(t),y+radius*Math.sin(t)];});
}
export function polygonPoints(segments){return segments.flatMap(s=>s.type==='point'?[s.point]:arcPoints(s));}
export function graphicPoints(g){
  if(g.type==='line')return [g.start,g.end];
  if(g.type==='arc')return arcPoints(g);
  if(g.type==='rect'){const [x,y]=g.start,[u,v]=g.end;return [[x,y],[u,y],[u,v],[x,v],[x,y]];}
  if(g.type==='poly'){const p=polygonPoints(g.segments);return [...p,p[0]];}
  if(g.type==='circle'){const r=Math.hypot(g.end[0]-g.center[0],g.end[1]-g.center[1]);return Array.from({length:97},(_,i)=>[g.center[0]+r*Math.cos(i*Math.PI/48),g.center[1]+r*Math.sin(i*Math.PI/48)]);}
  throw Error('지원하지 않는 그래픽 '+g.type);
}
export function contour(shape,size,ratio=0){
  const [w,h=w]=size;
  if(shape==='circle')return Array.from({length:96},(_,i)=>[w/2*Math.cos(i*Math.PI/48),h/2*Math.sin(i*Math.PI/48)]);
  if(shape==='rect')return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
  if(!['oval','roundrect'].includes(shape))throw Error('지원하지 않는 패드 '+shape);
  const r=shape==='oval'?Math.min(w,h)/2:Math.min(w,h)*ratio,points=[];
  for(const [x,y,start] of [[w/2-r,h/2-r,0],[-w/2+r,h/2-r,90],[-w/2+r,-h/2+r,180],[w/2-r,-h/2+r,270]])for(let j=0;j<=16;j++){const t=(start+j*90/16)*Math.PI/180;points.push([x+r*Math.cos(t),y+r*Math.sin(t)]);}
  return points;
}
export function worldContour(p,drill=false){
  const d=drill?p.drill:null,pts=contour(d?d.shape:p.shape,d?d.size:p.size,p.roundrectRatio),theta=(p.angle||0)*Math.PI/180;
  return pts.map(([x,y])=>{x+=d?.offset[0]||0;y+=d?.offset[1]||0;return [p.x+x*Math.cos(theta)+y*Math.sin(theta),p.y-x*Math.sin(theta)+y*Math.cos(theta)];});
}
export function path(points,hole=false){
  const pts=points.map(([x,y])=>new THREE.Vector2(x,-y));
  const ordered=THREE.ShapeUtils.isClockWise(pts)===hole?pts:[...pts].reverse();
  const out=hole?new THREE.Path(ordered):new THREE.Shape(ordered);out.closePath();return out;
}
export function expandLayers(layers){return [...new Set(layers.flatMap(l=>l==='*.Cu'?['F.Cu','B.Cu']:l==='*.Mask'?['F.Mask','B.Mask']:l))];}
export function wallGeometry(points,depth){
  const vertices=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];vertices.push(a[0],-a[1],0,b[0],-b[1],0,b[0],-b[1],-depth,a[0],-a[1],0,b[0],-b[1],-depth,a[0],-a[1],-depth);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}
