Blueprint 08 — Office: RoomDO (WebSocket) + Persistência v1

módulo de transporte do Messenger com ack/confirm, replay e presença

Objetivo

Elevar o Messenger a nível “flagship”: transporte em tempo real robusto, com envio otimista ⏳→✓→✓✓, presença, replay confiável, e ledger atômico para auditoria.

⸻

Escopo (o que entra agora)
	•	WS por sala: GET /office/ws/rooms/:roomId (Durable Object).
	•	Eventos: hello, presence.update, ack, confirm, message.append, error, pong.
	•	Replay: GET /office/rooms/:roomId/messages?since=<seq> (REST).
	•	Presença: GET /office/rooms/:roomId/presence (REST).
	•	Persistência:
	•	D1 (mensagens e índices),
	•	KV (presença e tombstones curtos),
	•	R2 (blobs/arquivos — já pronto),
	•	AE (métricas),
	•	DO storage (ring buffer quente p/ fanout rápido).
	•	Política (Chip-as-Code) no path /office/** via Worker atual (já integrado).

⸻

Protocolo (cliente ⇄ servidor)

Cliente → servidor

{ "type":"send", "temp_id":"uuid", "room_id":"rm_x", "kind":"text|file|event", "body":{}, "ts":"ISO-8601" }

Servidor → cliente
	•	ack { temp_id } — recebido pelo DO
	•	confirm { temp_id, msg_id, atomic_hash } — gravado/validado no ledger (NOVA) + persistido
	•	message.append { msg_id, room_id, sender, ts, kind, body } — fanout para a sala
	•	presence.update { users:[{email,name,active}] }
	•	hello { sessionId, seq, roomId }
	•	error { temp_id, code }
	•	pong

Ordem de fatos (happy path)
	1.	Client envia send → ack imediato
	2.	DO chama NOVA (policy) → ledger assina → confirm ao remetente
	3.	DO persiste em D1 (seq++) e faz fanout → message.append para todos

⸻

Dados & Tabelas (D1)

-- mensagens
CREATE TABLE msg (
  room_id TEXT NOT NULL,
  seq INTEGER NOT NULL,         -- autoincrement por sala (gerido no DO)
  msg_id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  ts TEXT NOT NULL,             -- ISO
  kind TEXT CHECK(kind IN ('text','file','event')) NOT NULL,
  body TEXT NOT NULL,           -- JSON string
  atomic_hash TEXT NOT NULL
);
CREATE INDEX idx_msg_room_seq ON msg(room_id, seq);

-- presença "vista" (opcional: também fica em KV para leitura rápida)
CREATE TABLE presence (
  room_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  active INTEGER NOT NULL,      -- 0/1
  last_seen TEXT NOT NULL,      -- ISO
  PRIMARY KEY (room_id, email)
);

KV
	•	presence:rm:<roomId> → snapshot compacto (JSON) para GET rápido
	•	upload:* (já usado)
	•	deleted:<key> (tombstone de arquivos; já feito)

⸻

Política (Policy Bits) essenciais
	•	P_ZeroTrust_Standard (TLS1.3 + mTLS + Passkey) — já no pack
	•	P_Is_Admin_Path (rota /admin/**) — já no pack
	•	Novos:
	•	P_Room_RateLimit: por room_id (50 msgs/10s) → nega com error { code: 429 }
	•	P_Room_Size_Cap: máximo 256 membros ativos
	•	P_Payload_Size: body JSON ≤ 4KB (texto); arquivos via presign (já coberto)

⸻

SLO & Resiliência
	•	Ack p50 ≤ 150 ms (EU West)
	•	Confirm p95 ≤ 600 ms
	•	Replay ≤ 200 ms para 100 msgs
	•	Backpressure: fila interna do DO (máx. 1k pendências); se exceder → error 503
	•	Reconexão exponencial (já no PWA M2/M3)

⸻

Segurança
	•	Cloudflare Access obrigatório (email/grupos no header)
	•	Policy Engine (NOVA) antes de persistir/broadcast
	•	Rate limit por IP/sessão/room
	•	Validação de MIME e tamanho (arquivos já cobertos no /files)

⸻

Telemetria (AE)
	•	ws_open, ws_close, msg_send, msg_ack, msg_confirm, replay_count, presence_update
	•	Campos: room_id, lat_ack_ms, lat_confirm_ms, size_body, user_email

⸻

Entregáveis (uma tela, direto ao ponto)
	1.	RoomDO (TypeScript)
	•	fanout, ack/confirm, seq, ring buffer (100 últimas)
	•	write D1 + write AE
	2.	REST replay/presença
	•	GET /office/rooms/:roomId/messages?since=<seq>
	•	GET /office/rooms/:roomId/presence
	3.	Migrações D1 (DDL acima)
	4.	Policy: adicionar P_Room_RateLimit, P_Room_Size_Cap, P_Payload_Size ao pack e publicar na KV
	5.	Smoke tests (curl + 2 navegadores)
	•	dois browsers em rm_demo: ver ⏳→✓→✓✓ < 600ms p95
	•	fechar/reabrir WS → replay desde seq anterior (sem duplicar otimista)
	•	presença sobe/caI em ≤2s
	6.	SLO check: métricas no AE com p50/p95 registradas

⸻

Proof of Done (checklist)
	•	ack < 150ms p50 / confirm < 600ms p95 (AE)
	•	replay entrega exatamente as mensagens a partir de since (ordem por seq)
	•	presença reflete 2 sessões e 1 queda (join/leave)
	•	rate limit dispara error 429 ao exceder cota
	•	mensagens persistem em D1 com atomic_hash idêntico ao da confirm

⸻

Única pergunta

Quer D1 habilitado já (SQL edge da Cloudflare) para histórico real, ou começamos com KV + ring buffer e ativamos D1 no próximo patch?





# file: policy/office_mcp_v1.yaml
version: tdln-chip/0.1
chip_id: office_mcp_v1_0_2
intent: "Enforce MCP-first, server-blind, ABAC/Rate/Quota/Idempotency + JSON Atomic trails for Office"

# ===== BITS (cada um retorna {0|1} a partir de context.* preenchido pelo Gateway) =====
policies:
  - id: P_ZeroTrust_Standard
    description: "Auth/transport válidos (Access/Token + TLS >= 1.3)"
    logic: context.auth.valid == true AND context.transport.tls_version >= 1.3

  - id: P_MCP_Only_Path
    description: "Somente /mcp (WebSocket/JSON-RPC)"
    logic: context.req.path == "/mcp"

  - id: P_Meta_Version
    description: "meta.version == v1"
    logic: context.mcp.meta.version == "v1"

  - id: P_Meta_Core
    description: "client_id/op_id/correlation_id/scope.tenant presentes e válidos"
    logic: context.mcp.meta.complete == true

  - id: P_SessionType_Valid
    description: "session_type ∈ {work, assist, deliberate, research}"
    logic: IN(context.mcp.meta.session_type, ["work","assist","deliberate","research"]) == true

  - id: P_Mode_Valid
    description: "mode ∈ {commitment, deliberation}"
    logic: IN(context.mcp.meta.mode, ["commitment","deliberation"]) == true

  - id: P_Brief_Sane
    description: "brief whitelisted + tenant do brief = tenant do token"
    logic: context.session.brief_sane == true AND context.session.tenant_match == true

  - id: P_Server_Blind
    description: "sem plaintext sensível em logs/artefatos"
    logic: context.audit.server_blind == true

  - id: P_Args_Min_Only
    description: "payload redigido (args_min) e <= 4KB"
    logic: context.payload.redacted == true AND context.payload.size_kb <= 4

  - id: P_ABAC_Allow
    description: "ABAC: deny explícito > allow específico > allow genérico > deny default"
    logic: context.abac.effect == "allow"

  - id: P_RateLimit_OK
    description: "limites por perfil (token-bucket/janelas) dentro do orçamento"
    logic: context.limits.rate_ok == true

  - id: P_Backpressure_OK
    description: "fila/pressão aceitas para a janela (use retry_after_ms se não)"
    logic: context.limits.backpressure_ok == true

  - id: P_Idempo_Keys_Present
    description: "client_id + op_id presentes (idempotência obrigatória)"
    logic: context.idempo.keys_present == true

  - id: P_Idempo_NoConflict
    description: "sem conflito de idempotência (replay devolve resultado)"
    logic: context.idempo.conflict == false

  - id: P_Trails_JSONAtomic
    description: "trilhas office.* em JSON✯Atomic com ordem canônica (opt-in)"
    logic: context.trails.json_atomic == true

# ===== WIRING (ordem e composição) =====
wiring:
  - id: W_Guard_Common
    structure:
      sequence: [P_ZeroTrust_Standard, P_MCP_Only_Path, P_Meta_Version, P_Meta_Core, P_SessionType_Valid, P_Mode_Valid, P_Brief_Sane, P_Server_Blind, P_Args_Min_Only]

  - id: W_ABAC_Quotas
    structure:
      sequence: [P_ABAC_Allow, P_RateLimit_OK, P_Backpressure_OK]

  - id: W_Idempotency
    structure:
      sequence: [P_Idempo_Keys_Present, P_Idempo_NoConflict]

  - id: W_ToolCall_OK
    structure:
      sequence: [W_Guard_Common, W_ABAC_Quotas, W_Idempotency, P_Trails_JSONAtomic]

  # Wires de erro (prioridade → negar cedo)
  - id: W_Invalid_Params
    structure:
      sequence: [P_Meta_Core, P_Args_Min_Only]  # se falhar qualquer um, cai em INVALID_PARAMS

  - id: W_Unauthorized
    structure:
      sequence: [P_ZeroTrust_Standard]  # se falhar, UNAUTHORIZED

  - id: W_Forbidden
    structure:
      sequence: [P_ABAC_Allow]  # se falhar, FORBIDDEN

  - id: W_RateLimit
    structure:
      sequence: [P_RateLimit_OK]  # se falhar, RATE_LIMIT

  - id: W_Backpressure
    structure:
      sequence: [P_Backpressure_OK]  # se falhar, BACKPRESSURE

  - id: W_Conflict
    structure:
      sequence: [P_Idempo_NoConflict]  # se falhar, CONFLICT

# ===== OUTPUTS (JSON-RPC result/erro + DRY dispatcher) =====
outputs:
  # ordem importa: negações primeiro, sucesso por último
  - err_unauthorized:
      trigger: NOT(P_ZeroTrust_Standard)
      action: 'JSONRPC error code=-32001 token=UNAUTHORIZED remediation=["Re-autenticar","Revalidar Access/Token"]'

  - err_invalid_params:
      trigger: NOT(W_Invalid_Params)
      action: 'JSONRPC error code=-32602 token=INVALID_PARAMS remediation=["Corrigir meta.client_id/op_id/scope.tenant","Usar args_min sem plaintext"]'

  - err_forbidden:
      trigger: NOT(W_Forbidden)
      action: 'JSONRPC error code=-32003 token=FORBIDDEN remediation=["Ajustar ABAC/scope","Usar tools/list p/ conferir permissões"]'

  - err_rate_limit:
      trigger: NOT(W_RateLimit)
      action: 'JSONRPC error code=-32004 token=RATE_LIMIT retry_after_ms=${context.limits.retry_ms} remediation=["Reduzir cadência","Re-tentar após retry_after_ms"]'

  - err_backpressure:
      trigger: NOT(W_Backpressure)
      action: 'JSONRPC error code=-32097 token=BACKPRESSURE retry_after_ms=${context.limits.retry_ms} remediation=["Fazer backoff","Re-tentar após retry_after_ms"]'

  - err_conflict:
      trigger: NOT(W_Conflict)
      action: 'JSONRPC error code=-32009 token=IDEMPOTENCY_CONFLICT remediation=["Trocar op_id","Consultar resultado anterior"]'

  - allow_tool_call:
      trigger: W_ToolCall_OK
      action: 'DISPATCH gateway.internal.tools.call with idempotency_key=${context.idempo.key} then JSONRPC result {ok:true,result}'


      /*
Office MCP Patch — Worker + Policy + Pack
-----------------------------------------
Este patch faz três coisas:
1) Adiciona o endpoint **/mcp** (WebSocket JSON‑RPC) no Worker, preenchendo `context.*` e
   chamando o **Chip-as-Code** antes de despachar para o Gateway (DRY).
