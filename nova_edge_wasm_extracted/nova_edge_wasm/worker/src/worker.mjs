// Edge Worker using the WASM policy engine for Chip-as-Code decisions
// Expects: KV 'UBL_FLAGS' keys: policy_pack (signed), policy_yaml (raw YAML)

// Warmup: pré-carrega e valida política na inicialização
let warmupDone = false;
let warmupError = null;
let warmupBlake3 = null;

async function warmup(env) {
  if (warmupDone) return { ok: true, error: warmupError, blake3: warmupBlake3 || null };
  
  try {
    // 1. Carregar pack e YAML
    const packRaw = await env.UBL_FLAGS.get("policy_pack");
    const yaml = await env.UBL_FLAGS.get("policy_yaml");
    if (!packRaw || !yaml) {
      warmupError = "policy_missing";
      return { ok: false, error: warmupError };
    }
    
    const pack = JSON.parse(packRaw);
    
    // 2. Verificar assinatura
    await verifyPack(pack, env.POLICY_PUBKEY_B64);
    
    // 3. Inicializar WASM
    const wasm = await getEngine(env);
    initPolicyWasm(wasm, yaml);
    wasm.__inited = true;
    
    warmupDone = true;
    warmupError = null;
    warmupBlake3 = pack.blake3 || null;
    return { ok: true, error: null, blake3: warmupBlake3 };
  } catch (e) {
    warmupError = e.message || "warmup_failed";
    warmupDone = false;
    return { ok: false, error: warmupError };
  }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Warmup endpoint
    if (path === "/warmup" || path === "/_warmup") {
      const result = await warmup(env);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 503,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Health check
    if (path === "/health") {
      return new Response(JSON.stringify({
        warmup: warmupDone,
        error: warmupError,
        engine_ready: warmupDone
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1) Verify Access (JWT must exist); in production reuse your existing verifyAccess()
    const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
    if (!jwt) return new Response("access_required", { status: 401 });

    // 2) Se warmup não foi feito, fazer agora (fallback)
    if (!warmupDone) {
      const warmupResult = await warmup(env);
      if (!warmupResult.ok) {
        return new Response(`warmup_failed: ${warmupResult.error}`, { status: 503 });
      }
    }
    
    // 3) WASM já está inicializado pelo warmup
    const wasm = await getEngine(env);

    // 4) Build context from Access headers
    const email = req.headers.get("CF-Access-Authenticated-User-Email") || "";
    const groupsHdr = req.headers.get("CF-Access-Groups") || "";
    const groups = groupsHdr.split(",").map(s=>s.trim()).filter(Boolean);
    const isAdminPath = path.startsWith("/admin/");
    const isWrite = ["POST","PUT","PATCH","DELETE"].includes(req.method);

    // panic flag from KV (optional mirror of DO)
    const panic = (await env.UBL_FLAGS.get("panic_active")) === "true";

    const ctxJson = JSON.stringify({
      transport: { tls_version: 1.3 },
      mtls: { verified: true, issuer: "Cloudflare Edge" },
      auth: { method: "access-passkey", rp_id: "app.ubl.agency" },
      user: { groups },
      system: { panic_mode: panic },
      who: email, did: `${req.method} ${path}`, req_id: req.headers.get("CF-Ray")
    });

    const dec = decideWasm(wasm, ctxJson);

    // Short-circuit on deny
    if (dec.decision.startsWith("deny")) {
      return new Response("policy_denied", { status: 403 });
    }

    // Forward to upstream (tunnel hostname) with identity hints
    const upstream = env.UPSTREAM_HOST || "https://nova-upstream.api.ubl.agency";
    const u = new URL(upstream);
    u.pathname = path; u.search = url.search;
    const hdr = new Headers(req.headers);
    hdr.set("X-Auth-Method","access-passkey");
    hdr.set("X-Auth-Rpid","app.ubl.agency");
    hdr.set("X-User-Groups", groups.join(","));
    hdr.set("X-Who", email);
    const fwdReq = new Request(u.toString(), { method: req.method, headers: hdr, body: ["GET","HEAD"].includes(req.method) ? undefined : await req.arrayBuffer() });
    const res = await fetch(fwdReq, { cf: { cacheTtl: 0 } });
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
  const { instance } = await WebAssembly.instantiate(env.ENGINE, {});
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
