import {dayKey, parseDay} from './day.js';

// All day events. A repeating event is stored once -- a start date plus a rule
// -- and the days it lands on are worked out here, so the sheet never fills up
// with generated rows and editing the event changes every occurrence at once.

export const EVENT_ICONS=[
 ['calendar-month','นัดหมาย'],['alarm-clock','ปลุก/เตือน'],['reminder-bell','เตือนความจำ'],
 ['important-date-pin','วันสำคัญ'],['event-star','อีเวนต์'],['checklist','สิ่งที่ต้องทำ'],
 ['planner-notebook','งานที่วางแผนไว้'],['edit-pencil','งานเขียน/แก้'],['sticky-note','โน้ตสั้น ๆ'],
 ['time-clock','กำหนดเวลา'],['recurring-schedule','งานประจำ'],['notification-message','ติดต่อ/นัดคุย'],
];
export const TONES=[
 ['blue','น้ำเงิน','#3c6fae'],['red','แดง','#c1523c'],['green','เขียว','#3f8a63'],
 ['yellow','เหลือง','#d0982c'],['purple','ม่วง','#7d5aa8'],
];
export const REPEATS=[
 ['none','ไม่ทำซ้ำ'],['daily','ทุกวัน'],['weekly','ทุกสัปดาห์'],['monthly','ทุกเดือน'],['yearly','ทุกปี'],
];
export const iconSrc=name=>`/calendar/icons/${EVENT_ICONS.some(i=>i[0]===name)?name:'calendar-month'}.png`;
export const charSrc=name=>`/calendar/characters/${name}.png`;
export const toneOf=id=>TONES.find(t=>t[0]===id)||TONES[0];
export const repeatLabel=id=>(REPEATS.find(r=>r[0]===id)||REPEATS[0])[1];
export const iconLabel=id=>(EVENT_ICONS.find(i=>i[0]===id)||EVENT_ICONS[0])[1];

const DATE=/^\d{4}-\d{2}-\d{2}$/;
const isDate=v=>DATE.test(String(v||''));
const text=(v,max)=>String(v??'').slice(0,max);

export function normalizeEvents(list){
 if(!Array.isArray(list))return [];
 const seen=new Set();
 return list
  .filter(x=>x&&typeof x==='object'&&x.id&&!seen.has(String(x.id))&&seen.add(String(x.id)))
  .map(x=>{
   const repeat=REPEATS.some(r=>r[0]===x.repeat)?x.repeat:'none';
   return {
    id:String(x.id),
    title:text(x.title,300),
    detail:text(x.detail,2000),
    date:isDate(x.date)?x.date:'',
    icon:EVENT_ICONS.some(i=>i[0]===x.icon)?x.icon:'calendar-month',
    tone:TONES.some(t=>t[0]===x.tone)?x.tone:'blue',
    repeat,
    repeatUntil:repeat!=='none'&&isDate(x.repeatUntil)?x.repeatUntil:'',
    done:repeat==='none'?Boolean(x.done):false,
    doneDates:repeat==='none'?'':String(x.doneDates||'').split(',').filter(isDate).join(','),
    createdAt:text(x.createdAt,40),updatedAt:text(x.updatedAt,40),
   };
  })
  .filter(x=>x.title.trim()&&x.date);
}

const partsOf=key=>key.split('-').map(Number);
const daysInMonth=(y,m)=>new Date(y,m,0).getDate();          // m is 1-12

/** Does this event land on that day? */
export function occursOn(event,key){
 if(!event.date||!isDate(key)||key<event.date)return false;
 if(event.repeat==='none')return key===event.date;
 if(event.repeatUntil&&key>event.repeatUntil)return false;
 const [sy,sm,sd]=partsOf(event.date),[y,m,d]=partsOf(key);
 if(event.repeat==='daily')return true;
 if(event.repeat==='weekly')return parseDay(key).getDay()===parseDay(event.date).getDay();
 // Monthly and yearly keep the day of the month. A month that is too short
 // simply does not get an occurrence -- the 31st never lands in February, and
 // 29 Feb only comes round on a leap year. Sliding it to the 28th would move
 // an appointment to a day you did not pick.
 if(event.repeat==='monthly')return d===sd&&sd<=daysInMonth(y,m);
 if(event.repeat==='yearly')return m===sm&&d===sd&&sd<=daysInMonth(y,m);
 return false;
}

export const doneSet=event=>new Set(String(event.doneDates||'').split(',').filter(Boolean));
/** Is this particular occurrence ticked off? */
export const isDoneOn=(event,key)=>event.repeat==='none'?event.done:doneSet(event).has(key);

/** The event list for one day, ordered the way the page shows them. */
export function eventsOn(events,key){
 return events
  .filter(e=>occursOn(e,key))
  .sort((a,b)=>Number(isDoneOn(a,key))-Number(isDoneOn(b,key))
   ||String(a.createdAt).localeCompare(String(b.createdAt))
   ||a.title.localeCompare(b.title,'th'));
}

/** The six week grid a month view shows, Sunday first. */
export function monthGrid(year,month){
 const first=new Date(year,month-1,1,12);
 const start=new Date(first);
 start.setDate(1-first.getDay());
 return Array.from({length:42},(_,i)=>{
  const d=new Date(start);
  d.setDate(start.getDate()+i);
  return {key:dayKey(d),day:d.getDate(),inMonth:d.getMonth()===month-1};
 });
}

/** Upcoming occurrences from `fromKey`, for the "what is coming" strip. */
export function upcoming(events,fromKey,days=30,limit=6){
 const out=[],cursor=parseDay(fromKey);
 for(let i=0;i<days&&out.length<limit;i++){
  const key=dayKey(cursor);
  for(const e of eventsOn(events,key)){
   if(!isDoneOn(e,key)&&out.length<limit)out.push({event:e,key});
  }
  cursor.setDate(cursor.getDate()+1);
 }
 return out;
}

export const monthLabel=(year,month)=>
 new Date(year,month-1,1,12).toLocaleDateString('th-TH',{month:'long',year:'numeric'});
export const dayLabel=key=>
 parseDay(key).toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
export const shortDay=key=>
 parseDay(key).toLocaleDateString('th-TH',{day:'numeric',month:'short'});

export const newId=()=>
 (globalThis.crypto?.randomUUID?.()||`c${Date.now()}${Math.random().toString(16).slice(2,8)}`);
