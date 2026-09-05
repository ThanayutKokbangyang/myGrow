import React,{useEffect,useMemo,useState} from 'react';
import './goals.css';
import {useSheetGoals} from './use-sheet-goals';
import {GOAL_ICONS,PLAN_ICONS,GOAL_STATUS,TERMS,goalIconSrc,planIconSrc,
        buildBoard,daysLeft,formatDay,newId} from './goals-model';

const statusLabel=id=>(GOAL_STATUS.find(s=>s[0]===id)||GOAL_STATUS[0])[1];
const termLabel=id=>(TERMS.find(t=>t[0]===id)||TERMS[0])[1];

/** Grid of pixel art to choose from, used for both goals and plan steps. */
function IconPicker({kind,value,onPick,onClose}){
 const list=kind==='goal'?GOAL_ICONS:PLAN_ICONS;
 const src=kind==='goal'?goalIconSrc:planIconSrc;
 useEffect(()=>{
  const onKey=e=>{if(e.key==='Escape')onClose()};
  addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey);
 },[onClose]);
 return <div className="goalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="goalModal goalPickerModal" role="dialog" aria-modal="true" aria-label="เลือกไอคอน">
   <header><h2>{kind==='goal'?'เลือกรูปเป้าหมาย':'เลือกรูปแผน'}</h2>
    <button type="button" onClick={onClose} aria-label="ปิด">✕</button></header>
   <div className={`goalIconGrid ${kind}`}>
    {list.map(([name,label],i)=>
     <button type="button" key={name} title={label} aria-label={label} aria-pressed={value===name}
       style={{'--i':i}} onClick={()=>{onPick(name);onClose()}}>
      <img src={src(name)} alt=""/><span>{label}</span>
     </button>)}
   </div>
  </div>
 </div>;
}

