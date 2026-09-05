import React,{useEffect,useRef,useState} from 'react';

// Three 2048x512 sheets, 4 frames of 512x512 each, played as a CSS sprite.
// Each sheet is an intro followed by a loop, not a four frame cycle:
//   study : [sit down] then read / write / turn the page
//   sleep : [sit on bed, lie down] then sleep / breathe
//   stop  : exhale, idle, check watch, idle with bubble -- all four loop
// Playing all four on repeat made the character sit down again every cycle.
const SHEETS={
 study:{src:'/focus/focus-study.png',label:'กำลังตั้งใจเรียนอยู่'},
 sleep:{src:'/focus/break-sleep.png',label:'พักผ่อนสักครู่'},
 stopped:{src:'/focus/timer-stopped.png',label:'หยุดอยู่'},
};
const WALK_MS=1100;
const prefersReduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// The same walking atlas the room uses: three poses per direction row.
function WalkFrames({direction}){
 const [phase,setPhase]=useState(0);
 useEffect(()=>{
  if(prefersReduced())return;
  const id=setInterval(()=>setPhase(v=>(v+1)%4),140);
  return()=>clearInterval(id);
 },[]);
 const pose=prefersReduced()?0:[1,0,2,0][phase];
 const row={down:0,left:1,right:2,up:3}[direction]??0;
 return <svg className="sceneWalker" viewBox={`${[215,505,785][pose]} ${[5,315,625,935][row]} 220 300`} aria-hidden="true">
  <image href="/tae-walk-sprite.png" width="1199" height="1312"/>
 </svg>;
}

/**
 * mode: 'study' while the focus timer runs, 'sleep' during a break, 'stopped'
 * when the timer is paused. Moving between the desk and the bed plays a short
 * walk first, so the character is seen going there rather than teleporting.
 */
export function PomodoroScene({mode}){
 const [shown,setShown]=useState(mode);
 const [walk,setWalk]=useState(null);         // 'toDesk' | 'toBed'
 const previous=useRef(mode);
 useEffect(()=>{
  if(mode===previous.current)return;
  const from=previous.current;
  previous.current=mode;
  // Only the furniture spots are walked to; stopping happens where they stand.
  if(mode==='stopped'||prefersReduced()){setWalk(null);setShown(mode);return}
  if(from===mode){setShown(mode);return}
  setWalk(mode==='study'?'toDesk':'toBed');
  const id=setTimeout(()=>{setWalk(null);setShown(mode)},WALK_MS);
  return()=>clearTimeout(id);
 },[mode]);

 const sheet=SHEETS[shown]||SHEETS.stopped;
 return <div className="pomoScene" aria-label={sheet.label} role="img">
  {walk
   ? <div className={`sceneWalk ${walk}`}>
      <span className="sceneShadow" aria-hidden="true"/>
      <WalkFrames direction={walk==='toDesk'?'left':'right'}/>
     </div>
   : <>
      <div className={`sceneSprite ${shown}`} key={shown}
        style={{backgroundImage:`url(${sheet.src})`}}/>
      {/* The stopped sheet draws an empty speech bubble on its last frame; the
          caption fades in on exactly that frame, sharing the loop timing. */}
      {shown==='stopped'&&<span className="sceneBubble">
        <i>หยุดอยู่</i>
       </span>}
     </>}
 </div>;
}