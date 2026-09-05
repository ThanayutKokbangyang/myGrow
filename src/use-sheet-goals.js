import {useEffect,useRef,useState} from 'react';
import {loadGoals,applyGoals,hasOwnerToken,clearOwnerToken} from './api';
import {normalizeItems} from './goals-model';

const CACHE='grow-goals-cache-v1',FRESH_MS=60000;
// Module scope so it outlives the component: the page unmounts whenever the
// user leaves the tab, and without this the sheet was refetched every visit.
const store={items:null,at:0,inflight:null};
const readCache=()=>{try{return normalizeItems(JSON.parse(localStorage.getItem(CACHE)||'[]'))}catch{return []}};
const writeCache=items=>{try{localStorage.setItem(CACHE,JSON.stringify(items))}catch{}};

function fetchGoals(force){
 if(store.inflight)return store.inflight;                                     // one request even if two callers ask
 if(!force&&store.items&&Date.now()-store.at<FRESH_MS)return Promise.resolve(store.items);
 store.inflight=loadGoals()
  .then(data=>{const items=normalizeItems(data);store.items=items;store.at=Date.now();return items})
  .finally(()=>{store.inflight=null});
 return store.inflight;
}

export function useSheetGoals(onRequireOwner){
 const cached=store.items;
 const [items,setItems]=useState(()=>cached||readCache());
 const [ready,setReady]=useState(Boolean(cached));
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState(cached?'เชื่อมต่อ Google Sheets แล้ว':'กำลังโหลดจาก Google Sheets…');
 const remote=useRef(cached||[]),working=useRef(false);

 function apply(next){
  remote.current=next;store.items=next;store.at=Date.now();
  setItems(next);writeCache(next);setReady(true);setMessage('เชื่อมต่อ Google Sheets แล้ว');
 }
 useEffect(()=>{
  let active=true;
  if(cached&&Date.now()-store.at<FRESH_MS)return;                             // fresh from an earlier visit
  fetchGoals(false)
   .then(list=>{if(active)apply(list)})
   .catch(e=>{if(active&&!cached)setMessage(e.message+' · ใช้ข้อมูลที่เก็บไว้ในเครื่องก่อน')});
  return()=>{active=false};
 },[]);

 async function refresh(){
  if(working.current)return;
  working.current=true;setBusy(true);
  try{apply(await fetchGoals(true))}
  catch(e){setMessage(e.message)}
  finally{working.current=false;setBusy(false)}
 }

 /** Save the whole desired list; only what actually changed is sent. */
 async function persist(next){
  if(working.current)return false;
  if(!ready){setMessage('รอเชื่อมต่อ Sheet ให้สำเร็จก่อนบันทึก');return false}
  if(!hasOwnerToken()){onRequireOwner?.();setMessage('ยืนยันตัวตนแล้วกดบันทึกอีกครั้ง');return false}
  const clean=normalizeItems(next);
  const before=new Map(remote.current.map(x=>[x.id,x]));
  const after=new Map(clean.map(x=>[x.id,x]));
  const same=(a,b)=>a&&b&&['type','goalId','term','title','detail','icon','status','due','order'].every(k=>String(a[k])===String(b[k]));
  const changes=[];
  for(const item of clean)if(!same(before.get(item.id),item))changes.push({type:'upsert',id:item.id,item});
  // A deleted goal takes its steps with it on the server, so only ask for the
  // goal row itself and let the sheet cascade.
  const goneGoals=new Set();
  for(const item of remote.current)if(!after.has(item.id)&&item.type==='goal'){goneGoals.add(item.id);changes.push({type:'delete',id:item.id})}
  for(const item of remote.current)if(!after.has(item.id)&&item.type==='step'&&!goneGoals.has(item.goalId))changes.push({type:'delete',id:item.id});
  if(!changes.length){setItems(clean);return true}
  working.current=true;setBusy(true);setItems(clean);                          // optimistic
  try{
   const result=await applyGoals(changes);
   apply(normalizeItems(result.items));
   setMessage('บันทึกใน Google Sheets แล้ว');
   return true;
  }catch(e){
   setItems(remote.current);                                                   // put the old list back
   if(e.status===401){clearOwnerToken();onRequireOwner?.()}
   setMessage(e.message);
   return false;
  }finally{working.current=false;setBusy(false)}
 }
 return {items,ready,busy,message,setMessage,persist,refresh};
}
