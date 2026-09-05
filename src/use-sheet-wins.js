import {useEffect,useRef,useState} from 'react';
import {loadWins,applyWins,hasOwnerToken,clearOwnerToken} from './api';
import {normalizeWins} from './wins-model';
const LEGACY='grow-small-wins-v1',CACHE='grow-small-wins-cache-v2';
const read=key=>{try{return normalizeWins(JSON.parse(localStorage.getItem(key)||'[]'))}catch{return []}};
export function useSheetWins(onRequireOwner){
 const [wins,setWins]=useState(()=>read(LEGACY).length?read(LEGACY):read(CACHE));
 const [message,setMessage]=useState('กำลังโหลดจาก Google Sheets…'),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState(0);
 const remote=useRef([]),working=useRef(false),legacy=useRef(read(LEGACY));
 function cache(items){try{localStorage.setItem(CACHE,JSON.stringify(items))}catch{}}
 async function refresh(){setReady(false);try{const items=normalizeWins(await loadWins());remote.current=items;const ids=new Set(items.map(w=>w.id)),missing=legacy.current.filter(w=>!ids.has(w.id));setWins([...items,...missing]);setPending(missing.length);cache(items);setReady(true);setMessage(missing.length?`มี ${missing.length} รายการจากเครื่องนี้ รอย้ายเข้า Sheet`:'เชื่อมต่อ Google Sheets แล้ว');}catch(e){setMessage(e.message+' · รายการเดิมยังอยู่ในเครื่อง')}}
 useEffect(()=>{let active=true;loadWins().then(data=>{if(!active)return;const items=normalizeWins(data);remote.current=items;const ids=new Set(items.map(w=>w.id)),missing=legacy.current.filter(w=>!ids.has(w.id));setWins([...items,...missing]);setPending(missing.length);cache(items);setReady(true);setMessage(missing.length?`มี ${missing.length} รายการจากเครื่องนี้ รอย้ายเข้า Sheet`:'เชื่อมต่อ Google Sheets แล้ว')}).catch(e=>{if(active)setMessage(e.message+' · รายการเดิมยังอยู่ในเครื่อง')});return()=>{active=false}},[]);
 async function persist(next){if(working.current)return false;if(!ready){setMessage('เชื่อมต่อ Sheet ให้สำเร็จก่อนบันทึก');return false}if(!hasOwnerToken()){onRequireOwner();setMessage('ยืนยันตัวตนแล้วกดบันทึกอีกครั้ง');return false}working.current=true;setBusy(true);
  try {const previous=new Map(wins.map(w=>[w.id,w])),remoteIds=new Set(remote.current.map(w=>w.id)),nextIds=new Set(next.map(w=>w.id));const changes=next.filter(w=>!remoteIds.has(w.id)||JSON.stringify(w)!==JSON.stringify(previous.get(w.id))).map(w=>({type:'upsert',id:w.id,item:w,createOnly:!remoteIds.has(w.id)}));for(const w of wins)if(!nextIds.has(w.id)&&remoteIds.has(w.id))changes.push({type:'delete',id:w.id});const result=await applyWins(changes),items=normalizeWins(result.items);remote.current=items;setWins(items);cache(items);legacy.current=[];setPending(0);try{localStorage.removeItem(LEGACY)}catch{}setMessage('บันทึกใน Google Sheets แล้ว');return true;
  }catch(e){if(e.status===401){clearOwnerToken();onRequireOwner()}setMessage(e.message);return false}finally{working.current=false;setBusy(false)}
 }
 return {wins,message,setMessage,persist,busy,ready,pending,refresh};
}
