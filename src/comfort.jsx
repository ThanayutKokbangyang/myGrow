import React, {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
export const localDay = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
let audio;
export function unlockSound(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function tone(freq,start,duration,type,volume){if(!audio||audio.state!=='running')return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.005);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(start);osc.stop(start+duration+.01);osc.onended=()=>{osc.disconnect();gain.disconnect()};}
export function woodStep(){if(!audio||audio.state!=='running')return;const t=audio.currentTime; tone(150+Math.random()*35,t,.08,'triangle',.09);tone(480+Math.random()*70,t,.035,'sine',.035);const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.035),audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(data.length*.16));const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1100;gain.gain.value=.12;source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};}
export function winSound(){if(!audio||audio.state!=='running')return;[523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>tone(f,audio.currentTime+i*.105,i===4?.4:.14,'square',.055));}
export function youtubeId(value){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol))return null;const host=u.hostname.toLowerCase();let id;if(host==='youtu.be')id=u.pathname.split('/')[1];else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v'):['embed','shorts','live'].includes(u.pathname.split('/')[1])?u.pathname.split('/')[2]:null;return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null}}
const MUSIC_POS='grow-music-pos';
// Drag-anywhere behaviour for the floating player. Position is kept as the
// widget's top-left in pixels, clamped into the viewport on every drag and on
// resize, so it can never end up off-screen.
export function useDraggable(ref,storageKey){
 const [pos,setPos]=useState(()=>{const v=read(storageKey,null);return v&&typeof v.x==='number'&&typeof v.y==='number'?v:null});
 const drag=useRef(null),moved=useRef(false);
 const clamp=useCallback((x,y)=>{
  const el=ref.current;if(!el)return {x,y};
  const w=el.offsetWidth,h=el.offsetHeight,m=6;
  return {x:Math.min(Math.max(x,m),Math.max(m,innerWidth-w-m)),y:Math.min(Math.max(y,m),Math.max(m,innerHeight-h-m))};
 },[ref]);
 const start=e=>{
  const el=ref.current;if(!el||e.button>0)return;
  const r=el.getBoundingClientRect();
  drag.current={dx:e.clientX-r.left,dy:e.clientY-r.top};
  moved.current=false;
  e.currentTarget.setPointerCapture?.(e.pointerId);
 };
 const move=e=>{
  if(!drag.current)return;
  const next=clamp(e.clientX-drag.current.dx,e.clientY-drag.current.dy);
  if(!moved.current){
   const r=ref.current.getBoundingClientRect();
   if(Math.abs(next.x-r.left)<4&&Math.abs(next.y-r.top)<4)return;   // a click, not a drag
   moved.current=true;
  }
  setPos(next);
 };
 const end=e=>{
  if(!drag.current)return;
  drag.current=null;
  e.currentTarget.releasePointerCapture?.(e.pointerId);
  if(moved.current)try{localStorage.setItem(storageKey,JSON.stringify(posRefValue(ref)))}catch{}
 };
 const posRefValue=el=>{const r=el.current.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top)}};
 // Keep it on screen when the window is resized or the panel folds/unfolds.
 useLayoutEffect(()=>{if(pos)setPos(p=>{const c=clamp(p.x,p.y);return c.x===p.x&&c.y===p.y?p:c})});
 useEffect(()=>{
  if(!pos)return;
  const onResize=()=>setPos(p=>p&&clamp(p.x,p.y));
  addEventListener('resize',onResize);
  return()=>removeEventListener('resize',onResize);
 },[pos,clamp]);
 const style=pos?{left:pos.x+'px',top:pos.y+'px',right:'auto',bottom:'auto'}:undefined;
 return {pos,style,dragProps:{onPointerDown:start,onPointerMove:move,onPointerUp:end,onPointerCancel:end},wasDragged:()=>moved.current};
}
export function MusicPlayer(){
  const [saved,setSaved]=useState(()=>read('grow-youtube',''));
  const [url,setUrl]=useState(saved);
  const [open,setOpen]=useState(false);
  const [started,setStarted]=useState(false);
  const [reload,setReload]=useState(0);
  const [error,setError]=useState('');
  const widget=useRef(null),shell=useRef(null);
  const {pos,style,dragProps,wasDragged}=useDraggable(widget,MUSIC_POS);
  // The widget box is only the toggle button; the panel floats out from it, so
  // the button never moves when the panel opens or closes. Pick the side with
  // room so the panel is always fully on screen.
  const [place,setPlace]=useState({v:'up',x:0});
  useLayoutEffect(()=>{
    if(!open)return;
    const compute=()=>{
      const el=widget.current,sh=shell.current;if(!el||!sh)return;
      const r=el.getBoundingClientRect(),m=6,w=sh.offsetWidth;
      // right-align to the button, then slide back inside the viewport
      const left=Math.min(Math.max(r.right-w,m),Math.max(m,innerWidth-w-m));
      const next={v:r.top>=sh.offsetHeight+14?'up':'down',x:Math.round(left-r.left)};
      setPlace(p=>p.v===next.v&&p.x===next.x?p:next);
    };
    compute();
    addEventListener('resize',compute);
    return()=>removeEventListener('resize',compute);
  },[open,pos]);
  const id=youtubeId(saved);
  // youtube-nocookie keeps working when the browser blocks third-party cookies
  // or storage, which is the usual cause of "An error occurred" in the embed.
  const embed=id?`https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`:'';
  // The iframe stays mounted whether the panel is folded or not, and the whole
  // player lives at the app root, so the music survives folding and page changes.
  return <div className={`musicWidget${open?' open':''}${started?' playing':''} v-${place.v}`} ref={widget} style={{...style,"--shell-x":place.x+"px"}}>
    <div className="musicShell" ref={shell}>
      <div className="musicPanel" hidden={!open}>
        <div className="musicGrip" {...dragProps} title="ลากเพื่อย้ายตำแหน่ง">⠿</div>
        <button type="button" className="musicClose" onClick={()=>setOpen(false)} aria-label="พับหน้าต่างเพลง">พับ –</button>
        <h3>เพลงระหว่างโฟกัส</h3>
        <form onSubmit={e=>{e.preventDefault();if(!youtubeId(url)){setError('ใส่ลิงก์วิดีโอ YouTube ที่ถูกต้อง');return}try{localStorage.setItem('grow-youtube',JSON.stringify(url));setSaved(url);setError('')}catch{setError('จำลิงก์ไม่ได้ พื้นที่เก็บข้อมูลอาจเต็ม')}}}>
          <label htmlFor="music-url">ลิงก์ YouTube</label>
          <div className="musicInput">
            <input id="music-url" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" required/>
            <button>ใช้เพลงนี้</button>
          </div>
        </form>
        {error&&<p role="alert">{error}</p>}
        {id&&<div className="musicActions">
          <button type="button" onClick={()=>setReload(n=>n+1)}>ลองโหลดใหม่</button>
          <button type="button" onClick={()=>{try{localStorage.removeItem('grow-youtube');setSaved('');setUrl('');setStarted(false)}catch{setError('ลบลิงก์ไม่สำเร็จ')}}}>ล้างเพลง</button>
          <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">เปิดใน YouTube ↗</a>
        </div>}
        <small>กดเล่นในวิดีโอ · กด “พับ” เพลงจะเล่นต่อ · เปลี่ยนหน้าเพลงก็ยังเล่นอยู่</small>
        <small>ลากที่ ⠿ หรือลากปุ่มด้านล่าง เพื่อย้ายไปวางตรงไหนก็ได้ · ถ้าขึ้น “An error occurred” ให้ปิดตัวบล็อกโฆษณาสำหรับเว็บนี้ แล้วกด “ลองโหลดใหม่”</small>
      </div>
      {id&&<div className="musicStage" onPointerDown={()=>setStarted(true)}>
        <iframe key={`${id}-${reload}`} title="เพลงโฟกัสจาก YouTube" src={embed} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>
      </div>}
    </div>
    <button type="button" className="musicToggle" aria-expanded={open}
      {...dragProps}
      onClick={()=>{if(wasDragged())return;setOpen(!open)}}>
      <span className="musicNote" aria-hidden="true">♫</span>
      {open?'พับเพลง':started?'เพลงกำลังเล่น':'เพลงโฟกัส'}
    </button>
  </div>
}
export {SmallWins} from './wins';