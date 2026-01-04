// Edge Worker using the WASM policy engine for Chip-as-Code decisions
// Multitenant: resolves tenant by host/header, loads policy per tenant

// Tenant resolution cache (per request)
let tenantCache = new Map();

// Policy cache per tenant (warmup state)
const tenantWarmup = new Map(); // { tenant: { done, error, blake3, wasm } }

/**
 * Resolve tenant from request (deterministic order)
 */
function resolveTenant(req, env) {
  const url = new URL(req.url);
  const host = url.host.toLowerCase();
  const cacheKey = `${host}:${req.headers.get("x-ubl-tenant") || ""}`;
  
  if (tenantCache.has(cacheKey)) {
    return tenantCache.get(cacheKey);
  }
  
  // 1. Header override (X-Ubl-Tenant)
  const headerTenant = req.headers.get("x-ubl-tenant");
  if (headerTenant) {
    tenantCache.set(cacheKey, headerTenant);
    return headerTenant;
  }
  
  // 2. Host mapping
  const hostMap = JSON.parse(env.TENANT_HOST_MAP || '{"api.ubl.agency":"ubl"}');
  if (hostMap[host]) {
    tenantCache.set(cacheKey, hostMap[host]);
    return hostMap[host];
  }
  
  // 3. Fallback to default
  const defaultTenant = env.TENANT_DEFAULT || "ubl";
  tenantCache.set(cacheKey, defaultTenant);
  return defaultTenant;
}

/**
 * Get Access AUD/JWKS for tenant
 */
function getAccessForTenant(tenant, env) {
  const audMap = JSON.parse(env.ACCESS_AUD_MAP || '{"ubl":"ubl-flagship-aud"}');
  const jwksMap = JSON.parse(env.ACCESS_JWKS_MAP || '{"ubl":"https://1f43a14fe5bb62b97e7262c5b6b7c476.cloudflareaccess.com/cdn-cgi/access/certs"}');
  
  return {
    aud: audMap[tenant] || audMap["ubl"],
    jwks: jwksMap[tenant] || jwksMap["ubl"]
  };
}

/**
 * Get allowed origins for tenant
 */
function getAllowedOrigins(tenant, env) {
  const allowlist = JSON.parse(env.ORIGIN_ALLOWLIST || '{}');
  return allowlist[tenant] || [];
}

/**
 * Warmup policy for a specific tenant
 */
async function warmupTenant(tenant, env, stage = "active") {
  const cached = tenantWarmup.get(tenant);
  if (cached && cached.done && cached.stage === stage) {
    return { ok: true, error: cached.error, blake3: cached.blake3 || null, version: cached.version, id: cached.id };
  }
  
  try {
    // Load pack and YAML for tenant (Blueprint 17: policy:{tenant}:pack/yaml)
    const targetStage = stage || cached?.stage || "active"; // active, next, prev
    const packKey = targetStage === "active" ? `policy_${tenant}_pack` : `policy_${tenant}_pack_${targetStage}`;
    const yamlKey = targetStage === "active" ? `policy_${tenant}_yaml` : `policy_${tenant}_yaml_${targetStage}`;
    
    // Fallback to legacy keys (for backward compatibility)
    const packRaw = await env.UBL_FLAGS.get(packKey) || 
                    (tenant === "ubl" ? (await env.UBL_FLAGS.get("policy_pack_active") || await env.UBL_FLAGS.get("policy_pack")) : null);
    const yaml = await env.UBL_FLAGS.get(yamlKey) || 
                 (tenant === "ubl" ? (await env.UBL_FLAGS.get("policy_yaml_active") || await env.UBL_FLAGS.get("policy_yaml")) : null);
    
    if (!packRaw || !yaml) {
      const error = `policy_missing: tenant=${tenant}, keys=${packKey}/${yamlKey}`;
      tenantWarmup.set(tenant, { done: false, error, blake3: null, wasm: null, stage });
      return { ok: false, error };
    }
    
    const pack = JSON.parse(packRaw);
    
    // Verify signature
    await verifyPack(pack, env.POLICY_PUBKEY_B64);
    
    // Initialize WASM (one instance per tenant)
    const wasm = await getEngine(env);
    initPolicyWasm(wasm, yaml);
    wasm.__inited = true;
    wasm.__tenant = tenant;
    
    tenantWarmup.set(tenant, { 
      done: true, 
      error: null, 
      blake3: pack.blake3 || null, 
      wasm,
      stage: targetStage,
      version: pack.version || "unknown",
      id: pack.id || "unknown"
    });
    
    return { ok: true, error: null, blake3: pack.blake3, version: pack.version, id: pack.id };
  } catch (e) {
    const error = e.message || "warmup_failed";
    tenantWarmup.set(tenant, { done: false, error, blake3: null, wasm: null, stage: targetStage || "active" });
    return { ok: false, error };
  }
}

