// UBL Flagship Edge Worker — TDLN WASM + JWKS + DO + KV + Queues

export interface Env {
  POLICY_KV: KVNamespace;
  BREAKGLASS_DO: DurableObjectNamespace<BreakGlassDO>;
  EVENT_QUEUE: Queue<PolicyEvent>;
  PUBLIC_KEY: string; // Ed25519 public key (base64)
  R2_BUCKET: R2Bucket;
}

interface PolicyEvent {
  timestamp: number;
  user_email?: string;
  path: string;
  method: string;
  decision: boolean;
  reason: string;
  eval_ms: number;
  bits: number;
}

// Durable Object para break-glass
export class BreakGlassDO implements DurableObject {
  state: DurableObjectState;
  env: Env;
  
  active: boolean = false;
  reason: string = "";
  until: number = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Carregar estado persistido
    this.state.storage.get<{active: boolean; reason: string; until: number}>("breakglass")
      .then(data => {
        if (data) {
          this.active = data.active;
          this.reason = data.reason;
          this.until = data.until;
        }
      });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.method === "GET") {
      // Ler estado
      return Response.json({
        active: this.active && (this.until === 0 || Date.now() / 1000 < this.until),
        reason: this.reason,
        until: this.until,
      });
    }
    
    if (request.method === "POST") {
      // Ativar/desativar break-glass
      const body = await request.json<{active: boolean; reason: string; ttl_seconds?: number}>();
      
      this.active = body.active;
      this.reason = body.reason || "";
      this.until = body.active && body.ttl_seconds
        ? Math.floor(Date.now() / 1000) + body.ttl_seconds
        : 0;
      
      await this.state.storage.put("breakglass", {
        active: this.active,
        reason: this.reason,
        until: this.until,
      });
      
      return Response.json({ success: true });
    }
    
    return new Response("Method not allowed", { status: 405 });
  }
}

// Cache JWKS (sem rede síncrona)
let jwksCache: { keys: any[]; expires: number } | null = null;
const JWKS_CACHE_TTL = 3600 * 1000; // 1 hora

async function getJWKS(): Promise<any[]> {
  if (jwksCache && Date.now() < jwksCache.expires) {
    return jwksCache.keys;
  }
  
  // Em produção, buscar do Access JWKS endpoint
  // Por ora, retornar cache vazio (será implementado com Access real)
  const keys: any[] = [];
  jwksCache = { keys, expires: Date.now() + JWKS_CACHE_TTL };
  return keys;
}

async function verifyAccessToken(token: string): Promise<{email?: string; groups?: string[]} | null> {
  // Em produção: verificar JWT com JWKS
  // Por ora, extrair do header CF-Access-Jwt-Assertion
  try {
    // Decodificar JWT (sem verificar por enquanto - será implementado com JWKS)
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return {
      email: payload.email,
      groups: payload.groups || [],
    };
  } catch {
    return null;
  }
}

async function verifyPolicyPack(env: Env): Promise<boolean> {
  const packJson = await env.POLICY_KV.get("policy_pack");
  if (!packJson) return false;
  
  const pack = JSON.parse(packJson);
  
  // Verificar assinatura Ed25519
  // Em produção: usar tdln-core WASM para verificar
  // Por ora, validação simplificada
  const publicKeyBytes = Uint8Array.from(atob(env.PUBLIC_KEY), c => c.charCodeAt(0));
  
  // TODO: Implementar verificação real com tdln-core WASM
  return pack.signature && pack.yaml_hash && pack.public_key === env.PUBLIC_KEY;
}

