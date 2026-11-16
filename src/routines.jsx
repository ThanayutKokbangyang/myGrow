import React,{useEffect,useRef,useState} from 'react';
import {useRoutines} from './use-routines';
import {ROUTINE_ICONS,moveMonth,routineCalendar,routineComplete,routineDateLabel,routineDay,routineMonthCells} from './routine-model';
import {WinCelebration} from './win-celebration';
import './routines.css';

function Glyph({name}){
 const paths={left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',plus:'M12 5v14M5 12h14',check:'m5 12 4 4L19 6',edit:'m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',close:'m6 6 12 12M18 6 6 18',refresh:'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M18 18a8 8 0 0 1-13-3'};
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.plus}/></svg>;
}
function Stamp({animate=false,small=false}){
 return <span className={`rtStamp ${animate?'stamping':''} ${small?'small':''}`} aria-label="ทำครบทุกข้อ"><img src="/ui/routine-success-stamp.png" width="1024" height="1024" alt="" draggable={false}/></span>;
}
function RoutineEditor({item,busy,onSave,onCancel}){
 const [title,setTitle]=useState(item.title||''),[icon,setIcon]=useState(item.icon||'sprout'),[saving,setSaving]=useState(false);
 async function submit(event){event.preventDefault();if(saving||busy||!title.trim())return;setSaving(true);try{if(await onSave({...item,title:title.trim(),icon}))onCancel()}finally{setSaving(false)}}
 return <form className="rtEditor" onSubmit={submit}>
  <label>ชื่อรูทีน<input autoFocus required maxLength={160} disabled={saving} value={title} onChange={event=>setTitle(event.target.value)} placeholder="เช่น อ่านหนังสือ 20 นาที"/></label>
  <fieldset><legend>ไอคอน</legend><div className="rtIconChoices">{ROUTINE_ICONS.map(([value,label])=><button type="button" key={value} disabled={saving} aria-label={label} title={label} aria-pressed={icon===value} onClick={()=>setIcon(value)}><img src={`/ui/pixel/${value}.png`} width="24" height="24" alt=""/></button>)}</div></fieldset>
  <div className="rtFormActions"><button className="rtPrimary" disabled={busy||saving||!title.trim()}>{saving?'กำลังบันทึก…':'บันทึกรูทีน'}</button><button type="button" className="rtSecondary" disabled={saving} onClick={onCancel}>ยกเลิก</button></div>
 </form>;
}
export function RoutinePage({onSuccess}){
 const state=useRoutines(),{templates,day,month,loading,saving,loaded,error,notice,celebration,check,command,load}=state;
 const [manage,setManage]=useState(false),[editing,setEditing]=useState(null),[archive,setArchive]=useState(''),[party,setParty]=useState(false),[stampAnimation,setStampAnimation]=useState(false);
 const success=useRef(onSuccess);success.current=onSuccess;
 const seen=useRef(celebration),today=routineDay(),isToday=day.date===today,stamped=routineComplete(day),completed=day.items.filter(item=>item.done).length;
 const calendarIndex=routineCalendar(state),monthStamps=[...calendarIndex.values()].filter(item=>item.date.slice(0,7)===month&&item.stampedAt).length;
 const ready=isToday&&loaded&&!loading&&!saving&&!stamped&&day.items.length>0&&completed===day.items.length;
 const [dragging,setDragging]=useState(false),[overToday,setOverToday]=useState(false);
 function stampToday(){if(ready)return command({action:'stamp',revision:day.revision})}
 function dropStamp(event,date){event.preventDefault();setOverToday(false);setDragging(false);if(date===today&&event.dataTransfer.getData('application/x-mygrow-routine-stamp')===today)stampToday()}
 useEffect(()=>{if(!stamped){setStampAnimation(false);return}if(celebration===seen.current)return;seen.current=celebration;setParty(true);setStampAnimation(true);success.current?.();const timer=setTimeout(()=>setStampAnimation(false),800);return()=>clearTimeout(timer)},[celebration,stamped]);
 function view(date=day.date,nextMonth=month){load({date,month:nextMonth})}
 async function saveTemplate(item){return command({action:'upsert',item,revision:item.revision||0})}
 async function archiveTemplate(item){if(await command({action:'archive',id:item.id,revision:item.revision}))setArchive('')}
 return <section className="routinePage" aria-labelledby="routineTitle">
  <header className="rtPageHeader"><div className="rtTitle"><img src="/ui/pixel/routine.svg" width="42" height="42" alt=""/><div><h1 id="routineTitle">รูทีนของเรา</h1><p>ตั้งรูทีนครั้งเดียว ทำต่อทุกวัน เก็บตราให้เต็มเดือน</p></div></div><div className="rtHeaderActions"><span className={`rtSync ${saving?'saving':''}`} role="status">{saving?'กำลังบันทึก…':loaded?'บันทึกกับ Google Sheets':'กำลังเปิดสมุดรูทีน…'}</span><button className="rtSecondary" disabled={saving||loading} onClick={()=>load({date:day.date,month},true)}><Glyph name="refresh"/>โหลดใหม่</button></div></header>
  {error&&<div className="rtError" role="alert"><span>{error}</span><button disabled={saving||loading} onClick={()=>load({date:today,month:today.slice(0,7)},true)}>ลองโหลดวันนี้ใหม่</button></div>}
  <div className="rtIntro"><img className="rtMascot" src="/ui/tae-checklist-desk-web.webp" width="190" height="160" alt=""/><div><h2>เดือนนี้ เราจะทำอะไรให้ได้ทุกวัน?</h2><p>เพิ่มรายการประจำของเราเพียงครั้งเดียว<br/>รูทีนชุดนี้จะอยู่ให้เช็คทุกวันตลอดเดือน และใช้ต่อในเดือนถัดไป</p><button className="rtPrimary" disabled={!loaded||loading||saving} onClick={()=>{setManage(true);document.getElementById('routineSetup')?.scrollIntoView({behavior:'smooth',block:'start'})}}>ตั้งค่ารูทีนของเรา</button></div></div>
  <div className="rtWorkspace">
   <section className="rtPanel rtChecklist"><header className="rtPanelHeader"><div><h2>{isToday?'รูทีนวันนี้':'รูทีนที่บันทึกไว้'}</h2><p>{routineDateLabel(day.date)} · {!isToday?'ดูย้อนหลัง':state.todayStarted?'รายการของวันนี้ถูกเก็บไว้แล้ว':'เริ่มจากข้อแรกของเรา'}</p></div>{!isToday&&<button className="rtTextButton" disabled={saving||loading} onClick={()=>view(today,today.slice(0,7))}>กลับมาวันนี้</button>}</header>
    <div className={`rtDaySummary ${stamped?'complete':''}`}><div><b>{loaded?`${completed} / ${day.items.length}`:'—'}</b><span>{stamped?'วันนี้ทำสำเร็จแล้ว!':ready?'ครบแล้ว! ไปปั๊มตรากัน':'ทำทีละข้อในจังหวะของเรา'}</span></div><img src="/ui/pixel/sprout.png" width="42" height="42" alt=""/></div>
    {!loaded&&!error?<div className="rtSkeleton" aria-hidden="true"><i/><i/><i/></div>:day.items.length?<ul className="rtRoutineList">{day.items.map(item=><li key={item.id} className={item.done?'done':''}><label><input type="checkbox" checked={item.done} disabled={!isToday||loading} onChange={event=>check(item.id,event.target.checked)}/><span className="rtCheckBox" aria-hidden="true">{item.done&&<Glyph name="check"/>}</span><img src={`/ui/pixel/${item.icon}.png`} width="30" height="30" alt=""/><span>{item.title}</span></label></li>)}</ul>:<div className="rtEmpty"><img src="/ui/pixel/book.png" width="42" height="42" alt=""/><h3>{isToday?'ยังไม่มีรูทีนประจำวัน':'วันนี้ยังไม่มีบันทึก'}</h3><p>{isToday?'เพิ่มสิ่งเล็ก ๆ ที่อยากทำทุกวัน แล้วเริ่มติ๊กทีละข้อ':'วันที่ยังไม่เคยเช็ครูทีนจะไม่มีตรา'}</p>{isToday&&<button className="rtPrimary" disabled={!loaded||loading||saving} onClick={()=>{setManage(true);setEditing({id:crypto.randomUUID(),title:'',icon:'sprout',revision:0})}}><Glyph name="plus"/>เพิ่มรูทีนแรก</button>}</div>}
    <div className="rtChecklistFooter"><p>{!isToday?'บันทึกวันเก่าเก็บไว้ให้ดู ไม่สามารถติ๊กย้อนหลังได้':'รายการนี้ใช้ซ้ำทุกวัน ไม่ต้องเพิ่มใหม่ หากเอาติ๊กออก ตราของวันนี้จะถูกยกเลิก'}</p><small>วันใหม่เริ่ม 05:00 ตามเวลาไทย · ต้องมีอย่างน้อย 1 รูทีนจึงจะได้ตรา</small></div>
    <div className={`rtStampTray ${ready?'ready':''} ${dragging?'dragging':''} ${stamped?'collected':''}`}><button type="button" className="rtStampSource" disabled={!ready} draggable={ready} onDragStart={event=>{event.dataTransfer.setData('application/x-mygrow-routine-stamp',today);event.dataTransfer.effectAllowed='copy';setDragging(true)}} onDragEnd={()=>{setDragging(false);setOverToday(false)}} onClick={stampToday} aria-label="ปั๊มตราวันนี้"><Stamp animate={stampAnimation}/></button><div><h3>{stamped?'เก็บความสำเร็จวันนี้แล้ว':ready?'ตรานี้เป็นของเราแล้ว!':'ตราความสำเร็จวันนี้'}</h3><p>{stamped?'พรุ่งนี้มาเก็บอีกดวงด้วยกัน':ready?'ลากตราไปวางบนวันที่วันนี้ หรือกดปุ่มด้านล่าง':'เช็คให้ครบทุกข้อ เพื่อปลดล็อกตราประจำวัน'}</p><button className="rtPrimary" disabled={!ready} onClick={stampToday}>{saving?'กำลังบันทึก…':stamped?'ปั๊มตราแล้ว':'ปั๊มตราวันนี้'}</button></div></div>
   </section>
   <section className="rtPanel rtCalendar"><header className="rtPanelHeader"><div><h2>สะสมวันที่เราทำได้</h2><p>เดือนนี้เก็บได้ {monthStamps} ตรา</p></div></header>
    <div className="rtMonthNav"><button className="rtIconButton" aria-label="เดือนก่อนหน้า" disabled={saving||loading} onClick={()=>view(day.date,moveMonth(month,-1))}><Glyph name="left"/></button><h3>{routineDateLabel(month+'-01',{month:'long',year:'numeric'})}</h3><button className="rtIconButton" aria-label="เดือนถัดไป" disabled={saving||loading||month>=today.slice(0,7)} onClick={()=>view(day.date,moveMonth(month,1))}><Glyph name="right"/></button></div>
    <div className="rtWeekdays" aria-hidden="true">{['จ','อ','พ','พฤ','ศ','ส','อา'].map((name,index)=><span key={index}>{name}</span>)}</div>
    <div className="rtCalendarGrid" aria-label="เลือกวันที่เพื่อดูรูทีน">{routineMonthCells(month).map((date,index)=>{
     if(!date)return <span className="rtBlankDay" key={`blank-${index}`}/>;
     const record=calendarIndex.get(date),done=Boolean(record?.stampedAt),future=date>today;
     return <button key={date} type="button" className={`rtDay ${date===today?'today':''} ${date===day.date?'selected':''} ${done?'stamped':''} ${date===today&&ready?'dropReady':''} ${date===today&&overToday?'dragOver':''}`} onDragOver={event=>{if(date===today&&ready){event.preventDefault();event.dataTransfer.dropEffect='copy';setOverToday(true)}}} onDragLeave={()=>setOverToday(false)} onDrop={event=>dropStamp(event,date)} disabled={future||loading||saving} aria-pressed={date===day.date} aria-current={date===today?'date':undefined} aria-label={`${routineDateLabel(date)} ${done?'ทำครบทุกข้อ':record?`ทำแล้ว ${record.completed} จาก ${record.total} ข้อ`:'ยังไม่มีตรา'}`} onClick={()=>view(date,month)}><span className="rtDayNumber">{Number(date.slice(-2))}</span>{done?<Stamp small animate={date===day.date&&stampAnimation&&isToday}/>:record?.completed?<span className="rtPartial">{record.completed}/{record.total}</span>:<span className="rtNoStamp" aria-hidden="true">{date===today&&ready?'วางตราที่นี่':''}</span>}{date===today&&<small>วันนี้</small>}</button>;
    })}</div>
    <div className="rtCalendarLegend"><span><i className="complete"/>ทำครบทุกข้อ</span><span><i className="partial"/>เริ่มทำแล้ว</span><button disabled={loading||saving} onClick={()=>view(today,today.slice(0,7))}>กลับมาวันนี้</button></div>
   </section>
  </div>
  <section className="rtPanel rtManage" id="routineSetup"><header className="rtPanelHeader"><div><h2>รูทีนประจำของเรา</h2><p>{state.todayStarted?'วันนี้เริ่มเช็คแล้ว การแก้รายการหลักจะใช้ตั้งแต่วันถัดไป':'ตั้งครั้งเดียว ใช้ทุกวันทั้งเดือน ไม่ต้องเพิ่มซ้ำทีละวัน'}</p></div><button className="rtSecondary" aria-expanded={manage} onClick={()=>setManage(value=>!value)}>{manage?'เก็บรายการ':'จัดการรูทีน'}</button></header>
   {manage&&<><div className="rtManageList">{templates.map(item=><div className="rtTemplate" key={item.id}><img src={`/ui/pixel/${item.icon}.png`} width="24" height="24" alt=""/><span>{item.title}</span>{archive===item.id?<div className="rtArchiveConfirm"><span>นำออกจากรายการหลัก?</span><button className="rtDanger" disabled={saving||loading} onClick={()=>archiveTemplate(item)}>ยืนยัน</button><button disabled={saving} onClick={()=>setArchive('')}>เก็บไว้</button></div>:<><button className="rtTextButton" disabled={saving||loading} onClick={()=>setEditing(item)}><Glyph name="edit"/>แก้ไข</button><button className="rtTextDanger" disabled={saving||loading} onClick={()=>setArchive(item.id)}>นำออก</button></>}</div>)}</div>{editing?<RoutineEditor key={editing.id} item={editing} busy={saving||loading} onSave={saveTemplate} onCancel={()=>setEditing(null)}/>:<button className="rtPrimary" disabled={saving||loading||!loaded||templates.length>=50} onClick={()=>setEditing({id:crypto.randomUUID(),title:'',icon:'sprout',revision:0})}><Glyph name="plus"/>เพิ่มรูทีน</button>}<p className="rtManageNote">ประวัติและตราวันเก่าจะยังอยู่ แม้เปลี่ยนหรือนำรายการหลักออก · สูงสุด 50 ข้อ</p></>}
  </section>
  <p className="rtNotice" role="status" aria-live="polite">{notice}</p>
  {party&&<WinCelebration onClose={()=>setParty(false)} label="DAILY ROUTINE COMPLETE" title="ทำครบตามรูทีนแล้ว!" message="บันทึกสำเร็จและปั๊มตราลงปฏิทินของวันนี้แล้ว" actionLabel="ดูตราของเรา"/>}
 </section>;
}
