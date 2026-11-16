export function switchMaterialText(value){
  return typeof value==='string'?value.replaceAll('필름','Film'):'';
}