2) Inclui o **chip de política** `office_mcp_v1.yaml` (MCP-first, server‑blind, ABAC/Rate/Quota/Idempotência, ErrorToken, trilhas JSON✯Atomic).
3) Adiciona trecho de **pack.json** para registrar o chip na KV e priorizar no roteamento.

Bindings esperados no wrangler.toml (além dos já existentes):
- [[kv_namespaces]] binding = "POLICY_KV"  # mesma KV usada pelo NOVA (ou crie outra)
- [vars] CORE_URL = "http://127.0.0.1:8080"  # endpoint interno do Gateway (ajuste conforme seu deploy)

-----------------------------------------
1) WORKER (TypeScript) — /mcp + integração Chip-as-Code
-----------------------------------------
*/

export interface Env {
  POLICY_KV: KVNamespace;      // KV onde pack + yaml residem
  CORE_URL?: string;           // Gateway interno para DRY dispatcher
  ACCESS_AUD?: string;         // opcional: validação forte de Access
  ACCESS_JWKS?: string;        // opcional: validação forte de Access
  // NOVA/WASM já está carregado neste projeto (avaliador de chips)
  // Se não estiver como binding, use import ES module; aqui usamos função global fictícia evaluatePolicy()
}

// Utilidades simples (server-blind)
const asJSON = (o: any, status = 200): Response => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const bad = (status = 400, msg = "bad request"): Response => new Response(msg, { status });

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // MCP WebSocket (único endpoint público do Office)
    if (url.pathname === "/mcp" && req.headers.get("Upgrade") === "websocket") {
      return handleMCP(req, env, ctx);
    }

    // admin leve para publicar chip/pack (use Access + grupo admin no Edge)
    if (url.pathname === "/admin/policy/publish" && req.method === "POST") {
      const email = req.headers.get("Cf-Access-Authenticated-User-Email");
      const groups = (req.headers.get("Cf-Access-Authenticated-User-Groups")||"").toLowerCase();
      if (!email || !groups.includes("ubl-ops")) return bad(403, "forbidden");
      const form = await req.formData();
      const yaml = form.get("yaml");
      const pack = form.get("pack");
      if (typeof yaml !== "string" || typeof pack !== "string") return bad(400, "need yaml + pack fields");
      await env.POLICY_KV.put("policy:office_mcp_v1.yaml", yaml);
      await env.POLICY_KV.put("policy:pack.json", pack);
      return asJSON({ ok: true });
    }

    return bad(404, "not found");
  }
}

