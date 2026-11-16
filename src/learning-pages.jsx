import React,{useEffect,useRef,useState} from 'react';
import {loadActivities,loadLearningStats} from './api';
import {PomodoroCard,FOCUS_SECONDS} from './pomodoro-card';
import {compareMinutes,formatLearningDay,formatMinutes,groupActivities,learningDay} from './learning-model';
import './learning-pages.css';

const skillOf=(skills,key)=>skills[key]||{label:'ทักษะอื่น',asset:'/ui/pixel/book.png',color:'#62746d'};
function Skill({skills,code}){const skill=skillOf(skills,code);return <span className="lrSkill"><img src={skill.asset} width="20" height="20" alt=""/>{skill.label}</span>}
function Empty({title,children,onLog}){return <div className="lrEmpty"><img src="/ui/pixel/sprout.png" width="38" height="38" alt=""/><h3>{title}</h3><p>{children}</p>{onLog&&<button className="lrPrimary" onClick={onLog}>บันทึกกิจกรรมแรก</button>}</div>}
function Entry({item,skills,onEdit,onRemove,removing,confirming,onConfirm,onCancel}){
 return <article className="lrEntry">
  <details><summary><span className="lrEntrySkill"><img src={skillOf(skills,item.skill).asset} width="28" height="28" alt=""/></span><span className="lrEntryHeading"><b>{item.topic}</b><small>{skillOf(skills,item.skill).label} · {new Date(item.date).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'})}</small></span><span className="lrEntryMinutes">{formatMinutes(item.minutes)}</span><span className="lrExpand" aria-hidden="true">⌄</span></summary>
   <div className="lrEntryDetails">{[['learned','ได้เรียนรู้'],['problem','ยังติดตรงไหน'],['next','ครั้งหน้าจะทำอะไรต่อ']].map(([key,label])=>item[key]?<div key={key}><b>{label}</b><p>{item[key]}</p></div>:null)}<p className="lrFieldNote">{item.before>0&&item.after>0?`ประเมินความเข้าใจด้วยตัวเอง: ก่อนฝึก ${item.before}/5 → หลังฝึก ${item.after}/5`:'ยังไม่ได้ประเมินความเข้าใจ'}{item.difficulty>0?` · ความยาก ${item.difficulty}/5`:''}</p>{!item.learned&&!item.problem&&!item.next&&<p>ยังไม่ได้เพิ่มโน้ต กดแก้ไขเพื่อเติมรายละเอียดได้</p>}</div>
  </details>
  <div className="lrEntryActions">{confirming?<><span>ลบบันทึกนี้?</span><button className="lrDanger" disabled={removing} onClick={onRemove}>{removing?'กำลังลบ…':'ยืนยันลบ'}</button><button disabled={removing} onClick={onCancel}>เก็บไว้</button></>:<><button disabled={removing} onClick={()=>onEdit(item)}>แก้ไข</button>{onConfirm&&<button disabled={removing} className="lrDelete" onClick={onConfirm}>ลบ</button>}</>}</div>
 </article>;
}
export function TodayPage({skills,todayLogs,summary,ready,error,onRetry,onLog,onEdit,onView,room,timer,setTimer,running,setRunning,phase,setPhase,sessions,openStage}){
 const [roomOpen,setRoomOpen]=useState(false);
 const minutes=todayLogs.reduce((sum,item)=>sum+Number(item.minutes||0),0);
 function focus(){if(!running){setPhase('focus');setTimer(FOCUS_SECONDS);setRunning(true)}openStage()}
 return <section className="learningPage lrToday">
  <header className="lrPageHeader"><div><h1>วันนี้ เริ่มจากอะไรดี?</h1><p>{formatLearningDay(learningDay(),{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · วันใหม่เริ่ม 05:00</p></div><button className="lrPrimary" onClick={()=>onLog()}>บันทึกกิจกรรม</button></header>
  {error&&<div className="lrError" role="alert">{error}<button onClick={onRetry}>ลองโหลดใหม่</button></div>}
  <div className="lrTodaySummary"><span>ฝึกแล้ว <b>{ready?formatMinutes(minutes):'—'}</b></span><span><b>{ready?todayLogs.length:'—'}</b> กิจกรรมวันนี้</span><span>ต่อเนื่อง <b>{ready?summary.streak||0:'—'}</b> วัน</span></div>
  <div className="lrTodayLayout">
   <div className="lrTodayMain">
    <section className="lrStart"><div><h2>ให้เวลากับสิ่งเดียวก่อน</h2><p>เริ่มโฟกัส 25 นาที แล้วกลับมาบันทึกสิ่งที่ได้ทำจริง</p></div><button className="lrPrimary" onClick={focus}>{running?(phase==='break'?'กลับไปช่วงพัก':'กลับไปโฟกัส'):'เริ่มโฟกัส 25 นาที'}</button><nav aria-label="เปิดงานของเรา"><button onClick={()=>onView('todos')}>ดูภารกิจวันนี้ →</button><button onClick={()=>onView('kanban')}>เปิดบอร์ดงาน →</button></nav></section>
    <section className="lrTodayActivities"><header className="lrSectionHeader"><div><h2>สิ่งที่ลงมือทำวันนี้</h2><p>บันทึกที่ทำแล้ว ไม่ใช่รายการงานที่วางแผนไว้</p></div><button onClick={()=>onView('history')}>ดูบันทึกทั้งหมด →</button></header>
     {!ready&&!error?<div className="lrSkeleton" aria-hidden="true"><i/><i/></div>:todayLogs.length?<div>{[...todayLogs].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5).map(item=><Entry key={item.id} item={item} skills={skills} onEdit={onEdit}/>)}</div>:<Empty title={error?'ยังโหลดข้อมูลไม่ได้':'เริ่มจากกิจกรรมเล็ก ๆ ก็ได้'} onLog={error?undefined:()=>onLog()}>{error?'ลองโหลดใหม่อีกครั้ง ข้อมูลเดิมของเรายังอยู่':'อ่านศัพท์ เขียนโค้ด หรือฝึกคณิต แล้วจดไว้สั้น ๆ'}</Empty>}
    </section>
    <section className="lrTodaySkills"><h2>เวลาฝึกวันนี้ แยกตามทักษะ</h2><div>{Object.entries(skills).map(([key,skill])=><button key={key} onClick={()=>onLog(key)}><img src={skill.asset} width="28" height="28" alt=""/><span>{skill.label}<small>{ready?formatMinutes(todayLogs.filter(item=>item.skill===key).reduce((sum,item)=>sum+Number(item.minutes),0)):'—'}</small></span><b>＋</b></button>)}</div></section>
   </div>
   <aside className="lrTodaySide"><PomodoroCard {...{timer,setTimer,running,setRunning,phase,setPhase,sessions}} tools={<button className="lrTextButton" onClick={openStage}>ขยาย</button>}/><div className="lrRoomIntro"><img src="/ui/pixel/sprout.png" width="32" height="32" alt=""/><h2>ห้อง Pixel ของเรา</h2><p>พักสายตา เดินเล่น หรือเลือกโต๊ะฝึกจากห้องเดิม</p><button className="lrSecondary" aria-expanded={roomOpen} onClick={()=>setRoomOpen(value=>!value)}>{roomOpen?'เก็บห้องไว้ก่อน':'เปิดห้อง Pixel'}</button></div></aside>
  </div>
  {roomOpen&&<section className="lrRoomExpanded" aria-label="ห้อง Pixel">{room}</section>}
 </section>;
}

export function ActivityHistory({skills,onLog,onEdit,onRemove,version}){
 const [query,setQuery]=useState(''),[skill,setSkill]=useState('all'),[start,setStart]=useState(''),[end,setEnd]=useState(''),[page,setPage]=useState(1);
 const [result,setResult]=useState({items:[],page:1,pages:1,total:0}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[deleting,setDeleting]=useState(''),[confirm,setConfirm]=useState('');
 const sequence=useRef(0),top=useRef(null);
 useEffect(()=>{
  const id=++sequence.current;let active=true;
  if(start&&end&&start>end){setError('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด');setLoading(false);return}
  setLoading(true);setError('');
  const timer=setTimeout(()=>loadActivities({page,pageSize:20,skill,query:query.trim(),start,end,refresh:retry?1:undefined}).then(data=>{if(active&&sequence.current===id){setResult(data);if(data.page!==page)setPage(data.page)}}).catch(error=>{if(active&&sequence.current===id)setError(error.message)}).finally(()=>{if(active&&sequence.current===id)setLoading(false)}),query?250:0);
  return()=>{active=false;clearTimeout(timer)};
 },[page,skill,query,start,end,version,retry]);
 const change=setter=>event=>{setter(event.target.value);setPage(1);setConfirm('')};
 async function remove(item){setDeleting(item.id);try{if(await onRemove(item.id)){setConfirm('');setRetry(value=>value+1)}else setError('ลบบันทึกไม่สำเร็จ ข้อมูลยังอยู่ กรุณาลองใหม่อีกครั้ง')}finally{setDeleting('')}}
 const filtered=query||skill!=='all'||start||end;
 return <section className="learningPage lrHistory" ref={top}>
  <header className="lrPageHeader"><div><h1>บันทึกการฝึก</h1><p>ย้อนดูสิ่งที่ทำ กดรายการเพื่ออ่านโน้ต หรือแก้ไขข้อมูลได้</p></div><button className="lrPrimary" onClick={()=>onLog()}>เพิ่มบันทึก</button></header>
  <form className="lrHistoryFilters" onSubmit={event=>event.preventDefault()}><label className="lrSearch">ค้นหาบันทึก<input type="search" value={query} maxLength={120} placeholder="หัวข้อ สิ่งที่เรียนรู้ หรือปัญหา…" onChange={change(setQuery)}/></label><label>ทักษะ<select value={skill} onChange={change(setSkill)}><option value="all">ทุกทักษะ</option>{Object.entries(skills).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></label><label>ตั้งแต่วันที่<input type="date" value={start} onChange={change(setStart)}/></label><label>ถึงวันที่<input type="date" value={end} onChange={change(setEnd)}/></label>{filtered&&<button type="button" className="lrSecondary" onClick={()=>{setQuery('');setSkill('all');setStart('');setEnd('');setPage(1)}}>ล้างตัวกรอง</button>}<button type="button" className="lrSecondary" disabled={loading} onClick={()=>setRetry(value=>value+1)}>โหลดใหม่</button></form>
  <div className="lrResultsStatus" role="status">{loading?'กำลังอัปเดตรายการ…':error?'โหลดบันทึกไม่สำเร็จ':`พบ ${result.total||0} กิจกรรม`}</div>
  {error&&<div className="lrError" role="alert">{error}<button onClick={()=>setRetry(value=>value+1)}>ลองใหม่</button></div>}
  <div className="lrHistoryList" aria-busy={loading}>{!result.items.length?(loading?<div className="lrSkeleton" aria-hidden="true"><i/><i/><i/></div>:!error&&<Empty title={filtered?'ไม่พบบันทึกที่ตรงกับตัวกรอง':'ยังไม่มีบันทึกการฝึก'} onLog={filtered?undefined:()=>onLog()}>{filtered?'ลองเปลี่ยนคำค้นหา หรือขยายช่วงวันที่':'บันทึกกิจกรรมแรก เพื่อเก็บสิ่งที่เราได้เรียนรู้'}</Empty>):groupActivities(result.items).map(([day,items])=><section className="lrDayGroup" key={day}><header><h2>{day===learningDay()?'วันนี้':formatLearningDay(day,{day:'numeric',month:'long',year:'numeric'})}</h2><span>แสดง {items.length} กิจกรรมในหน้านี้</span></header>{items.map(item=><Entry key={item.id} item={item} skills={skills} onEdit={onEdit} onConfirm={()=>setConfirm(item.id)} confirming={confirm===item.id} removing={deleting===item.id} onRemove={()=>remove(item)} onCancel={()=>setConfirm('')}/>)}</section>)}</div>
  {result.pages>1&&<nav className="lrPagination" aria-label="หน้าบันทึกการฝึก"><button className="lrSecondary" disabled={loading||page<=1} onClick={()=>{setPage(value=>value-1);top.current?.scrollIntoView({behavior:'smooth'})}}>← ก่อนหน้า</button><span>หน้า {result.page} / {result.pages}</span><button className="lrSecondary" disabled={loading||page>=result.pages} onClick={()=>{setPage(value=>value+1);top.current?.scrollIntoView({behavior:'smooth'})}}>ถัดไป →</button></nav>}
 </section>;
}

export function LearningStats({skills,onLog,version}){
 const [days,setDays]=useState(7),[data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;setLoading(true);setError('');
  loadLearningStats(days,Boolean(retry)).then(result=>{if(active)setData(result)}).catch(error=>{if(active)setError(error.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[days,version,retry]);
 const current=data?.current,previous=data?.previous,matching=data?.days===days,max=Math.max(1,...(data?.daily||[]).map(item=>item.minutes));
 return <section className="learningPage lrStats">
  <header className="lrPageHeader"><div><h1>สถิติการฝึก</h1><p>ดูเวลาที่ลงมือทำและความสม่ำเสมอ จากกิจกรรมที่บันทึกจริง</p></div><div className="lrPeriod" aria-label="ช่วงเวลาของสถิติ">{[7,30].map(value=><button key={value} aria-pressed={days===value} onClick={()=>setDays(value)}>{value} วันล่าสุด</button>)}</div></header>
  {error&&<div className="lrError" role="alert">{error}<button onClick={()=>setRetry(value=>value+1)}>ลองโหลดใหม่</button></div>}
  {!data?(loading?<div className="lrSkeleton" aria-hidden="true"><i/><i/><i/></div>:<Empty title="ยังโหลดสถิติไม่ได้">ลองโหลดข้อมูลใหม่อีกครั้ง</Empty>):<div className={loading||!matching?'lrStatsContent updating':'lrStatsContent'} aria-busy={loading}>
   <div className="lrRangeLabel">{formatLearningDay(data.start)} – {formatLearningDay(data.end)} · เทียบ {formatLearningDay(data.previousStart)} – {formatLearningDay(data.previousEnd)}{loading&&<span>กำลังอัปเดต…</span>}</div>
   <dl className="lrStatsSummary"><div><dt>เวลาฝึก</dt><dd>{formatMinutes(current.minutes)}</dd><small>{compareMinutes(current.minutes,previous.minutes)}</small></div><div><dt>วันที่ลงมือทำ</dt><dd>{current.activeDays}<small> / {data.days} วัน</small></dd><small>ช่วงก่อน {previous.activeDays} วัน</small></div><div><dt>กิจกรรมที่บันทึก</dt><dd>{current.total}<small> กิจกรรม</small></dd><small>ช่วงก่อน {previous.total} กิจกรรม</small></div></dl>
   {current.total===0&&<Empty title="ช่วงนี้ยังไม่มีบันทึก" onLog={()=>onLog()}>เริ่มบันทึกครั้งแรก หรือเลือกอีกช่วงเวลาเพื่อดูข้อมูลเดิม</Empty>}
   <section className="lrTrend"><header className="lrSectionHeader"><div><h2>เวลาฝึกในแต่ละวัน</h2><p>วันที่ไม่มีบันทึกแสดงเป็น 0 นาที · วันใหม่เริ่ม 05:00 ตามเวลาไทย</p></div></header><ol className="lrDailyBars" aria-label="นาทีที่ฝึกในแต่ละวัน">{data.daily.map(item=><li key={item.day} title={`${formatLearningDay(item.day)}: ${item.minutes} นาที`}><div><i style={{height:item.minutes?`${Math.max(3,item.minutes/max*100)}%`:'2px'}}/><span className="lrSrOnly">{formatLearningDay(item.day)} {item.minutes} นาที</span></div><small aria-hidden="true">{data.days===7?formatLearningDay(item.day,{weekday:'short'}):item.day.slice(-2)}</small></li>)}</ol><div className="lrTrendScale"><span>{formatLearningDay(data.start)}</span><span>วันที่ฝึกนานที่สุด {formatMinutes(max===1&&!current.minutes?0:max)}</span><span>{formatLearningDay(data.end)}</span></div></section>
   <section className="lrSkillDistribution"><h2>แบ่งเวลาฝึกให้ทักษะไหนบ้าง</h2><p>สัดส่วนของเวลาที่ฝึกทั้งหมดในช่วงนี้ ไม่ใช่คะแนนความเก่ง</p>{Object.entries(skills).map(([key,item])=>{const minutes=current.totals[key]||0,percent=current.minutes?Math.round(minutes/current.minutes*100):0;return <div className="lrDistributionRow" key={key}><Skill skills={skills} code={key}/><div className="lrDistributionTrack"><i style={{width:`${percent}%`,background:item.color}}/></div><b>{formatMinutes(minutes)}</b><small>{percent}%</small></div>})}</section>
   <p className="lrStatsFootnote">คะแนนก่อน–หลังในบันทึกเป็นการประเมินความเข้าใจด้วยตัวเอง จึงแยกไว้ในรายละเอียดกิจกรรม</p>
  </div>}
 </section>;
}
