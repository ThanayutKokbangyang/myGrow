import test from 'node:test';
import assert from 'node:assert/strict';

test('API reads normalize keys, refresh explicitly, and invalidate after writes',async()=>{
 globalThis.localStorage={getItem:()=>null};
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true,items:[],version:++calls})});
 try{
  const api=await import('../src/api.js');
  const {pendingReads}=await import('../src/loading-state.js');
  const opts={date:'2026-11-16',type:'todo',pageSize:100};
  const first=await api.loadTodos(opts);
  assert.equal(api.getCachedTodos(opts),first);
  assert.equal(await api.loadTodos({type:'todo',pageSize:100,date:'2026-11-16'}),first);
  assert.equal(calls,1);
  assert.equal(pendingReads('/api/todos'),0);
  await api.loadTodos({...opts,refresh:true});assert.equal(calls,2);
  await api.applyTodos([{id:'1',type:'delete'}]);
  assert.equal(api.getCachedTodos(opts),null);
  await api.loadTodos(opts);assert.equal(calls,4);
  const before=await api.loadDashboard();
  await api.createActivity({topic:'test'});
  assert.notEqual((await api.loadDashboard()).version,before.version);
  const statsBefore=await api.loadLearningStats(7);
  await api.updateActivity({id:'test',topic:'edited'});
  assert.notEqual((await api.loadLearningStats(7)).version,statsBefore.version);
  let rejectRead;
  globalThis.fetch=()=>new Promise((_,reject)=>{rejectRead=reject});
  const failed=api.loadDashboard(true);
  await Promise.resolve();
  assert.equal(pendingReads('/api/dashboard'),1);
  rejectRead(new Error('offline'));
  await assert.rejects(failed,/offline/);
  assert.equal(pendingReads('/api/dashboard'),0);
 }finally{globalThis.fetch=originalFetch;delete globalThis.localStorage}
});
