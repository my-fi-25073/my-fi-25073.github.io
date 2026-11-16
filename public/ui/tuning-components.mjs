import { renderGalleryCard } from './gallery.mjs';
/** @type {Record<string,string>} */
export const tuningComponentRoleLabels={spring:'Spring',stem_lubricant:'Stem lubricant',spring_lubricant:'Spring lubricant',gap_adjustment:'Gap adjustment'};
export function renderTuningComponent(component, href = '') {
  const selected = component.kind === 'spring' && component.manufacturer === 'Sprit' && component.manufacturerLogo
    ? { ...component.manufacturerLogo, springLabel: {series:component.series??'',force:component.force??''} }
    : component.image ?? component.manufacturerLogo;
  const image = selected ? {...selected,alt:component.image?component.name:`${component.manufacturer??component.name} logo`} : null;
  return renderGalleryCard({title:component.name,href,kind:component.kind,image,placeholderLogo:component.manufacturerLogo,
    metadata:[...(component.manufacturer?[{label:'Manufacturer',value:component.manufacturer}]:[]),...component.specifications]});
}
