export const ROUTINE_ICONS=[['sprout','พัฒนาตัวเอง'],['book','อ่านหนังสือ'],['brain','ฝึกสมอง'],['clock','จัดเวลา'],['flame','ออกกำลัง'],['check','งานประจำ'],['bolt','ลงมือทำ']];
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'});
export function routineDay(value=new Date()){
 const date=new Date(value);const parts=Object.fromEntries(formatter.formatToParts(new Date(date.getTime()-5*3600000)).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export const routineDateLabel=(date,options={day:'numeric',month:'long',year:'numeric'})=>new Date(date+'T12:00:00Z').toLocaleDateString('th-TH',{...options,timeZone:'UTC'});
export function moveMonth(month,direction){const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+direction);return date.toISOString().slice(0,7)}
export function routineMonthCells(month){
 const start=new Date(month+'-01T12:00:00Z'),offset=(start.getUTCDay()+6)%7,count=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
 const result=Array(offset).fill(null);for(let day=1;day<=count;day++)result.push(`${month}-${String(day).padStart(2,'0')}`);while(result.length%7)result.push(null);return result;
}
export const routineComplete=day=>Boolean(day?.items?.length&&day.items.every(item=>item.done)&&day.stampedAt);
export function routineCalendar(state){
 const index=new Map((state.calendar||[]).map(day=>[day.date,day]));
 if(state.day?.items?.length)index.set(state.day.date,{date:state.day.date,total:state.day.items.length,completed:state.day.items.filter(item=>item.done).length,stampedAt:state.day.stampedAt});
 return index;
}
