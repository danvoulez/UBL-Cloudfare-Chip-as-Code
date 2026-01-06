export interface Env {
  DEVICE_KV: KVNamespace;
  JWT_PRIVATE_JWK: string;
  JWT_PUBLIC_JWK: string;
  ALLOW_ORIGIN?: string;
}

type DeviceRecord = {
  device_code: string;
  user_code: string;
  scope?: string;
  audience?: string;
  adult?: boolean;
  approved?: boolean;
  subject?: string; // user id after login
  created_at: number;
  expires_at: number;
};

const JSON_HDR = { "content-type": "application/json" };

const cors = (env: Env) => (res: Response) => {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", env.ALLOW_ORIGIN || "*");
  h.set("access-control-allow-headers", "authorization, content-type");
  h.set("access-control-allow-methods", "GET,POST,OPTIONS");
  return new Response(res.body, { status: res.status, headers: h });
};

async function signJwtES256(payload: Record<string, any>, env: Env): Promise<string> {
  const privateJwk = JSON.parse(env.JWT_PRIVATE_JWK);
  const key = await crypto.subtle.importKey(
    "jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const base64url = (input: ArrayBuffer | Uint8Array | string) => {
    const bytes = typeof input === "string" ? new TextEncoder().encode(input) :
      (input instanceof ArrayBuffer ? new Uint8Array(input) : input);
    let str = "";
    for (let i=0;i<bytes.length;i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  };
  const header = { alg: "ES256", typ: "JWT" };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const der = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data));
  // Convert DER to JOSE (r|s)
  function derToJose(der: Uint8Array): string {
    if (der[0] !== 0x30) throw new Error("Invalid DER");
    let offset = 2; // skip 0x30,len
    if (der[offset] !== 0x02) throw new Error("Invalid DER (r)"); 
    const rLen = der[offset+1];
    const r = der.slice(offset+2, offset+2+rLen);
    offset = offset + 2 + rLen;
    if (der[offset] !== 0x02) throw new Error("Invalid DER (s)");
    const sLen = der[offset+1];
    const s = der.slice(offset+2, offset+2+sLen);
    const pad = (x: Uint8Array) => {
      const out = new Uint8Array(32);
      out.set(x.slice(Math.max(0, x.length-32)));
      return out;
    };
    const jose = new Uint8Array(64);
    jose.set(pad(r), 0);
    jose.set(pad(s), 32);
    return base64url(jose);
  }
  const sigB64 = derToJose(der);
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

function rand(n=6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i=0;i<n;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
  return s;
}

async function handleStart(req: Request, env: Env) {
  const { scope, audience, adult } = await req.json().catch(() => ({}));
  const now = Math.floor(Date.now()/1000);
  const device_code = crypto.randomUUID();
  const user_code = rand(6);
  const rec: DeviceRecord = {
    device_code, user_code, scope, audience, adult: !!adult,
    approved: false, created_at: now, expires_at: now + 600
  };
  await env.DEVICE_KV.put(`device:${device_code}`, JSON.stringify(rec), { expirationTtl: 600 });
  await env.DEVICE_KV.put(`user:${user_code}`, device_code, { expirationTtl: 600 });
  const host = new URL(req.url).host; // should be id.ubl.agency
  const base = `https://${host}`;
  return new Response(JSON.stringify({
    device_code, user_code,
    verification_uri: `${base}/activate`,
    verification_uri_complete: `${base}/activate?code=${user_code}`,
    expires_in: 600, interval: 5
  }), { headers: JSON_HDR });
}

