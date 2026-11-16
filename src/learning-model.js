const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'});
export function learningDay(value=new Date()){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return '';
 const map=Object.fromEntries(parts.formatToParts(new Date(date.getTime()-5*3600000)).map(part=>[part.type,part.value]));
 return `${map.year}-${map.month}-${map.day}`;
}
export function shiftLearningDay(key,days){const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
export const formatLearningDay=(key,options={day:'numeric',month:'short'})=>new Date(key+'T12:00:00Z').toLocaleDateString('th-TH',{...options,timeZone:'UTC'});
export function activityDateForDay(key,original){return original&&learningDay(original)===key?new Date(original).toISOString():new Date(key+'T12:00:00+07:00').toISOString()}
export function formatMinutes(value){const minutes=Math.max(0,Number(value)||0);return minutes>=60?`${Math.floor(minutes/60)} ชม.${minutes%60?` ${minutes%60} นาที`:''}`:`${minutes} นาที`}
export function compareMinutes(current,previous){
 if(!previous)return current?'ยังไม่มีเวลาฝึกในช่วงก่อนให้เทียบ':'ยังไม่มีบันทึกในทั้งสองช่วง';
 const delta=current-previous;
 return delta===0?'เท่ากับช่วงก่อน':`${delta>0?'มากกว่า':'น้อยกว่า'}ช่วงก่อน ${formatMinutes(Math.abs(delta))} (${Math.abs(Math.round(delta/previous*100))}%)`;
}
export function groupActivities(items){
 const groups=new Map();for(const item of items){const key=learningDay(item.date);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}
 return [...groups].sort(([a],[b])=>b.localeCompare(a));
}
