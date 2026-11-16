import {useEffect,useRef,useState} from 'react';
import {applyKanban,getCachedKanban,loadKanban} from './api';
import {changesBetween} from './kanban-model';

export function useKanban(){
 const cached=getCachedKanban();
 const [items,setItems]=useState(()=>cached?.items||[]),[ready,setReady]=useState(Boolean(cached));
 const [busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const remote=useRef(cached?.items||[]),working=useRef(false),alive=useRef(true);
 const accept=result=>{remote.current=result.items||[];setItems(remote.current);setReady(true)};
 useEffect(()=>{
  alive.current=true;let active=true;
  loadKanban().then(result=>{if(active)accept(result)}).catch(error=>{if(active)setError(error.message)});
  return()=>{active=false;alive.current=false};
 },[]);
 async function refresh(){
  if(working.current)return;
  working.current=true;setRefreshing(true);setError('');
  try{const result=await loadKanban(true);if(alive.current){accept(result);setNotice('โหลดบอร์ดล่าสุดแล้ว')}}
  catch(error){if(alive.current)setError(error.message)}
  finally{working.current=false;if(alive.current)setRefreshing(false)}
 }
 async function persist(next,message){
  if(working.current||!ready)return false;
  const changes=changesBetween(remote.current,next);
  if(!changes.length)return true;
  working.current=true;setBusy(true);setError('');setNotice('');setItems(next);
  try{
   const result=await applyKanban(changes);
   if(alive.current){accept(result);setNotice(message||'บันทึกบอร์ดแล้ว')}
   return true;
  }catch(error){
   if(alive.current){setItems(remote.current);setError(error.message)}
   return false;
  }finally{working.current=false;if(alive.current)setBusy(false)}
 }
 return {items,ready,busy:busy||refreshing,saving:busy,error,notice,persist,refresh};
}
