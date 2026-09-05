import {useEffect,useRef,useState} from 'react';
import {loadWins,applyWins,hasOwnerToken,clearOwnerToken} from './api';
import {normalizeWins} from './wins-model';
const LEGACY='grow-small-wins-v1',CACHE='grow-small-wins-cache-v2';
const FRESH_MS=60000;
// Module scope, so it outlives the component. SmallWins unmounts every time the
// user leaves the tab; without this the sheet was re-fetched (and the page fell
// back to "กำลังโหลด…") on every single visit.
const store={items:null,at:0,inflight:null};
const read=key=>{try{return normalizeWins(JSON.parse(localStorage.getItem(key)||'[]'))}catch{return []}};
export function rememberWins(items){store.items=items;store.at=Date.now();}
function fetchWins(force){
 if(store.inflight)return store.inflight;                                   // one request even if two callers ask
 if(!force&&store.items&&Date.now()-store.at<FRESH_MS)return Promise.resolve(store.items);
 store.inflight=loadWins()
  .then(data=>{const items=normalizeWins(data);rememberWins(items);return items})
  .finally(()=>{store.inflight=null});
 return store.inflight;
}
export function useSheetWins(onRequireOwner){
 const cached=store.items;
 const legacy=useRef(read(LEGACY));
 const merge=items=>{const ids=new Set(items.map(w=>w.id));const missing=legacy.current.filter(w=>!ids.has(w.id));return {list:[...items,...missing],missing};};
 const connected=n=>n?`มี ${n} รายการจากเครื่องนี้ รอย้ายเข้า Sheet`:'เชื่อมต่อ Google Sheets แล้ว';
 const first=cached?merge(cached):null;
 const [wins,setWins]=useState(()=>first?first.list:(read(LEGACY).length?read(LEGACY):read(CACHE)));
 const [pending,setPending]=useState(first?first.missing.length:0);
 const [ready,setReady]=useState(!!cached);
 const [message,setMessage]=useState(first?connected(first.missing.length):'กำลังโหลดจาก Google Sheets…');
 const [busy,setBusy]=useState(false);
 const remote=useRef(cached||[]),working=useRef(false);
 function cache(items){try{localStorage.setItem(CACHE,JSON.stringify(items))}catch{}}
 function apply(items){
  remote.current=items;
  const {list,missing}=merge(items);
  setWins(list);setPending(missing.length);cache(items);setReady(true);setMessage(connected(missing.length));
 }
 useEffect(()=>{
  let active=true;
  // Already have fresh data from an earlier visit: render it and stay quiet.
  if(cached&&Date.now()-store.at<FRESH_MS)return;
  fetchWins(false)
   .then(items=>{if(active)apply(items)})
   .catch(e=>{if(active&&!cached)setMessage(e.message+' · รายการเดิมยังอยู่ในเครื่อง')});
  return()=>{active=false};
 },[]);
 async function refresh(){
  if(working.current)return;
  working.current=true;setBusy(true);
  try{apply(await fetchWins(true))}
  catch(e){setMessage(e.message+' · รายการเดิมยังอยู่ในเครื่อง')}
  finally{working.current=false;setBusy(false)}
 }
 async function persist(next){
  if(working.current)return false;
  if(!ready){setMessage('เชื่อมต่อ Sheet ให้สำเร็จก่อนบันทึก');return false}
  if(!hasOwnerToken()){onRequireOwner();setMessage('ยืนยันตัวตนแล้วกดบันทึกอีกครั้ง');return false}
  working.current=true;setBusy(true);
  try{
   const previous=new Map(wins.map(w=>[w.id,w])),remoteIds=new Set(remote.current.map(w=>w.id)),nextIds=new Set(next.map(w=>w.id));
   const changes=next.filter(w=>!remoteIds.has(w.id)||JSON.stringify(w)!==JSON.stringify(previous.get(w.id))).map(w=>({type:'upsert',id:w.id,item:w,createOnly:!remoteIds.has(w.id)}));
   for(const w of wins)if(!nextIds.has(w.id)&&remoteIds.has(w.id))changes.push({type:'delete',id:w.id});
   const result=await applyWins(changes),items=normalizeWins(result.items);
   remote.current=items;rememberWins(items);                                // next visit starts from this
   setWins(items);cache(items);legacy.current=[];setPending(0);
   try{localStorage.removeItem(LEGACY)}catch{}
   setMessage('บันทึกใน Google Sheets แล้ว');return true;
  }catch(e){
   if(e.status===401){clearOwnerToken();onRequireOwner()}
   setMessage(e.message);return false;
  }finally{working.current=false;setBusy(false)}
 }
 return {wins,message,setMessage,persist,busy,ready,pending,refresh};
}