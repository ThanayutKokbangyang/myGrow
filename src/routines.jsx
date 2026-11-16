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
 return <span className={`rtStamp ${animate?'stamping':''} ${small?'small':''}`} aria-label="ทำครบทุกข้อ">
  <svg viewBox="0 0 64 64" aria-hidden="true" shapeRendering="crispEdges"><path d="M22 3h20v4h10v5h5v10h4v20h-4v10h-5v5H42v4H22v-4H12v-5H7V42H3V22h4V12h5V7h10Z" fill="none" stroke="currentColor" strokeWidth="3"/><path d="m19 26 9 9 18-19" fill="none" stroke="currentColor" strokeWidth="5"/></svg><b>ทำครบ</b>
 </span>;
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
 const state=useRoutines(),{templates,day,month,calendar,loading,saving,loaded,error,notice,celebration,check,command,load}=state;
 const [manage,setManage]=useState(false),[editing,setEditing]=useState(null),[archive,setArchive]=useState(''),[party,setParty]=useState(false),[stampAnimation,setStampAnimation]=useState(false);
 const success=useRef(onSuccess);success.current=onSuccess;
 const seen=useRef(celebration),today=routineDay(),isToday=day.date===today,stamped=routineComplete(day),completed=day.items.filter(item=>item.done).length;
 const calendarIndex=routineCalendar(state),monthStamps=[...calendarIndex.values()].filter(item=>item.date.slice(0,7)===month&&item.stampedAt).length;
 const pendingFull=day.items.length>0&&completed===day.items.length&&!stamped&&saving;
 useEffect(()=>{if(!stamped){setStampAnimation(false);return}if(celebration===seen.current)return;seen.current=celebration;setParty(true);setStampAnimation(true);success.current?.();const timer=setTimeout(()=>setStampAnimation(false),800);return()=>clearTimeout(timer)},[celebration,stamped]);
 function view(date=day.date,nextMonth=month){load({date,month:nextMonth})}
 async function saveTemplate(item){return command({action:'upsert',item,revision:item.revision||0})}
 async function archiveTemplate(item){if(await command({action:'archive',id:item.id,revision:item.revision}))setArchive('')}
 return <section className="routinePage" aria-labelledby="routineTitle">
  <header className="rtPageHeader"><div className="rtTitle"><img src="/ui/pixel/routine.svg" width="42" height="42" alt=""/><div><h1 id="routineTitle">รูทีนของเรา</h1><p>ทำทีละข้อ แล้วเก็บตราให้วันนี้</p></div></div><div className="rtHeaderActions"><span className={`rtSync ${saving?'saving':''}`} role="status">{saving?'กำลังบันทึก…':loaded?'บันทึกกับ Google Sheets':'กำลังเปิดสมุดรูทีน…'}</span><button className="rtSecondary" disabled={saving||loading} onClick={()=>load({date:day.date,month},true)}><Glyph name="refresh"/>โหลดใหม่</button></div></header>
  {error&&<div className="rtError" role="alert"><span>{error}</span><button disabled={saving||loading} onClick={()=>load({date:today,month:today.slice(0,7)},true)}>ลองโหลดวันนี้ใหม่</button></div>}
  <div className="rtWorkspace">
   <section className="rtPanel rtChecklist"><header className="rtPanelHeader"><div><h2>{isToday?'รูทีนวันนี้':'รูทีนที่บันทึกไว้'}</h2><p>{routineDateLabel(day.date)} · {!isToday?'ดูย้อนหลัง':state.todayStarted?'รายการของวันนี้ถูกเก็บไว้แล้ว':'เริ่มจากข้อแรกของเรา'}</p></div>{!isToday&&<button className="rtTextButton" disabled={saving||loading} onClick={()=>view(today,today.slice(0,7))}>กลับมาวันนี้</button>}</header>
    <div className={`rtDaySummary ${stamped?'complete':''}`}><div><b>{loaded?`${completed} / ${day.items.length}`:'—'}</b><span>{stamped?'ทำครบแล้ว เก็บตราอีกวัน!':pendingFull?'ครบแล้ว กำลังยืนยันตรา…':'รูทีนที่ทำสำเร็จ'}</span></div>{stamped?<Stamp animate={stampAnimation&&isToday}/>:<img src="/ui/pixel/sprout.png" width="50" height="50" alt=""/>}</div>
    {!loaded&&!error?<div className="rtSkeleton" aria-hidden="true"><i/><i/><i/></div>:day.items.length?<ul className="rtRoutineList">{day.items.map(item=><li key={item.id} className={item.done?'done':''}><label><input type="checkbox" checked={item.done} disabled={!isToday||loading} onChange={event=>check(item.id,event.target.checked)}/><span className="rtCheckBox" aria-hidden="true">{item.done&&<Glyph name="check"/>}</span><img src={`/ui/pixel/${item.icon}.png`} width="30" height="30" alt=""/><span>{item.title}</span></label></li>)}</ul>:<div className="rtEmpty"><img src="/ui/pixel/book.png" width="42" height="42" alt=""/><h3>{isToday?'ยังไม่มีรูทีนประจำวัน':'วันนี้ยังไม่มีบันทึก'}</h3><p>{isToday?'เพิ่มสิ่งเล็ก ๆ ที่อยากทำทุกวัน แล้วเริ่มติ๊กทีละข้อ':'วันที่ยังไม่เคยเช็ครูทีนจะไม่มีตรา'}</p>{isToday&&<button className="rtPrimary" disabled={!loaded||loading||saving} onClick={()=>{setManage(true);setEditing({id:crypto.randomUUID(),title:'',icon:'sprout',revision:0})}}><Glyph name="plus"/>เพิ่มรูทีนแรก</button>}</div>}
    <div className="rtChecklistFooter"><p>{!isToday?'บันทึกวันเก่าเก็บไว้ให้ดู ไม่สามารถติ๊กย้อนหลังได้':'ทำครบทุกข้อของวันนี้แล้วจะได้ตรา หากเอาติ๊กออก ตราของวันนี้จะถูกยกเลิก'}</p><small>วันใหม่เริ่ม 05:00 ตามเวลาไทย · ต้องมีอย่างน้อย 1 รูทีนจึงจะได้ตรา</small></div>
   </section>
   <section className="rtPanel rtCalendar"><header className="rtPanelHeader"><div><h2>ปฏิทินตราของเรา</h2><p>{monthStamps} วันที่ทำครบในเดือนนี้</p></div></header>
    <div className="rtMonthNav"><button className="rtIconButton" aria-label="เดือนก่อนหน้า" disabled={saving||loading} onClick={()=>view(day.date,moveMonth(month,-1))}><Glyph name="left"/></button><h3>{routineDateLabel(month+'-01',{month:'long',year:'numeric'})}</h3><button className="rtIconButton" aria-label="เดือนถัดไป" disabled={saving||loading||month>=today.slice(0,7)} onClick={()=>view(day.date,moveMonth(month,1))}><Glyph name="right"/></button></div>
    <div className="rtWeekdays" aria-hidden="true">{['จ','อ','พ','พฤ','ศ','ส','อา'].map((name,index)=><span key={index}>{name}</span>)}</div>
    <div className="rtCalendarGrid" aria-label="เลือกวันที่เพื่อดูรูทีน">{routineMonthCells(month).map((date,index)=>{
     if(!date)return <span className="rtBlankDay" key={`blank-${index}`}/>;
     const record=calendarIndex.get(date),done=Boolean(record?.stampedAt),future=date>today;
     return <button key={date} type="button" className={`rtDay ${date===today?'today':''} ${date===day.date?'selected':''} ${done?'stamped':''}`} disabled={future||loading||saving} aria-pressed={date===day.date} aria-current={date===today?'date':undefined} aria-label={`${routineDateLabel(date)} ${done?'ทำครบทุกข้อ':record?`ทำแล้ว ${record.completed} จาก ${record.total} ข้อ`:'ยังไม่มีตรา'}`} onClick={()=>view(date,month)}><span className="rtDayNumber">{Number(date.slice(-2))}</span>{done?<Stamp small animate={date===day.date&&stampAnimation&&isToday}/>:record?.completed?<span className="rtPartial">{record.completed}/{record.total}</span>:<span className="rtNoStamp" aria-hidden="true"/>}{date===today&&<small>วันนี้</small>}</button>;
    })}</div>
    <div className="rtCalendarLegend"><span><i className="complete"/>ทำครบทุกข้อ</span><span><i className="partial"/>เริ่มทำแล้ว</span><button disabled={loading||saving} onClick={()=>view(today,today.slice(0,7))}>กลับมาวันนี้</button></div>
   </section>
  </div>
  <section className="rtPanel rtManage"><header className="rtPanelHeader"><div><h2>รายการรูทีนประจำวัน</h2><p>{state.todayStarted?'วันนี้เริ่มเช็คแล้ว การแก้รายการหลักจะใช้ตั้งแต่วันถัดไป':'เพิ่มหรือแก้รายการได้ ก่อนเริ่มเช็คข้อแรกของวันนี้'}</p></div><button className="rtSecondary" aria-expanded={manage} onClick={()=>setManage(value=>!value)}>{manage?'เก็บรายการ':'จัดการรูทีน'}</button></header>
   {manage&&<><div className="rtManageList">{templates.map(item=><div className="rtTemplate" key={item.id}><img src={`/ui/pixel/${item.icon}.png`} width="24" height="24" alt=""/><span>{item.title}</span>{archive===item.id?<div className="rtArchiveConfirm"><span>นำออกจากรายการหลัก?</span><button className="rtDanger" disabled={saving||loading} onClick={()=>archiveTemplate(item)}>ยืนยัน</button><button disabled={saving} onClick={()=>setArchive('')}>เก็บไว้</button></div>:<><button className="rtTextButton" disabled={saving||loading} onClick={()=>setEditing(item)}><Glyph name="edit"/>แก้ไข</button><button className="rtTextDanger" disabled={saving||loading} onClick={()=>setArchive(item.id)}>นำออก</button></>}</div>)}</div>{editing?<RoutineEditor key={editing.id} item={editing} busy={saving||loading} onSave={saveTemplate} onCancel={()=>setEditing(null)}/>:<button className="rtPrimary" disabled={saving||loading||!loaded||templates.length>=50} onClick={()=>setEditing({id:crypto.randomUUID(),title:'',icon:'sprout',revision:0})}><Glyph name="plus"/>เพิ่มรูทีน</button>}<p className="rtManageNote">ประวัติและตราวันเก่าจะยังอยู่ แม้เปลี่ยนหรือนำรายการหลักออก · สูงสุด 50 ข้อ</p></>}
  </section>
  <p className="rtNotice" role="status" aria-live="polite">{notice}</p>
  {party&&<WinCelebration onClose={()=>setParty(false)} label="DAILY ROUTINE COMPLETE" title="ทำครบตามรูทีนแล้ว!" message="บันทึกสำเร็จและปั๊มตราลงปฏิทินของวันนี้แล้ว" actionLabel="ดูตราของเรา"/>}
 </section>;
}
