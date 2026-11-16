import React from 'react';
import {PomodoroScene} from './pomodoro-scene';

const uiIcon=name=>`/ui/pixel/${name}.png`;
export function PixelIcon({name,className=''}){
 return <img className={`pixelIcon ${className}`} src={uiIcon(name)} alt=""/>;
}
export const FOCUS_SECONDS=25*60,BREAK_SECONDS=5*60;

// One Pomodoro card, shared by the dashboard and the full-screen focus stage,
// so the tomato ring, the readout and the buttons are literally the same thing
// in both places. `tools` is whatever belongs next to the session counter
// (the expand button on the dashboard, nothing in the stage).
export function PomodoroCard({timer,setTimer,running,setRunning,sessions,phase='focus',setPhase,tools=null,className='',scene=true}){
 const total=phase==='break'?BREAK_SECONDS:FOCUS_SECONDS;
 // Asleep until the clock is actually touched: a full, idle focus block means
 // the day has not started yet (or has just been reset), so the character is in
 // bed. Pausing part way through is what shows the "stopped" pose instead.
 const idleAtFullBlock=!running&&phase==='focus'&&timer===FOCUS_SECONDS;
 const mode=running?(phase==='break'?'sleep':'study'):idleAtFullBlock?'sleep':'stopped';
 function reset(){
  setRunning(false);
  setPhase?.('focus');
  setTimer(FOCUS_SECONDS);
 }
 return <div className={`card timer ${className}`}>
  <div className="metricTitle">
   <b>Pomodoro</b>
   <span className="metricTools"><strong>{sessions}/6</strong>{tools}</span>
  </div>
  <div className={`timerBody${scene?' withScene':''}`}>
   {scene&&<PomodoroScene mode={mode}/>}
   <div className={`tomatoRing ${running?'ticking':''} ${phase==='break'?'resting':''}`}
     style={{'--timer-progress':`${(timer/total)*360}deg`}}>
    <img src="/ui/pomodoro.png" alt=""/>
   </div>
   <div className="timerReadout">
    <strong>
     {String(Math.floor(timer/60)).padStart(2,'0')}:{String(timer%60).padStart(2,'0')}
    </strong>
    <small>{phase==='break'?'BREAK TIME':'FOCUS SESSION'}</small>
   </div>
   <div className="timerActions">
    <button className={running?'timerStop':'timerStart'} onClick={()=>setRunning(!running)}>
     <PixelIcon name={running?'pause':'play'}/>
     {running?'Pause':'Start'}
    </button>
    <button className="timerReset" onClick={reset} aria-label="เริ่ม Pomodoro ใหม่">
     <PixelIcon name="reset"/>
     Reset
    </button>
   </div>
  </div>
 </div>;
}