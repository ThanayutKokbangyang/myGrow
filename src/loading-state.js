// Count actual network reads, so cache hits never flash a loading indicator.
const pending=new Map(),listeners=new Set();
export const subscribeReads=listener=>{listeners.add(listener);return()=>listeners.delete(listener)};
export const pendingReads=resource=>pending.get(resource)||0;
const publish=()=>{for(const listener of listeners)listener()};
export function beginRead(resource){
 pending.set(resource,pendingReads(resource)+1);publish();
 let finished=false;
 return ()=>{
  if(finished)return;finished=true;
  const remaining=pendingReads(resource)-1;
  if(remaining>0)pending.set(resource,remaining);else pending.delete(resource);
  publish();
 };
}
