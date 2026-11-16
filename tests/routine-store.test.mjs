import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoutineStore} from '../src/routine-store.js';
import {routineDay} from '../src/routine-model.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const today=routineDay();let day={date:today,items:[{id:'a',title:'A',icon:'book',done:false},{id:'b',title:'B',icon:'book',done:false}],revision:0,stampedAt:''};
 const response=()=>({ok:true,today,month:today.slice(0,7),day:structuredClone(day),templates:[],calendar:[],todayStarted:day.revision>0});
 const pending=[],writes=[];
 const store=createRoutineStore({read:async()=>response(),write:payload=>new Promise((resolve,reject)=>{writes.push(payload);pending.push({payload,resolve,reject})})});
 return {store,pending,writes,finish(){const request=pending.shift();day={...day,items:day.items.map(item=>({...item,done:request.payload.changes.find(change=>change.id===item.id)?.done??item.done})),revision:day.revision+1};day.stampedAt=day.items.every(item=>item.done)?'stamp-'+day.revision:'';request.resolve(response())}};
}
test('checks render immediately but stamping and celebration wait for the final successful response',async()=>{
 const f=fixture();await f.store.load();f.store.check('a',true);await tick();f.store.check('b',true);
 assert.equal(f.store.getSnapshot().day.items.every(item=>item.done),true);assert.equal(f.store.getSnapshot().day.stampedAt,'');assert.equal(f.store.getSnapshot().celebration,0);assert.equal(f.writes.length,1);
 f.finish();await tick();assert.equal(f.writes.length,2);assert.equal(f.writes[1].revision,1);assert.equal(f.store.getSnapshot().celebration,0);
 f.finish();await tick();assert(f.store.getSnapshot().day.stampedAt);assert.equal(f.store.getSnapshot().celebration,1);assert.equal(f.store.getSnapshot().saving,false);
});
test('failed writes roll checks back without awarding a stamp, and navigation can reuse the queue',async()=>{
 const f=fixture();await f.store.load();const off=f.store.subscribe(()=>{});f.store.check('a',true);await tick();off();const off2=f.store.subscribe(()=>{});
 f.pending.shift().reject(new Error('offline'));await tick();assert.equal(f.store.getSnapshot().day.items[0].done,false);assert.equal(f.store.getSnapshot().celebration,0);assert.equal(f.store.getSnapshot().error,'offline');assert.equal(f.store.getSnapshot().saving,false);off2();
});
test('rapid check/uncheck coalesces and locking ignores late private responses',async()=>{
 const f=fixture();await f.store.load();f.store.check('a',true);f.store.check('a',false);await tick();assert.equal(f.writes.length,0);assert.equal(f.store.getSnapshot().saving,false);
 f.store.check('a',true);await tick();let updates=0;f.store.subscribe(()=>updates++);f.store.dispose();f.finish();await tick();assert.equal(updates,0);
});