/** Create or edit one goal. Steps are added from the card itself. */
function GoalModal({initial,onSave,onClose}){
 const [form,setForm]=useState(initial);
 const [picking,setPicking]=useState(false);
 const set=(key,value)=>setForm(f=>({...f,[key]:value}));
 useEffect(()=>{
  const onKey=e=>{if(e.key==='Escape'&&!picking)onClose()};
  addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey);
 },[onClose,picking]);
 return <div className="goalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <form className="goalModal" onSubmit={e=>{e.preventDefault();if(form.title.trim())onSave({...form,title:form.title.trim()})}}>
   <header><h2>{initial.isNew?'เป้าหมายใหม่':'แก้ไขเป้าหมาย'}</h2>
    <button type="button" onClick={onClose} aria-label="ปิด">✕</button></header>
   <div className="goalFormBody">
    <button type="button" className="goalArtPick" onClick={()=>setPicking(true)}>
     <img src={goalIconSrc(form.icon)} alt=""/><span>เปลี่ยนรูป</span>
    </button>
    <div className="goalFields">
     <label>เป้าหมายคืออะไร
      <input value={form.title} maxLength={300} required autoFocus placeholder="เช่น สอบ TOEIC ให้ได้ 750"
        onChange={e=>set('title',e.target.value)}/></label>
     <div className="goalFieldRow">
      <label>ช่วงเวลา
       <select value={form.term} onChange={e=>set('term',e.target.value)}>
        {TERMS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>สถานะ
       <select value={form.status} onChange={e=>set('status',e.target.value)}>
        {GOAL_STATUS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>กำหนดเสร็จ
       <input type="date" value={form.due} onChange={e=>set('due',e.target.value)}/></label>
     </div>
     <label>ทำไมถึงอยากทำ (ไม่ใส่ก็ได้)
      <textarea value={form.detail} maxLength={2000} rows={3} placeholder="เขียนเหตุผลไว้ วันที่หมดแรงจะได้กลับมาอ่าน"
        onChange={e=>set('detail',e.target.value)}/></label>
    </div>
   </div>
   <footer>
    <button type="button" onClick={onClose}>ยกเลิก</button>
    <button className="goalPrimary" disabled={!form.title.trim()}>บันทึกเป้าหมาย</button>
   </footer>
   {picking&&<IconPicker kind="goal" value={form.icon} onPick={n=>set('icon',n)} onClose={()=>setPicking(false)}/>}
  </form>
 </div>;
}

/** The add-a-step row that lives at the bottom of every goal card. */
function PlanComposer({onAdd,disabled}){
 const [title,setTitle]=useState(''),[icon,setIcon]=useState('checklist');
 const [due,setDue]=useState(''),[picking,setPicking]=useState(false);
 return <form className="planAdd" onSubmit={e=>{
   e.preventDefault();
   if(!title.trim())return;
   onAdd({title:title.trim(),icon,due});
   setTitle('');setDue('');
  }}>
  <button type="button" className="planIconPick" onClick={()=>setPicking(true)} aria-label="เลือกรูปแผน">
   <img src={planIconSrc(icon)} alt=""/></button>
  <input value={title} maxLength={300} disabled={disabled} placeholder="เพิ่มแผน เช่น อ่านศัพท์วันละ 20 คำ"
    onChange={e=>setTitle(e.target.value)}/>
  <input type="date" className="planDue" value={due} disabled={disabled} aria-label="กำหนดเสร็จของแผนนี้"
    onChange={e=>setDue(e.target.value)}/>
  <button className="goalPrimary" disabled={disabled||!title.trim()}>เพิ่ม</button>
  {picking&&<IconPicker kind="plan" value={icon} onPick={setIcon} onClose={()=>setPicking(false)}/>}
 </form>;
}

function DueChip({due,done}){
 const left=daysLeft(due);
 if(left===null)return null;
 const tone=done?'ok':left<0?'late':left<=3?'soon':'';
 const label=done?formatDay(due):left<0?`เลย ${Math.abs(left)} วัน`:left===0?'ครบกำหนดวันนี้':`อีก ${left} วัน`;
 return <span className={`goalChip ${tone}`} title={formatDay(due)}>📅 {label}</span>;
}

export function Goals({onRequireOwner,onSuccess}){
 const {items,ready,busy,message,persist,refresh}=useSheetGoals(onRequireOwner);
 const [filter,setFilter]=useState('all');
 const [editing,setEditing]=useState(null);
 const [removing,setRemoving]=useState(null);
 const board=useMemo(()=>buildBoard(items),[items]);
 const shown=board.filter(g=>filter==='all'||g.term===filter);
 const totals=useMemo(()=>{
  const steps=items.filter(x=>x.type==='step');
  return {
   goals:board.length,
   active:board.filter(g=>g.status==='active').length,
   done:board.filter(g=>g.status==='done').length,
   steps:steps.length,
   stepsDone:steps.filter(s=>s.status==='done').length,
  };
 },[items,board]);

 const replace=(list,item)=>{
  const i=list.findIndex(x=>x.id===item.id);
  return i<0?[...list,item]:list.map(x=>x.id===item.id?item:x);
 };
 async function saveGoal(form){
  const ok=await persist(replace(items,{...form,type:'goal',goalId:''}));
  if(ok){setEditing(null);if(form.isNew)onSuccess?.()}
 }
 async function addStep(goal,data){
  const order=(goal.steps.at(-1)?.order??0)+10;
  await persist([...items,{id:newId(),type:'step',goalId:goal.id,term:'',detail:'',
   status:'todo',order,createdAt:new Date().toISOString(),...data}]);
 }
 async function toggleStep(step){
  const next=items.map(x=>x.id===step.id?{...x,status:x.status==='done'?'todo':'done'}:x);
  const ok=await persist(next);
  if(ok&&step.status!=='done')onSuccess?.();
 }
 async function removeItem(id){
  // Dropping a goal drops its steps here too, so the optimistic list matches
  // what the sheet will look like.
  const ok=await persist(items.filter(x=>x.id!==id&&x.goalId!==id));
  if(ok)setRemoving(null);
 }

 return <section className="page goalsPage">
  <header className="goalsHero">
   <div className="goalsEmblem"><img src={goalIconSrc('dream')} alt=""/></div>
   <div>
    <p className="goalEyebrow">GOALS &amp; PLANS</p>
    <h1>เป้าหมายของเรา</h1>
    <p className="goalsLead">เป้าหมายระยะยาว ระยะสั้น และแผนที่จะพาไปถึง อยู่ในหน้าเดียวกัน</p>
   </div>
   <button className="goalPrimary goalsAdd" onClick={()=>setEditing({
     id:newId(),type:'goal',goalId:'',term:'long',title:'',detail:'',icon:'dream',
     status:'active',due:'',order:(board.at(-1)?.order??0)+10,createdAt:'',isNew:true})}>
    ✚ เป้าหมายใหม่
   </button>
  </header>

  <div className="goalsStats">
   <div><span>เป้าหมายทั้งหมด</span><strong>{totals.goals}</strong></div>
   <div><span>กำลังทำอยู่</span><strong>{totals.active}</strong></div>
   <div><span>สำเร็จแล้ว</span><strong>{totals.done}</strong></div>
   <div><span>แผนที่ทำเสร็จ</span><strong>{totals.stepsDone}/{totals.steps}</strong></div>
  </div>

  <div className="goalsBar">
   <div className="goalTabs" role="tablist" aria-label="กรองช่วงเวลา">
    {[['all','ทั้งหมด'],...TERMS].map(([id,label])=>
     <button key={id} role="tab" aria-selected={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}
   </div>
   <div className="goalsConn">
    <span className={ready?'connected':''}>{ready?'☁ Google Sheets · แท็บ Goals':'กำลังเชื่อมต่อ…'}</span>
    <button type="button" disabled={busy} onClick={refresh}>โหลดใหม่</button>
   </div>
  </div>

  {shown.length===0
   ? <div className="goalsEmpty">
      <img src={goalIconSrc('plan')} alt=""/>
      <h2>{board.length?'ไม่มีเป้าหมายในช่วงเวลานี้':'ยังไม่มีเป้าหมาย'}</h2>
      <p>เริ่มจากเป้าหมายเดียวก่อนก็ได้ แล้วค่อยเติมแผนทีละข้อ</p>
     </div>
   : <div className="goalGrid">{shown.map(goal=>
      <article key={goal.id} className="goalCard" data-status={goal.status}>
       <div className="goalTop">
        <div className="goalArt"><img src={goalIconSrc(goal.icon)} alt=""/></div>
        <div className="goalHead">
         <div className="goalTags">
          <span className={`goalTerm ${goal.term}`}>{termLabel(goal.term)}</span>
          <span className={`goalChip status-${goal.status}`}>{statusLabel(goal.status)}</span>
          <DueChip due={goal.due} done={goal.status==='done'}/>
         </div>
         <h3>{goal.title}</h3>
         {goal.detail&&<p className="goalWhy">{goal.detail}</p>}
        </div>
        <div className="goalTools">
         <button type="button" onClick={()=>setEditing({...goal,isNew:false})} aria-label={`แก้ไข ${goal.title}`}>แก้ไข</button>
         <button type="button" onClick={()=>setRemoving(goal.id)} aria-label={`ลบ ${goal.title}`}>ลบ</button>
        </div>
       </div>

       <div className="goalProgress" role="img" aria-label={`ความคืบหน้า ${goal.percent}%`}>
        <div className="goalBar"><i style={{width:`${goal.percent}%`}}/></div>
        <b>{goal.total?`${goal.done}/${goal.total} แผน`:'ยังไม่มีแผน'}</b>
        <span>{goal.percent}%</span>
       </div>

       {removing===goal.id&&
        <p className="goalConfirm">ลบเป้าหมายนี้พร้อมแผนทั้งหมด?
         <button type="button" className="goalDanger" disabled={busy} onClick={()=>removeItem(goal.id)}>ยืนยันลบ</button>
         <button type="button" onClick={()=>setRemoving(null)}>ยกเลิก</button></p>}

       {goal.steps.length>0&&
        <ul className="planList">{goal.steps.map(step=>
         <li key={step.id} className={step.status==='done'?'done':''}>
          <button type="button" className="planCheck" disabled={busy} aria-pressed={step.status==='done'}
            onClick={()=>toggleStep(step)}>
           <span className="planBox" aria-hidden="true">{step.status==='done'?'✔':''}</span>
           <img src={planIconSrc(step.icon)} alt=""/>
           <span className="planTitle">{step.title}</span>
           <DueChip due={step.due} done={step.status==='done'}/>
          </button>
          <button type="button" className="planDelete" disabled={busy} aria-label={`ลบแผน ${step.title}`}
            onClick={()=>removeItem(step.id)}>✕</button>
         </li>)}
        </ul>}

       <PlanComposer disabled={busy||!ready} onAdd={data=>addStep(goal,data)}/>
      </article>)}
     </div>}

  <p className="goalMessage" role="status">{message}</p>
  {editing&&<GoalModal initial={editing} onSave={saveGoal} onClose={()=>setEditing(null)}/>}
 </section>;
}