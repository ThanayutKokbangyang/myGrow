import test from 'node:test';
import assert from 'node:assert/strict';
import edge from '../api/[...path].js';
import worker from '../worker/index.js';
const env={TAE_ACCESS_CODE:'test-code',SESSION_SECRET:'test-secret',GOOGLE_APPS_SCRIPT_URL:'https://script.google.com/test',GOOGLE_APPS_SCRIPT_SECRET:'sheet-test'};
for(const [name,handle] of [['Vercel',r=>edge(r)],['Worker',r=>worker.fetch(r,env)]])test(name+' routines protect checks, forward calendar dates and translate conflict/setup errors',async()=>{
 const original=globalThis.fetch,previous={...process.env};Object.assign(process.env,env);const calls=[];let failure='';
 globalThis.fetch=async(_url,options)=>{calls.push(JSON.parse(options.body));return Response.json(failure?{ok:false,error:failure}:{ok:true,templates:[],calendar:[],day:{items:[]}})};
 const request=(path,options={})=>new Request('https://grow.test'+path,options);
 try{
  assert.equal((await handle(request('/api/routines'))).status,401);assert.equal((await handle(request('/api/routines',{method:'POST',body:'{}'}))).status,401);assert.equal(calls.length,0);
  const login=await handle(request('/api/auth',{method:'POST',body:JSON.stringify({code:env.TAE_ACCESS_CODE})}));const headers={cookie:login.headers.get('set-cookie').split(';')[0]};
  await handle(request('/api/routines?month=2026-11&date=2026-11-16',{headers}));assert.equal(calls[0].action,'routines_list');assert.equal(calls[0].month,'2026-11');assert.equal(calls[0].date,'2026-11-16');
  const payload={action:'check',date:'2026-11-16',month:'2026-11',revision:2,changes:[{id:'read',done:true}]};
  assert.equal((await handle(request('/api/routines',{method:'POST',headers,body:JSON.stringify(payload)}))).status,200);assert.deepEqual(calls[1].changes,payload.changes);assert.equal(calls[1].revision,2);
  assert.equal((await handle(request('/api/routines',{method:'POST',headers,body:JSON.stringify({action:'list'})}))).status,400);
  payload.action='stamp';delete payload.changes;assert.equal((await handle(request('/api/routines',{method:'POST',headers,body:JSON.stringify(payload)}))).status,200);assert.equal(calls.at(-1).action,'routines_stamp');
  failure='ROUTINE_INCOMPLETE';assert.equal((await handle(request('/api/routines',{method:'POST',headers,body:JSON.stringify(payload)}))).status,409);
  failure='ROUTINE_CONFLICT';assert.equal((await handle(request('/api/routines',{method:'POST',headers,body:JSON.stringify(payload)}))).status,409);
  failure='ACTION_INVALID';const setup=await handle(request('/api/routines',{headers}));assert.equal(setup.status,503);assert.match((await setup.json()).error,/Apps Script/);
 }finally{globalThis.fetch=original;for(const key of Object.keys(env)){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}}
});