async function evaluateWithTDLN(
  ctx: {
    user_email?: string;
    user_groups: string[];
    path: string;
    method: string;
    has_passkey: boolean;
    break_glass_active: boolean;
    break_glass_until?: number;
  }
): Promise<{allow: boolean; reason: string; bits: number; eval_ms: number}> {
  // Em produção: carregar tdln-core WASM e chamar evaluate()
  // Por ora, lógica inline (será substituída por WASM)
  
  const start = performance.now();
  let allow = false;
  let reason = "";
  let bits = 0;
  
  if (ctx.break_glass_active) {
    if (ctx.break_glass_until && Date.now() / 1000 >= ctx.break_glass_until) {
      reason = "break-glass expired";
    } else {
      bits |= 0x04; // PCircuitBreaker
      allow = true;
      reason = "break-glass active";
    }
  } else {
    if (ctx.path.startsWith("/admin/")) {
      if (ctx.user_groups.includes("ubl-ops")) {
        bits |= 0x02; // PRoleAdmin
        allow = true;
        reason = "admin group membership";
      } else {
        allow = false;
        reason = "admin path requires ubl-ops group";
      }
    } else if (ctx.path.startsWith("/api/")) {
      if (ctx.has_passkey) {
        bits |= 0x01; // PUserPasskey
        allow = true;
        reason = "valid passkey";
      } else {
        allow = false;
        reason = "api path requires passkey";
      }
    } else {
      allow = true;
      reason = "public path";
    }
  }
  
  const eval_ms = performance.now() - start;
  
  return { allow, reason, bits, eval_ms };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Break-glass endpoint (protegido por Access grupo ubl-ops-breakglass)
    if (url.pathname === "/breakglass") {
      const doId = env.BREAKGLASS_DO.idFromName("global");
      const doStub = env.BREAKGLASS_DO.get(doId);
      return doStub.fetch(request);
    }
    
    // Verificar política assinada
    const packValid = await verifyPolicyPack(env);
    if (!packValid) {
      return new Response("Policy pack invalid or unsigned", { status: 503 });
    }
    
    // Obter break-glass state
    const doId = env.BREAKGLASS_DO.idFromName("global");
    const doStub = env.BREAKGLASS_DO.get(doId);
    const bgRes = await doStub.fetch(new Request("https://internal/breakglass"));
    const bgState = await bgRes.json<{active: boolean; until: number}>();
    
    // Extrair Access token
    const accessToken = request.headers.get("CF-Access-Jwt-Assertion");
    const userInfo = accessToken ? await verifyAccessToken(accessToken) : null;
    
    // Avaliar decisão
    const decision = await evaluateWithTDLN({
      user_email: userInfo?.email,
      user_groups: userInfo?.groups || [],
      path: url.pathname,
      method: request.method,
      has_passkey: false, // TODO: verificar passkey
      break_glass_active: bgState.active && (bgState.until === 0 || Date.now() / 1000 < bgState.until),
      break_glass_until: bgState.until,
    });
    
    // Publicar evento
    await env.EVENT_QUEUE.send({
      timestamp: Date.now(),
      user_email: userInfo?.email,
      path: url.pathname,
      method: request.method,
      decision: decision.allow,
      reason: decision.reason,
      eval_ms: decision.eval_ms,
      bits: decision.bits,
    });
    
    if (!decision.allow) {
      return new Response(JSON.stringify({ error: decision.reason }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Forward para origin (ou processar localmente)
    return new Response("OK", { status: 200 });
  },
  
  async queue(batch: MessageBatch<PolicyEvent>, env: Env): Promise<void> {
    // Consumer: agrega eventos e grava em R2
    const events: PolicyEvent[] = [];
    
    for (const message of batch.messages) {
      events.push(message.body);
      message.ack();
    }
    
    if (events.length === 0) return;
    
    // Agregar por hora
    const hour = new Date(events[0].timestamp).toISOString().slice(0, 13) + ":00:00Z";
    const key = `events/${hour.replace(/:/g, "-")}.ndjson`;
    
    // Ler existente e append
    let existing = "";
    try {
      const obj = await env.R2_BUCKET.get(key);
      if (obj) {
        existing = await obj.text();
      }
    } catch {}
    
    const lines = events.map(e => JSON.stringify(e)).join("\n");
    const content = existing ? existing + "\n" + lines : lines;
    
    await env.R2_BUCKET.put(key, content, {
      httpMetadata: { contentType: "application/x-ndjson" },
    });
  },
};
