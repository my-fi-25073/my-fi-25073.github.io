/** The archive's virtual groups are distinct from the actual manufacturer. */
export function switchManufacturerGroup({manufacturer,isFranken}){
  return isFranken?'Franken':manufacturer||'Unknown';
}
