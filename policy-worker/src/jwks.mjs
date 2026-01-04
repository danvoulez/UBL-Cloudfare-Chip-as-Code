//! JWKS cache and ES256 verification for Edge Worker
//! Core API is source of truth; Worker caches with TTL

// JWKS_URL and JWKS_TTL will be read from env parameter

/**
 * Get JWKS from cache or fetch from Core API
 */
async function getJWKS(env, ctx) {
  const JWKS_URL = env.JWKS_URL || 'https://core.api.ubl.agency/auth/jwks.json';
  const JWKS_TTL = Number(env.JWKS_TTL_SECONDS ?? 300);
  
  const caches = ctx?.caches || globalThis.caches;
  const cache = caches.default;
  const req = new Request(JWKS_URL);
  
  // Try cache first
  let res = await cache.match(req);
  if (res) {
    return res.json();
  }
  
  // Fetch from Core API with Cloudflare cache
  res = await fetch(JWKS_URL, {
    cf: {
      cacheEverything: true,
      cacheTtl: JWKS_TTL,
    },
  });
  
  if (!res.ok) {
    throw new Error(`JWKS fetch failed: ${res.status}`);
  }
  
  // Cache the response
  await cache.put(req, res.clone());
  
  return res.json();
}

/**
 * Base64URL decode
 */
function b64uDec(s) {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const decoded = atob(base64 + padding);
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}

/**
 * Convert ES256 JOSE signature (r||s) to DER format
 */
function joseToDer(sig) {
  const r = sig.slice(0, 32);
  const s = sig.slice(32);
  
  const trim = (a) => {
    let i = 0;
    while (i < a.length - 1 && a[i] === 0) i++;
    return a.slice(i);
  };
  
  const toInt = (a) => {
    const t = trim(a);
    return (t[0] & 0x80) ? new Uint8Array([0, ...t]) : t;
  };
  
  const R = toInt(r);
  const S = toInt(s);
  const len = 2 + R.length + 2 + S.length;
  
  return new Uint8Array([0x30, len, 0x02, R.length, ...R, 0x02, S.length, ...S]);
}

/**
 * Verify ES256 JWT signature
 */
async function verifyES256(jwt, jwks) {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('INVALID_JWT_FORMAT');
  }
  
  const [h, p, s] = parts;
  
  // Decode header
  const header = JSON.parse(new TextDecoder().decode(b64uDec(h)));
  if (header.alg !== 'ES256') {
    throw new Error('ALG_NOT_ES256');
  }
  
  const kid = header.kid;
  if (!kid) {
    throw new Error('MISSING_KID');
  }
  
  // Find key in JWKS
  const key = jwks.keys.find(k => k.kid === kid && k.alg === 'ES256');
  if (!key) {
    throw new Error('KEY_NOT_FOUND');
  }
  
  // Import EC raw point from JWK x, y
  const x = b64uDec(key.x);
  const y = b64uDec(key.y);
  const uncompressed = new Uint8Array(1 + x.length + y.length);
  uncompressed[0] = 0x04; // uncompressed point marker
  uncompressed.set(x, 1);
  uncompressed.set(y, 1 + x.length);
  
  // Import key for verification
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    uncompressed,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  );
  
  // Verify signature
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sigJose = b64uDec(s);
  const sigDer = joseToDer(sigJose);
  
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    sigDer,
    data
  );
  
  if (!ok) {
    throw new Error('BAD_SIGNATURE');
  }
  
  // Decode payload
  const payload = JSON.parse(new TextDecoder().decode(b64uDec(p)));
  
  // Validate exp
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('TOKEN_EXPIRED');
  }
  
  return { header, payload };
}

/**
 * Auth check endpoint (for smoke tests)
 */
async function authCheckHandler(req, env, ctx) {
  try {
    const jwks = await getJWKS(env, ctx);
    return new Response(
      JSON.stringify({
        ok: true,
        kids: jwks.keys.map(k => k.kid),
        alg: jwks.keys[0]?.alg,
      }),
      {
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}

export { getJWKS, verifyES256, authCheckHandler };
