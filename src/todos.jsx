import React,{useEffect,useMemo,useState} from 'react';
import './todos.css';
import {applyTodos,loadTodos} from './api';

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const id=()=>`todo-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const empty=()=>({id:id(),date:today(),title:'',detail:'',category:'coding',priority:'normal',done:false,createdAt:''});
const categories=[['coding','Coding'],['english','English'],['math','Math'],['life','ชีวิตประจำวัน']];
const categoryLabel=k=>categories.find(x=>x[0]===k)?.[1]||'อื่น ๆ';

function TodoForm({onSave}){
 const [form,setForm]=useState(empty); const set=(k,v)=>setForm(x=>({...x,[k]:v}));
 return <form className="todoComposer" onSubmit={e=>{e.preventDefault();if(!form.title.trim())return;onSave({...form,title:form.title.trim(),detail:form.detail.trim()});setForm(empty())}}>
  <div className="todoComposerTitle"><span className="todoBullet">✦</span><div><b>เพิ่มภารกิจวันนี้</b><small>เขียนให้ชัด แล้วค่อย ๆ ทำทีละข้อ</small></div></div>
  <label className="todoInputWide"><span>ฉันต้องทำอะไร?</span><input autoFocus value={form.title} maxLength={160} placeholder="เช่น ทำโจทย์ C# 3 ข้อ" onChange={e=>set('title',e.target.value)} required/></label>
  <div className="todoFormRow">
   <label><span>หมวด</span><select value={form.category} onChange={e=>set('category',e.target.value)}>{categories.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
   <label><span>ความสำคัญ</span><select value={form.priority} onChange={e=>set('priority',e.target.value)}><option value="normal">ปกติ</option><option value="high">สำคัญ</option></select></label>
   <button className="todoPrimary" disabled={!form.title.trim()}>+ เพิ่มงาน</button>
  </div>
  <label className="todoInputWide"><span>รายละเอียด (ไม่ใส่ก็ได้)</span><textarea rows="2" value={form.detail} maxLength={400} placeholder="เช่น ทบทวน Dictionary และเขียนโค้ดเอง" onChange={e=>set('detail',e.target.value)}/></label>
 </form>;
}

export function Todos({onRequireOwner,onSuccess}){
 const [items,setItems]=useState([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[filter,setFilter]=useState('all');
 useEffect(()=>{let live=true;loadTodos().then(x=>{if(live){setItems(x);setReady(true)}}).catch(e=>{if(live)setMessage(e.message)});return()=>{live=false}},[]);
 const todays=useMemo(()=>items.filter(x=>x.date===today()),[items]);
 const shown=todays.filter(x=>filter==='all'||filter==='done'&&x.done||filter==='open'&&!x.done);
 const done=todays.filter(x=>x.done).length;
 async function persist(next){
  setBusy(true);setMessage('');
  try{const r=await applyTodos(next);setItems(r.items||next);onSuccess?.();return true}
  catch(e){if(e.status===401){onRequireOwner?.(()=>persist(next));return false}setMessage(e.message);return false}
  finally{setBusy(false)}
 }
 async function add(item){const next=[...items,item];if(await persist(next))setMessage('บันทึกภารกิจแล้ว · +1 ก้าวเล็ก ๆ')}
 async function toggle(item){await persist(items.map(x=>x.id===item.id?{...x,done:!x.done}:x))}
 async function remove(item){if(!confirm(`ลบ “${item.title}” ใช่ไหม?`))return;await persist(items.filter(x=>x.id!==item.id))}
 return <section className="page todosPage">
  <header className="todosHero"><div><p className="todoEyebrow">TODAY'S QUEST BOARD</p><h1>ภารกิจวันนี้</h1><p>วางงานของวันนี้ไว้ตรงนี้ แล้วค่อยเก็บทีละภารกิจ</p></div><img src="/todos/todo-board.png" alt="กระดานรายการภารกิจ"/></header>
  <div className="todoStats"><div><span>ภารกิจวันนี้</span><b>{todays.length}</b></div><div><span>ทำเสร็จแล้ว</span><b>{done}</b></div><div className="todoProgress"><span>ความคืบหน้า</span><strong>{todays.length?Math.round(done/todays.length*100):0}%</strong><i><em style={{width:`${todays.length?done/todays.length*100:0}%`}}/></i></div></div>
  <TodoForm onSave={add}/>
  <div className="todoToolbar"><div className="todoFilters">{[['all','ทั้งหมด'],['open','ยังไม่เสร็จ'],['done','เสร็จแล้ว']].map(([k,l])=><button key={k} className={filter===k?'selected':''} onClick={()=>setFilter(k)}>{l}</button>)}</div><span>{ready?'☁ Google Sheets · แท็บ Todos':'กำลังเชื่อมต่อ…'}</span></div>
  {message&&<div className="todoMessage">{message}</div>}
  {shown.length?<div className="todoList">{shown.map(item=><article className={`todoItem ${item.done?'completed':''} priority-${item.priority}`} key={item.id}>
   <button className="todoCheck" aria-label={item.done?'ทำเป็นยังไม่เสร็จ':'ทำเสร็จแล้ว'} onClick={()=>toggle(item)} disabled={busy}>{item.done?'✓':''}</button><div className="todoItemBody"><div className="todoMeta"><span className={`todoTag ${item.category}`}>{categoryLabel(item.category)}</span>{item.priority==='high'&&<span className="todoPriority">สำคัญ</span>}</div><h2>{item.title}</h2>{item.detail&&<p>{item.detail}</p>}</div><button className="todoDelete" onClick={()=>remove(item)} aria-label={`ลบ ${item.title}`}>×</button>
  </article>)}</div>:<div className="todoEmpty"><span>✦</span><h2>{todays.length?'ไม่มีงานในตัวกรองนี้':'กระดานยังว่างอยู่'}</h2><p>{todays.length?'ลองเปลี่ยนตัวกรองดู':'เพิ่มภารกิจแรกของวันนี้ แล้วเริ่มก้าวเล็ก ๆ ไปด้วยกัน'}</p></div>}
 </section>;
}
