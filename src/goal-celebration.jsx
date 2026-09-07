import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import './goal-celebration.css';

export function GoalCelebration({allDone,goalTitle,onClose}){
 const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
  const timer=setTimeout(()=>closeRef.current(),allDone?6500:3800);
  const escape=event=>{if(event.key==='Escape')closeRef.current()};
  window.addEventListener('keydown',escape);
  return()=>{clearTimeout(timer);window.removeEventListener('keydown',escape)};
 },[allDone]);
 const sparks=Array.from({length:allDone?30:10},(_,index)=>index);
 return createPortal(<div className={`goalVictory ${allDone?'grand':'step'}`} onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section className="goalVictoryCard" role="dialog" aria-modal="true" aria-label={allDone?'ฉลองเป้าหมายสำเร็จ':'ฉลองแผนสำเร็จ'}>
   <button className="goalVictoryClose" type="button" onClick={onClose} aria-label="ปิดฉากฉลอง">×</button>
   <div className="goalVictoryStage" aria-hidden="true">
    {allDone&&<div className="goalVictoryRays"/>}
    <div className="goalVictorySparks">{sparks.map(index=><i key={index} style={{'--n':index,'--delay':`${(index%6)*.09}s`,'--x':`${(index%5-2)*28}px`}}/>)}</div>
    <div className="goalVictoryPlatform"><span/><span/><span/></div>
    <img className="goalVictoryTae" src="/calendar/characters/schedule-complete.png" alt=""/>
    <div className="goalVictoryBadge">{allDone?<img src="/goals/goal/trophy.png" alt=""/>:<span>✓</span>}</div>
   </div>
   <div className="goalVictoryCopy" role="status" aria-live="polite">
    <p>{allDone?'100% • GOAL COMPLETE':'PLAN COMPLETE • ONE STEP CLOSER'}</p>
    <h2>{allDone?'ทำเป้าหมายสำเร็จแล้ว!':'สำเร็จไปอีกหนึ่งแผน!'}</h2>
    <span><strong>{goalTitle}</strong><br/>{allDone?'ทุกก้าวที่ทำมาพาเราถึงตรงนี้แล้ว':'ก้าวเล็ก ๆ นี้กำลังพาเราเข้าใกล้เป้าหมาย'}</span>
   </div>
   <button className="goalVictoryContinue" type="button" onClick={onClose}>{allDone?'รับถ้วยรางวัล!':'ไปต่อกันเลย!'}</button>
  </section>
 </div>,document.body);
}
