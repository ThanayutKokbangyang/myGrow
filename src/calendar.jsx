import React,{useEffect,useMemo,useState} from 'react';
import './calendar.css';
import {useSheetCalendar} from './use-sheet-calendar';
import {dayKey,parseDay} from './day';
import {EVENT_ICONS,TONES,REPEATS,iconSrc,charSrc,toneOf,repeatLabel,iconLabel,
        normalizeEvents,eventsOn,isDoneOn,doneSet,monthGrid,monthLabel,dayLabel,shortDay,
        upcoming,newId} from './calendar-model';

const WEEKDAYS=['อา','จ','อ','พ','พฤ','ศ','ส'];

/** Pixel art picker, shared by the icon field and nothing else so far. */
function IconPicker({value,onPick,onClose}){
 useEffect(()=>{
  const onKey=e=>{if(e.key==='Escape')onClose()};
  addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey);
 },[onClose]);
 return <div className="calBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="calModal calPickerModal" role="dialog" aria-modal="true" aria-label="เลือกไอคอน">
   <header><h2>เลือกไอคอน</h2>
    <button type="button" onClick={onClose} aria-label="ปิด">✕</button></header>
   <div className="calIconGrid">
    {EVENT_ICONS.map(([name,label],i)=>
     <button type="button" key={name} title={label} aria-label={label} aria-pressed={value===name}
       style={{'--i':i}} onClick={()=>{onPick(name);onClose()}}>
      <img src={iconSrc(name)} alt=""/><span>{label}</span>
     </button>)}
   </div>
  </div>
 </div>;
}

function EventModal({initial,onSave,onDelete,onClose}){
 const [form,setForm]=useState(initial);
 const [picking,setPicking]=useState(false);
 const [confirming,setConfirming]=useState(false);
 const set=(key,value)=>setForm(f=>({...f,[key]:value}));
 useEffect(()=>{
  const onKey=e=>{if(e.key==='Escape'&&!picking)onClose()};
  addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey);
 },[onClose,picking]);
 const repeating=form.repeat!=='none';
 return <div className="calBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <form className="calModal" onSubmit={e=>{e.preventDefault();if(form.title.trim())onSave({...form,title:form.title.trim()})}}>
   <header><h2>{initial.isNew?'นัดหมายใหม่':'แก้ไขนัดหมาย'}</h2>
    <button type="button" onClick={onClose} aria-label="ปิด">✕</button></header>
   <div className="calFormBody">
    <button type="button" className="calIconPick" onClick={()=>setPicking(true)}>
     <img src={iconSrc(form.icon)} alt=""/><span>เปลี่ยนไอคอน</span>
    </button>
    <div className="calFields">
     <label>เรื่องอะไร
      <input value={form.title} maxLength={300} required autoFocus placeholder="เช่น สัมภาษณ์งานที่บริษัท A"
        onChange={e=>set('title',e.target.value)}/></label>
     <div className="calFieldRow">
      <label>วันที่
       <input type="date" required value={form.date} onChange={e=>set('date',e.target.value)}/></label>
      <label>ทำซ้ำ
       <select value={form.repeat} onChange={e=>set('repeat',e.target.value)}>
        {REPEATS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      {repeating&&
       <label>ซ้ำถึงวันที่ (ไม่ใส่ = ตลอดไป)
        <input type="date" value={form.repeatUntil} min={form.date}
          onChange={e=>set('repeatUntil',e.target.value)}/></label>}
     </div>
     <fieldset className="calToneField">
      <legend>สี</legend>
      <div className="calTonePick">
       {TONES.map(([id,label,color])=>
        <button type="button" key={id} title={label} aria-label={label} aria-pressed={form.tone===id}
          style={{'--tone':color}} onClick={()=>set('tone',id)}><i/></button>)}
      </div>
     </fieldset>
     <label>รายละเอียด (ไม่ใส่ก็ได้)
      <textarea value={form.detail} maxLength={2000} rows={3} placeholder="สถานที่ ของที่ต้องเตรียม หรืออะไรก็ได้ที่อยากให้เตือน"
        onChange={e=>set('detail',e.target.value)}/></label>
     {repeating&&
      <p className="calRepeatHint">
       เริ่ม {shortDay(form.date)} · {repeatLabel(form.repeat)}
       {form.repeat==='monthly'&&Number(form.date.slice(8))>28&&
        ' · เดือนที่ไม่มีวันที่ '+Number(form.date.slice(8))+' จะข้ามไป'}
      </p>}
    </div>
   </div>
   <footer>
    {!initial.isNew&&(confirming
     ? <span className="calConfirm">ลบนัดนี้{repeating?'ทั้งหมด':''}?
        <button type="button" className="calDanger" onClick={()=>onDelete(form.id)}>ยืนยันลบ</button>
        <button type="button" onClick={()=>setConfirming(false)}>ยกเลิก</button></span>
     : <button type="button" className="calDanger" onClick={()=>setConfirming(true)}>ลบ</button>)}
    <button type="button" onClick={onClose}>ปิด</button>
    <button className="calPrimary" disabled={!form.title.trim()||!form.date}>บันทึก</button>
   </footer>
   {picking&&<IconPicker value={form.icon} onPick={n=>set('icon',n)} onClose={()=>setPicking(false)}/>}
  </form>
 </div>;
}