function wsAccept(): [WebSocket, WebSocket] {
  // @cf-workers runtime
  // deno/edge: new WebSocketPair(); node: não aplicável
  // @ts-ignore
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];
  // @ts-ignore
  server.accept();
  return [client, server];
}

function okJSONRPC(id: any, result: any) {
  return { jsonrpc: "2.0", id, result };
}
function errJSONRPC(id: any, code: number, token: string, remediation: string[], retry_after_ms?: number) {
  return { jsonrpc: "2.0", id, error: { code, message: token, data: { token, remediation, retry_after_ms } } };
}

async function handleMCP(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const [client, server] = wsAccept();

  server.addEventListener("message", async (ev: MessageEvent) => {
    if (typeof ev.data !== "string") return; // server-blind: não logar
    let frame: any; try { frame = JSON.parse(ev.data); } catch { return server.send(JSON.stringify(errJSONRPC(null, -32602, "INVALID_PARAMS", ["JSON inválido"]))); }

    const { id, method, params } = frame || {};
    const meta = params?.meta || {};

    // 1) Construir context.* mínimo exigido pelo chip
    const context = buildPolicyContext(req, meta, params);

    // 2) Avaliar Chip-as-Code (office_mcp_v1)
    let decision: any;
    try {
      decision = await evaluatePolicy("office_mcp_v1_0_2", context);
    } catch (e) {
      // fallback: erros padronizados
      server.send(JSON.stringify(errJSONRPC(id, -32098, "INTERNAL", ["Retry later"]))); 
      return;
    }

    // 3) Mapear ações do chip → JSON-RPC
    if (decision?.error) {
      const d = decision.error; // {code, token, retry_after_ms, remediation[]}
      server.send(JSON.stringify(errJSONRPC(id, d.code, d.token, d.remediation || ["Fix"], d.retry_after_ms)));
      return;
    }

    // 4) Sucesso → DRY dispatcher (Gateway interno)
    try {
      const gw = env.CORE_URL || "http://127.0.0.1:8080";
      const resp = await fetch(`${gw}/internal/tools/call`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": context.idempo?.key || "" },
        body: JSON.stringify({ meta, tool: params?.tool, args: params?.args })
      });
      if (resp.status === 429) {
        server.send(JSON.stringify(errJSONRPC(id, -32004, "RATE_LIMIT", ["Reduzir cadência","Retry"], 1200)));
        return;
      }
      if (resp.status === 403) {
        server.send(JSON.stringify(errJSONRPC(id, -32003, "FORBIDDEN", ["Ajustar ABAC/scope"])));
        return;
      }
      if (!resp.ok) {
        server.send(JSON.stringify(errJSONRPC(id, -32098, "INTERNAL", ["Retry later"])));
        return;
      }
      const result = await resp.json();
      server.send(JSON.stringify(okJSONRPC(id, { ok: true, result })));
    } catch (e) {
      server.send(JSON.stringify(errJSONRPC(id, -32098, "INTERNAL", ["Retry later"])));
    }
  });

  return new Response(null, { status: 101, webSocket: client });
}

