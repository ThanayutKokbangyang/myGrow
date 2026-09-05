import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import './win-celebration.css';
export function WinCelebration({onClose}){
 const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
  const timer=setTimeout(()=>closeRef.current(),4600);
  const escape=e=>{if(e.key==='Escape')closeRef.current()};
  window.addEventListener('keydown',escape);
  return()=>{clearTimeout(timer);window.removeEventListener('keydown',escape)};
 },[]);
 return createPortal(<div className="winVictory"><div className="winVictoryCard">
  <button className="winVictoryClose" type="button" onClick={onClose} aria-label="ปิดฉากฉลอง">×</button>
  <div className="winVictoryStage" aria-hidden="true">
   {[0,1,2,3].map(burst=><div className={'winVictoryBurst burst'+burst} key={burst}>{Array.from({length:12},(_,i)=><i key={i} style={{'--dx':Math.cos(i*Math.PI/6)*72+'px','--dy':Math.sin(i*Math.PI/6)*72+'px','--delay':burst*.35+'s','--spark':['#ffe083','#77dccb','#f39bbd'][burst%3]}}/>)}</div>)}
   <div className="winVictoryShadow"/><div className="winVictoryHero"><span className="winVictorySprite"/><img className="winVictoryCup" src="/ui/pixel/trophy.svg" alt=""/></div><div className="winVictoryGround"/>
  </div>
  <div role="status" aria-live="polite"><p className="winVictoryLabel">SMALL WIN • BIG JOY</p><h2>เก่งมาก วันนี้ทำได้แล้ว!</h2><p>เก็บความสำเร็จลง Sheet แล้ว<br/>อีกหนึ่งก้าวที่น่าภูมิใจของเรา</p></div>
  <button type="button" className="winVictoryContinue" onClick={onClose}>ไปต่อกันเลย!</button>
 </div></div>,document.body);
}
