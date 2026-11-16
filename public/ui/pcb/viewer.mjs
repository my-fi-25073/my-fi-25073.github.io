import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TrackballControls} from 'three/addons/controls/TrackballControls.js';
import {mergeGeometries,deinterleaveAttribute} from 'three/addons/utils/BufferGeometryUtils.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {openSoldermaskHoles} from './soldermask-holes.mjs';
const $=s=>document.querySelector(s),host=$('#viewport');
const params=new URLSearchParams(location.search),embedded=params.has('embed'),poster=params.has('poster'),editable=params.get('edit')==='1'||(!embedded&&!poster&&['127.0.0.1','localhost'].includes(location.hostname));
document.documentElement.dataset.pcbMode=poster?'poster':embedded?'embed':'full';
document.documentElement.dataset.pcbEditable=String(editable);
try{
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;host.prepend(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.00001,1000);
  // Symmetric studio reflections: equal illumination on opposing faces, with
  // broad bright panels and darker gaps for metal to reflect.
  const envPixels=new Float32Array(256*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<256;x++){
    const theta=(y+.5)/128*Math.PI,phi=(x+.5)/256*Math.PI*2;
    const v=[Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];
    const intensity=.55+2.4*v.reduce((sum,n)=>sum+Math.pow(Math.abs(n),32),0),i=(y*256+x)*4;
    envPixels.set([intensity,intensity,intensity,1],i);
  }
  const environment=new THREE.DataTexture(envPixels,256,128,THREE.RGBAFormat,THREE.FloatType);environment.mapping=THREE.EquirectangularReflectionMapping;environment.needsUpdate=true;
  const pmrem=new THREE.PMREMGenerator(renderer),envMap=pmrem.fromEquirectangular(environment);scene.environment=envMap.texture;scene.environmentIntensity=1;environment.dispose();pmrem.dispose();
  const composer=new EffectComposer(renderer);
  const samples=Math.min(4,renderer.capabilities.maxSamples);composer.renderTarget1.samples=samples;composer.renderTarget2.samples=samples;
  composer.addPass(new RenderPass(scene,camera));
  const ao=new GTAOPass(scene,camera,1,1);ao.updateGtaoMaterial({radius:.0025,thickness:.0003,distanceExponent:1,distanceFallOff:1,scale:1,samples:16,screenSpaceRadius:false});ao.updatePdMaterial({radius:2});ao.blendIntensity=.7;composer.addPass(ao);const output=new OutputPass();composer.addPass(output);
  const antialias=new SMAAPass();composer.addPass(antialias);
  const modelRoot=new THREE.Group();scene.add(modelRoot);let controls,span=1,normal=1,diagonal=1,generation=0,currentModel=null,currentView='top';
  const colorRoles=[['leftMask','왼쪽 보드'],['rightMask','오른쪽 보드'],['frontMask','앞면 보드'],['backMask','뒷면 보드'],['frontSilk','앞면 실크'],['backSilk','뒷면 실크'],['copper','동박·패드'],['substrate','보드 단면']];
  const colorInputs=new Map();let colorTargets=new Map(),originalColors=new Map(),colorFile='',savedColors={};
  const layout=document.createElement('div');layout.id='viewer-layout';host.before(layout);layout.append(host);
  const panel=document.createElement('aside');panel.className='color-panel';layout.append(panel);
  const panelTitle=document.createElement('h2');panelTitle.textContent='색상';panel.append(panelTitle);
  let assembly=null;
  const assemblyPanel=document.createElement('section');assemblyPanel.hidden=true;assemblyPanel.className='assembly-panel';panel.prepend(assemblyPanel);
  const assemblyTitle=document.createElement('h2');assemblyTitle.textContent='RC-21XX 조립';assemblyPanel.append(assemblyTitle);
  function placementInput(labelText,name,min,max,value){const label=document.createElement('label'),input=document.createElement('input');label.textContent=labelText;input.type='number';input.min=String(min);input.max=String(max);input.step='.1';input.value=String(value);input.setAttribute('aria-label',name);label.append(input);assemblyPanel.append(label);return input;}
  const gapInput=placementInput('A/B 뒤쪽 간격 · mm','RC-21XX PCB 간격',-100,100,12);
  const heightInput=placementInput('B 높이 · mm','RC-21XX B 높이',-100,100,12);
  const tiltInput=placementInput('B 기울기 · °','RC-21XX B 기울기',-80,80,20);
  const assemblyNote=document.createElement('p');assemblyNote.className='small';assemblyNote.textContent='B를 A 뒤쪽에서 높이고 기울입니다. 음수 간격은 A 쪽으로 이동합니다. 값은 조립 미리보기용이며 원본 파일을 바꾸지 않습니다.';assemblyPanel.append(assemblyNote);
  function applyPlacement(){if(!assembly?.pivot||[gapInput,heightInput,tiltInput].some(input=>!Number.isFinite(input.valueAsNumber)))return;assembly.pivot.position.copy(assembly.basePivot).add(new THREE.Vector3(0,heightInput.valueAsNumber/1000,-gapInput.valueAsNumber/1000));assembly.pivot.rotation.x=THREE.MathUtils.degToRad(tiltInput.valueAsNumber);assembly.pivot.updateMatrixWorld(true);}
  for(const input of [gapInput,heightInput,tiltInput])input.oninput=input.onchange=applyPlacement;
  for(const part of ['A','B']){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.dataset.assemblyPart=part;label.append(input,document.createTextNode(part+' 보드 표시'));assemblyPanel.append(label);input.onchange=()=>{for(const mesh of currentModel?.children??[])if(mesh.userData.pcbPart===part)mesh.visible=input.checked;renderer.shadowMap.needsUpdate=true;};}
  const photoPalette={red:{name:'빨강',board:'#B4051D',silk:'#FFFFFF'},yellow:{name:'노랑',board:'#E3AC05',silk:'#FFFFFF'},blue:{name:'파랑',board:'#395381',silk:'#FFFFFF'},white:{name:'흰색',board:'#D7D5D1',silk:'#171717'},purple:{name:'보라',board:'#603D72',silk:'#FFFFFF'},black:{name:'검정',board:'#292D32',silk:'#FFFFFF'}};
  const boardColors=p=>({frontMask:p.board,backMask:p.board,frontSilk:p.silk,backSilk:p.silk,copper:'#C0C0C0'});
  const splitModel=file=>catalog.find(item=>item.file===file)?.splitColors===true;
  function specifiedColors(file){
    return catalog.find(item=>item.file===file)?.colors??null;
  }
  const versions=document.createElement('div');versions.className='k-segment color-versions';versions.hidden=true;panel.append(versions);const versionButtons=new Map();
  const swatches=document.createElement('div');swatches.className='photo-palette';swatches.setAttribute('aria-label','실물 사진 참고 팔레트');panel.append(swatches);
  for(const palette of Object.values(photoPalette)){const button=document.createElement('button'),mark=document.createElement('span');button.type='button';button.className='k-button';button.setAttribute('aria-label',palette.name+' 보드 색상 적용');mark.style.backgroundColor=palette.board;button.append(mark,document.createTextNode(palette.name));button.onclick=()=>{const colors=splitModel(colorFile)?{leftMask:palette.board,rightMask:palette.board,frontSilk:palette.silk,backSilk:palette.silk}:boardColors(palette);delete colors.copper;for(const [role,value] of Object.entries(colors))applyColor(role,value,false);savedColors={...savedColors,...colors};storeColors();syncColorInputs();};swatches.append(button);}
  function storeColors(){if(!editable)return;localStorage.setItem('keylog-pcb-colors:'+colorFile,JSON.stringify(savedColors));}
  function applyColor(role,value,persist=true){
    if(!/^#[0-9a-f]{6}$/i.test(value))return;
    if(role==='background')renderer.setClearColor(value);else for(const material of colorTargets.get(role)??[])material.color.set(value);
    const inputs=colorInputs.get(role);inputs.picker.value=value;inputs.hex.value=value.toUpperCase();inputs.hex.removeAttribute('aria-invalid');
    if(persist){savedColors[role]=value;storeColors();}
  }
  for(const [role,title] of colorRoles){
    const label=document.createElement('label'),caption=document.createElement('span'),pair=document.createElement('span'),picker=document.createElement('input'),hex=document.createElement('input'),absence=document.createElement('p');
    absence.className='small';absence.hidden=true;absence.textContent=role.endsWith('Silk')?'원본 GLB에 이 면의 실크 형상이 없습니다.':'원본에서 해당 재질을 식별하지 못했습니다.';
    caption.textContent=title;pair.className='color-pair';picker.type='color';picker.setAttribute('aria-label',title+' 색상');hex.type='text';hex.maxLength=7;hex.spellcheck=false;hex.setAttribute('aria-label',title+' HEX');
    picker.oninput=()=>applyColor(role,picker.value);hex.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(hex.value))applyColor(role,hex.value);};hex.onchange=()=>{if(!/^#[0-9a-f]{6}$/i.test(hex.value))hex.setAttribute('aria-invalid','true');};
    pair.append(picker,hex);label.append(caption,pair,absence);panel.append(label);colorInputs.set(role,{picker,hex,label,pair,absence});
  }
  const restore=document.createElement('button');restore.className='k-button';restore.textContent='GLB 원본 색상';restore.type='button';panel.append(restore);
  const paletteHint=document.createElement('p');paletteHint.className='small';paletteHint.textContent='색상은 이 브라우저에서 모델별로 기억합니다. GLB 원본 파일은 변경하지 않습니다.';panel.append(paletteHint);
  document.querySelector('.bottom span:last-child').textContent='원본 형상 · 모델별 보기 색상';
  function syncColorInputs(){for(const [role] of colorRoles){const materials=colorTargets.get(role)??[],enabled=role==='background'||materials.length>0,inputs=colorInputs.get(role);inputs.label.hidden=['leftMask','rightMask'].includes(role)?!splitModel(colorFile):['frontMask','backMask'].includes(role)&&splitModel(colorFile);inputs.picker.disabled=inputs.hex.disabled=!enabled;inputs.pair.hidden=!enabled;inputs.absence.hidden=enabled;inputs.label.title=enabled?'':inputs.absence.textContent;const value=role==='background'?'#'+renderer.getClearColor(new THREE.Color()).getHexString():materials[0]?'#'+materials[0].color.getHexString():'#000000';inputs.picker.value=value;inputs.hex.value=value.toUpperCase();}for(const [button,colors] of versionButtons)button.setAttribute('aria-pressed',String(Object.entries(colors).every(([role,value])=>colorInputs.get(role).hex.value.toUpperCase()===value)));}
  restore.onclick=()=>{for(const [material,value] of originalColors)material.color.copy(value);renderer.setClearColor(0,0);savedColors={};storeColors();syncColorInputs();};
  camera.position.set(1,1,1);
  function connect(target=new THREE.Vector3()){controls?.dispose();controls=new TrackballControls(camera,renderer.domElement);controls.staticMoving=true;controls.rotateSpeed=1;controls.zoomSpeed=1;controls.panSpeed=.5;controls.minZoom=.15;controls.maxZoom=30;controls.target.copy(target);controls.update();}connect();
  const pointers=new Set();function cancel(){if(!pointers.size)return;const ids=[...pointers];pointers.clear();connect(controls.target.clone());for(const id of ids)if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id);}
  renderer.domElement.addEventListener('pointerdown',e=>pointers.add(e.pointerId),true);
  // Let TrackballControls consume the final move/up before ending our pointer
  // lifetime. Recreating it in window capture dropped the last delta.
  window.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'&&e.buttons===0){cancel();return;}if(pointers.has(e.pointerId))controls.update();});
  window.addEventListener('pointerup',e=>{if(!pointers.has(e.pointerId))return;controls.update();pointers.delete(e.pointerId);});
  window.addEventListener('pointercancel',cancel,true);renderer.domElement.addEventListener('lostpointercapture',()=>{if(pointers.size)cancel();});window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  let oldW=0,oldH=0,oldRatio=0;
  function resize(){const w=host.clientWidth,h=host.clientHeight,ratio=Math.min(devicePixelRatio*1.5,3);if(!w||!h)return false;if(w!==oldW||h!==oldH||ratio!==oldRatio){oldW=w;oldH=h;oldRatio=ratio;renderer.setDrawingBufferSize(w,h,ratio);composer.setPixelRatio(ratio);composer.setSize(w,h);camera.left=-span*w/h;camera.right=span*w/h;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();controls.handleResize();}return true;}
  function preset(mode='top'){
    cancel();currentView=mode;camera.zoom=1;camera.up.set(...(normal===2?[0,0,1]:[0,1,0]));
    {camera.position.set(0,0,0);camera.position.setComponent(normal,(mode==='bottom'?-1:1)*diagonal*2);camera.up.set(...(normal===2?[0,1,0]:normal===1?[0,0,-1]:[0,1,0]));}
    const bodyBounds=new THREE.Box3();currentModel?.updateMatrixWorld(true);currentModel?.traverse(o=>{if(o.isMesh&&o.material.userData.pcbSubstrate)bodyBounds.union(new THREE.Box3().setFromObject(o));});
    const target=bodyBounds.isEmpty()?new THREE.Vector3():bodyBounds.getCenter(new THREE.Vector3());camera.position.add(target);camera.lookAt(target);camera.updateMatrixWorld(true);
    if(currentModel){const box=new THREE.Box3().setFromObject(currentModel),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));const width=2*Math.max(...points.map(p=>Math.abs(p.x))),height=2*Math.max(...points.map(p=>Math.abs(p.y)));span=Math.max(height,width/(host.clientWidth/host.clientHeight))*.54;}
    const distance=camera.position.distanceTo(target);camera.near=Math.max(distance-diagonal*1.5,diagonal*.005);camera.far=distance+diagonal*1.5;oldW=0;resize();connect(target);for(const id of ['top','bottom'])$('#'+id).setAttribute('aria-pressed',String(id===mode));
  }
  for(const id of ['top','bottom'])$('#'+id).onclick=()=>preset(id);$('#fit').onclick=()=>preset(currentView);
  function disposeModel(object){const geometries=new Set(),materials=new Set(),textures=new Set();object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());}
  function mergeStaticModel(source){
    source.updateMatrixWorld(true);const batches=new Map(),oldGeometries=new Set();let count=0;
    source.traverse(o=>{if(!o.isMesh)return;if(o.isSkinnedMesh||o.morphTargetInfluences?.length||Array.isArray(o.material))throw Error('이 PCB 정적 뷰어에서 지원하지 않는 변형 메시입니다.');count++;const g=o.geometry.clone();for(const [name,attribute]of Object.entries(g.attributes))if(attribute.isInterleavedBufferAttribute)g.setAttribute(name,deinterleaveAttribute(attribute));g.applyMatrix4(o.matrixWorld);oldGeometries.add(o.geometry);const signature=(o.userData.pcbPart??'')+'|'+o.material.uuid+'|'+Object.keys(g.attributes).sort().join(',')+'|'+Boolean(g.index);if(!batches.has(signature))batches.set(signature,{material:o.material,geometries:[],part:o.userData.pcbPart});batches.get(signature).geometries.push(g);});
    const result=new THREE.Group();for(const batch of batches.values()){const geometry=mergeGeometries(batch.geometries,false);if(!geometry)throw Error('PCB 메시 결합에 실패했습니다.');const mesh=new THREE.Mesh(geometry,batch.material);mesh.userData.pcbPart=batch.part;mesh.receiveShadow=true;mesh.castShadow=!batch.material.transparent&&!batch.material.userData.pcbSilk;result.add(mesh);batch.geometries.forEach(g=>g.dispose());}oldGeometries.forEach(g=>g.dispose());result.userData.sourceMeshes=count;return result;
  }
  const catalogUrl=params.get('catalog')||'/pcbs/catalog.json';
  if(!catalogUrl.startsWith('/')||catalogUrl.startsWith('//'))throw Error('잘못된 PCB 목록 경로입니다.');
  const catalog=await fetch(catalogUrl).then(r=>{if(!r.ok)throw Error('PCB 목록을 읽지 못했습니다.');return r.json();});
  const select=$('#model');let initial=params.get('model')||catalog[0]?.file;if(!catalog.some(item=>item.file===initial))throw Error('등록되지 않은 PCB 모델입니다.');for(const item of catalog){const option=new Option(item.name,item.file);option.selected=item.file===initial;select.add(option);}
  const loader=new GLTFLoader();
  if(['127.0.0.1','localhost'].includes(location.hostname)){loader.setRequestHeader({'Cache-Control':'no-cache'});loader.manager.setURLModifier(url=>url.includes('.glb')?url+(url.includes('?')?'&':'?')+'reload='+Date.now():url);}
  async function load(file){
    const item=catalog.find(x=>x.file===file);if(!item)throw Error('파일을 찾을 수 없습니다: '+file);const assembled=Boolean(item.assembly),id=++generation;document.documentElement.dataset.pcbReady='false';$('#error').hidden=true;$('#title').textContent=item.name;$('#file-info').textContent=`${item.parts.map(p=>p.file).join(' + ')} · ${(item.bytes/1e6).toFixed(2)} MB`;$('#model-info').textContent='';$('#status').textContent='모델을 불러오는 중…';
    for(const inputs of colorInputs.values())inputs.picker.disabled=inputs.hex.disabled=true;restore.disabled=true;
    assembly=null;assemblyPanel.hidden=true;if(currentModel){modelRoot.remove(currentModel);disposeModel(currentModel);currentModel=null;}
    try{
      const progress=new Map();
      const parts=await Promise.all(item.parts.map(async(part,index)=>{const result=await loader.loadAsync(part.url,event=>{progress.set(part.file,event.loaded);if(id===generation)$('#status').textContent=`모델을 불러오는 중 · ${Math.round([...progress.values()].reduce((a,b)=>a+b,0)/item.bytes*100)}%`;});result.scene.traverse(o=>{if(o.isMesh)o.userData.pcbPart=assembled?(index===0?'A':'B'):undefined;});return result;}));
      if(id!==generation){parts.forEach(part=>disposeModel(part.scene));return;}
      const gltf={scene:new THREE.Group()};
      if(assembled){
        const [a,b]=parts.map(p=>p.scene);a.updateMatrixWorld(true);b.updateMatrixWorld(true);
        const point=(root,name)=>{const node=root.getObjectByName(name);if(!node)throw Error('조립 기준 커넥터 '+name+' 없음');return node.getWorldPosition(new THREE.Vector3());};
        const shift=point(a,'J4').sub(point(b,'J4')),second=point(a,'J5').sub(point(b,'J5'));
        if(Math.hypot(shift.x-second.x,shift.z-second.z)>1e-6)throw Error('J4와 J5가 동일 이동량으로 정렬되지 않습니다.');
        const substrate=root=>{const box=new THREE.Box3();root.traverse(o=>{if(o.isMesh&&o.material.transparent&&o.material.opacity>=.97&&o.material.opacity<1)box.union(new THREE.Box3().setFromObject(o));});if(box.isEmpty())throw Error('조립 기준 PCB 몸체 없음');return box;};
        const sa=substrate(a),sb=substrate(b),gap=0,offsetZ=sa.min.z-sb.max.z-gap;
        b.position.add(new THREE.Vector3(shift.x,sa.min.y-sb.min.y,offsetZ));
        assembly={basePivot:new THREE.Vector3((sb.min.x+sb.max.x)/2+shift.x,sa.min.y,sa.min.z),offsetXmm:shift.x*1000,offsetZmm:offsetZ*1000};gapInput.value=String(item.assembly.gap);heightInput.value=String(item.assembly.height);tiltInput.value=String(item.assembly.tilt);assemblyPanel.hidden=false;
        for(const input of assemblyPanel.querySelectorAll('[data-assembly-part]'))input.checked=true;
      }
      parts.forEach(part=>gltf.scene.add(part.scene));
      const box=new THREE.Box3().setFromObject(gltf.scene);if(box.isEmpty())throw Error('GLB에 표시할 형상이 없습니다.');const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      normal=size.toArray().indexOf(Math.min(...size.toArray()));
      const aggregateTargets=new Map(colorRoles.map(([role])=>[role,[]])),aggregateOriginal=new Map();let correctedTotal=0;
      for(const part of parts){
      const gltf={scene:part.scene},size=new THREE.Box3().setFromObject(part.scene).getSize(new THREE.Vector3());
      // KiCad exports the solid substrate with alpha 0.98. Treat only the
      // board-spanning, nearly opaque solid as opaque, so its depth occludes
      // the opposite face. Preserve soldermask/silkscreen transparency and RGB.
      const materialBounds=new Map(),silkMaterials=new Set();gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const part=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);for(const material of Array.isArray(o.material)?o.material:[o.material]){if(!materialBounds.has(material))materialBounds.set(material,new THREE.Box3());materialBounds.get(material).union(part);if(/_silkscreen(?:_|$)/.test(o.name))silkMaterials.add(material);}});
      let corrected=0,substrateBounds=null;colorTargets=new Map(colorRoles.map(([role])=>[role,[]]));originalColors=new Map([...materialBounds.keys()].filter(m=>m.color).map(m=>[m,m.color.clone()]));
      const broad=extent=>[0,1,2].filter(axis=>axis!==normal).every(axis=>extent.getSize(new THREE.Vector3()).getComponent(axis)>=size.getComponent(axis)*.8);
      for(const [material,extent] of materialBounds){if(material.transparent&&material.opacity>=.97&&material.opacity<1&&extent.getSize(new THREE.Vector3()).getComponent(normal)>0&&broad(extent)){material.opacity=1;material.transparent=false;material.depthWrite=true;material.needsUpdate=true;corrected++;colorTargets.get('substrate').push(material);substrateBounds=extent;}}
      if(!substrateBounds)throw Error('PCB 몸체 재질을 식별하지 못했습니다.');
      if(substrateBounds){
        const low=substrateBounds.min.getComponent(normal),high=substrateBounds.max.getComponent(normal),depth=high-low;
        const front=[],back=[];
        for(const [material,extent] of materialBounds){
          if(colorTargets.get('substrate').includes(material))continue;
          const a=extent.min.getComponent(normal),b=extent.max.getComponent(normal),mid=(a+b)/2;
          if(material.metalness>=.5&&broad(extent)&&a>=low-depth*.15&&b<=high+depth*.15){colorTargets.get('copper').push(material);continue;}
          if(material.metalness<.5&&material.transparent&&b-a<depth*.05){
            const side=mid>high?'front':mid<low?'back':null;if(!side)continue;
            // KiCad may export a board-wide silk mesh with an anonymous name.
            // Its exported alpha is 0.9; soldermask is 0.83. Both must also
            // be planar and outside the substrate, as established above.
            if(silkMaterials.has(material)||(broad(extent)&&Math.abs(material.opacity-.9)<1e-6)){
              colorTargets.get(side+'Silk').push(material);
              material.opacity=1;material.transparent=false;material.depthWrite=true;material.needsUpdate=true;
            }else if(broad(extent)){
              (side==='front'?front:back).push(material);
            }
          }
        }
        for(const [side,list] of [['front',front],['back',back]]){
          // Silkscreen may cover a small area or be absent on one face.
          // Neither case prevents identifying the board-spanning soldermask.
          if(list.length!==1)throw Error((side==='front'?'앞면':'뒷면')+' 보드 재질을 하나로 식별하지 못했습니다.');
          colorTargets.get(side+'Mask').push(list[0]);
        }
      }
      if(splitModel(file)){
        const frontMaterials=new Set(colorTargets.get('frontMask')),frontMeshes=[];
        gltf.scene.traverse(o=>{if(o.isMesh&&frontMaterials.has(o.material))frontMeshes.push({mesh:o,box:new THREE.Box3().setFromObject(o)});});
        if(frontMeshes.length!==2)throw Error('Castor ULP의 두 기판 마스크를 구분하지 못했습니다.');
        const axes=[0,1,2].filter(a=>a!==normal),centers=frontMeshes.map(x=>x.box.getCenter(new THREE.Vector3()));const axis=axes.sort((a,b)=>Math.abs(centers[0].getComponent(b)-centers[1].getComponent(b))-Math.abs(centers[0].getComponent(a)-centers[1].getComponent(a)))[0];
        frontMeshes.sort((a,b)=>a.box.min.getComponent(axis)-b.box.min.getComponent(axis));
        if(frontMeshes[0].box.max.getComponent(axis)>=frontMeshes[1].box.min.getComponent(axis))throw Error('Castor ULP 좌우 기판이 겹쳐 구분할 수 없습니다.');
        const split=(frontMeshes[0].box.max.getComponent(axis)+frontMeshes[1].box.min.getComponent(axis))/2;
        for(const role of ['frontMask','backMask']){const originals=new Set(colorTargets.get(role)),clones=new Map();gltf.scene.traverse(o=>{if(!o.isMesh||!originals.has(o.material))return;const side=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).getComponent(axis)<split?'leftMask':'rightMask',key=o.material.uuid+side;if(!clones.has(key)){const m=o.material.clone();originalColors.set(m,originalColors.get(o.material).clone());clones.set(key,m);colorTargets.get(side).push(m);}o.material=clones.get(key);});colorTargets.set(role,[...clones.values()]);}
      }
      part.scene.userData.soldermaskHoles=openSoldermaskHoles(part.scene,colorTargets.get('substrate'),[...colorTargets.get('frontMask'),...colorTargets.get('backMask')],normal);
      // Preserve component colors; CAD exports often give metallic surfaces
      // fully diffuse roughness. Neutral exposed metals need a reflection lobe.
      for(const material of materialBounds.keys())if(material.metalness>=.5&&material.roughness>.9&&material.color){const c=material.color;if(Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b)<.15&&Math.max(c.r,c.g,c.b)>.18)material.roughness=.32;}
      const paintReplacements=new Map();
      for(const role of ['frontMask','backMask','frontSilk','backSilk','substrate'])for(const old of colorTargets.get(role)){
        if(paintReplacements.has(old))continue;
        const coating=role.endsWith('Mask'),silk=role.endsWith('Silk');
        const paint=new THREE.MeshPhysicalMaterial({color:old.color.clone(),map:old.map,alphaMap:old.alphaMap,opacity:coating?.99:old.opacity,transparent:coating||old.transparent,alphaTest:old.alphaTest,depthWrite:old.depthWrite,side:old.side,metalness:0,roughness:coating?.7:.9,clearcoat:0,specularIntensity:.04});
        paint.userData.pcbSilk=silk;
        paint.userData.pcbSubstrate=role==='substrate';
        paint.name=old.name;paintReplacements.set(old,paint);originalColors.set(paint,originalColors.get(old));originalColors.delete(old);
      }
      gltf.scene.traverse(o=>{if(!o.isMesh)return;o.material=Array.isArray(o.material)?o.material.map(m=>paintReplacements.get(m)??m):paintReplacements.get(o.material)??o.material;});
      for(const [role,materials] of colorTargets)colorTargets.set(role,materials.map(m=>paintReplacements.get(m)??m));
      for(const old of paintReplacements.keys())old.dispose();
      if(item.edgeFinish==='enig'){
        const gold=new THREE.MeshStandardMaterial({color:new THREE.Color(1,.766,.336),metalness:1,roughness:.25});
        gold.userData.pcbSubstrate=true;
        originalColors.set(gold,gold.color.clone());colorTargets.get('copper').push(gold);
        for(const material of colorTargets.get('copper')){material.metalness=1;material.roughness=.25;}
        const solids=[];gltf.scene.traverse(o=>{if(o.isMesh&&o.material.userData.pcbSubstrate)solids.push(o);});
        // Outer boundary and hole walls are disconnected closed contours.
        // Their outward-facing winding distinguishes exterior plating from holes.
        const edges=new Map(),adjacency=new Map(),axes=[0,1,2].filter(a=>a!==normal);
        const pointKey=p=>axes.map(a=>p.getComponent(a).toFixed(8)).join(',');
        function wallEdge(points){
          let pair=[points[0],points[1]],distance=0;for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){const d=axes.reduce((s,k)=>s+(points[a].getComponent(k)-points[b].getComponent(k))**2,0);if(d>distance){distance=d;pair=[points[a],points[b]];}}
          if(distance<1e-16)return null;
          const n=new THREE.Vector3().subVectors(points[1],points[0]).cross(new THREE.Vector3().subVectors(points[2],points[0]));
          let [a,b]=pair;if(n.x*(b.z-a.z)-n.z*(b.x-a.x)<0)[a,b]=[b,a];
          const ka=pointKey(a),kb=pointKey(b),key=[ka,kb].sort().join('|');return {key,ka,kb,area:a.x*b.z-b.x*a.z};
        }
        for(const mesh of solids){const g=mesh.geometry,p=g.attributes.position,count=g.index?g.index.count:p.count;
          for(let i=0;i<count;i+=3){const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,g.index?g.index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));if(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))<1e-8)continue;const e=wallEdge(points);if(!e||edges.has(e.key))continue;edges.set(e.key,e);for(const k of [e.ka,e.kb]){if(!adjacency.has(k))adjacency.set(k,[]);adjacency.get(k).push(e.key);}}
        }
        const seen=new Set(),outerEdges=new Set();for(const key of edges.keys()){if(seen.has(key))continue;const queue=[key],component=[];let area=0;while(queue.length){const k=queue.pop();if(seen.has(k))continue;seen.add(k);component.push(k);const e=edges.get(k);area+=e.area;for(const p of [e.ka,e.kb])for(const neighbor of adjacency.get(p))if(!seen.has(neighbor))queue.push(neighbor);}if(area>0)for(const k of component)outerEdges.add(k);}
        for(const mesh of solids){
          const g=mesh.geometry,p=g.attributes.position,index=g.index,flat=[],walls=[],v=new THREE.Vector3();
          const count=index?index.count:p.count,low=substrateBounds.min.getComponent(normal),high=substrateBounds.max.getComponent(normal);
          for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),heights=ids.map(id=>v.fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld).getComponent(normal));
            const onFace=heights.every(h=>Math.abs(h-low)<1e-8)||heights.every(h=>Math.abs(h-high)<1e-8);
            const edge=onFace?null:wallEdge(ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld)));
            (onFace||edge&&outerEdges.has(edge.key)?flat:walls).push(...ids);
          }
          if(!flat.length)continue;
          const face=new THREE.Mesh(g.clone(),gold);face.geometry.setIndex(flat);face.position.copy(mesh.position);face.quaternion.copy(mesh.quaternion);face.scale.copy(mesh.scale);face.userData={...mesh.userData};mesh.parent.add(face);
          const wallGeometry=g.clone();wallGeometry.setIndex(walls);mesh.geometry=wallGeometry;
        }
      }
      for(const [role,materials] of colorTargets)aggregateTargets.get(role).push(...materials);
      for(const [material,value] of originalColors)aggregateOriginal.set(material,value);
      correctedTotal+=corrected;
      }
      colorTargets=aggregateTargets;originalColors=aggregateOriginal;
      colorFile=file;const stored=localStorage.getItem('keylog-pcb-colors:'+file);
      savedColors=editable&&stored?JSON.parse(stored):{...specifiedColors(file)};
      const specified=specifiedColors(file),policy=specified?JSON.stringify(specified):null;
      if(specified&&localStorage.getItem('keylog-pcb-specified-colors:'+file)!==policy){savedColors={...savedColors,...specified};if(splitModel(file)){delete savedColors.frontMask;delete savedColors.backMask;}localStorage.setItem('keylog-pcb-specified-colors:'+file,policy);storeColors();}
      versions.replaceChildren();versionButtons.clear();versions.hidden=!item.finishes?.length;
      for(const finish of item.finishes??[]){const button=document.createElement('button');button.type='button';button.className='k-button';button.textContent=finish.label;button.onclick=()=>{for(const [role,value]of Object.entries(finish.colors))applyColor(role,value,false);savedColors={...savedColors,...finish.colors};storeColors();syncColorInputs();};versions.append(button);versionButtons.set(button,finish.colors);}
      if(embedded)document.querySelector('.toolbar').append(versions);
      renderer.setClearColor(0,0);for(const [role,value] of Object.entries(savedColors))if(colorInputs.has(role))applyColor(role,value,false);syncColorInputs();restore.disabled=false;
      currentModel=mergeStaticModel(gltf.scene);currentModel.position.sub(center);modelRoot.add(currentModel);diagonal=size.length();
      if(assembly){const pivot=new THREE.Group();pivot.userData.pcbPart='B';pivot.position.copy(assembly.basePivot);const meshes=currentModel.children.filter(mesh=>mesh.userData.pcbPart==='B');for(const mesh of meshes){currentModel.remove(mesh);mesh.position.sub(assembly.basePivot);pivot.add(mesh);}currentModel.add(pivot);assembly.pivot=pivot;applyPlacement();}
      const aspect=host.clientWidth/host.clientHeight;span=Math.max(size.x/Math.max(aspect,.2),size.y,size.z)*.65; if(normal===1)span=Math.max(size.x/Math.max(aspect,.2),size.z)*.65;if(normal===2)span=Math.max(size.x/Math.max(aspect,.2),size.y)*.65;
      let meshes=0,triangles=0;currentModel.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}});preset();$('#status').textContent=assembly?'RC-21XX · 상단 기능키 / 하단 주 키':'GLB 로딩 완료 · PCB 실물 보기';$('#model-info').textContent=`메시 ${meshes} · 삼각형 ${Math.round(triangles).toLocaleString('ko-KR')}`;$('#model-info').dataset.solidMaterials=String(correctedTotal);const loadedUrl=new URL(location.href);loadedUrl.searchParams.set('model',file);history.replaceState(null,'',loadedUrl);
    }catch(error){if(id!==generation)return;$('#status').textContent='모델 표시 실패';$('#error').hidden=false;$('#error').textContent=error.message;throw error;}
  }
  select.onchange=()=>void load(select.value);await load(select.value);
  renderer.setAnimationLoop(()=>{if(!resize())return;controls.update();camera.updateMatrixWorld();composer.render();document.documentElement.dataset.pcbReady=String(Boolean(currentModel));$('#controls-state').textContent=JSON.stringify({model:select.value,position:camera.position.toArray(),up:camera.up.toArray(),activePointers:pointers.size,normal,loaded:!!currentModel});});
  window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);controls.dispose();if(currentModel)disposeModel(currentModel);ao.dispose();output.dispose();antialias.dispose();composer.dispose();envMap.dispose();renderer.dispose();},{once:true});
}catch(error){$('#error').hidden=false;$('#error').textContent=error.message;$('#status').textContent='3D 뷰어 시작 실패';throw error;}