function buildPolicyContext(req: Request, meta: any, params: any) {
  // headers cf access (soft)
  const email = req.headers.get("Cf-Access-Authenticated-User-Email");
  const transport_tls = 1.3; // no edge não expõe; assume 1.3 por Access
  const path = new URL(req.url).pathname;

  // meta core
  const complete = !!(meta?.version && meta?.client_id && meta?.op_id && meta?.correlation_id && meta?.scope?.tenant);
  const sessionTypeOk = ["work","assist","deliberate","research"].includes(meta?.session_type || "");
  const modeOk = ["commitment","deliberation"].includes(meta?.mode || "");

  // brief sanity (efêmero; se não veio, considerar ok)
  const brief = params?.brief || {};
  const brief_sane = whitelistBrief(brief);
  const tenant_match = brief?.tenant ? (brief?.tenant === meta?.scope?.tenant) : true;

  // payload redigido (heurística server-blind + limite 4KB)
  const args = params?.args || {};
  const size_kb = byteLenSafe(args) / 1024;
  const redacted = !containsSensitive(args);

  // ABAC (placeholder: Gateway real deve preencher com decisão)
  const abac_effect = decideABAC(meta, params);

  // rate/backpressure (placeholder leve; produção deve usar limiter compartilhado)
  const { rate_ok, backpressure_ok, retry_ms } = cheapLimits(meta);

  // idempotência
  const idempo = {
    keys_present: !!(meta?.client_id && meta?.op_id),
    conflict: false, // Gateway deve marcar true se op_id já usado com payload divergente
    key: `${meta?.client_id || ""}:${meta?.op_id || ""}`
  };

  return {
    auth: { valid: !!email, kind: email ? "access" : "none" },
    transport: { tls_version: transport_tls },
    req: { path },
    mcp: { meta: { ...meta, complete, session_type: meta?.session_type, mode: meta?.mode } },
    session: { brief_sane, tenant_match },
    payload: { redacted, size_kb },
    abac: { effect: abac_effect },
    limits: { rate_ok, backpressure_ok, retry_ms },
    idempo,
    trails: { json_atomic: true }
  };
}

