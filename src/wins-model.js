export const WIN_CATEGORIES = [
  {id:'health', label:'สุขภาพ', icon:'heart', color:'#d75b62'},
  {id:'learning', label:'การเรียน', icon:'book', color:'#3c86bc'},
  {id:'work', label:'งาน', icon:'bolt', color:'#b78323'},
  {id:'life', label:'ชีวิตประจำวัน', icon:'sprout', color:'#44886a'},
  {id:'other', label:'อื่น ๆ', icon:'star', color:'#8c69b0'},
];
export function dayKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function parseDay(key){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d,12);}
export function categoryOf(value){return WIN_CATEGORIES.find(c=>c.id===value)||WIN_CATEGORIES[4];}
export function normalizeWins(data){if(!Array.isArray(data))throw Error('รูปแบบไฟล์ไม่ถูกต้อง');return data.map(x=>{if(!x||typeof x.id!=='string'||typeof x.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||dayKey(parseDay(x.date))!==x.date||typeof x.text!=='string'||!x.text.trim()||x.text.length>1000)throw Error('ข้อมูลความสำเร็จไม่ถูกต้อง');return {...x,category:categoryOf(x.category).id};});}
export function calendarDays(month){const first=new Date(month.getFullYear(),month.getMonth(),1,12);first.setDate(first.getDate()-first.getDay());return Array.from({length:42},(_,i)=>{const d=new Date(first);d.setDate(d.getDate()+i);return {key:dayKey(d),day:d.getDate(),inMonth:d.getMonth()===month.getMonth()};});}
export function makeWin({id,text,category,original},now=new Date()){return {id,date:original?.date||dayKey(now),text:text.trim(),category:categoryOf(category).id};}
