export const config = { runtime: 'edge' };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

const textEncoder = new TextEncoder();

const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const decode64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let value = 0;
  for (let i = 0; i < a.length; i++) value |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return value === 0;
};

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload))));
}

async function issueToken(secret) {
  const payload = base64url(
    textEncoder.encode(JSON.stringify({ sub: 'tae', exp: Date.now() + 180 * 24 * 60 * 60 * 1000 })),
  );
  return `${payload}.${await sign(payload, secret)}`;
}

async function validToken(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [payload, signature] = token.split('.');
  const secret = process.env.SESSION_SECRET;
  if (!payload || !signature || !secret || !same(signature, await sign(payload, secret))) return false;
  try {
    const data = JSON.parse(
      new TextDecoder().decode(
        decode64(payload.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((payload.length + 3) % 4)),
      ),
    );
    return data.sub === 'tae' && data.exp > Date.now();
  } catch {
    return false;
  }
}

async function sheetRequest(payload) {
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl || !/^https:\/\/script\.google\.com\//.test(scriptUrl)) {
    throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_APPS_SCRIPT_URL');
  }
  const response = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: JSON.stringify({ ...payload, secret: process.env.GOOGLE_APPS_SCRIPT_SECRET }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.error || 'Google Sheet ตอบกลับไม่สำเร็จ');
  return result;
}

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/status') {
    return json({
      configured: Boolean(process.env.GOOGLE_APPS_SCRIPT_URL),
      sheetId: process.env.GOOGLE_SHEET_ID || null,
    });
  }

  if (path === '/api/auth' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!process.env.TAE_ACCESS_CODE || !process.env.SESSION_SECRET) {
      return json({ error: 'ระบบยืนยันตัวยังไม่ได้ตั้งค่า' }, 503);
    }
    if (!same(String(body.code || ''), String(process.env.TAE_ACCESS_CODE))) {
      return json({ error: 'รหัสยืนยันไม่ถูกต้อง' }, 401);
    }
    return json({ ok: true, token: await issueToken(process.env.SESSION_SECRET) });
  }

  if (url.pathname === '/api/flashcards' && ['GET','POST'].includes(request.method)) {
    if(request.method==='POST' && !(await validToken(request)))return json({error:'กรุณายืนยันว่าเป็นเท่ก่อนบันทึก'},401);
    const body=request.method==='POST'?await request.json().catch(()=>null):null;
    const action=request.method==='GET'?'list':body?.action;
    if(!['list','upsert','delete','review','import','uploadImage'].includes(action))return json({error:'ไม่พบการทำงานนี้'},400);
    if(request.method==='POST'&&action==='list')return json({error:'ใช้ GET เพื่ออ่านคำศัพท์'},400);
    try{return json(await sheetRequest({action:'cards_'+action,card:body?.card,cards:body?.cards,id:body?.id,remembered:body?.remembered,reviewId:body?.reviewId,image:body?.image}));}
    catch(error){return json({error:error.message==='ACTION_INVALID'?'กรุณาอัปเดต Apps Script ให้รองรับ Vocabulary ก่อน':error.message},503);}
  }
  if (url.pathname === '/api/wins' && ['GET','POST'].includes(request.method)) {
    if (request.method === 'POST' && !(await validToken(request))) return json({error:'กรุณายืนยันว่าเป็นเท่ก่อนบันทึก'},401);
    const body=request.method==='POST'?await request.json().catch(()=>null):null;
    if(request.method==='POST' && (!Array.isArray(body?.changes)||body.changes.length>1000))return json({error:'ข้อมูลไม่ถูกต้อง'},400);
    try { return json(await sheetRequest({action:request.method==='GET'?'wins_list':'wins_apply',changes:body?.changes})); }
    catch(error){return json({error:error.message==='ACTION_INVALID'?'กรุณาอัปเดตและ Deploy Apps Script เวอร์ชัน SmallWins ก่อน':error.message},503);}
  }
  if (path === '/api/activities' && request.method === 'GET') {
    try {
      return json(await sheetRequest({ action: 'list' }));
    } catch (error) {
      return json({ error: error.message }, 503);
    }
  }

  if (path === '/api/activities' && request.method === 'POST') {
    if (!(await validToken(request))) return json({ error: 'กรุณายืนยันว่าเป็นเท่ก่อนบันทึก' }, 401);
    const item = await request.json().catch(() => null);
    if (item?._action === 'delete') {
      if (!item.id) return json({ error: 'ไม่พบรายการที่จะลบ' }, 400);
      try {
        return json(await sheetRequest({ action: 'delete', id: String(item.id) }));
      } catch (error) {
        return json({ error: error.message }, 503);
      }
    }
    if (!item?.topic) return json({ error: 'กรุณาระบุหัวข้อที่ฝึก' }, 400);
    try {
      return json(await sheetRequest({ action: 'append', item }));
    } catch (error) {
      return json({ error: error.message }, 503);
    }
  }

  if (path.startsWith('/api/activities/') && request.method === 'DELETE') {
    if (!(await validToken(request))) return json({ error: 'กรุณายืนยันว่าเป็นเท่ก่อนลบ' }, 401);
    try {
      return json(
        await sheetRequest({
          action: 'delete',
          id: decodeURIComponent(path.slice('/api/activities/'.length)),
        }),
      );
    } catch (error) {
      return json({ error: error.message }, 503);
    }
  }

  return json({ error: 'ไม่พบ API' }, 404);
}
