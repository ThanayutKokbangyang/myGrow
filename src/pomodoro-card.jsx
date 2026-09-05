import React from 'react';

const uiIcon=name=>`/ui/pixel/${name}.png`;
export function PixelIcon({name,className=''}){
 return <img className={`pixelIcon ${className}`} src={uiIcon(name)} alt=""/>;
}

// One Pomodoro card, shared by the dashboard and the full-screen focus stage,
// so the tomato ring, the readout and the buttons are literally the same thing
// in both places. `tools` is whatever belongs next to the session counter
// (the expand button on the dashboard, nothing in the stage).
export function PomodoroCard({timer,setTimer,running,setRunning,sessions,tools=null,className=''}){
 return <div className={`card timer ${className}`}>
  <div className="metricTitle">
   <b>Pomodoro</b>
   <span className="metricTools"><strong>{sessions}/6</strong>{tools}</span>
  </div>
  <div className="timerBody">
   <div className={`tomatoRing ${running?'ticking':''}`} style={{'--timer-progress':`${(timer/1500)*360}deg`}}>
    <img src="/ui/pomodoro.png" alt=""/>
   </div>
   <div className="timerReadout">
    <strong>
     {String(Math.floor(timer/60)).padStart(2,'0')}:{String(timer%60).padStart(2,'0')}
    </strong>
    <small>FOCUS SESSION</small>
   </div>
   <div className="timerActions">
    <button className={running?'timerStop':'timerStart'} onClick={()=>setRunning(!running)}>
     <PixelIcon name={running?'pause':'play'}/>
     {running?'Pause':'Start'}
    </button>
    <button className="timerReset" onClick={()=>{setRunning(false);setTimer(25*60)}} aria-label="เริ่ม Pomodoro ใหม่">
     <PixelIcon name="reset"/>
     Reset
    </button>
   </div>
  </div>
 </div>;
}