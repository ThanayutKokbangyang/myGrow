import React,{useEffect,useMemo,useState} from 'react';
import './todos.css';
import {applyTodos,loadTodos} from './api';
import todoMascot from './assets/tae-checklist-desk-web.png';

const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const newId=()=>`todo-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const blank=()=>({id:newId(),date:localDay(),title:'',detail:'',category:'life',priority:'normal',done:false,createdAt:new Date().toISOString()});
const PRIORITIES={high:{label:'สำคัญ',icon:'/ui/pixel/flame.png'},normal:{label:'ทั่วไป',icon:'/ui/pixel/check.png'}};
const priorityOf=value=>value==='high'?'high':'normal';
const priorityWeight=value=>value==='high'?2:1;
const thaiDate=()=>new Intl.DateTimeFormat('th-TH',{weekday:'long',day:'numeric',month:'long'}).format(new Date());

function Composer({onSave,busy}){
 const [form,setForm]=useState(blank),[more,setMore]=useState(false);
 const set=(key,value)=>setForm(item=>({...item,[key]:value}));
 const submit=e=>{e.preventDefault();if(!form.title.trim()||busy)return;onSave({...form,title:form.title.trim(),detail:form.detail.trim()});setForm(blank());setMore(false)};
 return <form className="todoComposer" onSubmit={submit}>
  <div className="todoComposerHead"><span>+</span><div><h2>เพิ่มสิ่งที่ต้องทำ</h2><p>งานอะไรก็ได้ที่เราอยากทำวันนี้</p></div></div>
  <label className="todoTitleField"><span>วันนี้จะทำอะไร?</span><input value={form.title} maxLength={160} placeholder="เช่น จ่ายค่าไฟ หรืออ่านหนังสือ" onChange={e=>set('title',e.target.value)} required/></label>
  <span className="todoPriorityLabel">จัดลำดับความสำคัญ</span>
  <div className="todoQuickPicks" aria-label="เลือกระดับความสำคัญ">{Object.entries(PRIORITIES).map(([key,item])=><button type="button" key={key} className={`${key} ${form.priority===key?'active':''}`} onClick={()=>set('priority',key)}><img src={item.icon} alt=""/>{item.label}</button>)}</div>
  <button type="button" className="todoMore" aria-expanded={more} onClick={()=>setMore(value=>!value)}>{more?'− ซ่อนรายละเอียด':'+ เพิ่มรายละเอียด'}</button>
  {more&&<div className="todoMoreFields"><label><span>รายละเอียด</span><textarea rows="3" value={form.detail} maxLength={400} placeholder="เขียนรายละเอียดเพิ่มเติมได้ตามต้องการ" onChange={e=>set('detail',e.target.value)}/></label></div>}
  <button className="todoAdd" disabled={!form.title.trim()||busy}>{busy?'กำลังบันทึก…':'เพิ่มลงภารกิจวันนี้'} <span>→</span></button>
 </form>;
}

function Task({item,onToggle,onRemove,busy}){
 const [confirming,setConfirming]=useState(false);
 const priority=priorityOf(item.priority),meta=PRIORITIES[priority];
 return <article className={`questCard ${item.done?'isDone':''} priority-${priority}`}>
  <button className="questCheck" onClick={()=>onToggle(item)} disabled={busy} aria-label={item.done?'เปลี่ยนเป็นยังไม่เสร็จ':'ทำภารกิจนี้เสร็จแล้ว'}><span>{item.done?'✓':''}</span></button>
  <div className="questBody"><div className="questMeta"><span className={`questPriority ${priority}`}><img src={meta.icon} alt=""/>{meta.label}</span></div><h3>{item.title}</h3>{item.detail&&<p>{item.detail}</p>}</div>
  <button className="questDelete" onClick={()=>setConfirming(true)} disabled={busy||confirming} aria-label={`ลบ ${item.title}`}>×</button>
  {confirming&&<div className="questConfirm" role="alert"><div><b>ลบรายการนี้?</b><span>รายการจะหายจากวันนี้</span></div><button type="button" className="danger" onClick={()=>onRemove(item)} disabled={busy}>ลบ</button><button type="button" onClick={()=>setConfirming(false)} disabled={busy}>ยกเลิก</button></div>}
 </article>;
}

export function Todos({onRequireOwner,onSuccess}){
 const [items,setItems]=useState([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[filter,setFilter]=useState('open'),[celebrate,setCelebrate]=useState(0);
 useEffect(()=>{let live=true;loadTodos().then(data=>{if(live){setItems(data);setReady(true)}}).catch(error=>{if(live)setMessage(error.message)});return()=>{live=false}},[]);
 const current=useMemo(()=>items.filter(item=>item.date===localDay()),[items]);
 const ordered=useMemo(()=>[...current].sort((a,b)=>Number(a.done)-Number(b.done)||priorityWeight(b.priority)-priorityWeight(a.priority)||String(a.createdAt).localeCompare(String(b.createdAt))),[current]);
 const shown=ordered.filter(item=>filter==='all'||filter==='done'&&item.done||filter==='open'&&!item.done);
 const completed=current.filter(item=>item.done).length;
 const percent=current.length?Math.round(completed/current.length*100):0;
 async function persist(next){setBusy(true);setMessage('');try{const result=await applyTodos(next);setItems(result.items||next);return true}catch(error){if(error.status===401){onRequireOwner?.(()=>persist(next));return false}setMessage(error.message);return false}finally{setBusy(false)}}
 async function add(item){if(await persist([...items,item]))setMessage('เพิ่มภารกิจให้แล้ว พร้อมลุย!')}
 async function toggle(item){const completing=!item.done;if(await persist(items.map(value=>value.id===item.id?{...value,done:completing}:value))&&completing){setCelebrate(Date.now());onSuccess?.()}}
 async function remove(item){await persist(items.filter(value=>value.id!==item.id))}
 return <section className="page todosPage">
  <header className="todoHero">
   <div className="todoHeroCopy"><div className="todoDate"><span>DAILY QUEST</span><i>{thaiDate()}</i></div><h1>วันนี้เรา<br/><em>จะทำอะไรบ้าง?</em></h1><p>ไม่ต้องทำทุกอย่างพร้อมกัน เลือกหนึ่งข้อ แล้วเริ่มจากตรงนั้น</p><div className={`todoCloud ${ready?'online':''}`}><span/>{ready?'บันทึกกับ Google Sheets แล้ว':'กำลังเชื่อมต่อ Google Sheets…'}</div></div>
   <div className={`todoMascot ${celebrate?'celebrate':''}`} key={celebrate||'idle'}><span className="todoSpark s1">✦</span><span className="todoSpark s2">✦</span><span className="todoSpark s3">✦</span><img src={todoMascot} alt="เท่กำลังจัดรายการภารกิจที่โต๊ะ"/></div>
   <div className="todoScore" style={{'--progress':`${percent}%`}}><div><strong>{percent}%</strong><span>สำเร็จวันนี้</span></div></div>
  </header>
  <div className="todoWorkspace">
   <div className="questPanel">
    <div className="questHeader"><div><span className="questKicker">TODAY'S LIST</span><h2>ภารกิจของเรา <b>{current.length}</b></h2></div><div className="questTabs">{[['open','ต้องทำ'],['done','เสร็จแล้ว'],['all','ทั้งหมด']].map(([key,label])=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}{key==='open'&&<i>{current.length-completed}</i>}</button>)}</div></div>
    {message&&<div className="todoNotice" role="status"><span>✦</span>{message}<button onClick={()=>setMessage('')}>×</button></div>}
    <div className="questList">{shown.map(item=><Task key={item.id} item={item} onToggle={toggle} onRemove={remove} busy={busy}/>)}</div>
    {!shown.length&&<div className="questEmpty"><div>{filter==='done'?'☆':'✓'}</div><h3>{current.length&&filter==='open'?'เก็บครบทุกภารกิจแล้ว!':filter==='done'?'ยังไม่มีงานที่ทำเสร็จ':'ยังไม่มีภารกิจวันนี้'}</h3><p>{filter==='open'?'พักได้อย่างสบายใจ หรือเพิ่มเป้าหมายใหม่ด้านขวา':'เพิ่มงานแรกจากช่องด้านขวา แล้วค่อยเริ่มทีละข้อ'}</p></div>}
   </div>
   <div className="todoSide"><Composer onSave={add} busy={busy}/><div className="todoDailyTip"><span>✦</span><div><b>เรียงให้อัตโนมัติ</b><p>งานสำคัญจะถูกจัดไว้บนสุด ตามด้วยงานทั่วไป</p></div></div></div>
  </div>
 </section>;
}
