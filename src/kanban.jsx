import React,{useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
import {dayKey} from './day';
import {useKanban} from './use-kanban';
import {cardMonth,cardsInMonth,shiftBoardMonth,cardsOf,columnsOf,dueState,moveCard,newId,PRIORITIES,TONES} from './kanban-model';
import {useBoardMotion,useBoardNavigation,useDragScroll} from './kanban-motion';
import './kanban.css';

function Icon({name,...props}){
 const paths={plus:'M12 5v14M5 12h14',close:'m6 6 12 12M18 6 6 18',edit:'m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',calendar:'M7 3v4M17 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',refresh:'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M18 18a8 8 0 0 1-13-3',search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',check:'m5 12 4 4L19 6',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'};
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]||paths.plus}/></svg>;
}
const dateLabel=date=>new Date(date+'T12:00:00+07:00').toLocaleDateString('th-TH',{day:'numeric',month:'short'});
const blankCard=(columnId,month)=>({id:newId(),type:'card',columnId,title:'',detail:'',priority:'normal',due:'',order:0,tone:'gold',done:false,revision:0,month});

function CardEditor({item,columns,busy,error,onClose,onSave,onDelete}){
 const [form,setForm]=useState(()=>({...item,month:cardMonth(item)==='unassigned'?dayKey().slice(0,7):cardMonth(item)})),[confirm,setConfirm]=useState(false),[closing,setClosing]=useState(false);
 const closeTimer=useRef(null),formRef=useRef(null);
 const close=()=>{if(busy||closing)return;setClosing(true);closeTimer.current=setTimeout(onClose,matchMedia('(prefers-reduced-motion: reduce)').matches?0:150)};
 useEffect(()=>()=>clearTimeout(closeTimer.current),[]);
 const dialog=useRef(null),savedFocus=useRef(null);
 useEffect(()=>{
  savedFocus.current=document.activeElement;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  dialog.current?.querySelector('input')?.focus();
  return()=>{document.body.style.overflow=overflow;savedFocus.current?.focus?.()};
 },[]);
 useEffect(()=>{
  const keydown=event=>{
   if(event.key==='Escape'&&!busy){event.preventDefault();close()}
   if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!busy){event.preventDefault();formRef.current?.requestSubmit()}
   if(event.key!=='Tab')return;
   const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')];
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  };
  document.addEventListener('keydown',keydown);return()=>document.removeEventListener('keydown',keydown);
 },[busy,onClose,closing]);
 const set=(key,value)=>setForm(old=>({...old,[key]:value}));
 return <div className={`kbBackdrop ${closing?'closing':''}`} onMouseDown={event=>{if(event.target===event.currentTarget)close()}}>
  <section className="kbDrawer" role="dialog" aria-modal="true" aria-labelledby="kbEditorTitle" ref={dialog}>
   <header><div><h2 id="kbEditorTitle">{item.revision?'รายละเอียดการ์ด':'เพิ่มการ์ดใหม่'}</h2><p>เก็บรายละเอียด แล้วค่อยลงมือทำ</p></div><button className="kbIconButton" disabled={busy||closing} onClick={close} aria-label="ปิดรายละเอียด"><Icon name="close"/></button></header>
   <form ref={formRef} onSubmit={async event=>{event.preventDefault();if(busy||closing)return;if(await onSave({...form,title:form.title.trim(),detail:form.detail.trim()}))close()}}>
    <label>ชื่องาน<input required maxLength={180} value={form.title} disabled={busy} onChange={event=>set('title',event.target.value)} placeholder="งานนี้เราจะทำอะไร?"/></label>
    <label>เดือนของงาน<input type="month" required value={form.month} disabled={busy} onChange={event=>set('month',event.target.value)}/><small>การ์ดจะแสดงในบอร์ดของเดือนนี้ แยกจากวันครบกำหนด</small></label>
    <label>รายละเอียด<textarea rows="6" maxLength={5000} value={form.detail} disabled={busy} onChange={event=>set('detail',event.target.value)} placeholder="สิ่งที่ต้องทำ ลิงก์ หรือโน้ตที่อยากเก็บไว้"/></label>
    <label>คอลัมน์<select value={form.columnId} disabled={busy} onChange={event=>set('columnId',event.target.value)}>{columns.map(column=><option key={column.id} value={column.id}>{column.title}</option>)}</select></label>
    <div className="kbFormRow"><label>ความสำคัญ<select value={form.priority} disabled={busy} onChange={event=>set('priority',event.target.value)}>{Object.entries(PRIORITIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>วันครบกำหนด<input type="date" value={form.due} disabled={busy} onChange={event=>set('due',event.target.value)}/></label></div>
    {error&&<p className="kbError" role="alert">{error}</p>}
    <div className="kbEditorActions"><button className="kbPrimary" disabled={busy||!form.title.trim()}>{busy?'กำลังบันทึก…':'บันทึกการ์ด'}</button><button className="kbSecondary" type="button" disabled={busy||closing} onClick={close}>ยกเลิก</button></div>
    <small className="kbKeyboardHint">Ctrl / ⌘ + Enter เพื่อบันทึก · Esc เพื่อปิด</small>
   </form>
   {item.revision>0&&<div className="kbDeleteArea">{confirm?<><p>ลบการ์ดนี้ออกจากบอร์ด?</p><button className="kbDanger" disabled={busy} onClick={async()=>{if(await onDelete(item))close()}}>ยืนยันลบ</button><button className="kbSecondary" disabled={busy} onClick={()=>setConfirm(false)}>เก็บไว้ก่อน</button></>:<button className="kbTextDanger" disabled={busy} onClick={()=>setConfirm(true)}><Icon name="trash"/>ลบการ์ด</button>}</div>}
  </section>
 </div>;
}

function ColumnForm({column,busy,error,count,canDelete,onSave,onDelete,onCancel}){
 const [title,setTitle]=useState(column.title),[tone,setTone]=useState(column.tone),[done,setDone]=useState(column.done),[confirm,setConfirm]=useState(false);
 return <form className="kbColumnForm" onSubmit={async event=>{event.preventDefault();if(await onSave({...column,title:title.trim(),tone,done}))onCancel()}}>
  <label>ชื่อคอลัมน์<input autoFocus maxLength={180} required value={title} disabled={busy} onChange={event=>setTitle(event.target.value)}/></label>
  <fieldset><legend>สีคอลัมน์</legend><div className="kbColors">{TONES.map(value=><button key={value} type="button" className={`kbTone-${value} ${tone===value?'selected':''}`} disabled={busy} aria-label={{gold:'เหลือง',blue:'น้ำเงิน',green:'เขียว',purple:'ม่วง',rose:'ชมพู'}[value]} aria-pressed={tone===value} onClick={()=>setTone(value)}>{tone===value&&<Icon name="check"/>}</button>)}</div></fieldset>
  <label className="kbCheckbox"><input type="checkbox" checked={done} disabled={busy} onChange={event=>setDone(event.target.checked)}/>นับงานในคอลัมน์นี้ว่าเสร็จแล้ว</label>
  {error&&<p className="kbError" role="alert">{error}</p>}
  <div className="kbInlineActions"><button className="kbPrimary" disabled={busy||!title.trim()}>บันทึก</button><button className="kbSecondary" type="button" disabled={busy} onClick={onCancel}>ยกเลิก</button></div>
  {column.revision>0&&<div className="kbColumnDelete">{confirm?<><span>ลบคอลัมน์ว่างนี้?</span><button type="button" className="kbDanger" disabled={busy} onClick={onDelete}>ยืนยันลบ</button></>:<button type="button" className="kbTextDanger" disabled={busy||count>0||!canDelete} title={count?'ย้ายการ์ดออกให้หมดก่อน':!canDelete?'ต้องเหลืออย่างน้อย 1 คอลัมน์':'ลบคอลัมน์ว่าง'} onClick={()=>setConfirm(true)}>ลบคอลัมน์</button>}</div>}
 </form>;
}

function QuickAdd({columnId,month,disabled,onSave,onCancel}){
 const [title,setTitle]=useState(''),[saving,setSaving]=useState(false);
 const input=useRef(null);
 async function submit(event){
  event.preventDefault();if(saving||!title.trim())return;
  setSaving(true);
  if(await onSave({...blankCard(columnId,month),title:title.trim()})){setTitle('');requestAnimationFrame(()=>input.current?.focus())}
  setSaving(false);
 }
 return <form className="kbQuickAdd" onSubmit={submit}>
  <textarea ref={input} autoFocus aria-label="ชื่อการ์ดใหม่" rows="2" maxLength={180} placeholder="ชื่องานที่อยากทำ…" value={title} disabled={saving||disabled} onChange={event=>setTitle(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form.requestSubmit()}if(event.key==='Escape'&&!saving)onCancel()}}/>
  <div><button className="kbPrimary" disabled={saving||disabled||!title.trim()}>{saving?'กำลังเพิ่ม…':'เพิ่มการ์ด'}</button><button type="button" className="kbIconButton" disabled={saving} aria-label="ปิดช่องเพิ่มการ์ด" onClick={onCancel}><Icon name="close"/></button><small>Enter เพื่อเพิ่ม</small></div>
 </form>;
}

