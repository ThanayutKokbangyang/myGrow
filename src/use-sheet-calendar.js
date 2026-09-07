import {useEffect,useRef,useState} from 'react';
import {loadCalendar,applyCalendar,hasOwnerToken,clearOwnerToken} from './api';
import {normalizeEvents} from './calendar-model';

const CACHE='grow-calendar-cache-v1',FRESH_MS=60000;
// Module scope so it outlives the component: the page unmounts whenever the
// user leaves the tab, and without this the sheet was refetched every visit.
const store={items:null,at:0,inflight:null};
const readCache=()=>{try{return normalizeEvents(JSON.parse(localStorage.getItem(CACHE)||'[]'))}catch{return []}};
const writeCache=items=>{try{localStorage.setItem(CACHE,JSON.stringify(items))}catch{}};

function fetchCalendar(force){
 if(store.inflight)return store.inflight;                                     // one request even if two callers ask
 if(!force&&store.items&&Date.now()-store.at<FRESH_MS)return Promise.resolve(store.items);
 store.inflight=loadCalendar()
  .then(data=>{const items=normalizeEvents(data);store.items=items;store.at=Date.now();return items})
  .finally(()=>{store.inflight=null});
 return store.inflight;
}

export function useSheetCalendar(onRequireOwner){
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
  fetchCalendar(false)
   .then(list=>{if(active)apply(list)})
   .catch(e=>{if(active&&!cached)setMessage(e.message+' · ใช้ข้อมูลที่เก็บไว้ในเครื่องก่อน')});
  return()=>{active=false};
 },[]);

 async function refresh(){
  if(working.current)return;
  working.current=true;setBusy(true);
  try{apply(await fetchCalendar(true))}
  catch(e){setMessage(e.message)}
  finally{working.current=false;setBusy(false)}
 }

 /** Save the whole desired list; only what actually changed is sent. */
 async function persist(next){
  if(working.current)return false;
  if(!ready){setMessage('รอเชื่อมต่อ Sheet ให้สำเร็จก่อนบันทึก');return false}
  if(!hasOwnerToken()){onRequireOwner?.();setMessage('ยืนยันตัวตนแล้วกดบันทึกอีกครั้ง');return false}
  const clean=normalizeEvents(next);
  const before=new Map(remote.current.map(x=>[x.id,x]));
  const after=new Map(clean.map(x=>[x.id,x]));
  const same=(a,b)=>a&&b&&['title','detail','date','icon','tone','repeat','repeatUntil','done','doneDates'].every(k=>String(a[k])===String(b[k]));
  const changes=[];
  for(const item of clean)if(!same(before.get(item.id),item))changes.push({type:'upsert',id:item.id,item});
  for(const item of remote.current)if(!after.has(item.id))changes.push({type:'delete',id:item.id});
  if(!changes.length){setItems(clean);return true}
  working.current=true;setBusy(true);setItems(clean);                          // optimistic
  try{
   const result=await applyCalendar(changes);
   apply(normalizeEvents(result.items));
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
