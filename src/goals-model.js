import {dayKey,dayStart} from './day';

// Goals and the plan steps under them share one Sheet tab and one list here:
// a row with an empty goalId is a goal, anything else is a step of that goal.

// Character art -- one per goal.
export const GOAL_ICONS=[
 ['dream','เป้าหมายที่ยิ่งใหญ่'],['trophy','ความสำเร็จสูงสุด'],['study','การศึกษา'],['work','การงาน'],['health','สุขภาพ'],
 ['sleep','พักผ่อนให้เพียงพอ'],['eat','กินอาหารดี ๆ'],['grow','พัฒนาตัวเอง'],['money','การเงินมั่นคง'],['learn','เรียนรู้สิ่งใหม่'],
 ['exercise','ออกกำลังกาย'],['mind','ดูแลสุขภาพใจ'],['journal','จดบันทึกประจำวัน'],['tidy','จัดระเบียบชีวิต'],['love','ใช้เวลากับคนที่รัก'],
 ['plan','ทำตามแผน'],['hobby','ทำสิ่งที่ชอบ'],['adventure','ออกไปผจญภัย'],['friends','สร้างความสัมพันธ์ที่ดี'],['relax','ผ่อนคลายบ้าง'],
];
// Object art -- one per plan step.
export const PLAN_ICONS=[
 ['checklist','เช็กลิสต์'],['schedule','ตารางเวลา'],['fitness','ฟิตร่างกาย'],['study','เรียน'],['coding','เขียนโค้ด'],['plant','ดูแลต้นไม้'],
 ['sleep','การนอน'],['meal','มื้ออาหาร'],['savings','เก็บเงิน'],['photo','ถ่ายรูป'],['travel','เดินทาง'],['journal','จดบันทึก'],
 ['pet','สัตว์เลี้ยง'],['cycling','ปั่นจักรยาน'],['target','เป้าที่ต้องยิง'],['exam','สอบ'],['gaming','เล่นเกม'],['music','ฟังเพลง'],
 ['holiday','พักร้อน'],['chores','งานบ้าน'],['message','ติดต่อคน'],['idea','ไอเดีย'],['shopping','ซื้อของ'],['hiking','เดินป่า'],
 ['healthy','สุขภาพดี'],['budget','งบประมาณ'],['home','บ้าน'],['world','โลกกว้าง'],['art','งานศิลปะ'],['award','รางวัล'],
];
export const goalIconSrc=name=>`/goals/goal/${GOAL_ICONS.some(i=>i[0]===name)?name:'dream'}.png`;
export const planIconSrc=name=>`/goals/plan/${PLAN_ICONS.some(i=>i[0]===name)?name:'checklist'}.png`;

export const TERMS=[['long','ระยะยาว'],['short','ระยะสั้น']];
export const GOAL_STATUS=[['active','กำลังทำ'],['paused','พักไว้ก่อน'],['done','สำเร็จแล้ว']];

export {dayKey};
export const formatDay=key=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key||''))return '';
 const [y,m,d]=key.split('-').map(Number);
 return new Date(y,m-1,d,12).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
};
// Positive = days left, negative = overdue, null = no date set.
export const daysLeft=key=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key||''))return null;
 const [y,m,d]=key.split('-').map(Number),target=new Date(y,m-1,d,12),today=dayStart();
 return Math.round((target-new Date(today.getFullYear(),today.getMonth(),today.getDate(),12))/86400000);
};

const text=(v,max)=>String(v??'').slice(0,max);
export function normalizeItems(list){
 if(!Array.isArray(list))return [];
 const seen=new Set();
 return list.filter(x=>x&&typeof x==='object'&&x.id&&!seen.has(String(x.id))&&seen.add(String(x.id))).map(x=>{
  const type=x.type==='step'?'step':'goal';
  return {
   id:String(x.id),type,
   goalId:type==='step'?String(x.goalId||''):'',
   term:type==='goal'?(x.term==='short'?'short':'long'):'',
   title:text(x.title,300),detail:type==='goal'?text(x.detail,2000):'',
   icon:text(x.icon,40),
   status:type==='goal'
    ?(GOAL_STATUS.some(s=>s[0]===x.status)?x.status:'active')
    :(x.status==='done'?'done':'todo'),
   due:/^\d{4}-\d{2}-\d{2}$/.test(x.due||'')?x.due:'',
   order:Number.isFinite(Number(x.order))?Math.max(0,Math.min(100000,Math.round(Number(x.order)))):0,
   createdAt:text(x.createdAt,40),updatedAt:text(x.updatedAt,40),
  };
 }).filter(x=>x.title.trim()&&(x.type==='goal'||x.goalId));
}

// One goal plus its steps, already sorted the way the page shows them.
export function buildBoard(items){
 const goals=items.filter(x=>x.type==='goal').sort((a,b)=>a.order-b.order||String(a.createdAt).localeCompare(String(b.createdAt)));
 const steps=items.filter(x=>x.type==='step');
 return goals.map(goal=>{
  const own=steps.filter(s=>s.goalId===goal.id).sort((a,b)=>a.order-b.order||String(a.createdAt).localeCompare(String(b.createdAt)));
  const done=own.filter(s=>s.status==='done').length;
  return {...goal,steps:own,done,total:own.length,
   percent:own.length?Math.round((done/own.length)*100):(goal.status==='done'?100:0)};
 });
}
export const orphanSteps=items=>{
 const known=new Set(items.filter(x=>x.type==='goal').map(x=>x.id));
 return items.filter(x=>x.type==='step'&&!known.has(x.goalId));
};

export const newId=()=>
 (globalThis.crypto?.randomUUID?.()||`g${Date.now()}${Math.random().toString(16).slice(2,8)}`);