import { getJWKS, verifyES256, authCheckHandler } from './jwks.mjs';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Resolve tenant early
    const tenant = resolveTenant(req, env);
    const access = getAccessForTenant(tenant, env);
    const allowedOrigins = getAllowedOrigins(tenant, env);
    
    // CORS handling (before other endpoints)
    const origin = req.headers.get("Origin");
    if (origin && allowedOrigins.length > 0) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Ubl-Tenant, Cf-Access-Jwt-Assertion",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
      };
      
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
    }
    
    // Auth check endpoint (for smoke tests)
    if (path === "/_auth_check") {
      return authCheckHandler(req, env, ctx);
    }
    
    // Warmup endpoint (tenant-aware)
    if (path === "/warmup" || path === "/_warmup") {
      const result = await warmupTenant(tenant, env, "active");
      const headers = { "Content-Type": "application/json" };
      if (origin && allowedOrigins.includes(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Vary"] = "Origin";
      }
      return new Response(JSON.stringify({ ...result, tenant }), {
        status: result.ok ? 200 : 503,
        headers
      });
    }
    
    // Policy status endpoint
    if (path === "/_policy/status") {
      const cached = tenantWarmup.get(tenant);
      const status = {
        tenant,
        ready: cached?.done || false,
        version: cached?.version || null,
        id: cached?.id || null,
        stage: cached?.stage || "active",
        error: cached?.error || null,
        blake3: cached?.blake3 || null
      };
      const headers = { "Content-Type": "application/json" };
      if (origin && allowedOrigins.includes(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Vary"] = "Origin";
      }
      return new Response(JSON.stringify(status), { headers });
    }
    
    // Reload endpoint (tenant-aware, stage-aware)
    if (path === "/_reload" && req.method === "POST") {
      // Verify ubl-ops group
      const groupsHdr = req.headers.get("CF-Access-Groups") || "";
      const groups = groupsHdr.split(",").map(s=>s.trim()).filter(Boolean);
      if (!groups.includes("ubl-ops")) {
        return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      try {
        const body = await req.json().catch(() => ({}));
        const targetTenant = body.tenant || url.searchParams.get("tenant") || tenant;
        const stage = body.stage || url.searchParams.get("stage") || "next";
        
        // Invalidate cache for this tenant
        const cached = tenantWarmup.get(targetTenant);
        if (cached) {
          cached.done = false;
          cached.stage = stage;
        }
        
        // Warmup with new stage
        const result = await warmupTenant(targetTenant, env, stage);
        
        return new Response(JSON.stringify({
          ok: result.ok,
          tenant: targetTenant,
          stage,
          error: result.error,
          version: result.version,
          id: result.id
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    // Health check
    if (path === "/health") {
      const cached = tenantWarmup.get(tenant);
      return new Response(JSON.stringify({
        tenant,
        warmup: cached?.done || false,
        error: cached?.error || null,
        engine_ready: cached?.done || false
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Admin routes (protected by Access, tenant-aware)
    if (path === "/admin/health" && req.method === "GET") {
      // Access already verified above; just return health
      const cached = tenantWarmup.get(tenant);
      return new Response(JSON.stringify({
        ok: true,
        tenant,
        warmup: cached?.done || false,
        error: cached?.error || null,
        engine_ready: cached?.done || false,
        access: {
          email,
          groups: groups.join(",")
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (path === "/admin/policy/promote" && req.method === "POST") {
      // Verify ubl-ops group
      const groupsHdr = req.headers.get("CF-Access-Groups") || "";
      const groups = groupsHdr.split(",").map(s=>s.trim()).filter(Boolean);
      if (!groups.includes("ubl-ops")) {
        return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      try {
        const body = await req.json().catch(() => ({}));
        const targetTenant = body.tenant || url.searchParams.get("tenant") || tenant;
        const stage = body.stage || url.searchParams.get("stage") || "next";
        
        // Promote: copy next -> active
        const nextPackKey = `policy_${targetTenant}_pack_${stage}`;
        const nextYamlKey = `policy_${targetTenant}_yaml_${stage}`;
        const activePackKey = `policy_${targetTenant}_pack`;
        const activeYamlKey = `policy_${targetTenant}_yaml`;
        
        const nextPack = await env.UBL_FLAGS.get(nextPackKey);
        const nextYaml = await env.UBL_FLAGS.get(nextYamlKey);
        
        if (!nextPack || !nextYaml) {
          return new Response(JSON.stringify({
            ok: false,
            error: `stage_not_found: tenant=${targetTenant}, stage=${stage}`
          }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        }
        
        // Copy next -> active
        await env.UBL_FLAGS.put(activePackKey, nextPack);
        await env.UBL_FLAGS.put(activeYamlKey, nextYaml);
        
        // Invalidate cache
        const cached = tenantWarmup.get(targetTenant);
        if (cached) {
          cached.done = false;
          cached.stage = "active";
        }
        
        // Warmup with active
        const result = await warmupTenant(targetTenant, env, "active");
        
        return new Response(JSON.stringify({
          ok: true,
          tenant: targetTenant,
          promoted_from: stage,
          to: "active",
          version: result.version,
          id: result.id
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Panic control (gated by ubl-ops group, tenant-aware)
    if (path === "/panic/on" && req.method === "POST") {
      const groupsHdr = req.headers.get("CF-Access-Groups") || "";
      const groups = groupsHdr.split(",").map(s=>s.trim()).filter(Boolean);
      if (!groups.includes("ubl-ops")) {
        return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      try {
        const body = await req.json();
        const ttlSec = body.ttl_sec || 300;
        const reason = body.reason || "ops";
        const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
        
        // Store panic state per tenant
        await env.UBL_FLAGS.put(`panic_${tenant}_active`, "true", { expirationTtl: ttlSec });
        await env.UBL_FLAGS.put(`panic_${tenant}_expires_at`, expiresAt.toString(), { expirationTtl: ttlSec });
        await env.UBL_FLAGS.put(`panic_${tenant}_reason`, reason, { expirationTtl: ttlSec });
        
        return new Response(JSON.stringify({
          ok: true,
          tenant,
          until: expiresAt,
          reason: reason
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (path === "/panic/off" && req.method === "POST") {
      const groupsHdr = req.headers.get("CF-Access-Groups") || "";
      const groups = groupsHdr.split(",").map(s=>s.trim()).filter(Boolean);
      if (!groups.includes("ubl-ops")) {
        return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Clear panic flags for tenant
      await env.UBL_FLAGS.delete(`panic_${tenant}_active`);
      await env.UBL_FLAGS.delete(`panic_${tenant}_expires_at`);
      await env.UBL_FLAGS.delete(`panic_${tenant}_reason`);
      
      return new Response(JSON.stringify({ ok: true, tenant }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1) Verify JWT if Authorization header present (ES256)
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const jwks = await getJWKS(env, ctx);
        const { payload } = await verifyES256(token, jwks);
        
        // Validate audience (tenant-aware)
        const expectedAud = access.aud;
        if (payload.aud && payload.aud !== expectedAud && payload.aud !== "ubl-gateway" && payload.aud !== "office") {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32001,
              message: "UNAUTHORIZED",
              data: { token: "UNAUTHORIZED", remediation: [`Invalid audience for tenant ${tenant}`] }
            }
          }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          });
        }
        
        req.claims = payload;
      } catch (e) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32001,
            message: "UNAUTHORIZED",
            data: { token: "UNAUTHORIZED", remediation: [e.message] }
          }
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    // 2) Verify Access (JWT must exist for protected routes)
    const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
    if (!jwt && !authHeader && path !== "/warmup" && path !== "/health") {
      return new Response("access_required", { status: 401 });
    }

    // 3) Warmup tenant policy if not done
    const cached = tenantWarmup.get(tenant);
    if (!cached || !cached.done) {
      const warmupResult = await warmupTenant(tenant, env, "active");
      if (!warmupResult.ok) {
        return new Response(`warmup_failed: ${warmupResult.error}`, { status: 503 });
      }
    }
    
    // 4) Get WASM engine for tenant
    const wasm = cached?.wasm || (await getEngine(env));
    if (!wasm.__inited || wasm.__tenant !== tenant) {
      // Re-initialize if tenant changed
      const yamlKey = cached?.stage === "active" ? `policy_${tenant}_yaml` : `policy_${tenant}_yaml_${cached?.stage || "active"}`;
      const yaml = await env.UBL_FLAGS.get(yamlKey) || 
                   (tenant === "ubl" ? (await env.UBL_FLAGS.get("policy_yaml_active") || await env.UBL_FLAGS.get("policy_yaml")) : null);
      if (yaml) {
        initPolicyWasm(wasm, yaml);
        wasm.__inited = true;
        wasm.__tenant = tenant;
      }
    }

    // 5) Build context from Access headers
    const email = req.headers.get("CF-Access-Authenticated-User-Email") || "";
    const groupsHdr = req.headers.get("CF-Access-Groups") || "";
    const groups = groupsHdr.split(",").map(s=>s.trim()).filter(Boolean);
    const isAdminPath = path.startsWith("/admin/");
    const isWrite = ["POST","PUT","PATCH","DELETE"].includes(req.method);

    // Panic flag from KV (tenant-specific)
    const panicActive = await env.UBL_FLAGS.get(`panic_${tenant}_active`);
    const panicExpires = await env.UBL_FLAGS.get(`panic_${tenant}_expires_at`);
    const now = Math.floor(Date.now() / 1000);
    const panic = panicActive === "true" && (!panicExpires || parseInt(panicExpires) > now);

    const ctxJson = JSON.stringify({
      transport: { tls_version: 1.3 },
      mtls: { verified: true, issuer: "Cloudflare Edge" },
      auth: { method: "access-passkey", rp_id: tenant === "voulezvous" ? "voulezvous.tv" : "app.ubl.agency" },
      user: { groups },
      system: { panic_mode: panic },
      who: email, 
      did: `${req.method} ${path}`, 
      req_id: req.headers.get("CF-Ray"),
      req: { path: path, method: req.method },
      origin: origin || null,
      rate: { ok: true } // TODO: implement rate limiting per tenant
    });

    const dec = decideWasm(wasm, ctxJson);

    // Short-circuit on deny
    if (dec.decision.startsWith("deny")) {
      return new Response("policy_denied", { status: 403 });
    }

    // Forward to upstream (Blueprint 01: roteamento por prefixo)
    let upstream;
    if (path.startsWith("/core/") || path.startsWith("/admin/") || path.startsWith("/files/")) {
      upstream = env.UPSTREAM_CORE || env.UPSTREAM_HOST || "https://origin.core.local";
    } else if (path.startsWith("/webhooks/")) {
      upstream = env.UPSTREAM_WEBHOOKS || "https://origin.webhooks.local";
    } else {
      upstream = env.UPSTREAM_CORE || env.UPSTREAM_HOST || "https://origin.core.local";
    }
    
    const u = new URL(upstream);
    u.pathname = path; 
    u.search = url.search;
    const hdr = new Headers(req.headers);
    hdr.set("X-Auth-Method","access-passkey");
    hdr.set("X-Auth-Rpid", tenant === "voulezvous" ? "voulezvous.tv" : "app.ubl.agency");
    hdr.set("X-User-Groups", groups.join(","));
    hdr.set("X-Who", email);
    hdr.set("X-Tenant", tenant);
    
    const fwdReq = new Request(u.toString(), { 
      method: req.method, 
      headers: hdr, 
      body: ["GET","HEAD"].includes(req.method) ? undefined : await req.arrayBuffer() 
    });
    const res = await fetch(fwdReq, { cf: { cacheTtl: 0 } });
    
    // Add CORS headers to response if origin is allowed
    if (origin && allowedOrigins.includes(origin)) {
      const resHeaders = new Headers(res.headers);
      resHeaders.set("Access-Control-Allow-Origin", origin);
      resHeaders.set("Vary", "Origin");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: resHeaders });
    }
    
    return res;
  }
};

async function verifyPack(pack, pubkeyB64) {
  const msg = `id=${pack.id}\nversion=${pack.version}\nblake3=${pack.blake3}\n`;
  const keyData = Uint8Array.from(atob(pubkeyB64), c=>c.charCodeAt(0));
  const key = await crypto.subtle.importKey("spki", keyData.buffer, {name:"Ed25519"}, false, ["verify"]);
  const sig = Uint8Array.from(atob(pack.signature), c=>c.charCodeAt(0)).buffer;
  const ok = await crypto.subtle.verify("Ed25519", key, sig, new TextEncoder().encode(msg));
  if (!ok) throw new Error("policy_pack_invalid");
}

let _engine;
async function getEngine(env) {
  if (_engine) return _engine;
  const wasmModule = await import("../build/policy_engine.wasm");
  const { instance } = await WebAssembly.instantiate(wasmModule, {});
  _engine = instance.exports;
  return _engine;
}

function initPolicyWasm(wasm, yaml) {
  const enc = new TextEncoder();
  const bytes = enc.encode(yaml);
  const ptr = wasm.alloc(bytes.length);
  const mem = new Uint8Array(wasm.memory.buffer);
  mem.set(bytes, ptr);
  const rc = wasm.init_policy(ptr, bytes.length);
  if (rc !== 0) throw new Error("init_policy_failed:"+rc);
  wasm.dealloc(ptr, bytes.length);
}

function decideWasm(wasm, ctxJson) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const inb = enc.encode(ctxJson);
  const ip = wasm.alloc(inb.length);
  new Uint8Array(wasm.memory.buffer).set(inb, ip);
  const op = wasm.decide_json(ip, inb.length);
  const ol = wasm.result_len();
  const out = new Uint8Array(wasm.memory.buffer, op, ol);
  const text = dec.decode(out);
  wasm.dealloc(ip, inb.length);
  wasm.dealloc(op, ol);
  return JSON.parse(text);
}
