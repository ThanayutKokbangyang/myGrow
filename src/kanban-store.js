import {changesBetween} from './kanban-model.js';

// Preserve edits made while the previous snapshot was being saved, but always
// use server-issued revisions for the next write.
export function rebaseBoard(server,sent,desired,acknowledgedIds=new Set()){
 const sentById=new Map(sent.map(item=>[item.id,item]));
 const result=new Map(server.map(item=>[item.id,item]));
 for(const change of changesBetween(sent,desired)){
  const old=sentById.get(change.id),current=result.get(change.id);
  if(!acknowledgedIds.has(change.id)&&((old&&current&&old.revision!==current.revision)||(!old&&current)||(old&&!current&&change.type!=='delete')))throw new Error('บอร์ดถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดใหม่ก่อนลองอีกครั้ง');
  if(change.type==='delete')result.delete(change.id);
  else result.set(change.id,{...change.item,revision:result.get(change.id)?.revision??0,updatedAt:result.get(change.id)?.updatedAt||''});
 }
 return [...result.values()];
}

export function createKanbanStore({read,write,initial=null}){
 let confirmed=initial?.items||[],desired=confirmed,sequence=0,waiters=[],disposed=false,reading=null,pumping=false,freshAt=initial?Date.now():0;
 let state={items:desired,ready:Boolean(initial),saving:false,refreshing:false,error:'',notice:'',pendingIds:[]};
 const listeners=new Set();
 const emit=patch=>{if(disposed)return;state={...state,...patch};for(const listener of listeners)listener()};
 const settle=(until,value)=>{const done=waiters.filter(waiter=>waiter.sequence<=until);waiters=waiters.filter(waiter=>waiter.sequence>until);done.forEach(waiter=>waiter.resolve(value))};
 async function pump(){
  if(pumping||disposed)return;
  pumping=true;
  try{
   while(!disposed&&waiters.length){
    const sent=desired,until=sequence,changes=changesBetween(confirmed,sent);
    if(!changes.length){settle(until,true);continue}
    emit({saving:true,pendingIds:changes.map(change=>change.id)});
    try{
     const result=await write(changes);
     if(disposed)return;
     if(!Array.isArray(result?.items))throw new Error('ข้อมูลตอบกลับไม่ครบ กรุณาโหลดบอร์ดใหม่');
     const message=waiters.filter(waiter=>waiter.sequence<=until).at(-1)?.message||'บันทึกบอร์ดแล้ว';
     confirmed=result.items;freshAt=Date.now();
     settle(until,true);
     desired=rebaseBoard(confirmed,sent,desired,new Set(changes.map(change=>change.id)));
     emit({items:desired,notice:message,pendingIds:changesBetween(confirmed,desired).map(change=>change.id)});
    }catch(error){
     if(disposed)return;
     desired=confirmed;
     emit({items:confirmed,error:error.message||'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',notice:'',pendingIds:[]});
     settle(Infinity,false);
     break;
    }
   }
  }finally{pumping=false;emit({saving:false,pendingIds:[]})}
 }
 return {
  getSnapshot:()=>state,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
  load(refresh=false){
   if(disposed||pumping||waiters.length)return Promise.resolve(false);
   if(!refresh&&state.ready&&Date.now()-freshAt<60000)return Promise.resolve(true);
   if(reading)return reading;
   emit({refreshing:true,error:''});
   reading=Promise.resolve().then(()=>read(refresh)).then(result=>{
    if(disposed)return false;
    if(!Array.isArray(result?.items))throw new Error('ข้อมูลตอบกลับไม่ครบ กรุณาโหลดบอร์ดใหม่');
    confirmed=result.items;desired=confirmed;freshAt=Date.now();
    emit({items:desired,ready:true,notice:refresh?'โหลดบอร์ดล่าสุดแล้ว':''});return true;
   }).catch(error=>{emit({error:error.message});return false}).finally(()=>{reading=null;emit({refreshing:false})});
   return reading;
  },
  persist(update,message){
   if(disposed||!state.ready||reading)return Promise.resolve(false);
   const next=typeof update==='function'?update(desired):update;
   if(!changesBetween(desired,next).length){if(state.error)emit({error:''});return Promise.resolve(true)}
   desired=next;sequence++;
   emit({items:desired,saving:true,error:'',notice:'',pendingIds:changesBetween(confirmed,desired).map(change=>change.id)});
   const promise=new Promise(resolve=>waiters.push({sequence,message,resolve}));
   // Coalesce operations in this turn, then serialize network writes.
   queueMicrotask(pump);
   return promise;
  },
  dispose(){disposed=true;settle(Infinity,false);listeners.clear()},
 };
}