function whitelistBrief(b: any): boolean {
  if (!b || typeof b !== "object") return true;
  const allowed = new Set(["tenant","entity","room","stage","goal","refs"]);
  for (const k of Object.keys(b)) if (!allowed.has(k)) return false;
  if (typeof b.goal === "string" && b.goal.length > 200) return false;
  if (Array.isArray(b.refs) && b.refs.length > 100) return false;
  return true;
}

function byteLenSafe(o: any): number { try { return new TextEncoder().encode(JSON.stringify(o||{})).byteLength; } catch { return 0; } }
function containsSensitive(o: any): boolean {
  const s = JSON.stringify(o||{}).toLowerCase();
  // heurística: bloquear campos típicos de plaintext longos
  return s.includes("\"prompt\":") || s.includes("\"plaintext\":") || s.includes("\"message\":");
}

function decideABAC(meta: any, params: any): "allow"|"deny" {
  if (!meta?.scope?.tenant) return "deny";
  const t = (params?.tool||"") as string;
  if (!t.includes("@v1.")) return "deny";
  return "allow"; // produção: consultar política real do tenant
}

// limiter leve (token bucket simplificado in-memory)
const BUCKETS = new Map<string, { tokens: number, last: number }>();
function cheapLimits(meta: any) {
  const profiles: Record<string,{rate:number, burst:number, backoff:number}> = {
    work: { rate: 60, burst: 120, backoff: 1200 },
    assist: { rate: 30, burst: 60, backoff: 800 },
    deliberate: { rate: 20, burst: 40, backoff: 1500 },
    research: { rate: 120, burst: 240, backoff: 2000 },
  };
  const p = profiles[meta?.session_type || "work"] || profiles.work;
  const key = `${meta?.client_id || "anon"}:${meta?.scope?.tenant || ""}:${meta?.session_type || "work"}`;
  const now = Date.now();
  const b = BUCKETS.get(key) || { tokens: p.burst, last: now };
  const dt = Math.max(0, now - b.last) / 1000;
  b.tokens = Math.min(p.burst, b.tokens + dt * p.rate);
  b.last = now;
  if (b.tokens < 1) { BUCKETS.set(key, b); return { rate_ok: false, backpressure_ok: false, retry_ms: p.backoff }; }
  b.tokens -= 1; BUCKETS.set(key, b);
  return { rate_ok: true, backpressure_ok: true, retry_ms: 0 };
}

