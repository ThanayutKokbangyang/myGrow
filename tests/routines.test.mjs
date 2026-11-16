import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {routineDay,routineMonthCells,routineComplete} from '../src/routine-model.js';
function fixture(){
 const tables=new Map();let now=Date.parse('2026-11-16T06:00:00Z'),released=0;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 function sheet(name){const rows=[];tables.set(name,rows);return {getLastRow:()=>{let n=rows.length;while(n&&!rows[n-1]?.some(value=>String(value||'').length))n--;return n},getMaxRows:()=>1000,setFrozenRows(){},getRange(r,c,n,m){return {getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>String(rows[r+i-1]?.[c+j-1]??''))),setNumberFormat(){return this},setValues(values){values.forEach((row,i)=>{rows[r+i-1]??=[];row.forEach((value,j)=>rows[r+i-1][c+j-1]=typeof value==='string'&&value.startsWith("'")?value.slice(1):value)});return this}}}}}
 const objects=new Map(),book={getSheetByName:name=>objects.get(name)||null,insertSheet:name=>{const value=sheet(name);objects.set(name,value);return value}};
 const formatDate=(date,timeZone)=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`};
 const context={Date:Clock,SpreadsheetApp:{openById:()=>book},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test'})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++}})},Utilities:{formatDate}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('google-apps-script/Code.gs','utf8'),context);
 return {call:body=>JSON.parse(JSON.stringify(context.routines_(body))),tables,advance:value=>now=Date.parse(value),today:()=>context.routineToday_(),released:()=>released};
}
const add=(id,title=id)=>({action:'routines_upsert',item:{id,title,icon:'book'},revision:0});
const checks=(changes,revision=0,date='2026-11-16')=>({action:'routines_check',changes,revision,date,month:date.slice(0,7)});
const stamp=(revision,date='2026-11-16')=>({action:'routines_stamp',revision,date,month:date.slice(0,7)});
test('a date receives a stamp only after explicit placement on a fully completed day',()=>{
 const f=fixture();let result=f.call({action:'routines_list'});assert.equal(result.day.items.length,0);assert.equal(result.day.stampedAt,'');
 f.call(add('read'));f.call(add('code'));assert.throws(()=>f.call(stamp(0)),/ROUTINE_INCOMPLETE/);
 result=f.call(checks([{id:'read',done:true}]));assert.equal(result.day.revision,1);assert.equal(result.day.stampedAt,'');assert.equal(result.todayStarted,true);
 result=f.call(checks([{id:'code',done:true}],1));assert.equal(result.day.stampedAt,'');assert.throws(()=>f.call(stamp(1)),/ROUTINE_CONFLICT/);result=f.call(stamp(2));assert(result.day.stampedAt);assert.equal(result.calendar[0].completed,2);assert(routineComplete(result.day));
 const duplicate=f.call(checks([{id:'code',done:true}],0));assert.equal(duplicate.day.revision,3);assert.equal(duplicate.day.stampedAt,result.day.stampedAt);
 result=f.call(checks([{id:'read',done:false}],3));assert.equal(result.day.stampedAt,'');assert.equal(result.calendar[0].stampedAt,'');
});
test('template changes never erase historical stamps or change a started day’s commitment',()=>{
 const f=fixture();f.call(add('read','Read original'));f.call(add('code','Code original'));
 f.call(checks([{id:'read',done:true}]));
 f.call({action:'routines_upsert',item:{id:'read',title:'Read renamed',icon:'brain'},revision:1});
 f.call({action:'routines_archive',id:'code',revision:1});
 let result=f.call(add('walk','Walk newly added'));assert.deepEqual(result.day.items.map(item=>item.title),['Read original','Code original']);
 result=f.call(checks([{id:'code',done:true}],1));result=f.call(stamp(2));const savedStamp=result.day.stampedAt;assert(savedStamp);
 f.advance('2026-11-17T06:00:00Z');result=f.call({action:'routines_list'});assert.deepEqual(result.day.items.map(item=>item.title),['Read renamed','Walk newly added']);assert.equal(result.day.items.some(item=>item.done),false);
 result=f.call({action:'routines_list',date:'2026-11-16',month:'2026-11'});assert.equal(result.day.stampedAt,savedStamp);assert.deepEqual(result.day.items.map(item=>item.title),['Read original','Code original']);
 assert.throws(()=>f.call(checks([{id:'read',done:false}],2)),/ROUTINE_DAY_CHANGED/);
});
test('conflicts and malformed or backdated changes fail before touching saved rows',()=>{
 const f=fixture();f.call(add('read'));f.call(add('code'));f.call(checks([{id:'read',done:true}]));
 const snapshot=JSON.stringify([...f.tables]);
 assert.throws(()=>f.call(checks([{id:'code',done:true}],0)),/ROUTINE_CONFLICT/);
 assert.throws(()=>f.call(checks([{id:'read',done:1}],1)));
 assert.throws(()=>f.call(checks([{id:'read',done:false}],1,'2026-11-15')),/ROUTINE_DAY_CHANGED/);
 assert.throws(()=>f.call(checks([{id:'unknown',done:true}],1)));
 assert.throws(()=>f.call({...add('bad'),month:'2026-99'}));assert.equal(JSON.stringify([...f.tables]),snapshot);
});
test('stale template edits conflict and formula-like titles remain literal',()=>{
 const f=fixture();f.call(add('read','=literal routine'));assert.equal(f.tables.get('Routines')[1][1],'=literal routine');
 f.call({action:'routines_upsert',item:{id:'read',title:'renamed',icon:'book'},revision:1});
 assert.throws(()=>f.call({action:'routines_upsert',item:{id:'read',title:'stale',icon:'book'},revision:1}),/ROUTINE_CONFLICT/);
 assert.equal(f.call({action:'routines_list'}).templates[0].title,'renamed');
});
test('routine days use Bangkok 05:00 and monthly grids handle leap years without duplicate dates',()=>{
 const f=fixture();f.advance('2026-11-15T21:59:00Z');assert.equal(f.today(),'2026-11-15');assert.equal(routineDay('2026-11-15T21:59:00Z'),f.today());
 f.advance('2026-11-15T22:00:00Z');assert.equal(f.today(),'2026-11-16');assert.equal(routineDay('2026-11-15T22:00:00Z'),f.today());
 const leap=routineMonthCells('2024-02').filter(Boolean);assert.equal(leap.length,29);assert.equal(new Set(leap).size,29);assert.equal(routineMonthCells('2026-02').filter(Boolean).length,28);
 assert.equal(routineComplete({items:[],stampedAt:'not-a-stamp'}),false);
});

test('a routine set created once repeats throughout the month and stamp cannot be placed on other dates',()=>{
 const f=fixture();f.call(add('read'));f.call(add('walk'));
 for(let day=16;day<=30;day++){f.advance(`2026-11-${day}T06:00:00Z`);const result=f.call({action:'routines_list'});assert.deepEqual(result.day.items.map(item=>item.id),['read','walk']);assert(result.day.items.every(item=>!item.done));}
 assert.throws(()=>f.call(stamp(0,'2026-11-29')),/ROUTINE_DAY_CHANGED/);assert.throws(()=>f.call(stamp(0,'2026-12-01')),/ROUTINE_DAY_CHANGED/);
});