async function handleApprove(req: Request, env: Env) {
  // In production: require authenticated user session (passkey).
  // For now expect JSON { user_code, subject } from authenticated channel.
  const { user_code, subject } = await req.json();
  if (!user_code || !subject) return new Response(JSON.stringify({ ok:false, error:"missing user_code or subject" }), { headers: JSON_HDR, status: 400 });
  const device_code = await env.DEVICE_KV.get(`user:${user_code}`);
  if (!device_code) return new Response(JSON.stringify({ ok:false, error:"invalid_or_expired_user_code" }), { headers: JSON_HDR, status: 404 });
  const key = `device:${device_code}`;
  const recRaw = await env.DEVICE_KV.get(key);
  if (!recRaw) return new Response(JSON.stringify({ ok:false, error:"expired" }), { headers: JSON_HDR, status: 404 });
  const rec: DeviceRecord = JSON.parse(recRaw);
  rec.approved = true;
  rec.subject = String(subject);
  await env.DEVICE_KV.put(key, JSON.stringify(rec), { expirationTtl: Math.max(1, rec.expires_at - Math.floor(Date.now()/1000)) });
  return new Response(JSON.stringify({ ok:true }), { headers: JSON_HDR });
}

async function handlePoll(req: Request, env: Env) {
  const { device_code } = await req.json();
  if (!device_code) return new Response(JSON.stringify({ ok:false, error:"missing_device_code" }), { headers: JSON_HDR, status: 400 });
  const recRaw = await env.DEVICE_KV.get(`device:${device_code}`);
  if (!recRaw) return new Response(JSON.stringify({ ok:false, status:"expired" }), { headers: JSON_HDR, status: 404 });
  const rec: DeviceRecord = JSON.parse(recRaw);
  if (!rec.approved) return new Response(JSON.stringify({ ok:true, status:"pending" }), { headers: JSON_HDR });
  const now = Math.floor(Date.now()/1000);
  const iss = `https://${new URL(req.url).host}`;
  const payload = {
    iss, sub: rec.subject, aud: rec.audience || "office",
    iat: now, exp: now + 900, scope: rec.scope || "default", adult: !!rec.adult,
  };
  const access_token = await signJwtES256(payload, env);
  // Optional: short refresh with same sub
  const refresh_payload = { iss, sub: rec.subject, iat: now, exp: now + 86400, typ: "refresh" };
  const refresh_token = await signJwtES256(refresh_payload, env);
  // cleanup
  await env.DEVICE_KV.delete(`device:${device_code}`);
  return new Response(JSON.stringify({ ok:true, access_token, refresh_token, token_type:"Bearer", expires_in: 900 }), { headers: JSON_HDR });
}

async function handleJWKS(env: Env) {
  const pub = JSON.parse(env.JWT_PUBLIC_JWK);
  return new Response(JSON.stringify({ keys: [pub] }), { headers: JSON_HDR });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return cors(env)(new Response(null, { headers: { "access-control-allow-origin": env.ALLOW_ORIGIN || "*" } }));
    const url = new URL(req.url);
    try {
      if (url.pathname === "/healthz") return cors(env)(new Response("ok"));
      if (url.pathname === "/.well-known/jwks.json" || url.pathname === "/auth/jwks.json") return cors(env)(await handleJWKS(env));
      if (url.pathname === "/device/start" && req.method === "POST") return cors(env)(await handleStart(req, env));
      if (url.pathname === "/device/approve" && req.method === "POST") return cors(env)(await handleApprove(req, env));
      if (url.pathname === "/device/poll" && req.method === "POST") return cors(env)(await handlePoll(req, env));
      if (url.pathname === "/activate" && req.method === "GET") {
        const code = url.searchParams.get("code") || "";
        const html = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;padding:24px;max-width:560px;margin:0 auto}</style><h1>Authenticate</h1><p>Enter this code after logging in: <b>${code || "—"}</b></p><p>POST to <code>/device/approve</code> with <code>{"user_code":"${code}","subject":"&lt;user-id&gt;"}</code> after passkey login.</p>`;
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return cors(env)(new Response(JSON.stringify({ ok:false, error:"not_found" }), { headers: JSON_HDR, status: 404 }));
    } catch (e:any) {
      return cors(env)(new Response(JSON.stringify({ ok:false, error: e?.message || "internal_error" }), { headers: JSON_HDR, status: 500 }));
    }
  }
}
