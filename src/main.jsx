import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {ActivityForm} from "./activity-form";
import {learningDay} from "./learning-model";
import {AccessGate} from "./access-gate";
import "./styles.css";
import {PageLoading,usePendingRead} from "./page-loading";
import {contains,roomGeometry} from "./room-geometry";
import {MusicPlayer, unlockSound, woodStep, winSound, smallWinSound} from "./comfort";
const FocusStage = lazy(() => import("./focus-stage").then(module => ({default: module.FocusStage})));
const TodayPage = lazy(() => import("./learning-pages").then(module => ({default: module.TodayPage})));
const ActivityHistory = lazy(() => import("./learning-pages").then(module => ({default: module.ActivityHistory})));
const LearningStats = lazy(() => import("./learning-pages").then(module => ({default: module.LearningStats})));
const KanbanBoard = lazy(() => import("./kanban").then(module => ({default: module.KanbanBoard})));
const Goals = lazy(() => import("./goals").then(module => ({default: module.Goals})));
const Todos = lazy(() => import("./todos").then(module => ({default: module.Todos})));
const Reflections = lazy(() => import("./reflections").then(module => ({default: module.Reflections})));
const Calendar = lazy(() => import("./calendar").then(module => ({default: module.Calendar})));
const SummaryLibrary = lazy(() => import("./summaries").then(module => ({default: module.SummaryLibrary})));
import {PixelIcon, PomodoroCard, FOCUS_SECONDS, BREAK_SECONDS} from "./pomodoro-card";
import {
  lockSite,
  clearOwnerToken,
  createActivity,
  updateActivity,
  deleteActivity,
  hasOwnerToken,
  loadDashboard,
  verifyOwner,
} from "./api";

const SmallWins = lazy(() => import("./wins").then(module => ({default: module.SmallWins})));

const SKILLS = {
  english: {
    label: "English",
    asset: "/icons/english.png",
    desk: "/desks/desk-00.png",
    color: "#2a9d8f",
    pos: { x: 27, y: 29 },
  },
  coding: {
    label: "Coding",
    asset: "/icons/coding.png",
    desk: "/desks/desk-01.png",
    color: "#3975c6",
    pos: { x: 73, y: 29 },
  },
  math: {
    label: "Math",
    asset: "/icons/math.png",
    desk: "/desks/desk-02.png",
    color: "#7854a7",
    pos: { x: 27, y: 69 },
  },
  cognitive: {
    label: "Cognitive",
    asset: "/icons/cognitive.png",
    desk: "/desks/desk-03.png",
    color: "#e58a17",
    pos: { x: 73, y: 69 },
  },
};
const EMPTY = {
  skill: "english",
  topic: "",
  minutes: 25,
  before: 0,
  after: 0,
  difficulty: 0,
  learned: "",
  problem: "",
  next: "",
};
// Days start at 05:00 (see day.js), so a session logged at 01:00 still counts
// as the day before rather than starting a fresh one.
const dateKey = (d) => learningDay(d);
function findWalkPath(start,end,hitsTable){
  const step=1,minX=3,maxX=97,minY=12,maxY=94;
  const cols=Math.floor((maxX-minX)/step)+1,rows=Math.floor((maxY-minY)/step)+1;
  
  const cell=p=>({
    x:Math.max(0,Math.min(cols-1,Math.round((p.x-minX)/step))),
    y:Math.max(0,Math.min(rows-1,Math.round((p.y-minY)/step)))
  });
  const point=c=>({x:minX+c.x*step,y:minY+c.y*step});
  const from=cell(start),to=cell(end),key=c=>`${c.x},${c.y}`;
  
  const blocked=c=>hitsTable(point(c));
  if(hitsTable(end))return [];
  const clearSegment=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*4));for(let i=1;i<=n;i++){if(hitsTable({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;}return true;};
  const open=[from],came=new Map(),g=new Map([[key(from),0]]),seen=new Set();
  
  while(open.length){
    open.sort((a,b)=>
      (g.get(key(a))+Math.abs(a.x-to.x)+Math.abs(a.y-to.y))-
      (g.get(key(b))+Math.abs(b.x-to.x)+Math.abs(b.y-to.y))
    );
    
    const cur=open.shift(),ck=key(cur);
    
    if(ck===key(to)){
      const raw=[];
      let n=cur;
      while(n){
        raw.unshift(point(n));
        n=came.get(key(n));
      }
      raw[0]=start;
      raw[raw.length-1]=end;
      
      const simple=[raw[0]];
      for(let i=1;i<raw.length-1;i++){
        const a=simple[simple.length-1],b=raw[i],c=raw[i+1];
        if((a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y))continue;
        simple.push(b);
      }
      simple.push(end);
      if(!simple.slice(1).every((p,i)=>clearSegment(simple[i],p)))return [];
      return simple.slice(1);
    }
    
    if(seen.has(ck))continue;
    seen.add(ck);
    
    for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const n={x:cur.x+dx,y:cur.y+dy};
      if(n.x<0||n.x>=cols||n.y<0||n.y>=rows||blocked(n)||seen.has(key(n)))continue;
      const score=(g.get(ck)||0)+1;
      if(score<(g.get(key(n))??Infinity)){
        came.set(key(n),cur);
        g.set(key(n),score);
        open.push(n);
      }
    }
  }
  return[];
}

