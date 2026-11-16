import * as THREE from 'three';
import clipping from 'polygon-clipping';

const snap=v=>Math.round(v*1e7)/1e4; // metres -> mm, 0.1 µm seam tolerance
const area=r=>r.reduce((sum,p,i)=>{const q=r[(i+1)%r.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
function inside(p,r){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}

function outlines(meshes,axis,plane){
  const axes=[0,1,2].filter(a=>a!==axis),edges=new Map(),points=new Map(),faces=[];
  for(const mesh of meshes){const g=mesh.geometry,p=g.attributes.position,count=g.index?g.index.count:p.count;
    for(let i=0;i<count;i+=3){const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,g.index?g.index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      if(!v.every(p=>Math.abs(p.getComponent(axis)-plane)<1e-8))continue;
      const xy=v.map(p=>axes.map(a=>snap(p.getComponent(a))));if(Math.abs(area(xy))<1e-10)continue;
      faces.push([xy]);
      const keys=xy.map(p=>{const k=p.join(',');points.set(k,p);return k;});
      for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],key=[a,b].sort().join('|');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
    }
  }
  const links=new Map();for(const [a,b] of edges.values()){for(const [x,y] of [[a,b],[b,a]]){if(!links.has(x))links.set(x,[]);links.get(x).push(y);}}
  if([...links.values()].some(list=>list.length!==2)){
    // Overlapping CAD faces / T-junctions require exact triangle union before
    // extracting boundaries. This uses the same source faces, not guessed holes.
    const batches=[];for(let i=0;i<faces.length;i+=512)batches.push(clipping.union(...faces.slice(i,i+512)));
    const polygons=clipping.union(...batches);return {polygons,holes:polygons.flatMap(p=>p.slice(1).map(r=>[r]))};
  }
  const visited=new Set(),rings=[];
  for(const start of links.keys()){if(visited.has(start))continue;let prev=null,current=start;const ring=[];
    do{if(visited.has(current))throw Error('솔더마스크 절단: 교차 원본 경계');visited.add(current);ring.push(points.get(current));const next=links.get(current).find(k=>k!==prev);prev=current;current=next;}while(current!==start);
    if(ring.length>=3)rings.push(ring);
  }
  rings.sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
  const entries=rings.map((ring,i)=>{const parent=rings.findIndex((r,j)=>j<i&&inside(ring[0],r));return {ring,parent,depth:0};});
  // Use the smallest enclosing ring, not the first (largest) one.
  for(let i=0;i<entries.length;i++){for(let j=i-1;j>=0;j--)if(inside(entries[i].ring[0],entries[j].ring)){entries[i].parent=j;entries[i].depth=entries[j].depth+1;break;}}
  const polygons=[],owners=new Map();for(let i=0;i<entries.length;i++){const e=entries[i];if(e.depth%2===0){owners.set(i,polygons.length);polygons.push([e.ring]);}else polygons[owners.get(e.parent)].push(e.ring);}
  return {polygons,holes:entries.filter(e=>e.depth%2===1).map(e=>[e.ring])};
}

export function openSoldermaskHoles(root,substrateMaterials,maskMaterials,axis){
  root.updateMatrixWorld(true);const solids=[],groups=new Map();
  const surfaceMaterials=new Set(maskMaterials),surfaceMeshes=[];
  root.traverse(o=>{if(!o.isMesh)return;if(substrateMaterials.includes(o.material))solids.push(o);if(/_(copper|pad|via|silkscreen|soldermask)(?:_|$)/.test(o.name))surfaceMaterials.add(o.material);});
  root.traverse(o=>{if(o.isMesh&&surfaceMaterials.has(o.material))surfaceMeshes.push(o);});
  const bounds=new THREE.Box3();for(const mesh of solids)bounds.union(new THREE.Box3().setFromObject(mesh));
  const top=outlines(solids,axis,bounds.max.getComponent(axis)),bottom=outlines(solids,axis,bounds.min.getComponent(axis));
  if(!top.polygons.length||!bottom.polygons.length)throw Error('솔더마스크 절단: 기판 표면 경계 없음');
  const holes=top.holes.length&&bottom.holes.length?clipping.intersection(top.holes,bottom.holes):[];
  const result={throughHoles:holes.length,sides:[]};if(!holes.length)return result;
  const low=bounds.min.getComponent(axis),high=bounds.max.getComponent(axis),depth=high-low;
  for(const mesh of surfaceMeshes){const g=mesh.geometry,p=g.attributes.position,count=g.index?g.index.count:p.count,planes=new Map(),keep=[];
    for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j),heights=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld).getComponent(axis)),plane=heights[0];
      const planar=Math.max(...heights)-Math.min(...heights)<1e-8,nearFace=Math.min(Math.abs(plane-low),Math.abs(plane-high))<depth*.15;
      if(!planar||!nearFace){keep.push(...ids);continue;}const key=plane.toFixed(8);if(!planes.has(key))planes.set(key,[]);planes.get(key).push(...ids);
    }
    for(const [plane,ids]of planes){const part=new THREE.Mesh(g.clone(),mesh.material);part.geometry.setIndex(ids);part.matrixWorld.copy(mesh.matrixWorld);part.userData={...mesh.userData};part.name=mesh.name;const key=mesh.material.uuid+'|'+plane;if(!groups.has(key))groups.set(key,{material:mesh.material,plane:Number(plane),meshes:[]});groups.get(key).meshes.push(part);}
    if(planes.size){if(keep.length){mesh.geometry=g.clone();mesh.geometry.setIndex(keep);}else mesh.removeFromParent();}
  }
  const axes=[0,1,2].filter(a=>a!==axis),inverse=root.matrixWorld.clone().invert();
  for(const {material,plane,meshes}of groups.values()){
    if(material.map||material.alphaMap)throw Error('솔더마스크 절단: 텍스처가 있는 원본은 지원하지 않습니다.');
    const source=outlines(meshes,axis,plane).polygons,opened=clipping.difference(source,holes);
    const removed=clipping.intersection(source,holes).reduce((sum,poly)=>sum+Math.abs(area(poly[0]))-poly.slice(1).reduce((s,r)=>s+Math.abs(area(r)),0),0);
    const positions=[],indices=[];for(const polygon of opened){const rings=polygon.map(r=>r.slice(0,-1).map(p=>new THREE.Vector2(...p))),triangles=THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1)),vertices=rings.flat(),offset=positions.length/3;
      for(const p of vertices){const v=new THREE.Vector3();v.setComponent(axis,plane);v.setComponent(axes[0],p.x/1000);v.setComponent(axes[1],p.y/1000);v.applyMatrix4(inverse);positions.push(...v.toArray());}
      for(const tri of triangles)indices.push(...tri.map(i=>i+offset));
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    // Keep the exported face direction, including the bottom face.
    if(indices.length){const normal=new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal,indices[0]).transformDirection(root.matrixWorld);const sign=plane>(low+high)/2?1:-1;if(normal.getComponent(axis)*sign<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];geometry.setIndex(indices);geometry.computeVertexNormals();}}
    if(indices.length){const replacement=new THREE.Mesh(geometry,material);replacement.userData={...meshes[0].userData};replacement.name=meshes[0].name;root.add(replacement);}else geometry.dispose();for(const mesh of meshes)mesh.geometry.dispose();
    result.sides.push({side:plane>(low+high)/2?'front':'back',openedAreaMm2:+removed.toFixed(4)});
  }
  return result;
}