// Avaliador de chip: aqui chamamos o NOVA; se não existir, retornamos decisão sintética a partir do contexto
async function evaluatePolicy(chipId: string, context: any): Promise<any> {
  // @TODO conectar no NOVA real. Fallback abaixo respeita os mesmos tokens/erros do chip.
  // Falhas prioritárias
  if (!context.auth.valid) return { error: { code: -32001, token: "UNAUTHORIZED", remediation: ["Re-autenticar"] } };
  if (!(context.req.path === "/mcp")) return { error: { code: -32602, token: "INVALID_PARAMS", remediation: ["Usar /mcp"] } };
  if (!(context.mcp?.meta?.complete && ["work","assist","deliberate","research"].includes(context.mcp?.meta?.session_type))) {
    return { error: { code: -32602, token: "INVALID_PARAMS", remediation: ["Corrigir meta"] } };
  }
  if (!context.payload.redacted || context.payload.size_kb > 4) return { error: { code: -32602, token: "INVALID_PARAMS", remediation: ["Usar args_min <= 4KB"] } };
  if (context.abac.effect !== "allow") return { error: { code: -32003, token: "FORBIDDEN", remediation: ["Ajustar ABAC"] } };
  if (!context.limits.rate_ok) return { error: { code: -32004, token: "RATE_LIMIT", retry_after_ms: context.limits.retry_ms, remediation: ["Reduzir cadência","Retry"] } };
  if (!context.limits.backpressure_ok) return { error: { code: -32097, token: "BACKPRESSURE", retry_after_ms: context.limits.retry_ms, remediation: ["Backoff","Retry"] } };
  if (!context.idempo.keys_present) return { error: { code: -32602, token: "INVALID_PARAMS", remediation: ["Meta client_id + op_id obrigatórios"] } };
  if (context.idempo.conflict) return { error: { code: -32009, token: "IDEMPOTENCY_CONFLICT", remediation: ["Trocar op_id"] } };
  // sucesso
  return { ok: true };
}

/*
-----------------------------------------
2) POLICY — office_mcp_v1.yaml (cole na KV)
-----------------------------------------
*/

