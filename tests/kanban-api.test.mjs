import test from 'node:test';
import assert from 'node:assert/strict';
import edge from '../api/[...path].js';
import worker from '../worker/index.js';
const env={TAE_ACCESS_CODE:'test-code',SESSION_SECRET:'test-secret',GOOGLE_APPS_SCRIPT_URL:'https://script.google.com/test',GOOGLE_APPS_SCRIPT_SECRET:'sheet-secret'};
for(const [name,handle] of [['Vercel',r=>edge(r)],['Worker',r=>worker.fetch(r,env)]])test(name+' Kanban adapter validates batches and translates conflicts',async()=>{
 const oldFetch=globalThis.fetch,previous={...process.env};Object.assign(process.env,env);
 let payloads=[],conflict=false;
 globalThis.fetch=async(_url,options)=>{payloads.push(JSON.parse(options.body));return Response.json(conflict?{ok:false,error:'KANBAN_CONFLICT'}:{ok:true,items:[]})};
 const request=(path,options={})=>new Request('https://grow.test'+path,options);
 try{
  const login=await handle(request('/api/auth',{method:'POST',body:JSON.stringify({code:env.TAE_ACCESS_CODE})}));
  const headers={cookie:login.headers.get('set-cookie').split(';')[0]};
  assert.equal((await handle(request('/api/kanban',{headers}))).status,200);assert.equal(payloads[0].action,'kanban_list');
  assert.equal((await handle(request('/api/kanban',{headers,method:'POST',body:JSON.stringify({changes:[]})}))).status,400);assert.equal(payloads.length,1);
  const changes=[{type:'delete',id:'test-id',revision:1}];
  assert.equal((await handle(request('/api/kanban',{headers,method:'POST',body:JSON.stringify({changes})}))).status,200);
  assert.deepEqual(payloads[1].changes,changes);assert.equal(payloads[1].action,'kanban_apply');
  conflict=true;const result=await handle(request('/api/kanban',{headers,method:'POST',body:JSON.stringify({changes})}));assert.equal(result.status,409);assert.match((await result.json()).error,/โหลดใหม่/);
 }finally{globalThis.fetch=oldFetch;for(const key of Object.keys(env)){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}}
});