function App() {
  const [view, setView] = useState("today");
  const [currentLearningDay,setCurrentLearningDay]=useState(()=>learningDay());
  useEffect(()=>{const tick=()=>setCurrentLearningDay(learningDay());const timer=setInterval(tick,30000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick)}},[]);
  const resource={today:"dashboard",progress:"learning-stats",history:"activities",goals:"goals",todos:"todos",reflections:"todos",calendar:"calendar",wins:"wins",summaries:"summaries",kanban:"kanban"}[view];
  const reading=usePendingRead(`/api/${resource}`);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("grow-sound") !== "off");
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;
  const victoryStop = useRef(null);
  useEffect(()=>{if(!soundEnabled)victoryStop.current?.();return ()=>victoryStop.current?.();},[soundEnabled]);
  const celebrateSmallWin = () => { victoryStop.current?.(); if(soundRef.current) victoryStop.current=smallWinSound(); };
  const celebrateSound = () => { if(soundRef.current) winSound(); };
  const [logs, setLogs] = useState([]);
  const [summary,setSummary]=useState({total:0,minutes:0,gain:0,activeDays:0,streak:0,xp:0,totals:{english:0,coding:0,math:0,cognitive:0}});
  const [dashboardReady,setDashboardReady]=useState(false),[dashboardError,setDashboardError]=useState(''),[learningVersion,setLearningVersion]=useState(0),[saveError,setSaveError]=useState('');
  const dashboardRequest=useRef(0);
  const [modal, setModal] = useState(null);
  useEffect(()=>setSaveError(''),[modal]);
  const openActivity=skill=>{setSaveError('');setModal({...EMPTY,skill:skill||'english'})};
  const editActivity=item=>{setSaveError('');setModal(item)};
  const [verify, setVerify] = useState(null);
  const [toast, setToast] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const [growthEvent, setGrowthEvent] = useState(null);
  const [pos, setPos] = useState({ x: 48, y: 52 });
  const [direction, setDirection] = useState("down");
  const [walking, setWalking] = useState(false);
  const [timer, setTimer] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("focus");   // "focus" | "break"
  const [stage, setStage] = useState(false);
  const [sessions, setSessions] = useState(() =>
    Number(localStorage.getItem("grow-sessions") || 0),
  );
  const roomRef = useRef(null);
  const characterRef = useRef(null);
  const walkAnimation = useRef(null);
  const posRef = useRef(pos);
  const directionRef = useRef(direction);
  const celebrateTimer = useRef(null);
  const deletingIds = useRef(new Set());
  const audioCtx = useRef(null);
  const playBeep = (freq = 880, duration = 0.15, volume = 0.25) => {
    if (!soundRef.current) return;
    try {
      if (!audioCtx.current)
        audioCtx.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      const ctx = audioCtx.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + duration,
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };
  const playFinish = celebrateSound;
  useEffect(() => {
    if (!walking || view !== "today" || !soundEnabled) return;
    const step = () => { if (!document.hidden) woodStep(); };
    step();
    const timer = setInterval(step, 280);
    return () => clearInterval(timer);
  }, [walking, view, soundEnabled]);
  async function refreshDashboard(force=false){
    const request=++dashboardRequest.current;setDashboardError('');
    try{let result=await loadDashboard(force);if(result.today!==learningDay())result=await loadDashboard(true);if(request!==dashboardRequest.current)return;setLogs(result.todayItems||[]);if(result.summary)setSummary(result.summary);setDashboardReady(true)}
    catch(error){if(request===dashboardRequest.current)setDashboardError(error.message)}
  }
  useEffect(() => {
    ["down", "up", "left", "right"].forEach((name) => {
      const image = new Image();
      image.src = `/sprite/directions/${name}.png`;
    });
  }, []);
  useEffect(()=>{if(view==='today')refreshDashboard()},[view,currentLearningDay]);
  useEffect(() => localStorage.setItem("grow-sessions", sessions), [sessions]);
  // Lets the floating music player lift itself above the focus stage, so the
  // video can be muted and a different track played over it.
  useEffect(() => {
    document.body.classList.toggle("stage-open", stage);
    return () => document.body.classList.remove("stage-open");
  }, [stage]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () =>
        setTimer((v) => {
          if (v <= 1) {
            // A finished focus session rolls straight into the 5 minute break,
            // which is what sends the character off to the bed; the break then
            // hands back to a fresh, paused focus session.
            if (phase === "focus") {
              setSessions((s) => s + 1);
              setPhase("break");
              notify("โฟกัสครบ 25 นาทีแล้ว · พัก 5 นาที");
              playFinish();
              return BREAK_SECONDS;
            }
            setRunning(false);
            setPhase("focus");
            notify("พักครบแล้ว พร้อมลุยรอบต่อไป");
            playFinish();
            return FOCUS_SECONDS;
          }
          if (v <= 11) playBeep(660, 0.1, 0.18);
          return v - 1;
        }),
      1000,
    );
    return () => clearInterval(id);
  }, [running, phase]);
  useEffect(
    () => () => {
      cancelAnimationFrame(walkAnimation.current);
      clearTimeout(celebrateTimer.current);
    },
    [],
  );
  const today = currentLearningDay;
  const todayLogs = logs.filter((x) => dateKey(x.date) === today);
  const xp = Number(summary.xp||0);
  // Consecutive days, not "days ever logged": a gap resets it. Today being
  // empty so far does not break the run -- only a whole missed day does.
  const streak = Number(summary.streak||0);
  const notify = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 2400);
  };
  function moveTo(next,done){
  cancelAnimationFrame(walkAnimation.current);
  setWalking(false);
  const geometry=roomGeometry(roomRef.current,characterRef.current);
  const route=findWalkPath({...posRef.current},next,p=>geometry.some(d=>contains(d.collision,p)));
  if(!route.length)return false;
  setWalking(true);
  let index=0;
  const nextSegment=()=>{
    if(index>=route.length){
      setPos(next);
      setWalking(false);
      
      setDirection(directionRef.current);
      
      done?.();
      return;
    }
    
    const start={...posRef.current};
    const target=route[index++];
    const dx=target.x-start.x;
    const dy=target.y-start.y;
    const distance=Math.hypot(dx,dy);
    
    if(distance<.1){
      nextSegment();
      return;
    }
    
    const segmentDirection=Math.abs(dx)>=Math.abs(dy)
      ?(dx>0?'right':'left')
      :(dy>0?'down':'up');
    
    directionRef.current=segmentDirection;
    setPos(start);
    setDirection(segmentDirection);
    
    
    const duration=Math.max(180,distance*46);
    const started=performance.now();
    
    const tick=now=>{
      const progress=Math.min(1,(now-started)/duration);
      const current={x:start.x+dx*progress,y:start.y+dy*progress};
      posRef.current=current;
      
      if(characterRef.current&&roomRef.current){
        const x=roomRef.current.clientWidth*current.x/100;
        const y=roomRef.current.clientHeight*current.y/100;
        characterRef.current.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
        characterRef.current.style.setProperty("--depth-scale", .84 + current.y * .003);
      }
      
      if(progress<1){
        walkAnimation.current=requestAnimationFrame(tick);
      }else{
        nextSegment();
      }
    };
    
    walkAnimation.current=requestAnimationFrame(tick);
  };
  
  nextSegment();
  return true;
}
  function walk(e) {
    const room=roomRef.current,r=room.getBoundingClientRect();
    const point={x:e.clientX-r.left-room.clientLeft,y:e.clientY-r.top-room.clientTop};
    const desks=roomGeometry(room,characterRef.current);
    const hit=desks.find(d=>contains(d.raw,point));
    if(hit){goSkill(hit.code);return;}
    const next={x:Math.max(3,Math.min(97,point.x/room.clientWidth*100)),y:Math.max(12,Math.min(94,point.y/room.clientHeight*100))};
    if(!moveTo(next))notify("จุดนี้เดินไปไม่ได้ ลองเลือกพื้นที่ข้างโต๊ะนะ");
  }
  function goSkill(k){
    const desk=roomGeometry(roomRef.current,characterRef.current).find(d=>d.code===k);
    if(!desk)return;
    const r=desk.collision,cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2;
    const candidates=[{x:cx,y:r.bottom+2,dir:'up'},{x:r.left-2,y:cy,dir:'right'},{x:r.right+2,y:cy,dir:'left'},{x:cx,y:r.top-2,dir:'down'}]
      .filter(p=>p.x>=3&&p.x<=97&&p.y>=12&&p.y<=94)
      .sort((a,b)=>Math.hypot(a.x-posRef.current.x,a.y-posRef.current.y)-Math.hypot(b.x-posRef.current.x,b.y-posRef.current.y));
    for(const p of candidates){if(moveTo({x:p.x,y:p.y},()=>{directionRef.current=p.dir;setDirection(p.dir);setModal({...EMPTY,skill:k});}))return;}
    notify("ยังเดินเข้าโต๊ะนี้ไม่ได้ ลองขยับออกมาก่อนนะ");
  }
  async function saveNow(data) {
    const editing=Boolean(data.id);
    const item={...data,id:data.id||data.draftId||crypto.randomUUID(),date:data.date||new Date().toISOString(),minutes:Number(data.minutes),before:Number(data.before),after:Number(data.after),difficulty:Number(data.difficulty)};
    setSaveError('');
    try{
      await (editing?updateActivity(item):createActivity(item));
      setLearningVersion(value=>value+1);refreshDashboard(true);setModal(null);
      if(!editing){setGrowthEvent(item.id);setCelebrating(true);celebrateSound();clearTimeout(celebrateTimer.current);celebrateTimer.current=setTimeout(()=>setCelebrating(false),2400)}
      notify(editing?'แก้ไขบันทึกแล้ว':'บันทึกกิจกรรมแล้ว');return true;
    }catch(error){setSaveError(error.message);return false}
  }
  function save(data){if(!data.topic.trim())return Promise.resolve(false);return saveNow(data)}
  async function removeNow(id){
    if(deletingIds.current.has(String(id)))return false;
    deletingIds.current.add(String(id));
    try{await deleteActivity(id);setLearningVersion(value=>value+1);refreshDashboard(true);notify('ลบบันทึกแล้ว');return true}
    catch(error){notify('ลบไม่สำเร็จ: '+error.message);return false}
    finally{deletingIds.current.delete(String(id))}
  }
  function remove(id){return removeNow(id)}
  async function confirmOwner(code) {
    await verifyOwner(code);
    const pending = verify;
    setVerify(null);
    notify("ยืนยันว่าเป็นเท่แล้ว เบราว์เซอร์จะจำไว้");
    if (pending?.type === "save") await saveNow(pending.data);
    if (pending?.type === "delete") await removeNow(pending.id);
    if (pending?.type === "todos") await pending.action();
  }
  return (
    <div className="app" onPointerDownCapture={unlockSound} onKeyDownCapture={unlockSound}>
      <aside>
        <div className="brand">
          <PixelIcon name="sprout" />
          GROW ROOM
        </div>
        {[
          ["today", "/ui/nav-home.png", "วันนี้"],
          ["history", "/ui/nav-history.png", "บันทึกการฝึก"],
          ["progress", "/ui/nav-progress.png", "สถิติการฝึก"],
          ["goals", "/goals/goal/dream.png", "เป้าหมาย"],
          ["kanban", "/ui/pixel/board.svg", "บอร์ดงาน"],
          ["todos", "/todos/todo-board.png", "ภารกิจวันนี้"],
          ["reflections", "/goals/plan/journal.png", "ห้องสารภาพ"],
          ["calendar", "/calendar/icons/calendar-month.png", "ปฏิทิน"],
          ["wins", "/ui/pixel/trophy.svg", "ความสำเร็จเล็ก ๆ"],
          ["summaries", "/summaries/summary-icon.png", "สรุปของเรา"],
        ].map(([k, asset, l]) => (
          <button
            className={view === k ? "active" : ""}
            onClick={() => setView(k)}
            title={l}
            aria-label={l}
            key={k}
          >
            <img className="navPixelIcon" src={asset} alt="" />
            <span className="navLabel">{l}</span>
          </button>
        ))}
        <button className="soundToggle" title={soundEnabled ? "ปิดเสียงเกม" : "เปิดเสียงเกม"} aria-label={soundEnabled ? "ปิดเสียงเกม" : "เปิดเสียงเกม"} aria-pressed={soundEnabled} onClick={() => {const next=!soundEnabled;setSoundEnabled(next);try{localStorage.setItem("grow-sound",next?"on":"off")}catch{}}}>{soundEnabled?"♪":"♫"}<span className="navLabel">{soundEnabled?"เสียงเปิด":"เสียงปิด"}</span></button>
        <button title="ล็อกเว็บ" aria-label="ล็อกเว็บ" onClick={()=>lockSite().catch(error=>notify(error.message))}><PixelIcon name="close"/><span className="navLabel">ล็อกเว็บ</span></button>
        <div className="asideBottom">
          <div className="avatarMini">
            <img src="/tae-avatar.webp" alt="" />
          </div>
          <div>
            <b>Tae</b>
            <small>LV {Math.floor(xp / 500) + 1}</small>
          </div>
          <PixelIcon name="gear" />
        </div>
      </aside>
      <main aria-busy={reading}>
        <PageLoading key={view} active={reading}/>
        <Suspense fallback={<PageLoading label="กำลังเปิดหน้า…"/>}>
        {view === "today" ? (
          <TodayPage skills={SKILLS} todayLogs={todayLogs} summary={summary} ready={dashboardReady} error={dashboardError} onRetry={()=>refreshDashboard(true)} onLog={openActivity} onEdit={editActivity} onView={setView} room={<PixelRoom {...{pos,direction,walking,celebrating,walk,goSkill,roomRef,characterRef}}/>} {...{timer,setTimer,running,setRunning,phase,setPhase,sessions}} openStage={()=>setStage(true)}/>
        ) : view === "kanban" ? (
          <KanbanBoard/>
        ) : view === "goals" ? (
          <Goals onRequireOwner={()=>setVerify({type:"goals"})} onSuccess={celebrateSmallWin} />
        ) : view === "todos" ? (
          <Todos onRequireOwner={(action)=>setVerify({type:"todos",action})} onSuccess={celebrateSmallWin} />
        ) : view === "reflections" ? (
          <Reflections onRequireOwner={(action)=>setVerify({type:"todos",action})} />
        ) : view === "calendar" ? (
          <Calendar onRequireOwner={()=>setVerify({type:"calendar"})} onSuccess={celebrateSmallWin} />
        ) : view === "wins" ? (
          <SmallWins onSuccess={celebrateSmallWin} onRequireOwner={()=>setVerify({type:"wins"})} />
        ) : view === "summaries" ? (
          <SummaryLibrary onRequireOwner={(action)=>setVerify({type:"todos",action})} onSuccess={celebrateSmallWin} />
        ) : view === "history" ? (
          <ActivityHistory skills={SKILLS} onLog={openActivity} onEdit={editActivity} onRemove={remove} version={`${learningVersion}:${currentLearningDay}`}/>
        ) : (
          <LearningStats skills={SKILLS} onLog={openActivity} version={`${learningVersion}:${currentLearningDay}`}/>
        )}
        </Suspense>
      </main>
      {modal && (
        <ActivityForm
          initial={modal}
          skills={SKILLS}
          error={saveError}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}{" "}
      {verify && (
        <VerifyModal onClose={() => setVerify(null)} onConfirm={confirmOwner} />
      )}{" "}
      {toast && (
        <div className="toast">
          <PixelIcon name="bolt" /> {toast}
        </div>
      )}
      <MusicPlayer />
      {stage && (
        <Suspense fallback={<PageLoading label="กำลังเปิดห้องโฟกัส…"/>}>
        <FocusStage
          onClose={() => setStage(false)}
          {...{ timer, setTimer, running, setRunning, phase, setPhase, sessions }}
        />
        </Suspense>
      )}
    </div>
  );
}