export function Calendar({onRequireOwner,onSuccess}){
 const [today,setToday]=useState(dayKey);
 const [selected,setSelected]=useState(dayKey);
 const [cursor,setCursor]=useState(()=>{const d=parseDay(dayKey());return {year:d.getFullYear(),month:d.getMonth()+1}});
 const [editing,setEditing]=useState(null);
 const grid=useMemo(()=>monthGrid(cursor.year,cursor.month),[cursor]);
 const range=useMemo(()=>({start:grid[0].key,end:grid[grid.length-1].key}),[grid]);
 const {items,ready,busy,message,persist,refresh}=useSheetCalendar(onRequireOwner,range);

 // The 05:00 day boundary can roll over while the page is open.
 useEffect(()=>{
  const tick=()=>setToday(dayKey());
  const timer=setInterval(tick,30000);
  addEventListener('focus',tick);
  return()=>{clearInterval(timer);removeEventListener('focus',tick)};
 },[]);

 const byDay=useMemo(()=>{
  const map=new Map();
  for(const cell of grid)map.set(cell.key,eventsOn(items,cell.key));
  return map;
 },[items,grid]);
 const dayEvents=useMemo(()=>eventsOn(items,selected),[items,selected]);
 const soon=useMemo(()=>upcoming(items,today,30,5),[items,today]);
 const monthCount=useMemo(()=>grid.filter(c=>c.inMonth).reduce((n,c)=>n+(byDay.get(c.key)?.length||0),0),[grid,byDay]);

 function openNew(dateKey){
  setEditing({id:newId(),title:'',detail:'',date:dateKey,icon:'calendar-month',tone:'blue',
   repeat:'none',repeatUntil:'',done:false,doneDates:'',createdAt:'',isNew:true});
 }
 function goToday(){
  const key=dayKey();
  setToday(key);setSelected(key);
  const d=parseDay(key);setCursor({year:d.getFullYear(),month:d.getMonth()+1});
 }
 function moveMonth(step){
  setCursor(c=>{
   const d=new Date(c.year,c.month-1+step,1,12);
   return {year:d.getFullYear(),month:d.getMonth()+1};
  });
 }
 async function save(form){
  const {isNew,...event}=form;
  const list=items.some(x=>x.id===event.id)
   ? items.map(x=>x.id===event.id?{...x,...event}:x)
   : [...items,event];
  const ok=await persist(list);
  if(ok){
   setEditing(null);setSelected(event.date);
   const d=parseDay(event.date);setCursor({year:d.getFullYear(),month:d.getMonth()+1});
   if(isNew)onSuccess?.();
  }
 }
 async function remove(id){
  const ok=await persist(items.filter(x=>x.id!==id));
  if(ok)setEditing(null);
 }
 /** Ticking one day of a repeating event only affects that day. */
 async function toggleDone(event,key){
  const next=items.map(x=>{
   if(x.id!==event.id)return x;
   if(x.repeat==='none')return {...x,done:!x.done};
   const days=doneSet(x);
   days.has(key)?days.delete(key):days.add(key);
   return {...x,doneDates:[...days].sort().join(',')};
  });
  const ok=await persist(next);
  if(ok&&!isDoneOn(event,key))onSuccess?.();
 }

 const allDone=dayEvents.length>0&&dayEvents.every(e=>isDoneOn(e,selected));
 return <section className="page calendarPage">
  <header className="calHero">
   <img className="calHeroArt" src={charSrc('holding-calendar')} alt=""/>
   <div>
    <p className="calEyebrow">SCHEDULE</p>
    <h1>ปฏิทินของเรา</h1>
    <p className="calLead">นัดหมายและสิ่งที่ต้องทำในแต่ละวัน · เดือนนี้มี {monthCount} รายการ</p>
   </div>
   <button className="calPrimary calAdd" onClick={()=>openNew(selected)}>✚ เพิ่มนัดหมาย</button>
  </header>

  {soon.length>0&&
   <div className="calUpcoming">
    <img src={charSrc('phone-reminder')} alt=""/>
    <div>
     <b>ใกล้ถึงแล้ว</b>
     <ul>{soon.map(({event,key})=>
      <li key={event.id+key} style={{'--tone':toneOf(event.tone)[2]}}>
       <button type="button" onClick={()=>{
         setSelected(key);
         const d=parseDay(key);setCursor({year:d.getFullYear(),month:d.getMonth()+1});
        }}>
        <img src={iconSrc(event.icon)} alt=""/>
        <span>{event.title}</span>
        <small>{key===today?'วันนี้':shortDay(key)}</small>
       </button>
      </li>)}
     </ul>
    </div>
   </div>}

  <div className="calBoard">
   <section className="calMonth">
    <div className="calMonthBar">
     <button type="button" onClick={()=>moveMonth(-1)} aria-label="เดือนก่อนหน้า">‹</button>
     <h2>{monthLabel(cursor.year,cursor.month)}</h2>
     <button type="button" onClick={()=>moveMonth(1)} aria-label="เดือนถัดไป">›</button>
     <button type="button" className="calToday" onClick={goToday}>วันนี้</button>
    </div>
    <div className="calGrid">
     {WEEKDAYS.map(d=><span className="calWeekday" key={d}>{d}</span>)}
     {grid.map(cell=>{
      const list=byDay.get(cell.key)||[];
      const undone=list.filter(e=>!isDoneOn(e,cell.key));
      return <button type="button" key={cell.key}
        className={`calDay${cell.inMonth?'':' outside'}${cell.key===today?' isToday':''}${cell.key===selected?' selected':''}`}
        aria-pressed={cell.key===selected}
        aria-label={`${dayLabel(cell.key)} · ${list.length} รายการ`}
        onClick={()=>setSelected(cell.key)}
        onDoubleClick={()=>openNew(cell.key)}>
       <b>{cell.day}</b>
       {list.length>0&&<>
        {/* A day with something on it gets a star; it dims once everything
            there is ticked off. The colour dots stay underneath. */}
        <img className={`calStar${undone.length?'':' done'}`} src={iconSrc('event-star')} alt=""/>
        <span className="calDots">
         {list.slice(0,4).map(e=>
          <i key={e.id} style={{'--tone':toneOf(e.tone)[2]}} className={isDoneOn(e,cell.key)?'done':''}/>)}
         {list.length>4&&<u>+{list.length-4}</u>}
        </span>
       </>}
       {undone.length>0&&<small>{undone.length}</small>}
      </button>;
     })}
    </div>
    <p className="calHint">คลิกวันเพื่อดูรายการ · ดับเบิลคลิกเพื่อเพิ่มนัดของวันนั้น</p>
   </section>

   <section className="calDayPanel">
    <div className="calDayHead">
     <div>
      <p className="calEyebrow">{selected===today?'วันนี้':'วันที่เลือก'}</p>
      <h2>{dayLabel(selected)}</h2>
     </div>
     <button type="button" className="calPrimary" onClick={()=>openNew(selected)}>✚ เพิ่ม</button>
    </div>

    {dayEvents.length===0
     ? <div className="calEmpty">
        <img src={charSrc('thinking-planning')} alt=""/>
        <p>วันนี้ยังว่างอยู่</p>
        <small>กดปุ่มเพิ่มด้านบน หรือดับเบิลคลิกวันในปฏิทิน</small>
       </div>
     : <>
        {allDone&&
         <div className="calAllDone">
          <img src={charSrc('schedule-complete')} alt=""/>
          <b>เคลียร์ครบทุกอย่างของวันนี้แล้ว</b>
         </div>}
        <ul className="calList">{dayEvents.map(event=>{
         const done=isDoneOn(event,selected);
         return <li key={event.id} className={done?'done':''} style={{'--tone':toneOf(event.tone)[2]}}>
          <button type="button" className="calCheck" disabled={busy} aria-pressed={done}
            aria-label={`${done?'ยกเลิก':'ทำเสร็จแล้ว'} ${event.title}`}
            onClick={()=>toggleDone(event,selected)}>
           <span className="calBox">{done?'✔':''}</span>
          </button>
          <img className="calRowIcon" src={iconSrc(event.icon)} alt=""/>
          <div className="calRowText">
           <b>{event.title}</b>
           {event.detail&&<p>{event.detail}</p>}
           <div className="calRowTags">
            <span className="calTag">{iconLabel(event.icon)}</span>
            {event.repeat!=='none'&&
             <span className="calTag repeat">
              <img src={iconSrc('recurring-schedule')} alt=""/>{repeatLabel(event.repeat)}
              {event.repeatUntil&&` ถึง ${shortDay(event.repeatUntil)}`}
             </span>}
           </div>
          </div>
          <button type="button" className="calEdit" aria-label={`แก้ไข ${event.title}`}
            onClick={()=>setEditing({...event,isNew:false})}>
           <img src={iconSrc('edit-pencil')} alt=""/>
          </button>
         </li>;
        })}</ul>
       </>}
   </section>
  </div>

  <div className="calFooter">
   <span className={ready?'connected':''}>{ready?'☁ Google Sheets · แท็บ Calendar':'กำลังเชื่อมต่อ…'}</span>
   <button type="button" disabled={busy} onClick={refresh}>โหลดใหม่</button>
   <p className="calMessage" role="status">{message}</p>
  </div>

  {editing&&<EventModal initial={editing} onSave={save} onDelete={remove} onClose={()=>setEditing(null)}/>}
 </section>;
}
