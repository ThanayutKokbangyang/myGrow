import React,{useEffect,useRef,useState} from 'react';
import './summaries.css';
import {deleteSummary,hasOwnerToken,loadSummaries,uploadSummary} from './api';
import {dayKey} from './day';

const CATEGORIES=[
 ['all','ทั้งหมด','✦'],['coding','Coding','</>'],['english','English','Aa'],['math','Math','Σ'],
 ['cognitive','Cognitive','◈'],['work','งาน','▣'],['life','ชีวิต','♥'],['other','อื่น ๆ','•']
];
const category=id=>CATEGORIES.find(x=>x[0]===id)||CATEGORIES[CATEGORIES.length-1];
const MAX_FILE=3*1024*1024;
const ACCEPTED=['application/pdf','image/jpeg','image/png','image/webp'];
const thaiDate=value=>new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});

function fileToData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(new Error('อ่านไฟล์ไม่สำเร็จ'));reader.readAsDataURL(file)})}
async function prepareImage(file){
 if(!file.type.startsWith('image/')||file.size<=1.6*1024*1024)return file;
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise((resolve,reject)=>{const value=new Image();value.onload=()=>resolve(value);value.onerror=reject;value.src=url});
  const scale=Math.min(1,1800/Math.max(image.width,image.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84));
  return blob?new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg'}):file;
 } finally {URL.revokeObjectURL(url)}
}

function Reader({item,onClose}){
 const pdf=item.mimeType==='application/pdf';
 return <div className="summaryReaderBackdrop" role="dialog" aria-modal="true" aria-label={`เปิดอ่าน ${item.title}`} onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <section className="summaryReader"><header><div><span>{category(item.category)[1]}</span><h2>{item.title}</h2></div><div><a href={pdf?item.previewUrl:item.fileUrl} target="_blank" rel="noreferrer">เปิดแท็บใหม่ ↗</a><button onClick={onClose} aria-label="ปิด">×</button></div></header>
   {pdf?<iframe title={item.title} src={item.previewUrl}/>:<img src={item.fileUrl} alt={item.title}/>} {item.note&&<p>{item.note}</p>}
  </section>
 </div>
}