function SkillArt({ skill }) {
  const s = SKILLS[skill];
  return <img className="skillArt" src={s.asset} alt="" />;
}

function PixelRoom({pos,direction,walking,celebrating,walk,goSkill,roomRef,characterRef}) {
 return <div className="dashboard pixelDashboard learningRoom">
      <section className="roomPanel">
        <div className="room" ref={roomRef} onClick={walk}>
          {Object.entries(SKILLS).map(([k, s]) => (
            <Station key={k} code={k} {...s} onClick={e => { if(e.detail===0){ e.stopPropagation(); goSkill(k); } }} />
          ))}
          <div
            ref={characterRef}
            className={`character ${walking ? "walk" : ""} ${celebrating ? "celebrate" : ""}`}
            style={{
              transform: `translate3d(${pos.x}cqw,${pos.y}cqh,0) translate(-50%,-50%)`,
              "--depth-scale": .84 + pos.y * .003,
            }}
            role="img"
            aria-label="ตัวละคร Tae"
          >
            <div className="characterVisual">
              <span className="characterGroundShadow" />
              <WalkingSprite direction={direction} walking={walking} />
            </div>
          </div>
          {celebrating && (
            <div className="celebration" aria-hidden="true">
              <strong>GREAT JOB!</strong>
              {[0, 1, 2].map((b) => (
                <span className={`firework f${b}`} key={b}>
                  {Array.from({ length: 16 }, (_, i) => (
                    <i style={{ "--i": i }} key={i} />
                  ))}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
 </div>;
}
// The original atlas contains three poses per direction, including real alternating steps.
function WalkingSprite({ direction, walking }) {
  const [phase, setPhase] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setPhase(0);
    if (!walking || reducedMotion) return;
    const timer = setInterval(() => setPhase(value => (value + 1) % 4), 140);
    return () => clearInterval(timer);
  }, [walking, reducedMotion]);
  const pose = walking && !reducedMotion ? [1, 0, 2, 0][phase] : 0;
  const row = { down: 0, left: 1, right: 2, up: 3 }[direction] ?? 0;
  const x = [215, 505, 785][pose];
  const y = [5, 315, 625, 935][row];
  return (
    <svg className="walkingSprite" viewBox={`${x} ${y} 220 300`} aria-hidden="true">
      <image href="/tae-walk-sprite.png" width="1199" height="1312" />
    </svg>
  );
}

function Station({ code, label, desk, color, onClick, pos }) {
  return (
    <button
      className={`station ${code}`}
      data-skill={code}
      style={{ "--c": color, left: `${pos.x}%`, top: `${pos.y}%` }}
      onClick={onClick}
    >
      <img className="deskArt" src={desk} alt="" />
      <b>{label}</b>
    </button>
  );
}

function VerifyModal({ onClose, onConfirm }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onConfirm(code);
    } catch (err) {
      setError(err.message || "รหัสไม่ถูกต้อง");
      setBusy(false);
    }
  }
  return (
    <div className="backdrop verifyBackdrop">
      <form className="modal verifyModal" onSubmit={submit}>
        <button type="button" className="close" onClick={onClose}>
          <PixelIcon name="close" />
        </button>
        <PixelIcon name="sprout" className="verifyBadge" />
        <p className="eyebrow">OWNER CHECK</p>
        <h2>ยืนยันว่าเป็นเท่</h2>
        <p>
          ใส่รหัสครั้งแรกครั้งเดียว เบราว์เซอร์เครื่องนี้จะจำการยืนยันไว้ให้
        </p>
        <label>
          รหัสยืนยัน
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="••••••"
            required
          />
        </label>
        {error && <div className="verifyError">{error}</div>}
        <button className="primary verifySubmit" disabled={busy} type="submit">
          <PixelIcon name="check" />
          {busy ? "กำลังยืนยัน..." : "ยืนยันและบันทึก"}
        </button>
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<AccessGate><App /></AccessGate>);

// Installed-app support: registering the service worker is what lets iOS keep
// Grow Room on the home screen and open it offline. Dev builds skip it so the
// Vite HMR server is never served from the cache.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
