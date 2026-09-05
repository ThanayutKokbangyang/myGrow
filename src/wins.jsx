import React,{useEffect,useRef,useState} from 'react';
import './wins.css';
import {useSheetWins} from './use-sheet-wins';
import {WIN_CATEGORIES,dayKey,parseDay,categoryOf,normalizeWins,calendarDays,makeWin} from './wins-model';
const STORAGE='grow-small-wins-v1';
const formatDate=key=>parseDay(key).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
function WinIcon({name}){if(name==='heart'||name==='star')return <svg className="winPixelIcon" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true"><path fill="currentColor" d={name==='heart'?'M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z':'M6 0h4v4h6v4h-2v2h-2v6H8v-2H6v2H2v-6H0V6h6z'}/></svg>;return <img className="winPixelIcon" src={`/ui/pixel/${name}.png`} alt=""/>;}
function Trophy({className=''}){return <img className={`winTrophy ${className}`} src="/ui/pixel/trophy.svg" alt=""/>;}
export function SmallWins({onSuccess,onRequireOwner}){
 const {wins,message,setMessage,persist,busy,ready,pending,refresh}=useSheetWins(onRequireOwner);
 const [today,setToday]=useState(dayKey),[selected,setSelected]=useState(dayKey),[month,setMonth]=useState(()=>parseDay(dayKey()));
 const [text,setText]=useState(''),[category,setCategory]=useState('learning'),[filter,setFilter]=useState('all');
 const [editing,setEditing]=useState(null),[removing,setRemoving]=useState(null);
 const textRef=useRef(null);
 useEffect(()=>{const refresh=()=>setToday(dayKey());const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[]);
 function selectDay(key){setSelected(key);setRemoving(null);}
 function goToday(){const key=dayKey();setToday(key);selectDay(key);setMonth(parseDay(key));}
 async function save(e){e.preventDefault();if(!text.trim())return;const original=editing?wins.find(w=>w.id===editing):null;if(editing&&!original){setMessage('ไม่พบรายการเดิม');return;}
  const item=makeWin({id:editing||crypto.randomUUID(),text,category,original});
  const next=editing?wins.map(w=>w.id===editing?item:w):[item,...wins];
  if(await persist(next)){setText('');setEditing(null);setToday(dayKey());selectDay(item.date);setMonth(parseDay(item.date));setFilter('all');setMessage('บันทึกใน Google Sheets แล้ว เก่งมาก!');onSuccess();}
 }
 const byDate=new Map();for(const win of wins){if(!byDate.has(win.date))byDate.set(win.date,[]);byDate.get(win.date).push(win);}
 const selectedWins=byDate.get(selected)||[],shown=selectedWins.filter(w=>filter==='all'||w.category===filter);
 const activeCategory=categoryOf(category),original=editing?wins.find(w=>w.id===editing):null;
 return <section className="page smallWins pixelWins">
  <header className="winsHero"><div className="trophyPedestal"><Trophy/></div><div><p className="eyebrow">DAILY ACHIEVEMENTS</p><h1>ความสำเร็จเล็ก ๆ</h1><p>ก้าวเล็กของวันนี้ ก็สมควรได้รับถ้วยรางวัล</p></div><div className="winsTotal"><Trophy/><b>{wins.length}</b><span>ความสำเร็จทั้งหมด</span></div></header>
  <div className="winSheetStatus"><span>{ready?'☁ Google Sheets':'กำลังรอการเชื่อมต่อ'}</span>{pending>0&&<button disabled={busy||!ready} onClick={()=>persist(wins)}>ย้าย {pending} รายการเดิมเข้า Sheet</button>}<button disabled={busy} onClick={refresh}>โหลดใหม่</button></div>
  <fieldset className="winSheetFields" disabled={busy}><div className="pixelWinsLayout">
   <form className="pixelWinComposer" onSubmit={save}>
    <div className="winPanelTitle"><WinIcon name="plus"/><h2>{editing?'แก้ไขความสำเร็จ':'วันนี้เราทำอะไรสำเร็จ'}</h2></div>
    <p className="winAutoDate">{editing?`บันทึกของ ${formatDate(original?.date||today)}`:`วันนี้ · ${formatDate(today)}`}<small>{editing?'เก็บวันที่เดิมของรายการไว้':'บันทึกเป็นวันนี้ให้อัตโนมัติ'}</small></p>
    <fieldset><legend>เป็นความสำเร็จเรื่องอะไร?</legend><div className="winCategoryPick">{WIN_CATEGORIES.map(c=><button type="button" key={c.id} style={{'--category':c.color}} aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}><WinIcon name={c.icon}/>{c.label}</button>)}</div></fieldset>
    <label htmlFor="win-text">เรื่องเล็ก ๆ ที่อยากให้รางวัลตัวเอง</label><textarea ref={textRef} id="win-text" value={text} maxLength={1000} required onChange={e=>setText(e.target.value)} placeholder="เช่น วันนี้เดินครบ 6,000 ก้าว / เรียน C# จบหนึ่งบท…"/>
    <div className="winComposerMeta"><span style={{color:activeCategory.color}}><WinIcon name={activeCategory.icon}/>{activeCategory.label}</span><small>{text.length}/1000</small></div>
    <button className="winSave" disabled={!text.trim()}><Trophy/>{editing?'บันทึกการแก้ไข':'เก็บความสำเร็จวันนี้'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setText('')}}>ยกเลิกการแก้ไข</button>}
   </form>
   <div className="winsArchive">
    <section className="winCalendar" aria-label="ปฏิทินความสำเร็จ"><div className="winCalendarHeading"><div><p className="eyebrow">YOUR JOURNEY</p><h2>{month.toLocaleDateString('th-TH',{month:'long',year:'numeric'})}</h2></div><div><button type="button" aria-label="เดือนก่อนหน้า" onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1,12))}>‹</button><button type="button" onClick={goToday}>วันนี้</button><button type="button" aria-label="เดือนถัดไป" onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1,12))}>›</button></div></div>
     <div className="winCalendarGrid">{['อา','จ','อ','พ','พฤ','ศ','ส'].map(d=><span className="winWeekday" key={d}>{d}</span>)}{calendarDays(month).map(d=>{const entries=byDate.get(d.key)||[];const cats=WIN_CATEGORIES.filter(c=>entries.some(w=>w.category===c.id));return <button type="button" key={d.key} className={`${d.inMonth?'':'outside'} ${d.key===today?'isToday':''} ${d.key===selected?'selected':''}`} aria-pressed={d.key===selected} aria-current={d.key===today?'date':undefined} aria-label={`${formatDate(d.key)} · ${entries.length} ความสำเร็จ`} onClick={()=>selectDay(d.key)}><span>{d.day}</span>{entries.length>0&&<small>{entries.length}</small>}<span className="winDayDots">{cats.map(c=><i key={c.id} style={{background:c.color}}/>)}</span></button>})}</div>
     <p className="winCalendarHint">จุดสีคือหมวดที่ทำสำเร็จ · คลิกวันเพื่อดูบันทึก</p>
    </section>
    <section className="pixelWinList"><div className="winListHeading"><Trophy/><div><h2>{selected===today?'ความสำเร็จวันนี้':formatDate(selected)}</h2><p>{selectedWins.length} เรื่องดี ๆ ที่เก็บไว้</p></div></div>
     <div className="winFilters" aria-label="กรองหมวดความสำเร็จ"><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>ทั้งหมด</button>{WIN_CATEGORIES.map(c=><button type="button" key={c.id} aria-pressed={filter===c.id} onClick={()=>setFilter(c.id)}>{c.label}</button>)}</div>
     <div className="winEntriesScroll" tabIndex={0} role="region" aria-label="รายการความสำเร็จ เลื่อนเพื่อดูเพิ่มเติม">{shown.length===0?<div className="pixelWinsEmpty"><Trophy/><p>{selectedWins.length?'ยังไม่มีบันทึกในหมวดนี้':'ยังไม่มีความสำเร็จในวันนี้'}</p><small>เขียนเรื่องดี ๆ ของวันนี้ได้ในช่องบันทึก</small></div>:shown.map(w=>{const c=categoryOf(w.category);return <article key={w.id} style={{'--category':c.color}}><div className="winEntryCategory"><WinIcon name={c.icon}/>{c.label}</div><p>{w.text}</p><div className="winEntryActions">{removing===w.id?<><span>ลบรายการนี้?</span><button type="button" onClick={async()=>{if(await persist(wins.filter(x=>x.id!==w.id))){setRemoving(null);if(editing===w.id){setEditing(null);setText('')}setMessage('ลบรายการแล้ว')}}}>ยืนยันลบ</button><button type="button" onClick={()=>setRemoving(null)}>ยกเลิก</button></>:<><button type="button" onClick={()=>{setEditing(w.id);setText(w.text);setCategory(c.id);textRef.current?.focus();textRef.current?.scrollIntoView({behavior:'smooth',block:'center'})}}>แก้ไข</button><button type="button" onClick={()=>setRemoving(w.id)}>ลบ</button></>}</div></article>})}</div>
    </section>
   </div>
  </div>
  </fieldset><p className="winMessage" role="status">{message}</p>
  <footer><small>บันทึกใน Google Sheets · แท็บ SmallWins · สำรองข้อมูลไว้ได้เสมอ</small><button type="button" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(wins,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`small-wins-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>สำรองข้อมูล</button><label className="importWins">นำเข้าข้อมูล<input type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>5000000)throw Error();const imported=normalizeWins(JSON.parse(await file.text()));const ids=new Set(wins.map(w=>w.id));const next=[...wins,...imported.filter(w=>!ids.has(w.id)&&ids.add(w.id))];if(await persist(next))setMessage('นำเข้าข้อมูลเรียบร้อย')}catch{setMessage('ไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์สำรองความสำเร็จ')}}}/></label></footer>
 </section>;
}
