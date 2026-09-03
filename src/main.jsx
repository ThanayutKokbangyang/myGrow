import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  clearOwnerToken,
  createActivity,
  deleteActivity,
  hasOwnerToken,
  loadActivities,
  verifyOwner,
} from "./api";

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
  before: 2,
  after: 3,
  difficulty: 3,
  learned: "",
  problem: "",
  next: "",
};
const dateKey = (d) => new Date(d).toLocaleDateString("th-TH");
const uiIcon = (name) => `/ui/pixel/${name}.png`;
function PixelIcon({ name, className = "" }) {
  return <img className={`pixelIcon ${className}`} src={uiIcon(name)} alt="" />;
}
const hitsTable = (p) =>
  Object.values(SKILLS).some(
    (s) => Math.abs(p.x - s.pos.x) < 18 && Math.abs(p.y - s.pos.y) < 20,
  );

function findWalkPath(start,end){
  const step=2,minX=3,maxX=97,minY=12,maxY=94;
  const cols=Math.floor((maxX-minX)/step)+1,rows=Math.floor((maxY-minY)/step)+1;
  
  const cell=p=>({
    x:Math.max(0,Math.min(cols-1,Math.round((p.x-minX)/step))),
    y:Math.max(0,Math.min(rows-1,Math.round((p.y-minY)/step)))
  });
  const point=c=>({x:minX+c.x*step,y:minY+c.y*step});
  const from=cell(start),to=cell(end),key=c=>`${c.x},${c.y}`;
  
  // ลดระยะการชนโต๊ะลงอีก (14/16 → 10/12)
  const hitsTable=p=>
    Object.values(SKILLS).some(s=>
      Math.abs(p.x-s.pos.x)<10&&Math.abs(p.y-s.pos.y)<12
    );
  
  // ไม่ block จุดเริ่มต้น และจุดปลายทาง
  const blocked=c=>{
    const ck=key(c);
    if(ck===key(from)||ck===key(to))return false;
    return hitsTable(point(c));
  };
  
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
  const [logs, setLogs] = useState(() =>
    JSON.parse(
      localStorage.getItem("grow-logs-cache") ||
        localStorage.getItem("grow-logs") ||
        "[]",
    ),
  );
  const [modal, setModal] = useState(null);
  const [verify, setVerify] = useState(null);
  const [toast, setToast] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const [pos, setPos] = useState({ x: 48, y: 52 });
  const [direction, setDirection] = useState("down");
  const [walking, setWalking] = useState(false);
  const [timer, setTimer] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(() =>
    Number(localStorage.getItem("grow-sessions") || 0),
  );
  const roomRef = useRef(null);
  const characterRef = useRef(null);
  const spriteRef = useRef(null);
  const walkAnimation = useRef(null);
  const posRef = useRef(pos);
  const directionRef = useRef(direction);
  const celebrateTimer = useRef(null);
  const deletingIds = useRef(new Set());
  const audioCtx = useRef(null);
  const playBeep = (freq = 880, duration = 0.15, volume = 0.25) => {
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
  const playFinish = () => {
    [880, 1108, 1318].forEach((f, i) =>
      setTimeout(() => playBeep(f, 0.28, 0.3), i * 180),
    );
  };
  useEffect(() => {
    let active = true;
    loadActivities()
      .then((items) => {
        if (active) setLogs(items);
      })
      .catch((error) => notify(error.message));
    ["down", "up", "left", "right"].forEach((name) => {
      const image = new Image();
      image.src = `/sprite/directions/${name}.png`;
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () => localStorage.setItem("grow-logs-cache", JSON.stringify(logs)),
    [logs],
  );
  useEffect(() => localStorage.setItem("grow-sessions", sessions), [sessions]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () =>
        setTimer((v) => {
          if (v <= 1) {
            setRunning(false);
            setSessions((s) => s + 1);
            notify("Pomodoro สำเร็จ! +25 XP");
            playFinish();
            return 25 * 60;
          }
          if (v <= 11) playBeep(660, 0.1, 0.18);
          return v - 1;
        }),
      1000,
    );
    return () => clearInterval(id);
  }, [running]);
  useEffect(
    () => () => {
      cancelAnimationFrame(walkAnimation.current);
      clearTimeout(celebrateTimer.current);
    },
    [],
  );
  const today = dateKey(new Date());
  const todayLogs = logs.filter((x) => dateKey(x.date) === today);
  const minutes = todayLogs.reduce((a, b) => a + Number(b.minutes), 0);
  const xp =
    logs.reduce((a, b) => a + Number(b.minutes) * 2, 0) + sessions * 25;
  const streak = new Set(logs.map((x) => dateKey(x.date))).size;
  const notify = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 2400);
  };
  function moveTo(next,done){
  cancelAnimationFrame(walkAnimation.current);
  const route=findWalkPath({...posRef.current},next);
  if(!route.length)return;
  setWalking(true);
  let index=0;
  const nextSegment=()=>{
    if(index>=route.length){
      setPos(next);
      setWalking(false);
      
      // หันหน้าไปทางทิศทางสุดท้ายที่เดิน
      const lastStart={...posRef.current};
      const dx=next.x-lastStart.x;
      const dy=next.y-lastStart.y;
      const finalDir=Math.abs(dx)>=Math.abs(dy)
        ?(dx>0?'right':'left')
        :(dy>0?'down':'up');
      
      setDirection(finalDir);
      if(spriteRef.current){
        spriteRef.current.src=`/sprite/directions/${finalDir}.png`;
      }
      
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
    
    if(spriteRef.current){
      spriteRef.current.src=`/sprite/directions/${segmentDirection}.png`;
    }
    
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
}
  function walk(e) {
    if (e.target.closest(".station")) return;
    const r = roomRef.current.getBoundingClientRect(),
      next = {
        x: Math.max(4, Math.min(96, ((e.clientX - r.left) / r.width) * 100)),
        y: Math.max(12, Math.min(94, ((e.clientY - r.top) / r.height) * 100)),
      };
    if (hitsTable(next)) {
      notify("ตรงนั้นมีโต๊ะอยู่ ลองคลิกพื้นที่ว่างนะ");
      return;
    }
    moveTo(next);
  }
  function goSkill(k){
  const p=SKILLS[k].pos;
  const currentPos={...posRef.current};
  
  // เดินไปใกล้โต๊ะ (y+10 แทน y+22 เพื่อให้ใกล้ขึ้น)
  moveTo({x:p.x,y:p.y+10},()=>{
    // พอเดินถึงแล้วค่อยหันหน้าเข้าหาโต๊ะ
    let targetDir;
    if(Math.abs(currentPos.x-p.x) > Math.abs(currentPos.y-p.y)){
      targetDir = currentPos.x > p.x ? 'left' : 'right';
    } else {
      targetDir = currentPos.y > p.y ? 'up' : 'down';
    }
    
    setDirection(targetDir);
    if(spriteRef.current){
      spriteRef.current.src=`/sprite/directions/${targetDir}.png`;
    }
    
    setModal({...EMPTY,skill:k});
  });
}
  async function saveNow(data) {
    const item = {
      ...data,
      id: String(Date.now()),
      date: new Date().toISOString(),
      minutes: Number(data.minutes),
      before: Number(data.before),
      after: Number(data.after),
      difficulty: Number(data.difficulty),
    };
    // แสดงผลทันที (optimistic) แล้วค่อยซิงค์เบื้องหลัง
    setLogs((v) => [item, ...v.filter((x) => String(x.id) !== String(item.id))]);
    setModal(null);
    setCelebrating(true);
    clearTimeout(celebrateTimer.current);
    celebrateTimer.current = setTimeout(() => setCelebrating(false), 2400);
    notify(`บันทึกแล้ว +${item.minutes * 2} XP`);
    try {
      const result = await createActivity(item);
      if (result.item)
        setLogs((v) =>
          v.map((x) => (String(x.id) === String(item.id) ? result.item : x)),
        );
    } catch (error) {
      // ถอนรายการที่เพิ่งเพิ่มออกถ้าซิงค์ไม่สำเร็จ
      setLogs((v) => v.filter((x) => String(x.id) !== String(item.id)));
      if (error.status === 401) {
        clearOwnerToken();
        setVerify({ type: "save", data });
        return;
      }
      notify("บันทึกไม่สำเร็จ: " + error.message);
    }
  }
  function save(data) {
    if (!data.topic.trim()) return;
    if (!hasOwnerToken()) {
      setVerify({ type: "save", data });
      return;
    }
    return saveNow(data);
  }
  async function removeNow(id) {
    if (deletingIds.current.has(String(id))) return;
    deletingIds.current.add(String(id));
    // เอาออกจากหน้าจอทันที (optimistic) พร้อมเก็บไว้เผื่อถอนกลับ
    let removed = null;
    setLogs((v) => {
      removed = v.find((x) => String(x.id) === String(id)) || null;
      return v.filter((x) => String(x.id) !== String(id));
    });
    notify("ลบแล้ว");
    try {
      await deleteActivity(id);
    } catch (error) {
      if (removed) setLogs((v) => [removed, ...v]);
      if (error.status === 401) {
        clearOwnerToken();
        setVerify({ type: "delete", id });
        return;
      }
      notify("ลบไม่สำเร็จ: " + error.message);
    } finally {
      deletingIds.current.delete(String(id));
    }
  }
  function remove(id) {
    if (!hasOwnerToken()) {
      setVerify({ type: "delete", id });
      return;
    }
    removeNow(id);
  }
  async function confirmOwner(code) {
    await verifyOwner(code);
    const pending = verify;
    setVerify(null);
    notify("ยืนยันว่าเป็นเท่แล้ว เบราว์เซอร์จะจำไว้");
    if (pending?.type === "save") await saveNow(pending.data);
    if (pending?.type === "delete") await removeNow(pending.id);
  }
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <PixelIcon name="sprout" />
          GROW ROOM
        </div>
        {[
          ["today", "/ui/nav-home.png", "วันนี้"],
          ["history", "/ui/nav-history.png", "ประวัติ"],
          ["progress", "/ui/nav-progress.png", "พัฒนาการ"],
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
        <div className="asideBottom">
          <div className="avatarMini">
            <img src="/tae-avatar.png" alt="" />
          </div>
          <div>
            <b>Tae</b>
            <small>LV {Math.floor(xp / 500) + 1}</small>
          </div>
          <PixelIcon name="gear" />
        </div>
      </aside>
      <main>
        {view === "today" ? (
          <Today
            {...{
              todayLogs,
              minutes,
              xp,
              streak,
              pos,
              direction,
              walking,
              celebrating,
              walk,
              goSkill,
              roomRef,
              characterRef,
              spriteRef,
              timer,
              setTimer,
              running,
              setRunning,
              sessions,
              setModal,
            }}
          />
        ) : view === "history" ? (
          <HistoryView logs={logs} remove={remove} />
        ) : (
          <Progress logs={logs} xp={xp} streak={streak} />
        )}
      </main>
      {modal && (
        <LogModal
          initial={modal}
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
    </div>
  );
}

function SkillArt({ skill }) {
  const s = SKILLS[skill];
  return <img className="skillArt" src={s.asset} alt="" />;
}

function Today({
  todayLogs,
  minutes,
  xp,
  streak,
  pos,
  direction,
  walking,
  celebrating,
  walk,
  goSkill,
  roomRef,
  characterRef,
  spriteRef,
  timer,
  setTimer,
  running,
  setRunning,
  sessions,
  setModal,
}) {
  const totals = Object.keys(SKILLS).reduce(
    (o, k) => ({
      ...o,
      [k]: todayLogs
        .filter((x) => x.skill === k)
        .reduce((a, b) => a + Number(b.minutes), 0),
    }),
    {},
  );
  return (
    <div className="dashboard pixelDashboard">
      <section className="roomPanel">
        <div className="room" ref={roomRef} onClick={walk}>
          {Object.entries(SKILLS).map(([k, s]) => (
            <Station key={k} code={k} {...s} onClick={() => goSkill(k)} />
          ))}
          <div
            ref={characterRef}
            className={`character ${walking ? "walk" : ""} ${celebrating ? "celebrate" : ""}`}
            style={{
              transform: `translate3d(${pos.x}cqw,${pos.y}cqh,0) translate(-50%,-50%)`,
            }}
            role="img"
            aria-label="ตัวละคร Tae"
          >
            <img
              ref={spriteRef}
              src={`/sprite/directions/${direction}.png`}
              alt=""
            />
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
      <section className="sideCol">
        <div className="card plan">
          <div className="cardTitle">
            <h2>Today's plan</h2>
            <span>{Math.min(todayLogs.length, 4)}/4</span>
          </div>
          {Object.entries(SKILLS).map(([k, s]) => {
            const log = todayLogs.find((x) => x.skill === k);
            return (
              <div className={`task ${log ? "" : "muted"}`} key={k}>
                <span style={{ background: s.color }}>
                  <SkillArt skill={k} />
                </span>
                <div>
                  <b>{log?.topic || s.label}</b>
                  <small>
                    {log ? `${s.label} · ${log.minutes}m` : "ยังไม่ได้ฝึก"}
                  </small>
                </div>
                {log ? (
                  <PixelIcon name="check" className="done" />
                ) : (
                  <i className="checkBox" />
                )}
              </div>
            );
          })}
          <button className="primary" onClick={() => setModal({ ...EMPTY })}>
            <PixelIcon name="plus" /> Add activity
          </button>
        </div>
        <div className="card timer">
          <div className="metricTitle">
            <b>Pomodoro</b>
            <strong>{sessions}/6</strong>
          </div>
          <div className="timerBody">
            <div
              className={`tomatoRing ${running ? "ticking" : ""}`}
              style={{ "--timer-progress": `${(timer / 1500) * 360}deg` }}
            >
              <img src="/ui/pomodoro.png" alt="" />
            </div>
            <div className="timerReadout">
              <strong>
                {String(Math.floor(timer / 60)).padStart(2, "0")}:
                {String(timer % 60).padStart(2, "0")}
              </strong>
              <small>FOCUS SESSION</small>
            </div>
            <div className="timerActions">
              <button
                className={running ? "timerStop" : "timerStart"}
                onClick={() => setRunning(!running)}
              >
                <PixelIcon name={running ? "pause" : "play"} />
                {running ? "Pause" : "Start"}
              </button>
              <button
                className="timerReset"
                onClick={() => {
                  setRunning(false);
                  setTimer(25 * 60);
                }}
                aria-label="เริ่ม Pomodoro ใหม่"
              >
                <PixelIcon name="reset" />
                Reset
              </button>
            </div>
          </div>
        </div>
        <div className="card focus">
          <b>Focus time</b>
          <div>
            <span className="focusIcon">
              <img src="/ui/focus.png" alt="" />
            </span>
            <div className="focusInfo">
              <strong>
                {Math.floor(minutes / 60)}h {minutes % 60}m
              </strong>
              <small>เวลาฝึกวันนี้</small>
            </div>
          </div>
        </div>
      </section>
      <section className="card weekly">
        <h3>Weekly progress</h3>
        {Object.entries(SKILLS).map(([k, s]) => (
          <div className="weekRow" key={k}>
            <span style={{ background: s.color }}>
              <SkillArt skill={k} />
            </span>
            <b>{s.label}</b>
            <div className="bar">
              <i
                style={{
                  background: s.color,
                  width: `${Math.min(100, totals[k] / 1.2)}%`,
                }}
              />
            </div>
            <strong>{Math.min(100, Math.round(totals[k] / 1.2))}%</strong>
          </div>
        ))}
      </section>
      <section className="card streakCard">
        <PixelIcon name="flame" />
        <h2>{streak} day streak</h2>
        <div className="streakDots">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((x) => (
            <i className={x < Math.min(streak, 8) ? "on" : ""} key={x} />
          ))}
        </div>
        <strong>+{xp % 500} XP</strong>
      </section>
    </div>
  );
}
function Station({ code, label, desk, color, onClick, pos }) {
  return (
    <button
      className={`station ${code}`}
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

function LogModal({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave(f);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <form className="modal" onSubmit={submit}>
        <button type="button" className="close" onClick={onClose}>
          <PixelIcon name="close" />
        </button>
        <p className="eyebrow">ACTIVITY LOG</p>
        <h2>วันนี้ฝึกอะไรไปบ้าง?</h2>
        <label>
          ทักษะ
          <div className="skillPick">
            {Object.entries(SKILLS).map(([k, s]) => (
              <button
                type="button"
                className={f.skill === k ? "selected" : ""}
                style={{ "--c": s.color }}
                onClick={() => upd("skill", k)}
                key={k}
              >
                <SkillArt skill={k} />
                {s.label}
              </button>
            ))}
          </div>
        </label>
        <div className="fields">
          <label className="wide">
            หัวข้อที่ฝึก
            <input
              autoFocus
              value={f.topic}
              onChange={(e) => upd("topic", e.target.value)}
              placeholder="เช่น Dictionary และการนับความถี่"
              required
            />
          </label>
          <label>
            เวลาที่ใช้ (นาที)
            <input
              type="number"
              min="1"
              value={f.minutes}
              onChange={(e) => upd("minutes", e.target.value)}
            />
          </label>
          <label>
            ความยาก
            <select
              value={f.difficulty}
              onChange={(e) => upd("difficulty", e.target.value)}
            >
              {[1, 2, 3, 4, 5].map((x) => (
                <option key={x} value={x}>
                  {x} / 5
                </option>
              ))}
            </select>
          </label>
          <label>
            ก่อนฝึก <b>{f.before}/5</b>
            <input
              type="range"
              min="1"
              max="5"
              value={f.before}
              style={{ "--range-fill": `${(Number(f.before) - 1) * 25}%` }}
              onChange={(e) => upd("before", e.target.value)}
            />
          </label>
          <label>
            หลังฝึก <b>{f.after}/5</b>
            <input
              type="range"
              min="1"
              max="5"
              value={f.after}
              style={{ "--range-fill": `${(Number(f.after) - 1) * 25}%` }}
              onChange={(e) => upd("after", e.target.value)}
            />
          </label>
          <label className="wide">
            ได้เรียนรู้อะไร
            <textarea
              value={f.learned}
              onChange={(e) => upd("learned", e.target.value)}
              placeholder="สรุปสั้น ๆ ด้วยคำของเราเอง"
            />
          </label>
          <label>
            ยังติดตรงไหน
            <textarea
              value={f.problem}
              onChange={(e) => upd("problem", e.target.value)}
              placeholder="จุดที่ยังไม่เข้าใจ"
            />
          </label>
          <label>
            ครั้งหน้าจะทำอะไรต่อ
            <textarea
              value={f.next}
              onChange={(e) => upd("next", e.target.value)}
              placeholder="กำหนดก้าวถัดไป"
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" onClick={onClose} disabled={saving}>
            ยกเลิก
          </button>
          <button className="primary" type="submit" disabled={saving}>
            <PixelIcon name="check" />
            {saving ? "กำลังบันทึก..." : "บันทึกกิจกรรม"}
          </button>
        </div>
      </form>
    </div>
  );
}

function HistoryView({ logs, remove }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = logs.filter(
    (x) =>
      (filter === "all" || x.skill === filter) &&
      (!q ||
        [x.topic, x.learned, x.problem, x.next, SKILLS[x.skill].label].some(
          (v) =>
            String(v || "")
              .toLowerCase()
              .includes(q),
        )),
  );
  const grouped = shown.reduce((o, x) => {
    const k = dateKey(x.date);
    (o[k] ??= []).push(x);
    return o;
  }, {});
  return (
    <section className="page historyPage">
      <p className="eyebrow">LEARNING JOURNAL</p>
      <h1>ทำอะไรไปบ้าง</h1>
      <div className="historyTools">
        <label className="searchBox">
          <PixelIcon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาหัวข้อ สิ่งที่เรียนรู้ หรือปัญหา..."
            aria-label="ค้นหาประวัติการฝึก"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="ล้างคำค้นหา">
              <PixelIcon name="close" />
            </button>
          )}
        </label>
        <div className="filter">
          <button
            className={filter === "all" ? "on" : ""}
            onClick={() => setFilter("all")}
          >
            ทั้งหมด
          </button>
          {Object.entries(SKILLS).map(([k, s]) => (
            <button
              className={filter === k ? "on" : ""}
              onClick={() => setFilter(k)}
              key={k}
            >
              <SkillArt skill={k} />
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="timeline">
        {shown.length ? (
          Object.entries(grouped).map(([day, items]) => (
            <section className="dayGroup" key={day}>
              <header>
                <div>
                  <small>ACTIVITY GROUP</small>
                  <h2>{day === dateKey(new Date()) ? "วันนี้" : day}</h2>
                </div>
                <span>
                  {items.length} กิจกรรม ·{" "}
                  {items.reduce((n, x) => n + Number(x.minutes), 0)} นาที
                </span>
              </header>
              <div className="dayLogs">
                {items.map((x) => {
                  const s = SKILLS[x.skill];
                  return (
                    <article key={x.id} style={{ "--c": s.color }}>
                      <div className="logIcon">
                        <SkillArt skill={x.skill} />
                      </div>
                      <div className="logMain">
                        <small>
                          {new Date(x.date).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {s.label} · {x.minutes} นาที
                        </small>
                        <h3>{x.topic}</h3>
                        {x.learned && (
                          <p>
                            <b>ได้เรียนรู้:</b> {x.learned}
                          </p>
                        )}
                        {x.problem && (
                          <p>
                            <b>ยังติด:</b> {x.problem}
                          </p>
                        )}
                        {x.next && (
                          <p>
                            <b>ครั้งต่อไป:</b> {x.next}
                          </p>
                        )}
                      </div>
                      <div className="improve">
                        <PixelIcon name="trend" />
                        <b>
                          {x.after - x.before >= 0 ? "+" : ""}
                          {x.after - x.before}
                        </b>
                        <small>พัฒนาการ</small>
                      </div>
                      <button
                        className="delete"
                        onClick={() => remove(x.id)}
                        aria-label={`ลบ ${x.topic}`}
                      >
                        <PixelIcon name="trash" />
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="empty big">
            <PixelIcon name="search" />
            <b>ไม่พบรายการที่ค้นหา</b>
            <small>ลองเปลี่ยนคำค้นหาหรือตัวกรองทักษะ</small>
          </div>
        )}
      </div>
    </section>
  );
}

function Progress({ logs, xp, streak }) {
  const totals = useMemo(
    () =>
      Object.keys(SKILLS).reduce(
        (o, k) => ({
          ...o,
          [k]: logs
            .filter((x) => x.skill === k)
            .reduce((a, b) => a + Number(b.minutes), 0),
        }),
        {},
      ),
    [logs],
  );
  const max = Math.max(1, ...Object.values(totals));
  const gain = logs.length
    ? (
        logs.reduce((a, b) => a + Number(b.after) - Number(b.before), 0) /
        logs.length
      ).toFixed(1)
    : 0;
  return (
    <section className="page">
      <p className="eyebrow">YOUR GROWTH</p>
      <h1>เราเก่งขึ้นแค่ไหนแล้ว</h1>
      <div className="summary">
        <div>
          <PixelIcon name="clock" />
          <span>
            <b>{Object.values(totals).reduce((a, b) => a + b, 0)}</b>นาทีทั้งหมด
          </span>
        </div>
        <div>
          <PixelIcon name="trend" />
          <span>
            <b>+{gain}</b>เฉลี่ยต่อครั้ง
          </span>
        </div>
        <div>
          <PixelIcon name="flame" />
          <span>
            <b>{streak}</b>วันที่ลงมือ
          </span>
        </div>
        <div>
          <PixelIcon name="bolt" />
          <span>
            <b>{xp}</b>XP สะสม
          </span>
        </div>
      </div>
      <div className="card progressCard">
        <h2>เวลาฝึกแยกตามทักษะ</h2>
        {Object.entries(SKILLS).map(([k, s]) => (
          <div className="progressRow" key={k}>
            <span style={{ background: s.color }}>
              <SkillArt skill={k} />
            </span>
            <b>{s.label}</b>
            <div className="bar">
              <i
                style={{
                  background: s.color,
                  width: `${(totals[k] / max) * 100}%`,
                }}
              />
            </div>
            <strong>{totals[k]} นาที</strong>
          </div>
        ))}
      </div>
      <div className="insight">
        <PixelIcon name="brain" />
        <div>
          <b>
            {logs.length
              ? "ทุกครั้งที่บันทึก เราจะเห็นหลักฐานว่าตัวเองกำลังไปข้างหน้า"
              : "เริ่มบันทึกกิจกรรมแรกของเรา"}
          </b>
          <p>
            ไม่ต้องเก่งขึ้นแบบก้าวกระโดด แค่หลังฝึกเข้าใจมากกว่าก่อนฝึก 1
            ระดับก็ถือว่าชนะแล้ว
          </p>
        </div>
      </div>
    </section>
  );
}
createRoot(document.getElementById("root")).render(<App />);