export function KanbanBoard(){
 const {items,ready,busy,saving,refreshing,error,notice,pendingIds,persist,refresh}=useKanban();
 const currentMonth=dayKey().slice(0,7);
 const [month,setMonth]=useState(()=>dayKey().slice(0,7));
 const creationMonth=/^\d{4}-\d{2}$/.test(month)?month:currentMonth;
 function selectMonth(value){if(!value)return;setMonth(value);setAdding(null);setDrag(null);setTarget(null)}
 const [query,setQuery]=useState(''),[priority,setPriority]=useState('all'),[editing,setEditing]=useState(null),[columnForm,setColumnForm]=useState(null);
 const [drag,setDrag]=useState(null),[target,setTarget]=useState(null),[adding,setAdding]=useState(null),[editorSaving,setEditorSaving]=useState(false),[toastVisible,setToastVisible]=useState(false);
 const canvas=useRef(null),searchInput=useRef(null);
 const deferredQuery=useDeferredValue(query);
 const trackDrag=useDragScroll(canvas,Boolean(drag));
 const navigation=useBoardNavigation(canvas);
 useBoardMotion(canvas,items);
 useEffect(()=>{setToastVisible(Boolean(notice));if(!notice)return;const timer=setTimeout(()=>setToastVisible(false),3500);return()=>clearTimeout(timer)},[notice]);
 const columns=useMemo(()=>columnsOf(items),[items]);
 const today=dayKey();
 const allCards=cardsInMonth(items,month),doneIds=new Set(columns.filter(column=>column.done).map(column=>column.id));
 const doneCount=allCards.filter(card=>doneIds.has(card.columnId)).length;
 const visible=card=>(month==='all'||cardMonth(card)===month)&&(priority==='all'||card.priority===priority)&&(!deferredQuery.trim()||[card.title,card.detail].join(' ').toLowerCase().includes(deferredQuery.trim().toLowerCase()));
 const locked=refreshing||!ready,filtered=Boolean(query.trim())||priority!=='all';
 async function saveCard(form){
  return persist(current=>{
   const old=current.find(item=>item.id===form.id);
   const next=old?moveCard(current,old.id,form.columnId,old.columnId===form.columnId?old.id:null):current;
   const moved=next.find(item=>item.id===form.id);
   const card={...form,month:form.month||creationMonth,revision:moved?.revision??0,order:moved?.order??(Math.max(-1,...cardsOf(next,form.columnId).map(item=>item.order))+1)};
   return old?next.map(item=>item.id===form.id?card:item):[...next,card];
  },form.revision?'อัปเดตการ์ดแล้ว':'เพิ่มการ์ดแล้ว พร้อมเริ่มเลย');
 }
 async function move(id,columnId,beforeId=null){
  setDrag(null);setTarget(null);
  if(locked)return;
  const column=columns.find(item=>item.id===columnId);
  await persist(current=>moveCard(current,id,columnId,beforeId),`ย้ายการ์ดไป “${column?.title}” แล้ว`);
 }
 function insertion(event,columnId,cardId){
  const cards=cardsOf(items,columnId).filter(card=>card.id!==drag&&visible(card));
  const index=cards.findIndex(card=>card.id===cardId),rect=event.currentTarget.getBoundingClientRect();
  return event.clientY<rect.top+rect.height/2?cardId:cards[index+1]?.id||null;
 }
 function drop(event,columnId,beforeId=null){
  event.preventDefault();event.stopPropagation();
  const id=drag||event.dataTransfer.getData('text/plain');
  if(id)move(id,columnId,beforeId);
 }
 function over(event,columnId,beforeId=null){
  if(!drag||locked)return;trackDrag(event);event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
  if(target?.columnId!==columnId||target?.beforeId!==beforeId)setTarget({columnId,beforeId});
 }
 async function saveColumn(column){
  return persist(current=>current.some(item=>item.id===column.id)?current.map(item=>item.id===column.id?{...column,revision:item.revision}:item):[...current,column],'บันทึกคอลัมน์แล้ว');
 }
 async function shiftColumn(id,direction){
  const order=columns.map(column=>column.id),index=order.indexOf(id),to=index+direction;
  if(to<0||to>=order.length)return;
  [order[index],order[to]]=[order[to],order[index]];
  await persist(current=>current.map(item=>item.type==='column'?{...item,order:order.indexOf(item.id)}:item),'ย้ายลำดับคอลัมน์แล้ว');
 }
 return <section className="kanbanPage" aria-labelledby="kbTitle">
  <header className="kbHeader"><div className="kbHeading"><img src="/ui/pixel/board.svg" width="40" height="40" alt=""/><div><h1 id="kbTitle">บอร์ดงาน</h1><p>ค่อย ๆ ขยับงาน ทีละใบ</p></div></div><div className="kbHeaderActions"><span className={`kbSync ${saving?'saving':ready?'saved':''}`} role="status"><i/>{saving?'กำลังบันทึก…':ready?'บันทึกแล้ว':'กำลังเชื่อมต่อบอร์ด…'}</span><button className="kbPrimary" disabled={locked||!columns.length} onClick={()=>setEditing(blankCard(columns[0].id,creationMonth))}><Icon name="plus"/>เพิ่มการ์ด</button></div></header>
  <div className="kbMonthBar"><div className="kbMonthPicker"><button aria-label="เดือนก่อนหน้า" onClick={()=>selectMonth(shiftBoardMonth(creationMonth,-1))}><Icon name="left"/></button><label><span>เดือนของบอร์ด</span><input type="month" value={creationMonth} onChange={event=>selectMonth(event.target.value)}/></label><button aria-label="เดือนถัดไป" onClick={()=>selectMonth(shiftBoardMonth(creationMonth,1))}><Icon name="right"/></button></div><div className="kbMonthActions"><button aria-pressed={month===currentMonth} onClick={()=>selectMonth(currentMonth)}>เดือนนี้</button><button aria-pressed={month==='all'} onClick={()=>selectMonth('all')}>ดูทั้งหมด</button>{items.some(item=>item.type==='card'&&cardMonth(item)==='unassigned')&&<button aria-pressed={month==='unassigned'} onClick={()=>selectMonth('unassigned')}>ยังไม่ระบุเดือน</button>}</div><p>{month==='all'?'แสดงงานทุกเดือน':month==='unassigned'?'เปิดรายละเอียดการ์ดเพื่อกำหนดเดือน':'เพิ่มการ์ดใหม่ลงเดือนที่เลือก · เปลี่ยนเดือนได้ในรายละเอียด'}</p></div>
  <div className="kbToolbar"><label className={`kbSearch ${query?'hasQuery':''}`}><Icon name="search"/><input ref={searchInput} aria-label="ค้นหาการ์ด" placeholder="ค้นหางานในบอร์ด…" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button onClick={()=>setQuery('')} aria-label="ล้างคำค้น"><Icon name="close"/></button>}</label><select aria-label="กรองความสำคัญ" value={priority} onChange={event=>setPriority(event.target.value)}><option value="all">ทุกความสำคัญ</option>{Object.entries(PRIORITIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>{filtered&&<button className="kbClearFilters" onClick={()=>{setQuery('');setPriority('all');searchInput.current?.focus()}}>ล้างตัวกรอง</button>}<span className="kbSummary">{ready?`${allCards.length} การ์ด · เสร็จแล้ว ${doneCount}`:'กำลังเปิดบอร์ด…'}</span><button className="kbReload" disabled={busy} onClick={refresh}><Icon name="refresh"/>โหลดใหม่</button></div>
  {error&&<div className="kbError" role="alert"><strong>บันทึกหรือโหลดบอร์ดไม่สำเร็จ</strong><span>{error}</span><button disabled={busy} onClick={refresh}>ลองโหลดใหม่</button></div>}
  <div className="kbBoardTools"><span>{filtered?'กำลังกรองการ์ดในบอร์ด':'ลากการ์ดเพื่อจัดงาน หรือกดเพื่อเปิดรายละเอียด'}</span><div className="kbScrollControls"><button aria-label="เลื่อนบอร์ดไปทางซ้าย" disabled={navigation.start} onClick={()=>navigation.scroll(-1)}><Icon name="left"/></button><button aria-label="เลื่อนบอร์ดไปทางขวา" disabled={navigation.end} onClick={()=>navigation.scroll(1)}><Icon name="right"/></button></div></div>
  <p className={`kbAnnouncement ${toastVisible?'visible':''}`} role="status" aria-live="polite">{notice&&<><Icon name="check"/>{notice}</>}</p>
  <div className="kbCanvas" ref={canvas} aria-label="คอลัมน์งาน" tabIndex="0">
   {!ready&&!error&&<div className="kbSkeleton" aria-hidden="true">{[0,1,2].map(index=><div key={index}><i/><span/><span/></div>)}</div>}
   {columns.map((column,index)=>{
    const totalCards=cardsOf(items,column.id),cards=totalCards.filter(card=>month==='all'||cardMonth(card)===month),shown=cards.filter(visible);
    return <section className={`kbColumn kbTone-${column.tone} ${target?.columnId===column.id&&!target.beforeId?'dropActive':''}`} key={column.id} aria-label={column.title} onDragOver={event=>over(event,column.id)} onDrop={event=>drop(event,column.id)}>
     <header className="kbColumnHeader"><span className="kbColumnDot"/><h2>{column.title}</h2><span className="kbCount">{filtered?`${shown.length}/${cards.length}`:cards.length}</span><button className="kbIconButton" disabled={locked} onClick={()=>setColumnForm(columnForm?.id===column.id?null:column)} aria-label={`ตั้งค่าคอลัมน์ ${column.title}`} title="ตั้งค่าคอลัมน์"><Icon name="edit"/></button></header>
     {columnForm?.id===column.id?<ColumnForm column={columnForm} count={totalCards.length} canDelete={columns.length>1} busy={busy} error={error} onSave={saveColumn} onDelete={async()=>{if(await persist(current=>current.filter(item=>item.id!==column.id),'ลบคอลัมน์แล้ว'))setColumnForm(null)}} onCancel={()=>setColumnForm(null)}/>:<>
      <div className="kbCards">{shown.map(card=>{
       const due=dueState(card.due,today),completed=column.done;
       return <article key={card.id} data-card-id={card.id} className={`kbCard ${pendingIds.includes(card.id)?'pending':''} ${drag===card.id?'dragging':''} ${target?.beforeId===card.id?'dropBefore':''} ${completed?'complete':''}`} draggable={!locked} onDragStart={event=>{if(locked){event.preventDefault();return}setDrag(card.id);event.dataTransfer.setData('text/plain',card.id);event.dataTransfer.effectAllowed='move'}} onDragEnd={()=>{setDrag(null);setTarget(null)}} onDragOver={event=>over(event,column.id,insertion(event,column.id,card.id))} onDrop={event=>drop(event,column.id,insertion(event,column.id,card.id))}>
        <button className="kbCardOpen" disabled={locked} onClick={()=>setEditing(card)} aria-label={`เปิดการ์ด ${card.title}`}><span className={`kbPriority ${card.priority}`}>{PRIORITIES[card.priority]}</span><h3>{card.title}</h3>{card.detail&&<p>{card.detail}</p>}</button>
        <footer>{card.due?<span className={`kbDue ${completed?'finished':due}`}><Icon name={completed?'check':'calendar'}/>{completed?'เสร็จแล้ว':due==='late'?'เลยกำหนด':due==='today'?'วันนี้':dateLabel(card.due)}</span>:<span className="kbNoDue">{completed?'เสร็จแล้ว':'ไม่มีกำหนด'}</span>}<label className="kbMove"><span className="kbSrOnly">ย้ายการ์ด {card.title} ไปคอลัมน์</span><select value={column.id} disabled={locked} onChange={event=>move(card.id,event.target.value)}>{columns.map(option=><option key={option.id} value={option.id}>{option.title}</option>)}</select></label></footer>
       </article>;
      })}</div>
      {!shown.length&&<div className="kbEmptyColumn"><img src={`/ui/pixel/${column.done?'check':'plus'}.png`} width="26" height="26" alt=""/><p>{filtered?'ไม่พบการ์ดที่ตรงกับตัวกรอง':column.done?'งานที่เสร็จแล้วจะมาอยู่ตรงนี้':'เพิ่มการ์ด หรือลากงานมาวางที่นี่'}</p></div>}
      {adding===column.id?<QuickAdd key={month} columnId={column.id} month={creationMonth} disabled={locked} onSave={saveCard} onCancel={()=>setAdding(null)}/>:<button className="kbAddCard" disabled={locked} onClick={()=>{setAdding(column.id);setColumnForm(null)}}><Icon name="plus"/>เพิ่มการ์ด</button>}
      <div className="kbColumnOrder"><button disabled={locked||index===0} onClick={()=>shiftColumn(column.id,-1)} aria-label={`ย้ายคอลัมน์ ${column.title} ไปทางซ้าย`}><Icon name="left"/></button><span>{column.done?'คอลัมน์งานที่เสร็จแล้ว':'ลากการ์ดเพื่อย้ายงาน'}</span><button disabled={locked||index===columns.length-1} onClick={()=>shiftColumn(column.id,1)} aria-label={`ย้ายคอลัมน์ ${column.title} ไปทางขวา`}><Icon name="right"/></button></div>
     </>}
    </section>;
   })}
   {ready&&columns.length<12&&<div className="kbNewColumn">{columnForm?.revision===0?<ColumnForm column={columnForm} count={0} canDelete={false} busy={busy} error={error} onSave={saveColumn} onCancel={()=>setColumnForm(null)}/>:<button disabled={locked} onClick={()=>setColumnForm({id:newId(),type:'column',columnId:'',title:'',detail:'',priority:'normal',due:'',order:Math.max(-1,...columns.map(item=>item.order))+1,tone:TONES[columns.length%TONES.length],done:false,revision:0})}><Icon name="plus"/>เพิ่มคอลัมน์</button>}</div>}
  </div>
  <div className="kbHint"><Icon name="check"/><span>ลากเพื่อจัดลำดับและย้ายคอลัมน์ · บนมือถือใช้เมนูใต้การ์ดเพื่อย้ายงาน</span></div>
  {editing&&<CardEditor item={editing} columns={columns} busy={editorSaving||refreshing} error={error} onClose={()=>setEditing(null)} onSave={async form=>{setEditorSaving(true);try{return await saveCard(form)}finally{setEditorSaving(false)}}} onDelete={async card=>{setEditorSaving(true);try{return await persist(current=>current.filter(item=>item.id!==card.id),'ลบการ์ดแล้ว')}finally{setEditorSaving(false)}}}/>}
 </section>;
}