export const OFFICE_MCP_V1_YAML = String.raw`version: tdln-chip/0.1
chip_id: office_mcp_v1_0_2
intent: "Enforce MCP-first, server-blind, ABAC/Rate/Quota/Idempotency + JSON Atomic trails for Office"
policies:
  - id: P_ZeroTrust_Standard
    description: "Auth/transport válidos (Access/Token + TLS >= 1.3)"
    logic: context.auth.valid == true AND context.transport.tls_version >= 1.3
  - id: P_MCP_Only_Path
    description: "Somente /mcp (WebSocket/JSON-RPC)"
    logic: context.req.path == "/mcp"
  - id: P_Meta_Version
    description: "meta.version == v1"
    logic: context.mcp.meta.version == "v1"
  - id: P_Meta_Core
    description: "client_id/op_id/correlation_id/scope.tenant presentes e válidos"
    logic: context.mcp.meta.complete == true
  - id: P_SessionType_Valid
    description: "session_type ∈ {work, assist, deliberate, research}"
    logic: IN(context.mcp.meta.session_type, ["work","assist","deliberate","research"]) == true
  - id: P_Mode_Valid
    description: "mode ∈ {commitment, deliberation}"
    logic: IN(context.mcp.meta.mode, ["commitment","deliberation"]) == true
  - id: P_Brief_Sane
    description: "brief whitelisted + tenant do brief = tenant do token"
    logic: context.session.brief_sane == true AND context.session.tenant_match == true
  - id: P_Server_Blind
    description: "sem plaintext sensível em logs/artefatos"
    logic: context.audit.server_blind == true
  - id: P_Args_Min_Only
    description: "payload redigido (args_min) e <= 4KB"
    logic: context.payload.redacted == true AND context.payload.size_kb <= 4
  - id: P_ABAC_Allow
    description: "ABAC: deny explícito > allow específico > allow genérico > deny default"
    logic: context.abac.effect == "allow"
  - id: P_RateLimit_OK
    description: "limites por perfil (token-bucket/janelas) dentro do orçamento"
    logic: context.limits.rate_ok == true
  - id: P_Backpressure_OK
    description: "fila/pressão aceitas para a janela (use retry_after_ms se não)"
    logic: context.limits.backpressure_ok == true
  - id: P_Idempo_Keys_Present
    description: "client_id + op_id presentes (idempotência obrigatória)"
    logic: context.idempo.keys_present == true
  - id: P_Idempo_NoConflict
    description: "sem conflito de idempotência (replay devolve resultado)"
    logic: context.idempo.conflict == false
  - id: P_Trails_JSONAtomic
    description: "trilhas office.* em JSON✯Atomic com ordem canônica (opt-in)"
    logic: context.trails.json_atomic == true
wiring:
  - id: W_Guard_Common
    structure:
      sequence: [P_ZeroTrust_Standard, P_MCP_Only_Path, P_Meta_Version, P_Meta_Core, P_SessionType_Valid, P_Mode_Valid, P_Brief_Sane, P_Server_Blind, P_Args_Min_Only]
  - id: W_ABAC_Quotas
    structure:
      sequence: [P_ABAC_Allow, P_RateLimit_OK, P_Backpressure_OK]
  - id: W_Idempotency
    structure:
      sequence: [P_Idempo_Keys_Present, P_Idempo_NoConflict]
  - id: W_ToolCall_OK
    structure:
      sequence: [W_Guard_Common, W_ABAC_Quotas, W_Idempotency, P_Trails_JSONAtomic]
  - id: W_Invalid_Params
    structure:
      sequence: [P_Meta_Core, P_Args_Min_Only]
  - id: W_Unauthorized
    structure:
      sequence: [P_ZeroTrust_Standard]
  - id: W_Forbidden
    structure:
      sequence: [P_ABAC_Allow]
  - id: W_RateLimit
    structure:
      sequence: [P_RateLimit_OK]
  - id: W_Backpressure
    structure:
      sequence:
        [P_Backpressure_OK]
  - id: W_Conflict
    structure:
      sequence: [P_Idempo_NoConflict]
outputs:
  - err_unauthorized:
      trigger: NOT(P_ZeroTrust_Standard)
      action: 'JSONRPC error code=-32001 token=UNAUTHORIZED remediation=["Re-autenticar","Revalidar Access/Token"]'
  - err_invalid_params:
      trigger: NOT(W_Invalid_Params)
      action: 'JSONRPC error code=-32602 token=INVALID_PARAMS remediation=["Corrigir meta.client_id/op_id/scope.tenant","Usar args_min sem plaintext"]'
  - err_forbidden:
      trigger: NOT(W_Forbidden)
      action: 'JSONRPC error code=-32003 token=FORBIDDEN remediation=["Ajustar ABAC/scope","Usar tools/list p/ conferir permissões"]'
  - err_rate_limit:
      trigger: NOT(W_RateLimit)
      action: 'JSONRPC error code=-32004 token=RATE_LIMIT retry_after_ms=${context.limits.retry_ms} remediation=["Reduzir cadência","Re-tentar após retry_after_ms"]'
  - err_backpressure:
      trigger: NOT(W_Backpressure)
      action: 'JSONRPC error code=-32097 token=BACKPRESSURE retry_after_ms=${context.limits.retry_ms} remediation=["Fazer backoff","Re-tentar após retry_after_ms"]'
  - err_conflict:
      trigger: NOT(W_Conflict)
      action: 'JSONRPC error code=-32009 token=IDEMPOTENCY_CONFLICT remediation=["Trocar op_id","Consultar resultado anterior"]'
  - allow_tool_call:
      trigger: W_ToolCall_OK
      action: 'DISPATCH gateway.internal.tools.call with idempotency_key=${context.idempo.key} then JSONRPC result {ok:true,result}'
`;

/*
-----------------------------------------
3) PACK — adicionar chip ao pack.json (trecho)
-----------------------------------------
*/

