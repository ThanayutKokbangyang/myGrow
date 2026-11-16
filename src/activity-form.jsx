import React,{useEffect,useRef,useState} from 'react';
import {activityDateForDay,learningDay} from './learning-model';
import './learning-pages.css';

export function ActivityForm({initial,skills,onClose,onSave,error}){
 const [form,setForm]=useState(()=>{const date=initial.date||new Date().toISOString();return {...initial,date,day:learningDay(date),draftId:initial.id?undefined:crypto.randomUUID()}}),[saving,setSaving]=useState(false);
 const dialog=useRef(null),submitRef=useRef(false);
 const editing=Boolean(initial.id);
 useEffect(()=>{
  const previous=document.activeElement;
  dialog.current.querySelector('input[name=topic]')?.focus();
  return()=>previous?.focus?.();
 },[]);
 useEffect(()=>{
  const handler=event=>{
   if(event.key==='Escape'&&!saving){event.preventDefault();onClose()}
   if(event.key==='Tab'){
    const nodes=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary')];
    if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes.at(-1)?.focus()}
    else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0]?.focus()}
   }
  };
  document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);
 },[saving,onClose]);
 const set=(key,value)=>setForm(old=>({...old,[key]:value}));
 async function submit(event){
  event.preventDefault();if(submitRef.current)return;
  submitRef.current=true;setSaving(true);
  try{const {day,...rest}=form;await onSave({...rest,date:activityDateForDay(day,form.date)})}
  finally{submitRef.current=false;setSaving(false)}
 }
 return <div className="lrBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)onClose()}}>
  <section className="lrActivityModal" role="dialog" aria-modal="true" aria-labelledby="lrActivityTitle" ref={dialog}>
   <header><div><h2 id="lrActivityTitle">{editing?'แก้ไขบันทึกการฝึก':'วันนี้ได้ลงมือทำอะไร?'}</h2><p>หัวข้อ เวลา และทักษะก็พอ รายละเอียดเติมทีหลังได้</p></div><button type="button" disabled={saving} onClick={onClose} aria-label="ปิดบันทึก">×</button></header>
   <form onSubmit={submit}>
    <fieldset className="lrSkillChoices"><legend>ทักษะที่ฝึก</legend>{Object.entries(skills).map(([key,skill])=><button key={key} type="button" aria-pressed={form.skill===key} disabled={saving} onClick={()=>set('skill',key)}><img src={skill.asset} width="24" height="24" alt=""/>{skill.label}</button>)}</fieldset>
    <label>หัวข้อที่ฝึก<input name="topic" value={form.topic} maxLength={180} required disabled={saving} onChange={event=>set('topic',event.target.value)} placeholder="เช่น ฝึก Two Pointers หรือทบทวนศัพท์ TOEIC"/></label>
    <div className="lrFormRow"><label>เวลาที่ฝึกจริง (นาที)<input type="number" min="1" max="1440" step="1" required value={form.minutes} disabled={saving} onChange={event=>set('minutes',event.target.value)}/></label><label>วันที่บันทึก<input type="date" required value={form.day} max={learningDay()} disabled={saving} onChange={event=>set('day',event.target.value)}/></label></div>
    <details className="lrOptional" open={undefined}><summary>เพิ่มสิ่งที่เรียนรู้และการประเมินตัวเอง <span>ไม่บังคับ</span></summary>
     <label>ได้เรียนรู้อะไร<textarea rows="3" maxLength={5000} value={form.learned} disabled={saving} onChange={event=>set('learned',event.target.value)}/></label>
     <label>ยังติดตรงไหน<textarea rows="2" maxLength={5000} value={form.problem} disabled={saving} onChange={event=>set('problem',event.target.value)}/></label>
     <label>ครั้งหน้าจะทำอะไรต่อ<textarea rows="2" maxLength={5000} value={form.next} disabled={saving} onChange={event=>set('next',event.target.value)}/></label>
     <p className="lrFieldNote">คะแนนต่อไปนี้คือความเข้าใจที่เราประเมินเอง ไม่ใช่ผลทดสอบ</p>
     <div className="lrFormRow">{[['before','ก่อนฝึก'],['after','หลังฝึก'],['difficulty','ความยาก']].map(([key,label])=><label key={key}>{label}<select value={form[key]} disabled={saving} onChange={event=>set(key,event.target.value)}>{[0,1,2,3,4,5].map(value=><option key={value} value={value}>{value?`${value} / 5`:'ยังไม่ประเมิน'}</option>)}</select></label>)}</div>
    </details>
    {error&&<div className="lrError" role="alert">{error}</div>}
    <footer><button className="lrSecondary" type="button" disabled={saving} onClick={onClose}>ยกเลิก</button><button className="lrPrimary" disabled={saving||!form.topic.trim()}>{saving?'กำลังบันทึก…':editing?'บันทึกการแก้ไข':'บันทึกกิจกรรม'}</button></footer>
   </form>
  </section>
 </div>;
}
