const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
const textEncoder = new TextEncoder();
const mime = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  png: "image/png",
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
        exp: Date.now() + 180 * 24 * 60 * 60 * 1000,
      }),
    ),
  );
  return `${payload}.${await sign(payload, secret)}`;
}
async function validToken(request, env) {
  const token = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
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
    return data.sub === "tae" && data.exp > Date.now();
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
  if (url.pathname === "/api/status")
    return json({
      configured: Boolean(env.GOOGLE_APPS_SCRIPT_URL),
      sheetId: env.GOOGLE_SHEET_ID || null,
    });
  if (url.pathname === "/api/auth" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!env.TAE_ACCESS_CODE || !env.SESSION_SECRET)
      return json({ error: "ระบบยืนยันตัวยังไม่ได้ตั้งค่า" }, 503);
    if (!same(String(body.code || ""), String(env.TAE_ACCESS_CODE)))
      return json({ error: "รหัสยืนยันไม่ถูกต้อง" }, 401);
    return json({ ok: true, token: await issueToken(env.SESSION_SECRET) });
  }
  if (url.pathname === "/api/activities" && request.method === "GET") {
    try {
      return json(await sheetRequest(env, { action: "list" }));
    } catch (error) {
      return json({ error: error.message }, 503);
    }
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