export function SummaryLibrary({onRequireOwner,onSuccess}){
 const [items,setItems]=useState([]),[page,setPage]=useState(1),[pages,setPages]=useState(1),[total,setTotal]=useState(0);
 const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[search,setSearch]=useState('');
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reader,setReader]=useState(null),[removing,setRemoving]=useState('');
 const [form,setForm]=useState({title:'',category:'coding',note:'',date:dayKey()}),[file,setFile]=useState(null);
 const inputRef=useRef(null);
 async function refresh(nextPage=page){setReady(false);try{const result=await loadSummaries({page:nextPage,pageSize:12,category:filter,query:search});setItems(result.items||[]);setPage(result.page||1);setPages(result.pages||1);setTotal(result.total||0)}catch(error){setMessage(error.message)}finally{setReady(true)}}
 useEffect(()=>{refresh(1)},[filter,search]);
 async function saveNow(){
  if(!file||!form.title.trim())return;
  setBusy(true);setMessage('กำลังเก็บสรุปไว้ในชั้นหนังสือ…');
  try{
   const prepared=await prepareImage(file);
   if(prepared.size>MAX_FILE)throw new Error('ไฟล์ใหญ่เกิน 3 MB กรุณาลดขนาดก่อนอัปโหลด');
   if(!ACCEPTED.includes(prepared.type))throw new Error('รองรับเฉพาะ PDF, JPG, PNG และ WebP');
   await uploadSummary({...form,title:form.title.trim(),note:form.note.trim()},{name:prepared.name,type:prepared.type,size:prepared.size,data:await fileToData(prepared)});
   setForm(value=>({...value,title:'',note:''}));setFile(null);if(inputRef.current)inputRef.current.value='';setMessage('เก็บสรุปแล้ว กลับมาอ่านเมื่อไรก็ได้ ✦');onSuccess?.();await refresh(1);
  }catch(error){if(error.status===401){setMessage('ยืนยันว่าเป็นเท่ก่อน แล้วระบบจะอัปโหลดต่อให้');onRequireOwner?.(saveNow)}else setMessage(error.message)}finally{setBusy(false)}
 }
 async function removeNow(id){setBusy(true);try{await deleteSummary(id);setRemoving('');setMessage('นำสรุปออกจากชั้นแล้ว');await refresh(items.length===1&&page>1?page-1:page)}catch(error){if(error.status===401)onRequireOwner?.(()=>removeNow(id));else setMessage(error.message)}finally{setBusy(false)}}
 function submit(e){e.preventDefault();if(!hasOwnerToken())return onRequireOwner?.(saveNow);saveNow()}
 return <section className="page summariesPage">
  {reader&&<Reader item={reader} onClose={()=>setReader(null)}/>} 
  <header className="summaryHero"><div className="summaryHeroCopy"><p className="summaryEyebrow">TAE'S KNOWLEDGE SHELF</p><h1>สรุปของเรา</h1><p>เก็บสิ่งที่จดไว้ให้เป็นระเบียบ แล้วหยิบกลับมาอ่านได้เสมอ</p><div className="summaryCloud">{ready?'☁ เชื่อมกับ Google Drive และ Sheets แล้ว':'กำลังเปิดชั้นหนังสือ…'}</div></div><img src="/summaries/tae-reading.png" alt="เท่กำลังนั่งอ่านสรุปข้างชั้นหนังสือ"/><div className="summaryTotal"><b>{total}</b><span>สรุปที่เก็บไว้</span></div></header>
  <div className="summaryLayout"><form className="summaryComposer" onSubmit={submit}><div className="summaryPanelTitle"><img src="/summaries/summary-icon.png" alt=""/><div><small>NEW NOTE</small><h2>เพิ่มสรุปใหม่</h2></div></div>
   <label>ชื่อเรื่อง<input value={form.title} maxLength={140} required onChange={e=>setForm({...form,title:e.target.value})} placeholder="เช่น C# LINQ ที่ใช้บ่อย"/></label>
   <div className="summaryFormRow"><label>หมวดหมู่<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATEGORIES.slice(1).map(c=><option value={c[0]} key={c[0]}>{c[1]}</option>)}</select></label><label>วันที่<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label></div>
   <label>โน้ตช่วยจำ<textarea value={form.note} maxLength={600} onChange={e=>setForm({...form,note:e.target.value})} placeholder="หัวข้อนี้สำคัญตรงไหน หรือควรกลับมาอ่านเมื่อไร"/></label>
   <label className={`summaryDrop ${file?'hasFile':''}`}><input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{const value=e.target.files?.[0]||null;if(value&&value.size>MAX_FILE&&!value.type.startsWith('image/')){setMessage('PDF ต้องมีขนาดไม่เกิน 3 MB');e.target.value='';return setFile(null)}setFile(value)}}/><span className="summaryUploadIcon">⇧</span><b>{file?file.name:'เลือกรูปหรือ PDF'}</b><small>{file?`${(file.size/1024/1024).toFixed(2)} MB`:'JPG, PNG, WebP หรือ PDF · ไม่เกิน 3 MB'}</small></label>
   <button className="summarySave" disabled={busy||!file||!form.title.trim()}>{busy?'กำลังบันทึก…':'เก็บเข้าชั้นสรุป'}</button>{message&&<p className="summaryMessage" role="status">{message}</p>}
  </form>
  <section className="summaryArchive"><div className="summaryTools"><div><small>OUR ARCHIVE</small><h2>หยิบกลับมาอ่าน</h2></div><form onSubmit={e=>{e.preventDefault();setSearch(query.trim())}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาชื่อหรือโน้ต…"/><button aria-label="ค้นหา">⌕</button></form></div>
   <nav className="summaryFilters">{CATEGORIES.map(c=><button key={c[0]} className={filter===c[0]?'active':''} onClick={()=>{setFilter(c[0]);setPage(1)}}><span>{c[2]}</span>{c[1]}</button>)}</nav>
   {!ready?<div className="summaryEmpty">กำลังจัดแฟ้มบนชั้น…</div>:items.length===0?<div className="summaryEmpty"><img src="/summaries/summary-icon.png" alt=""/><h3>ยังไม่พบสรุปในชั้นนี้</h3><p>อัปโหลดไฟล์แรกจากช่องด้านซ้ายได้เลย</p></div>:<div className="summaryGrid">{items.map(item=><article key={item.id}><button className="summaryCover" onClick={()=>setReader(item)}>{item.mimeType==='application/pdf'?<div className="summaryPdf"><b>PDF</b><span>เปิดอ่าน</span></div>:<img src={item.fileUrl} alt="" loading="lazy"/>}<span className="summaryOpen">เปิดอ่าน</span></button><div className="summaryCardBody"><div><span className={`summaryCategory ${item.category}`}>{category(item.category)[1]}</span><time>{thaiDate(item.date)}</time></div><h3>{item.title}</h3>{item.note&&<p>{item.note}</p>}<footer>{removing===item.id?<><span>ลบทั้งไฟล์?</span><button disabled={busy} onClick={()=>removeNow(item.id)}>ยืนยัน</button><button onClick={()=>setRemoving('')}>ยกเลิก</button></>:<><small>{item.mimeType==='application/pdf'?'PDF':'IMAGE'} · {Math.max(1,Math.round(Number(item.fileSize||0)/1024))} KB</small><button onClick={()=>setRemoving(item.id)} aria-label={`ลบ ${item.title}`}>ลบ</button></>}</footer></div></article>)}</div>}
   {pages>1&&<nav className="summaryPagination"><button disabled={page<=1||!ready} onClick={()=>refresh(page-1)}>‹ ก่อนหน้า</button><span>หน้า <b>{page}</b> / {pages}<small>{total} รายการ</small></span><button disabled={page>=pages||!ready} onClick={()=>refresh(page+1)}>ถัดไป ›</button></nav>}
  </section></div>
 </section>
}
