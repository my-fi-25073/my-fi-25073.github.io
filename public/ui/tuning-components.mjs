import { renderGalleryCard } from './gallery.mjs';
import {switchMaterialText} from './switch-materials.mjs';
/** @type {Record<string,string>} */
export const tuningComponentRoleLabels = { spring: 'Spring', stem_lubricant: 'Stem lubricant', spring_lubricant: 'Spring lubricant',gap_adjustment:'Gap adjustment' };
/**
 * @template T
 * @param {{components?:T[],housingFit?:{state:string,method?:string|null,material?:string|null,materialSpec?:string|null}}} tuning
 * @returns {Array<T|{role:'gap_adjustment',kind:'material',name:string,manufacturer:null,specifications:[]}>}
 */
export function tuningComponents(tuning){
  const components=tuning.components??[],fit=tuning.housingFit;
  if(!fit||fit.state==='none'||fit.state==='unknown')return components;
  const name=switchMaterialText(fit.materialSpec??fit.material)||({glue_marker:'Glue Marker',cyanoacrylate:'Cyanoacrylate'}[fit.method]);
  if(fit.state!=='applied'||!name)throw Error('Gap adjustment: 선택한 재료의 이름을 읽을 수 없습니다.');
  return [...components,{role:'gap_adjustment',kind:'material',name,manufacturer:null,specifications:[]}];
}
export function renderTuningComponent(component, href = '') {
  if(component.role==='gap_adjustment')return renderGalleryCard({title:component.name,kind:'material',showMedia:false});
  const selected = component.kind === 'spring' && component.manufacturer === 'Sprit' && component.manufacturerLogo
    ? { ...component.manufacturerLogo, springLabel: {series:component.series??'',force:component.force??''} }
    : component.image ?? component.manufacturerLogo;
  const image = selected ? {...selected,alt:component.image?component.name:`${component.manufacturer??component.name} logo`} : null;
  return renderGalleryCard({title:component.name,href,kind:component.kind,image,placeholderLogo:component.manufacturerLogo,
    metadata:[...(component.manufacturer?[{label:'Manufacturer',value:component.manufacturer}]:[]),...component.specifications]});
}
