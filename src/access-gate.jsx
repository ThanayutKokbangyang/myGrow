import React,{useEffect,useState} from 'react';
import {verifyOwner,verifySession} from './api';
import {PageLoading} from './page-loading';
import './access-gate.css';

export function AccessGate({children}){
 const [open,setOpen]=useState(false),[checking,setChecking]=useState(true);
 const [code,setCode]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function check(){
  setChecking(true);setError('');
  try{await verifySession();setOpen(true)}
  catch(error){setOpen(false);if(error.status!==401)setError('ตรวจสอบการเข้าใช้งานไม่ได้ กรุณาลองอีกครั้ง')}
  finally{setChecking(false)}
 }
 useEffect(()=>{
  // Remove the old long-lived browser token; only the server cookie is used now.
  try{localStorage.removeItem('grow-room-owner-token-v1')}catch{}
  const lock=()=>{setOpen(false);setCode('');setError('')};
  window.addEventListener('grow-session-ended',lock);check();
  return()=>window.removeEventListener('grow-session-ended',lock);
 },[]);
 async function submit(event){
  event.preventDefault();if(busy||!code)return;
  setBusy(true);setError('');
  try{await verifyOwner(code);setCode('');setOpen(true)}
  catch(error){setError(error.message||'เข้าใช้งานไม่สำเร็จ กรุณาลองอีกครั้ง')}
  finally{setBusy(false)}
 }
 if(checking)return <div className="accessScreen"><PageLoading label="กำลังตรวจสอบการเข้าใช้งาน…"/></div>;
 if(open)return children;
 return <main className="accessScreen">
  <form className="accessCard" onSubmit={submit} aria-busy={busy}>
   <img className="accessSprout" src="/ui/pixel/sprout.png" width="52" height="52" alt=""/>
   <h1>ห้องของเท่</h1><p>ใส่รหัสเพื่อเข้าพื้นที่ส่วนตัวของเรา</p>
   <label htmlFor="siteCode">รหัสเข้าเว็บ</label>
   <div className="accessInput"><input id="siteCode" type={visible?'text':'password'} autoComplete="current-password" autoFocus required maxLength={200} value={code} disabled={busy} onChange={event=>setCode(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error?'accessError':undefined}/><button type="button" disabled={busy} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?'ซ่อน':'แสดง'}</button></div>
   {error&&<p className="accessError" id="accessError" role="alert">{error}</p>}
   <button className="accessSubmit" disabled={busy||!code}>{busy?'กำลังเปิดห้อง…':'เข้าห้องของเรา'}</button>
   <button className="accessRetry" type="button" disabled={busy} onClick={check}>ตรวจสอบการเข้าใช้งานอีกครั้ง</button>
  </form>
 </main>;
}
