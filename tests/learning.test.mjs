import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {activityDateForDay,compareMinutes,groupActivities,learningDay,shiftLearningDay} from '../src/learning-model.js';
const headers=['id','date_iso','date_th','skill','topic','minutes','before','after','improvement','difficulty','learned','problem','next','xp','created_by','updated_at'];
function fixture(){
 const rows=[headers],cache=new Map();let released=0;
 const OriginalDate=Date,now=Date.parse('2026-11-16T06:00:00Z');
 class Clock extends OriginalDate{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 const formatDate=(value,timeZone,format)=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(value).map(part=>[part.type,part.value]));
  return format==='H'?parts.hour:format==='dd/MM/yyyy'?`${parts.day}/${parts.month}/${parts.year}`:`${parts.year}-${parts.month}-${parts.day}`;
 };
 const sheet={getLastRow:()=>rows.length,getMaxRows:()=>1000,deleteRow:row=>rows.splice(row-1,1),getRange(r,c,n,m){return {getValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m)),getDisplayValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m).map(String)),setValues(values){values.forEach((row,i)=>rows[r+i-1]=row.map(value=>typeof value==='string'&&value.startsWith("'")?value.slice(1):value))}}}};
 const ctx={Date:Clock,SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test'})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++}})},CacheService:{getScriptCache:()=>({get:key=>cache.get(key)||null,put:(key,value)=>cache.set(key,value),removeAll:keys=>keys.forEach(key=>cache.delete(key))})},Utilities:{formatDate}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('google-apps-script/Code.gs','utf8'),ctx);
 return {rows,released:()=>released,call:(name,...args)=>JSON.parse(JSON.stringify(ctx[name](...args)))};
}
const item=(id,date,minutes=25)=>({id,date,skill:'coding',topic:'ฝึกเขียนโค้ด',minutes,before:0,after:0,difficulty:0,learned:'',problem:'',next:''});
function seeded(){const f=fixture();for(const entry of [item('old','2026-11-09T05:00:00Z',40),item('start','2026-11-10T05:00:00Z',10),item('late','2026-11-15T21:59:00Z',20),item('today','2026-11-15T22:00:00Z',30),item('future','2026-11-17T05:00:00Z',70),item('ancient','2026-10-01T05:00:00Z',80)])f.call('appendActivity_',entry);return f}

test('learning day is Bangkok 05:00 in both client and Apps Script, regardless of host timezone',()=>{
 const f=fixture();
 for(const [date,day] of [['2026-11-15T21:59:00Z','2026-11-15'],['2026-11-15T22:00:00Z','2026-11-16']]){assert.equal(learningDay(date),day);assert.equal(f.call('activityDay_',date),day)}
 const original='2026-11-15T21:59:00Z';assert.equal(activityDateForDay('2026-11-15',original),new Date(original).toISOString());assert.equal(learningDay(activityDateForDay('2026-11-13',original)),'2026-11-13');
 assert.equal(shiftLearningDay('2026-03-01',-1),'2026-02-28');assert.equal(shiftLearningDay('2024-03-01',-1),'2024-02-29');
});
test('7/30-day reports use complete consecutive windows and include zero-activity days',()=>{
 const f=seeded(),week=f.call('learningStats_',{days:7});
 assert.equal(week.start,'2026-11-10');assert.equal(week.end,'2026-11-16');assert.equal(week.previousStart,'2026-11-03');assert.equal(week.previousEnd,'2026-11-09');
 assert.equal(week.current.minutes,60);assert.equal(week.previous.minutes,40);assert.equal(week.current.activeDays,3);assert.equal(week.daily.length,7);assert.equal(week.daily.reduce((sum,day)=>sum+day.minutes,0),60);assert(week.daily.some(day=>day.minutes===0));
 const month=f.call('learningStats_',{days:30});assert.equal(month.daily.length,30);assert.equal(month.current.minutes,100);assert.equal(month.previous.minutes,80);
 const dashboard=f.call('dashboardSummary_',{});assert.deepEqual(dashboard.todayItems.map(item=>item.id),['today']);assert.equal(dashboard.summary.streak,2);
});
test('editing preserves IDs and dates, rejects stale writes, and invalidates report totals',()=>{
 const f=seeded();f.call('learningStats_',{days:7});
 const original=f.call('listActivities_',{page:1,pageSize:100}).items.find(item=>item.id==='today');const count=f.rows.length;
 const updated=f.call('updateActivity_',{item:{...original,topic:'แก้ไขหัวข้อ',minutes:45},expectedUpdatedAt:original.updatedAt}).item;
 assert.equal(f.rows.length,count);assert.equal(updated.id,original.id);assert.equal(updated.date,original.date);assert(updated.updatedAt>original.updatedAt);
 assert.throws(()=>f.call('updateActivity_',{item:original,expectedUpdatedAt:original.updatedAt}),/ACTIVITY_CONFLICT/);
 assert.equal(f.call('learningStats_',{days:7}).current.minutes,75);
 f.call('deleteActivity_','late');assert.equal(f.call('learningStats_',{days:7}).current.minutes,55);
});
test('history date filters follow logical days and filter before pagination',()=>{
 const f=seeded();const day=f.call('listActivities_',{start:'2026-11-15',end:'2026-11-15',pageSize:1});assert.equal(day.total,1);assert.equal(day.items[0].id,'late');
 const result=f.call('listActivities_',{start:'2026-11-10',end:'2026-11-16',skill:'coding',query:'โค้ด',pageSize:2,page:2});assert.equal(result.total,3);assert.equal(result.items.length,1);assert.equal(result.pages,2);
 assert.throws(()=>f.call('listActivities_',{start:'2026-11-16',end:'2026-11-15'}));
});
test('new records support unrated scores, protect literal text and are idempotent',()=>{
 const f=fixture();const record={...item('literal','2026-11-16T05:00:00Z'),topic:'=literal',learned:'=SUM(1,2)'};
 f.call('appendActivity_',record);f.call('appendActivity_',record);assert.equal(f.rows.length,2);assert.equal(f.rows[1][4],'=literal');assert.equal(f.rows[1][10],'=SUM(1,2)');
 const before=JSON.stringify(f.rows);assert.throws(()=>f.call('appendActivity_',{...record,id:'bad',minutes:-1}));assert.throws(()=>f.call('appendActivity_',{...record,id:'bad',before:2,after:0}));assert.equal(JSON.stringify(f.rows),before);
});
test('empty reports and comparisons do not fabricate improvement percentages',()=>{
 const f=fixture(),stats=f.call('learningStats_',{days:30});assert.equal(stats.current.minutes,0);assert.equal(stats.current.activeDays,0);assert.equal(stats.daily.length,30);
 assert.doesNotMatch(compareMinutes(30,0),/100%/);assert.match(compareMinutes(60,30),/100%/);assert.equal(groupActivities([]).length,0);
});

test('backdated inserts and changed dates are ordered by activity time before paging',()=>{const f=fixture();f.call('appendActivity_',item('newer','2026-11-16T05:00:00Z'));f.call('appendActivity_',item('backdated','2026-11-10T05:00:00Z'));assert.equal(f.call('listActivities_',{page:1,pageSize:1}).items[0].id,'newer');});
