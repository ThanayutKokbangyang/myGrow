const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
const sessionCookie=(token,clear=false)=>`__Host-grow-session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict${clear?'; Max-Age=0':''}`;
const textEncoder = new TextEncoder();
const mime = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  json: "application/json; charset=utf-8",
};
const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const decode64 = (value) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const same = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let value = 0;
  for (let i = 0; i < a.length; i++) value |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return value === 0;
};

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload)),
    ),
  );
}
async function issueToken(secret) {
  const payload = base64url(
    textEncoder.encode(
      JSON.stringify({
        sub: "tae",
        audience: "private-site-v2",
        exp: Date.now() + 12 * 60 * 60 * 1000,
      }),
    ),
  );
  return `${payload}.${await sign(payload, secret)}`;
}
async function validToken(request, env) {
  const token = (request.headers.get('cookie') || '').split(';').map(value=>value.trim()).find(value=>value.startsWith('__Host-grow-session='))?.slice('__Host-grow-session='.length)||'';
  const [payload, signature] = token.split(".");
  if (
    !payload ||
    !signature ||
    !env.SESSION_SECRET ||
    !same(signature, await sign(payload, env.SESSION_SECRET))
  )
    return false;
  try {
    const data = JSON.parse(
      new TextDecoder().decode(
        decode64(
          payload.replace(/-/g, "+").replace(/_/g, "/") +
            "===".slice((payload.length + 3) % 4),
        ),
      ),
    );
    return data.sub === "tae" && data.audience === "private-site-v2" && Number.isFinite(data.exp) && data.exp > Date.now();
  } catch {
    return false;
  }
}
async function sheetRequest(env, payload) {
  if (
    !env.GOOGLE_APPS_SCRIPT_URL ||
    !/^https:\/\/script\.google\.com\//.test(env.GOOGLE_APPS_SCRIPT_URL)
  )
    throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_APPS_SCRIPT_URL");
  const response = await fetch(env.GOOGLE_APPS_SCRIPT_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "content-type": "text/plain; charset=utf-8" },
    body: JSON.stringify({ ...payload, secret: env.GOOGLE_APPS_SCRIPT_SECRET }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok)
    throw new Error(result?.error || "Google Sheet ตอบกลับไม่สำเร็จ");
  return result;
}
async function handleApi(request, env, url) {
  if (!['GET','HEAD'].includes(request.method) && ((request.headers.get('origin') && request.headers.get('origin') !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site')) return json({error:'ไม่อนุญาตคำขอจากเว็บไซต์อื่น'},403);
  if (url.pathname === '/api/auth' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!env.TAE_ACCESS_CODE || !env.SESSION_SECRET) return json({error:'ระบบยืนยันตัวยังไม่ได้ตั้งค่า'},503);
    if (!same(String(body?.code || ''), String(env.TAE_ACCESS_CODE))) return json({error:'รหัสเข้าเว็บไม่ถูกต้อง'},401);
    return json({ok:true},200,{'set-cookie':sessionCookie(await issueToken(env.SESSION_SECRET))});
  }
  if (url.pathname === '/api/logout' && request.method === 'POST') return json({ok:true},200,{'set-cookie':sessionCookie('',true)});
  if (!(await validToken(request,env))) return json({error:'กรุณาใส่รหัสก่อนเข้าใช้งาน'},401);
  if (url.pathname === '/api/session' && request.method === 'GET') return json({ok:true});
  if (url.pathname === '/api/status') return json({configured:Boolean(env.GOOGLE_APPS_SCRIPT_URL)});

  if(url.pathname==='/api/routines'&&['GET','POST'].includes(request.method)){
    const body=request.method==='POST'?await request.json().catch(()=>null):null;
    const action=request.method==='GET'?'list':body?.action;
    if(!['list','upsert','archive','check'].includes(action)||request.method==='POST'&&action==='list')return json({error:'ข้อมูลรูทีนไม่ถูกต้อง'},400);
    try{return json(await sheetRequest(env, {action:'routines_'+action,item:body?.item,id:body?.id,revision:body?.revision,changes:body?.changes,month:request.method==='GET'?url.searchParams.get('month'):body?.month,date:request.method==='GET'?url.searchParams.get('date'):body?.date}));}
    catch(error){return json({error:error.message==='ACTION_INVALID'?'กรุณาอัปเดตและ Deploy Apps Script เวอร์ชันรูทีนก่อน':error.message==='ROUTINE_CONFLICT'?'รายการเปลี่ยนจากอีกหน้าต่าง กรุณาโหลดใหม่ก่อนลองอีกครั้ง':error.message==='ROUTINE_DAY_CHANGED'?'วันเปลี่ยนแล้ว กรุณากลับมาวันนี้ก่อนเช็ครูทีน':error.message},['ROUTINE_CONFLICT','ROUTINE_DAY_CHANGED'].includes(error.message)?409:503);}
  }
  if (url.pathname === '/api/kanban' && ['GET','POST'].includes(request.method)) {
    const body=request.method==='POST'?await request.json().catch(()=>null):null;
    if(request.method==='POST' && (!Array.isArray(body?.changes)||!body.changes.length||body.changes.length>750))return json({error:'ข้อมูลบอร์ดไม่ถูกต้อง'},400);
    try { return json(await sheetRequest(env, {action:request.method==='GET'?'kanban_list':'kanban_apply',changes:body?.changes})); }
    catch(error){return json({error:error.message==='ACTION_INVALID'?'กรุณาอัปเดตและ Deploy Apps Script เวอร์ชันบอร์ดงานก่อน':error.message==='KANBAN_CONFLICT'?'บอร์ดถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดใหม่ก่อนลองอีกครั้ง':error.message},error.message==='KANBAN_CONFLICT'?409:503);}
  }
  if (url.pathname === '/api/calendar' && ['GET','POST'].includes(request.method)) {
    if (request.method === 'POST' && !(await validToken(request, env))) return json({error:'กรุณายืนยันว่าเป็นเท่ก่อนบันทึก'},401);
    const body=request.method==='POST'?await request.json().catch(()=>null):null;
    if(request.method==='POST' && (!Array.isArray(body?.changes)||!body.changes.length||body.changes.length>500))return json({error:'ข้อมูลไม่ถูกต้อง'},400);
    try { return json(await sheetRequest(env, {action:request.method==='GET'?'calendar_list':'calendar_apply',changes:body?.changes,start:url.searchParams.get('start'),end:url.searchParams.get('end'),page:url.searchParams.get('page'),pageSize:url.searchParams.get('pageSize')})); }
    catch(error){return json({error:error.message==='ACTION_INVALID'?'กรุณาอัปเดตและ Deploy Apps Script เวอร์ชัน Calendar ก่อน':error.message},503);}
  }
  if (url.pathname === '/api/goals' && ['GET','POST'].includes(request.method)) {
    if (request.method === 'POST' && !(await validToken(request, env))) return json({error:'กรุณายืนยันว่าเป็นเท่ก่อนบันทึก'},401);
    const body=request.method==='POST'?await request.json().catch(()=>null):null;
    if(request.method==='POST' && (!Array.isArray(body?.changes)||!body.changes.length||body.changes.length>500))return json({error:'ข้อมูลไม่ถูกต้อง'},400);
    try { return json(await sheetRequest(env, {action:request.method==='GET'?'goals_list':'goals_apply',changes:body?.changes})); }
    catch(error){return json({error:error.message==='ACTION_INVALID'?'กรุณาอัปเดตและ Deploy Apps Script เวอร์ชัน Goals ก่อน':error.message},503);}
  }
  if (url.pathname === '/api/todos' && ['GET','POST'].includes(request.method)) {
    if (request.method === 'POST' && !(await validToken(request, env))) return json({error:'กรุณายืนยันว่าเป็นเท่ก่อนบันทึก'},401);
    const body=request.method==='POST'?await request.json().catch(()=>null):null;
    if(request.method==='POST' && (!Array.isArray(body?.changes)||body.changes.length>1000))return json({error:'ข้อมูลไม่ถูกต้อง'},400);
    try { return json(await sheetRequest(env, {action:request.method==='GET'?'todos_list':'todos_apply',changes:body?.changes,type:url.searchParams.get('type'),date:url.searchParams.get('date'),start:url.searchParams.get('start'),end:url.searchParams.get('end'),page:url.searchParams.get('page'),pageSize:url.searchParams.get('pageSize'),summary:url.searchParams.get('summary')==='1'})); }
    catch(error){return json({error:error.message==='ACTION_INVALID'?'กรุณาอัปเดตและ Deploy Apps Script เวอร์ชัน Todos ก่อน':error.message},503);}
  }
  if (url.pathname === '/api/wins' && ['GET','POST'].includes(request.method)) {
    if (request.method === 'POST' && !(await validToken(request, env))) return json({error:'กรุณายืนยันว่าเป็นเท่ก่อนบันทึก'},401);
    const body=request.method==='POST'?await request.json().catch(()=>null):null;
    if(request.method==='POST' && (!Array.isArray(body?.changes)||body.changes.length>1000))return json({error:'ข้อมูลไม่ถูกต้อง'},400);
    try { return json(await sheetRequest(env, {action:request.method==='GET'?'wins_list':'wins_apply',changes:body?.changes,date:url.searchParams.get('date'),start:url.searchParams.get('start'),end:url.searchParams.get('end'),page:url.searchParams.get('page'),pageSize:url.searchParams.get('pageSize'),summary:url.searchParams.get('summary')==='1'})); }
    catch(error){return json({error:error.message==='ACTION_INVALID'?'กรุณาอัปเดตและ Deploy Apps Script เวอร์ชัน SmallWins ก่อน':error.message},503);}
  }
  if (url.pathname === '/api/summaries' && ['GET','POST'].includes(request.method)) {
    if (request.method === 'POST' && !(await validToken(request, env))) return json({error:'กรุณายืนยันว่าเป็นเท่ก่อนบันทึก'},401);
    const body=request.method==='POST'?await request.json().catch(()=>null):null;
    const action=request.method==='GET'?'list':body?.action;
    if(!['list','upload','delete'].includes(action))return json({error:'ข้อมูลไม่ถูกต้อง'},400);
    if(action==='upload'&&(!body?.item?.title||!body?.file?.data))return json({error:'กรุณาเลือกไฟล์และตั้งชื่อสรุป'},400);
    try{return json(await sheetRequest(env,{action:'summaries_'+action,item:body?.item,file:body?.file,id:body?.id,page:url.searchParams.get('page'),pageSize:url.searchParams.get('pageSize'),category:url.searchParams.get('category'),query:url.searchParams.get('query')}));}
    catch(error){return json({error:error.message==='ACTION_INVALID'?'กรุณาอัปเดตและ Deploy Apps Script เวอร์ชัน Summaries ก่อน':error.message},503);}
  }
  if (url.pathname === "/api/activities" && request.method === "GET") {
    try {
      return json(await sheetRequest(env, { action:"list", page:url.searchParams.get('page'), pageSize:url.searchParams.get('pageSize'), skill:url.searchParams.get('skill'), query:url.searchParams.get('query') }));
    } catch (error) {
      return json({ error: error.message }, 503);
    }
  }
  if (url.pathname === "/api/dashboard" && request.method === "GET") {
    try{return json(await sheetRequest(env,{action:"dashboard_summary",refresh:url.searchParams.get("refresh")==="1"}));}
    catch(error){return json({error:error.message},503);}
  }
  if (url.pathname === "/api/activities" && request.method === "POST") {
    if (!(await validToken(request, env)))
      return json({ error: "กรุณายืนยันว่าเป็นเท่ก่อนบันทึก" }, 401);
    const item = await request.json().catch(() => null);
    if (!item?.topic) return json({ error: "กรุณาระบุหัวข้อที่ฝึก" }, 400);
    try {
      return json(await sheetRequest(env, { action: "append", item }));
    } catch (error) {
      return json({ error: error.message }, 503);
    }
  }
  if (
    url.pathname.startsWith("/api/activities/") &&
    request.method === "DELETE"
  ) {
    if (!(await validToken(request, env)))
      return json({ error: "กรุณายืนยันว่าเป็นเท่ก่อนลบ" }, 401);
    try {
      return json(
        await sheetRequest(env, {
          action: "delete",
          id: decodeURIComponent(url.pathname.slice("/api/activities/".length)),
        }),
      );
    } catch (error) {
      return json({ error: error.message }, 503);
    }
  }
  return json({ error: "ไม่พบ API" }, 404);
}
function staticResponse(path,request){
  const asset = STATIC_ASSETS[path] || STATIC_ASSETS['/index.html'];
  
  if (!asset) return new Response('Not found', { status: 404 });
  
  const body = decode64(asset.data);
  const ext = (path.split('.').pop() || 'html').toLowerCase();
  
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'content-type': mime[ext] || 'application/octet-stream',
      'cache-control': path === '/index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);
    return staticResponse(
      url.pathname === "/" ? "/index.html" : url.pathname,
      request,
    );
  },
};
