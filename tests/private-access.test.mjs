import test from 'node:test';
import assert from 'node:assert/strict';
import edge from '../api/[...path].js';
import worker from '../worker/index.js';

const env={TAE_ACCESS_CODE:'test-only-secret',SESSION_SECRET:'test-signing-key-not-for-production',GOOGLE_APPS_SCRIPT_URL:'https://script.google.com/test',GOOGLE_APPS_SCRIPT_SECRET:'sheet-test'};
const req=(path,options={})=>new Request('https://grow.test'+path,options);
async function forged(claims){
 const encode=value=>Buffer.from(value).toString('base64url');
 const payload=encode(JSON.stringify(claims));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return payload+'.'+encode(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
}
for(const [name,handle] of [['Vercel',request=>edge(request)],['Worker',request=>worker.fetch(request,env)]]){
 test(name+' requires password and protects every data endpoint',async()=>{
  const previous={...process.env},originalFetch=globalThis.fetch;
  Object.assign(process.env,env);let sheetCalls=0;
  globalThis.fetch=async()=>{sheetCalls++;return Response.json({ok:true,items:[]})};
  try{
   const paths=['activities','dashboard','goals','todos','calendar','wins','summaries','status','session'];
   for(const path of paths){const response=await handle(req('/api/'+path));assert.equal(response.status,401,path);assert.equal(response.headers.get('cache-control'),'no-store')}
   assert.equal(sheetCalls,0);
   for(const value of ['wrong',null]){
    const response=await handle(req('/api/auth',{method:'POST',body:JSON.stringify(value===null?null:{code:value})}));
    assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null);
   }
   const login=await handle(req('/api/auth',{method:'POST',headers:{origin:'https://grow.test'},body:JSON.stringify({code:env.TAE_ACCESS_CODE})}));
   assert.equal(login.status,200);assert.deepEqual(await login.json(),{ok:true});
   const cookie=login.headers.get('set-cookie');
   for(const attr of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert(cookie.includes(attr));
   const headers={cookie:cookie.split(';')[0]};
   assert.equal((await handle(req('/api/session',{headers}))).status,200);
   for(const path of paths.slice(0,7))assert.equal((await handle(req('/api/'+path,{headers}))).status,200,path);
   assert.equal(sheetCalls,7);
   assert.equal((await handle(req('/api/todos',{method:'POST',headers:{...headers,origin:'https://attacker.test'},body:'{}'}))).status,403);
   const legacy=await forged({sub:'tae',exp:Date.now()+100000});
   const expired=await forged({sub:'tae',audience:'private-site-v2',exp:Date.now()-1});
   for(const token of [legacy,expired,'malformed'])assert.equal((await handle(req('/api/session',{headers:{cookie:'__Host-grow-session='+token}}))).status,401);
   assert.equal((await handle(req('/api/session',{headers:{authorization:'Bearer '+cookie.split('=')[1].split(';')[0]}}))).status,401);
   const logout=await handle(req('/api/logout',{method:'POST',headers}));
   assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
   if(name==='Vercel'){
    delete process.env.TAE_ACCESS_CODE;
    assert.equal((await handle(req('/api/auth',{method:'POST',body:'{}'}))).status,503);
   }
  }finally{
   globalThis.fetch=originalFetch;
   for(const key of Object.keys(env)){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}
  }
 });
}
