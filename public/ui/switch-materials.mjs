export function switchMaterialText(value){
  if (value === 'SW 폼 필름 v2') return 'SW Foam Film v2';
  return typeof value === 'string' ? value.replaceAll('필름', 'Film').trim() : '';
}
