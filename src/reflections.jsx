import React,{useEffect,useMemo,useState} from 'react';
import './reflections.css';
import {applyTodos,loadTodos} from './api';
import reflectionArt from './assets/tae-reflection-night.png';

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const newId=()=>`reflection-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const emptyForm=()=>({mistake:'',cause:'',cost:'',repair:''});
const thaiDate=value=>{const [y,m,d]=String(value).slice(0,10).split('-').map(Number);return new Intl.DateTimeFormat('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(y,m-1,d))};
const unpack=detail=>{try{return {...emptyForm(),...JSON.parse(detail)}}catch{return {...emptyForm(),cost:String(detail||'')}}};

function Entry({item}){
 const data=unpack(item.detail);
 return <article className="reflectionEntry">
  <div className="reflectionEntryDate"><span>{new Date(`${item.date}T00:00:00`).getDate()}</span><small>{new Intl.DateTimeFormat('th-TH',{month:'short'}).format(new Date(`${item.date}T00:00:00`))}</small></div>
  <div><span className="reflectionEntryKicker">สิ่งที่ยอมรับกับตัวเอง</span><h3>{item.title}</h3>{data.cause&&<p><b>ต้นเหตุ:</b> {data.cause}</p>}{data.cost&&<p><b>สิ่งที่เสียไป:</b> {data.cost}</p>}<div className="reflectionRepair"><img src="/ui/pixel/bolt.png" alt=""/><span><b>สิ่งที่จะทำให้ต่างออกไป</b>{data.repair||'ยังไม่ได้กำหนด'}</span></div></div>
 </article>;
}

export function Reflections({onRequireOwner}){
 const [allItems,setAllItems]=useState([]),[form,setForm]=useState(emptyForm),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;loadTodos().then(items=>{if(live){setAllItems(items);setReady(true)}}).catch(error=>setMessage(error.message));return()=>{live=false}},[]);
 const entries=useMemo(()=>allItems.filter(item=>String(item.id).startsWith('reflection-')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),[allItems]);
 const todayEntries=entries.filter(item=>String(item.date).slice(0,10)===today());
 const set=(key,value)=>setForm(current=>({...current,[key]:value}));
 async function persist(next){setBusy(true);setMessage('');try{const result=await applyTodos(next);setAllItems(result.items||next);return true}catch(error){if(error.status===401){onRequireOwner?.(()=>persist(next));return false}setMessage(error.message);return false}finally{setBusy(false)}}
 async function submit(event){event.preventDefault();if(!form.mistake.trim()||!form.repair.trim()||busy)return;const item={id:newId(),date:today(),title:form.mistake.trim().slice(0,160),detail:JSON.stringify({cause:form.cause.trim(),cost:form.cost.trim(),repair:form.repair.trim()}).slice(0,400),category:'life',priority:'high',done:false,createdAt:new Date().toISOString()};if(await persist([...allItems,item])){setForm(emptyForm());setMessage('บันทึกความจริงไว้แล้ว พรุ่งนี้ตอบมันด้วยการลงมือ')}}
 return <section className="page reflectionsPage">
  <header className="reflectionHero">
   <div className="reflectionHeroCopy"><span className="reflectionEyebrow">THE HONEST ROOM</span><h1>วันนี้เราปล่อย<br/><em>อะไรให้หลุดมือ?</em></h1><p>ไม่ได้เขียนเพื่อเกลียดตัวเอง แต่เขียนเพื่อหยุดข้ออ้างเดิม ก่อนมันเอาวันพรุ่งนี้ไปอีกวัน</p><div className={`reflectionCloud ${ready?'online':''}`}><i/>{ready?'เก็บบันทึกไว้ใน Google Sheets':'กำลังเปิดสมุดบันทึก…'}</div></div>
   <div className="reflectionScene"><span className="reflectionTick t1">ติ๊ก</span><span className="reflectionTick t2">ต่อก</span><img src={reflectionArt} alt="เท่นั่งทบทวนวันที่ปล่อยเวลาให้ผ่านไป"/></div>
   <div className="reflectionCount"><strong>{entries.length}</strong><span>ครั้งที่เรา<br/>ไม่หลอกตัวเอง</span></div>
  </header>

  <div className="reflectionGrid">
   <form className="reflectionForm" onSubmit={submit}>
    <header><img src="/goals/plan/journal.png" alt=""/><div><span>คำสารภาพของวันนี้</span><h2>{thaiDate(today())}</h2></div></header>
    <div className="reflectionWarning"><b>ถ้าไม่เขียนให้ชัด</b><span>พรุ่งนี้เราจะมีข้ออ้างเดิมให้เชื่ออีกครั้ง</span></div>
    <label><span>วันนี้เราทำอะไรที่ไม่ควรทำ?</span><textarea value={form.mistake} maxLength={160} rows="2" placeholder="เช่น นอนทั้งวัน ทั้งที่ตั้งใจว่าจะอ่านหนังสือ" onChange={event=>set('mistake',event.target.value)} required/></label>
    <div className="reflectionFormRow"><label><span>ต้นเหตุจริง ๆ คืออะไร?</span><input value={form.cause} maxLength={90} placeholder="เช่น เล่นมือถือดึก" onChange={event=>set('cause',event.target.value)}/></label><label><span>มันทำให้เราเสียอะไรไป?</span><input value={form.cost} maxLength={90} placeholder="เช่น เสียเวลาเตรียมสอบ 1 วัน" onChange={event=>set('cost',event.target.value)}/></label></div>
    <label className="repairField"><span>พรุ่งนี้จะทำอะไรไม่ให้เกิดซ้ำ?</span><textarea value={form.repair} maxLength={120} rows="2" placeholder="เขียนเป็นการกระทำเล็ก ๆ เช่น วางมือถือไว้นอกห้องก่อน 23:00" onChange={event=>set('repair',event.target.value)} required/></label>
    <button className="reflectionSubmit" disabled={busy||!form.mistake.trim()||!form.repair.trim()}>{busy?'กำลังบันทึก…':'ยอมรับ และไม่ปล่อยให้ซ้ำ'}<span>→</span></button>
    {message&&<div className="reflectionMessage" role="status">{message}<button type="button" onClick={()=>setMessage('')}>×</button></div>}
   </form>

   <div className="reflectionArchive">
    <header><div><span>ACCOUNTABILITY LOG</span><h2>สิ่งที่เราเคยสัญญาว่าจะไม่ทำซ้ำ</h2></div><b>{todayEntries.length} วันนี้</b></header>
    {entries.length?<div className="reflectionEntries">{entries.map(item=><Entry key={item.id} item={item}/>)}</div>:<div className="reflectionEmpty"><img src="/ui/pixel/brain.png" alt=""/><h3>สมุดเล่มนี้ยังว่าง</h3><p>ถ้าวันนี้พลาด ยอมรับตามจริงหนึ่งเรื่อง แล้วกำหนดการแก้ที่ทำได้ทันที</p></div>}
   </div>
  </div>
 </section>;
}
