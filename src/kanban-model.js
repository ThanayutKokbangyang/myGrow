export const TONES=['gold','blue','green','purple','rose'];
export const PRIORITIES={normal:'ทั่วไป',high:'สำคัญ',urgent:'เร่งด่วน'};
export const ordered=items=>[...items].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
export const columnsOf=items=>ordered(items.filter(item=>item.type==='column'));
export const cardsOf=(items,columnId)=>ordered(items.filter(item=>item.type==='card'&&item.columnId===columnId));
export const newId=()=>crypto.randomUUID();
export function moveCard(items,id,columnId,beforeId=null){
 const card=items.find(item=>item.id===id&&item.type==='card');
 if(!card||!items.some(item=>item.id===columnId&&item.type==='column')||beforeId===id)return items;
 const destination=cardsOf(items,columnId).filter(item=>item.id!==id);
 const index=beforeId?destination.findIndex(item=>item.id===beforeId):-1;
 destination.splice(index<0?destination.length:index,0,{...card,columnId});
 const changes=new Map(destination.map((item,order)=>[item.id,{...item,order}]));
 if(card.columnId!==columnId)cardsOf(items,card.columnId).filter(item=>item.id!==id).forEach((item,order)=>changes.set(item.id,{...item,order}));
 return items.map(item=>changes.get(item.id)||item);
}
const fields=['type','columnId','title','detail','priority','due','order','tone','done'];
export function changesBetween(before,after){
 const previous=new Map(before.map(item=>[item.id,item])),next=new Map(after.map(item=>[item.id,item]));
 const changes=[];
 for(const item of after){const old=previous.get(item.id);if(!old||fields.some(key=>old[key]!==item[key]))changes.push({type:'upsert',id:item.id,revision:old?.revision??0,item})}
 for(const item of before)if(!next.has(item.id))changes.push({type:'delete',id:item.id,revision:item.revision});
 return changes;
}
export function dueState(due,today){return !due?'':due<today?'late':due===today?'today':'upcoming'}
