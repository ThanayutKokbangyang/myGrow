import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {pendingReads,subscribeReads} from './loading-state.js';
import './page-loading.css';

export function usePendingRead(resource){
 return useSyncExternalStore(subscribeReads,()=>pendingReads(resource),()=>0)>0;
}

export function PageLoading({active=true,label='กำลังโหลดข้อมูล…',detail='รอสักครู่ เดี๋ยวพร้อมแล้ว'}){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  if(!active){setVisible(false);return}
  const timer=setTimeout(()=>setVisible(true),200);
  return()=>clearTimeout(timer);
 },[active]);
 if(!active||!visible)return null;
 return <div className="growLoading" role="status" aria-live="polite" aria-atomic="true">
  <div className="growLoadingPanel">
   <img className="growLoadingIcon" src="/ui/pixel/sprout.png" width="40" height="40" alt=""/>
   <strong>{label}</strong><span>{detail}</span>
   <div className="growLoadingSteps" aria-hidden="true">{[0,1,2,3].map(step=><i key={step} style={{'--step':step}}/>)}</div>
  </div>
 </div>;
}
