import data from '../../data/pcbs.json';
export function GET(){return new Response(JSON.stringify(data.items.flatMap(item=>item.scene?[item.scene]:[])),{headers:{'Content-Type':'application/json; charset=utf-8'}});}
