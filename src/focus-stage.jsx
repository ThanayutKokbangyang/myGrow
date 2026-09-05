import React,{useEffect,useMemo,useRef,useState} from 'react';
import {youtubeId,useDraggable} from './comfort';
import {PomodoroCard} from './pomodoro-card';

const STORE='grow-focus-videos',LAST='grow-focus-last';
const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const clean=list=>Array.isArray(list)?list.filter(v=>v&&/^[\w-]{11}$/.test(v.id)).map(v=>({id:v.id,title:String(v.title||v.id).slice(0,120),addedAt:Number(v.addedAt)||Date.now()})):[];
// The title is a nicety: if oEmbed is unreachable (offline, blocked) the video
// simply keeps whatever name the user typed, or its id.
async function lookupTitle(id){
 try{
  const r=await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
  if(!r.ok)return '';
  return String((await r.json()).title||'').slice(0,120);
 }catch{return ''}
}

export function FocusStage({onClose,timer,setTimer,running,setRunning,phase,setPhase,sessions}){
 const [videos,setVideos]=useState(()=>clean(read(STORE,[])));
 const [playing,setPlaying]=useState(()=>{const id=read(LAST,null);return typeof id==='string'&&/^[\w-]{11}$/.test(id)?id:null});
 const [muted,setMuted]=useState(true);          // starts silent on purpose
 const [url,setUrl]=useState(''),[name,setName]=useState(''),[error,setError]=useState('');
 const [epoch,setEpoch]=useState(0);             // bump to remount the player
 const [barShown,setBarShown]=useState(false);
 const hideBar=useRef(null);
 const apiAlive=useRef(false);
 const frame=useRef(null),timerBox=useRef(null);
 const timerDrag=useDraggable(timerBox,'grow-focus-timer-pos');

 useEffect(()=>{write(STORE,videos)},[videos]);
 useEffect(()=>{if(playing)write(LAST,playing)},[playing]);
 useEffect(()=>{
  const onKey=e=>{if(e.key==='Escape')onClose()};
  addEventListener('keydown',onKey);
  return()=>removeEventListener('keydown',onKey);
 },[onClose]);
 // The player only starts talking back once the parent sends the "listening"
 // handshake. Without it apiAlive never flipped, so every mute toggle fell back
 // to remounting the iframe -- which restarted the video.
 useEffect(()=>{
  const onMessage=e=>{if(typeof e.origin==='string'&&e.origin.includes('youtube'))apiAlive.current=true};
  addEventListener('message',onMessage);
  return()=>removeEventListener('message',onMessage);
 },[]);
 useEffect(()=>{
  if(!playing)return;
  apiAlive.current=false;
  const hello=()=>{try{frame.current?.contentWindow?.postMessage(JSON.stringify({event:'listening',id:'grow-focus',channel:'widget'}),'*')}catch{}};
  const pings=[300,900,1800].map(ms=>setTimeout(hello,ms));
  return()=>pings.forEach(clearTimeout);
 },[playing,epoch]);

 const command=func=>{try{frame.current?.contentWindow?.postMessage(JSON.stringify({event:'command',func,args:[],id:'grow-focus',channel:'widget'}),'*')}catch{}};
 function toggleMute(){
  const next=!muted;
  setMuted(next);
  command(next?'mute':'unMute');   // never remounts: the video keeps playing
 }
 function add(e){
  e.preventDefault();
  const id=youtubeId(url);
  if(!id){setError('ใส่ลิงก์วิดีโอ YouTube ที่ถูกต้อง');return}
  if(videos.some(v=>v.id===id)){setError('มีวิดีโอนี้อยู่แล้ว');return}
  const item={id,title:name.trim()||id,addedAt:Date.now()};
  setVideos(v=>[item,...v]);setUrl('');setName('');setError('');
  if(!name.trim())lookupTitle(id).then(t=>{if(t)setVideos(v=>v.map(x=>x.id===id?{...x,title:t}:x))});
 }
 function remove(id){
  setVideos(v=>v.filter(x=>x.id!==id));
  if(playing===id){setPlaying(null);try{localStorage.removeItem(LAST)}catch{}}
 }

 // Moving the pointer up into the video gives the parent no mouseleave (the
 // iframe eats it), so the bar retires on a timer instead of on :hover alone.
 const revealBar=()=>{
  setBarShown(true);
  clearTimeout(hideBar.current);
  hideBar.current=setTimeout(()=>setBarShown(false),2500);
 };
 useEffect(()=>()=>clearTimeout(hideBar.current),[]);

 // The src must NOT depend on `muted`: writing a new src to a live iframe makes
 // it navigate, which is what restarted the video on every toggle. The flag is
 // baked in when a video starts (or when the reload button bumps `epoch`), and
 // after that only postMessage changes the sound.
 const mutedNow=useRef(muted);mutedNow.current=muted;
 const src=useMemo(
  ()=>playing?`https://www.youtube-nocookie.com/embed/${playing}?autoplay=1&mute=${mutedNow.current?1:0}&rel=0&playsinline=1&loop=1&playlist=${playing}&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`:'',
  [playing,epoch],
 );

 return <div className="focusStage" role="dialog" aria-modal="true" aria-label="โหมดขยาย Pomodoro">
  {playing
   ? <div className="focusVideo">
      <iframe key={`${playing}-${epoch}`} ref={frame} title="วิดีโอโฟกัส" src={src}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>
     </div>
   : <div className="focusLibrary">
      <header><h2>เลือกวิดีโอสำหรับโฟกัส</h2><p>บันทึกลิงก์ไว้ ครั้งหน้ากดเล่นได้เลย · เก็บไว้ในเครื่องนี้เท่านั้น</p></header>
      <form onSubmit={add}>
       <label htmlFor="focus-url">ลิงก์ YouTube</label>
       <input id="focus-url" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" required/>
       <label htmlFor="focus-name">ชื่อที่อยากให้แสดง (ไม่ใส่ก็ได้)</label>
       <div className="focusAddRow">
        <input id="focus-name" type="text" value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="เช่น Lofi ตอนอ่านหนังสือ"/>
        <button className="focusPrimary">บันทึกวิดีโอ</button>
       </div>
       {error&&<p className="focusError" role="alert">{error}</p>}
      </form>
      {videos.length===0
       ? <p className="focusEmpty">ยังไม่มีวิดีโอที่บันทึกไว้ · เพิ่มอันแรกได้เลย</p>
       : <ul className="focusList">{videos.map(v=>
          <li key={v.id}>
           <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy"/>
           <b title={v.title}>{v.title}</b>
           <button type="button" className="focusPrimary" onClick={()=>{setMuted(true);setPlaying(v.id)}}>▶ เล่น</button>
           <button type="button" onClick={()=>remove(v.id)} aria-label={`ลบ ${v.title}`}>ลบ</button>
          </li>)}
         </ul>}
     </div>}

  {/* The very same Pomodoro card as the dashboard, tomato ring and all; it
      just rides along in the corner once a video is playing. */}
  <div ref={timerBox} className="focusTimer floating" style={timerDrag.style}>
   <div className="focusTimerGrip" {...timerDrag.dragProps} title="ลากเพื่อย้ายตำแหน่ง">⠿ ลากได้</div>
   <PomodoroCard {...{timer,setTimer,running,setRunning,phase,setPhase,sessions}}/>
  </div>

  <div className={`focusBottom${barShown||!playing?' show':''}`}
    onMouseEnter={revealBar} onMouseMove={revealBar}
    onMouseLeave={()=>{clearTimeout(hideBar.current);setBarShown(false)}}>
   <div className="focusBar">
   {playing&&<>
    <button type="button" onClick={toggleMute} aria-pressed={!muted}>{muted?'🔇 เสียงปิด':'🔊 เสียงเปิด'}</button>
    <button type="button" onClick={()=>setEpoch(e=>e+1)}>โหลดวิดีโอใหม่</button>
    <button type="button" onClick={()=>setPlaying(null)}>เลือกวิดีโออื่น</button>
   </>}
   <button type="button" className="focusClose" onClick={onClose}>✕ ปิดโหมดขยาย</button>
   </div>
  </div>
 </div>;
}