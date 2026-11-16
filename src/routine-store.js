import {routineDay} from './routine-model.js';
export function createRoutineStore({read,write}){
 let state={loaded:false,loading:false,saving:false,templates:[],day:{date:routineDay(),items:[],revision:0,stampedAt:''},calendar:[],today:routineDay(),month:routineDay().slice(0,7),todayStarted:false,error:'',notice:'',celebration:0};
 let confirmed=state.day,pending=new Map(),inflight=false,commandBusy=false,reading=null,disposed=false,freshAt=0,lastStamp='';
 const listeners=new Set();
 const emit=patch=>{if(disposed)return;state={...state,...patch};for(const listener of listeners)listener()};
 const accept=result=>{if(!result?.day||!Array.isArray(result.day.items)||!Array.isArray(result.templates)||!Array.isArray(result.calendar))throw new Error('ข้อมูลรูทีนตอบกลับไม่ครบ กรุณาโหลดใหม่');return result};
 const overlay=day=>({...day,items:day.items.map(item=>pending.has(item.id)?{...item,done:pending.get(item.id)}:item),stampedAt:pending.size?'':day.stampedAt});
 async function flush(){
  if(inflight||disposed||commandBusy)return;
  inflight=true;
  try{
   while(pending.size&&!disposed){
    const changes=[...pending].filter(([id,done])=>confirmed.items.some(item=>item.id===id&&item.done!==done)).map(([id,done])=>({id,done}));pending.clear();
    if(!changes.length){emit({day:confirmed});break}
    const result=accept(await write({action:'check',changes,date:confirmed.date,month:state.month,revision:confirmed.revision}));
    if(disposed)return;
    confirmed=result.day;freshAt=Date.now();
    for(const [id,done] of pending)if(confirmed.items.some(item=>item.id===id&&item.done===done))pending.delete(id);
    const day=overlay(confirmed),stamp=day.stampedAt;
    const celebrate=Boolean(stamp&&stamp!==lastStamp&&!pending.size);
    if(!pending.size)lastStamp=stamp;
    emit({...result,loaded:true,day,notice:celebrate?'ทำครบแล้ว ปั๊มตราวันนี้ให้แล้ว!':'บันทึกรูทีนแล้ว',celebration:state.celebration+(celebrate?1:0)});
   }
  }catch(error){pending.clear();emit({day:confirmed,error:error.message,notice:''})}
  finally{inflight=false;emit({saving:false})}
 }
 return {
  getSnapshot:()=>state,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
  load(options={},refresh=false){
   if(disposed||state.saving)return Promise.resolve(false);
   const date=options.date||routineDay(),month=options.month||date.slice(0,7);
   if(reading)return reading;
   if(!refresh&&state.loaded&&state.day.date===date&&state.month===month&&Date.now()-freshAt<60000)return Promise.resolve(true);
   emit({loading:true,error:''});
   reading=Promise.resolve().then(()=>read({date,month,refresh:refresh?1:undefined})).then(result=>{
    result=accept(result);if(disposed)return false;
    confirmed=result.day;lastStamp=confirmed.stampedAt;freshAt=Date.now();emit({...result,loaded:true,notice:''});return true;
   }).catch(error=>{emit({error:error.message});return false}).finally(()=>{reading=null;emit({loading:false})});
   return reading;
  },
  check(id,done){
   if(disposed||!state.loaded||state.loading||commandBusy||state.day.date!==routineDay()||typeof done!=='boolean')return false;
   if(!state.day.items.some(item=>item.id===id))return false;
   pending.set(id,done);emit({day:{...state.day,items:state.day.items.map(item=>item.id===id?{...item,done}:item),stampedAt:''},saving:true,error:'',notice:''});
   queueMicrotask(flush);return true;
  },
  async command(payload){
   if(disposed||state.loading||state.saving||commandBusy)return false;
   commandBusy=true;emit({saving:true,error:'',notice:''});
   try{
    const result=accept(await write({...payload,date:state.day.date,month:state.month}));
    if(disposed)return false;
    confirmed=result.day;lastStamp=confirmed.stampedAt;freshAt=Date.now();
    emit({...result,loaded:true,notice:result.todayStarted?'บันทึกรายการหลักแล้ว จะใช้รายการใหม่ในวันถัดไป':'บันทึกรายการรูทีนแล้ว'});return true;
   }catch(error){emit({error:error.message});return false}
   finally{commandBusy=false;emit({saving:false})}
  },
  dispose(){disposed=true;pending.clear();listeners.clear()},
 };
}