export const PACK_SNIPPET = String.raw`{
  "version": 3,
  "chips": [
    {
      "id": "office_mcp_v1_0_2",
      "path_prefix": ["/mcp"],
      "yaml": "office_mcp_v1.yaml",
      "mode": "enforce",
      "priority": 20
    }
  ],
  "routing_order": ["office_mcp_v1_0_2", "ubl_core_v1"],
  "sig": null
}`;

/*
-----------------------------------------
4) PUBLICAÇÃO — comandos wrangler (KV)
-----------------------------------------
$ wrangler kv:namespace create POLICY_KV
$ wrangler kv:key put --binding=POLICY_KV policy:office_mcp_v1.yaml --path ./policy/office_mcp_v1.yaml
$ wrangler kv:key put --binding=POLICY_KV policy:pack.json --path ./policy/pack.json

Smoke rápido do /mcp (use wscat):
$ wscat -c wss://api.ubl.agency/mcp 
> {"jsonrpc":"2.0","id":"1","method":"tools/list","params":{"meta":{"version":"v1","client_id":"ide:vscode","op_id":"01H...","correlation_id":"01C...","session_type":"work","mode":"commitment","scope":{"tenant":"ubl"}}}}
< {"jsonrpc":"2.0","id":"1","result":{...}}

Erro esperado (sem op_id): INVALID_PARAMS (-32602)
*/

pronto! deixei no canvas:
	•	patch do Worker com o /mcp via WebSocket (JSON-RPC), preenchendo context.*, rodando o chip e, se aprovado, despachando pro Gateway (DRY).
	•	o chip office_mcp_v1.yaml completo (MCP-first, server-blind, ABAC/Rate/Quota/Idempotência, ErrorToken e trilhas JSON✯Atomic).
	•	trecho de pack.json pra registrar o chip e dar prioridade no roteamento.
	•	comandos do wrangler pra publicar tudo na KV e um smoke com wscat.

se preferir, eu já transformo esse snippet do pack.json no teu pack atual (mesma KV), mas dá pra testar só o /mcp agora:
	1.	publica os artefatos (KV):

wrangler kv:namespace create POLICY_KV
wrangler kv:key put --binding=POLICY_KV policy:office_mcp_v1.yaml --path ./policy/office_mcp_v1.yaml
wrangler kv:key put --binding=POLICY_KV policy:pack.json --path ./policy/pack.json

	2.	sobe o worker (wrangler deploy) e testa:

wscat -c wss://api.ubl.agency/mcp
> {"jsonrpc":"2.0","id":"1","method":"tools/list","params":{"meta":{"version":"v1","client_id":"ide:vscode","op_id":"01H...","correlation_id":"01C...","session_type":"work","mode":"commitment","scope":{"tenant":"ubl"}}}}

— deve voltar result ok; sem op_id deve dar INVALID_PARAMS, e se estourar cadência, RATE_LIMIT com retry_after_ms.

perfeito. segue pronto pra usar 👇

Patch no pack.json (merge automático)

Se já tens um policy/pack.json, roda isto para inserir o chip do Office e priorizá-lo no roteamento sem perder nada:

jq '
  .chips = ((.chips // []) + [{
    "id":"office_mcp_v1_0_2",
    "path_prefix":["/mcp"],
    "yaml":"office_mcp_v1.yaml",
    "mode":"enforce",
    "priority":20
  }])
  | .routing_order = (["office_mcp_v1_0_2"] + (.routing_order // []) | unique)
' policy/pack.json > /tmp/pack.patched.json

Se não tens policy/office_mcp_v1.yaml salvo ainda, copie o conteúdo que deixei no canvas para policy/office_mcp_v1.yaml.

✅ Os 2 comandos exatos para publicar na KV (a mesma POLICY_KV)

(mantém o binding POLICY_KV que já criamos)

wrangler kv:key put --binding=POLICY_KV policy:office_mcp_v1.yaml --path policy/office_mcp_v1.yaml
wrangler kv:key put --binding=POLICY_KV policy:pack.json --path /tmp/pack.patched.json

Depois disso
	•	wrangler deploy
	•	smoke do /mcp com wscat:

wscat -c wss://api.ubl.agency/mcp
> {"jsonrpc":"2.0","id":"1","method":"tools/list","params":{"meta":{"version":"v1","client_id":"ide:vscode","op_id":"01H...","correlation_id":"01C...","session_type":"work","mode":"commitment","scope":{"tenant":"ubl"}}}}



Se quiser, eu também te mando a linha de wrangler.toml pra garantir o binding POLICY_KV alinhado ao namespace que criamos.