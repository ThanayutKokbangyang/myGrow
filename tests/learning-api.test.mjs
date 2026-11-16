import test from 'node:test';
import assert from 'node:assert/strict';
import edge from '../api/[...path].js';
import worker from '../worker/index.js';
const env={TAE_ACCESS_CODE:'test-code',SESSION_SECRET:'test-secret',GOOGLE_APPS_SCRIPT_URL:'https://script.google.com/test',GOOGLE_APPS_SCRIPT_SECRET:'sheet-test'};
for(const [name,handle] of [['Vercel',r=>edge(r)],['Worker',r=>worker.fetch(r,env)]])test(name+' learning routes forward ranges, protect edits and translate conflicts',async()=>{
 const original=globalThis.fetch,previous={...process.env};Object.assign(process.env,env);const requests=[];let failure='';
 globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));return Response.json(failure?{ok:false,error:failure}:{ok:true,items:[],item:{id:'one'}})};
 const request=(path,options={})=>new Request('https://grow.test'+path,options);
 try{
  assert.equal((await handle(request('/api/learning-stats'))).status,401);
  assert.equal((await handle(request('/api/activities',{method:'POST',body:JSON.stringify({_action:'update',item:{id:'one'}})}))).status,401);assert.equal(requests.length,0);
  const login=await handle(request('/api/auth',{method:'POST',body:JSON.stringify({code:env.TAE_ACCESS_CODE})}));const headers={cookie:login.headers.get('set-cookie').split(';')[0]};
  await handle(request('/api/learning-stats?days=30&refresh=1',{headers}));assert.equal(requests[0].action,'learning_stats');assert.equal(requests[0].days,'30');assert.equal(requests[0].refresh,true);
  await handle(request('/api/activities?start=2026-11-10&end=2026-11-16&pageSize=20',{headers}));assert.equal(requests[1].start,'2026-11-10');assert.equal(requests[1].end,'2026-11-16');assert.equal(requests[1].pageSize,'20');
  const body=JSON.stringify({_action:'update',item:{id:'one',topic:'edited',updatedAt:'original-stamp'}});
  assert.equal((await handle(request('/api/activities',{headers,method:'POST',body}))).status,200);assert.equal(requests[2].action,'update');assert.equal(requests[2].expectedUpdatedAt,'original-stamp');
  failure='ACTIVITY_CONFLICT';assert.equal((await handle(request('/api/activities',{headers,method:'POST',body}))).status,409);
  failure='ACTION_INVALID';const response=await handle(request('/api/activities',{headers,method:'POST',body}));assert.equal(response.status,503);assert.match((await response.json()).error,/Apps Script/);
 }finally{globalThis.fetch=original;for(const key of Object.keys(env)){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}}
});
