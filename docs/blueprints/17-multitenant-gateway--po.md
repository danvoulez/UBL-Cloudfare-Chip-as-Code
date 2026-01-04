Blueprint 17 — Multitenant (Gateway + Policy + Storage)

0) Escopo e papéis
	•	Tenant: unidade de isolamento lógico (políticas, chaves, quotas, domínios, métricas).
	•	ubl: tenant-mãe (admin/ops/webhooks/hardening).
	•	voulezvous: tenant de produto (OMNI / TV + Party).
	•	Objetivo: resolver o tenant por requisição, aplicar política do tenant no Edge, isolar artefatos (KV/R2/Postgres/DO), e operar blue/green por tenant.

⸻

1) Resolução de Tenant (determinística)

Ordem de precedência (qualquer rota HTTP/WS):
	1.	MCP: meta.scope.tenant (canônico).
	2.	Header: X-Ubl-Tenant.
	3.	Host: mapa Host→Tenant.
	4.	Fallback: TENANT_DEFAULT = "ubl".

Vars do Worker

[vars]
TENANT_DEFAULT = "ubl"
TENANT_HOST_MAP = '{"api.ubl.agency":"ubl","voulezvous.tv":"voulezvous"}'
ACCESS_AUD_MAP  = '{"ubl":"AUD_UBL","voulezvous":"AUD_VVZ"}'
ACCESS_JWKS_MAP = '{"ubl":"https://team-ubl/certs","voulezvous":"https://team-vvz/certs"}'

Função (pseudocódigo)

function resolveTenant(req, isMcp, meta) {
  if (isMcp && meta?.scope?.tenant) return meta.scope.tenant;
  const hdr = req.headers.get("x-ubl-tenant"); if (hdr) return hdr;
  const host = new URL(req.url).host.toLowerCase();
  const map = JSON.parse(TENANT_HOST_MAP); return map[host] || TENANT_DEFAULT;
}

Resultado: nenhuma UI decide tenant; o Edge decide sempre igual.

⸻

2) Política por Tenant (Chip-as-Code)

Cada tenant tem pack assinado e YAML na KV, com chaves padronizadas:

policy:{TENANT}:yaml
policy:{TENANT}:pack
policy:{TENANT}:yaml_next
policy:{TENANT}:pack_next

Padrões de bits (exemplos)
	•	Comuns: P_Transport_Secure, P_Device_Identity, P_User_Passkey, P_Rate_Bucket_OK.
	•	ubl (admin): P_Is_Admin_Path, P_Webhook_Verified, W_Admin_Only.
	•	voulezvous (app): P_Is_MCP, P_Is_App_Origin(voulezvous.tv), W_App_ZeroTrust.

Outputs típicos
	•	allow_mcp (app) → /mcp
	•	allow_admin_write (admin) → /admin/**
	•	deny_rate_limit, deny_policy_fail (com ErrorToken).

Promoção blue/green por tenant
	1.	Assinar → pack_next.
	2.	/_reload?stage=next&tenant={id}.
	3.	Validar smoke.
	4.	Promover → pack (prod).
	5.	Retenção da pack_prev p/ rollback.

⸻

3) Identidade & Acesso (por tenant)
	•	Cloudflare Access: uma app por tenant (AUD/JWKS distintos).
	•	mTLS: certificados emitidos pela CA interna (LAB 256) — exigidos pelo Caddy/Proxy.
	•	MCP: meta.scope.tenant obrigatório; ABAC filtra tools/list por tenant.

Regra: não há credenciais compartilhadas entre tenants.

⸻

4) Armazenamento & Namespaces (isolamento forte)

KV (global, com prefixo)
	•	kv:{tenant}:* (configs, ponteiros, índices simples).
	•	Política: policy:{tenant}:*.

R2 (objetos)
	•	Bucket único, prefixos: tenants/{tenant}/…
	•	Classes para custo: tenants/{tenant}/vod/ (Hot→Standard/IA por ciclo), …/logs/ (IA/Cold).

Postgres (LAB 256)
	•	Tabelas com coluna tenant_id (NOT NULL) + RLS por tenant.
	•	Índices compostos: (tenant_id, *).
	•	Backups: pg_dump diário → R2 tenants/ubl/backups/postgres/YYY….
	•	Nunca cruzar tenants em queries sem tenant_id.

DO / D1 (controle)
	•	DO por tipo; chave composta inclui tenant: office_session:{tenant}:{session_id}.
	•	D1 opcional para catálogos (tool registry por tenant).

⸻

5) CORS, Origens & Headers (por tenant)
	•	ALLOWED_ORIGINS = { "voulezvous.tv": "voulezvous" }
	•	CORS devolve Access-Control-Allow-Origin coerente com tenant resolvido.
	•	Vary: Origin sempre.
	•	Cookies de sessão (se houver): SameSite=Lax, Secure, HttpOnly.

⸻

6) ABAC/Quotas/Idempotência (escopo tenant)
	•	ABAC avalia primeiro por tenant (deny explícito > allow específico > allow genérico > deny default).
	•	Quotas & rate: tabelas fechadas por session_type (work/assist/deliberate/research) — por tenant.
	•	Idempotência: cache por sessão e por tenant ({tenant}:{client_id}:{op_id}).

⸻

7) Observabilidade & Custos (por tenant)
	•	Métricas (Prom/OTel): label obrigatório tenant.
	•	Logs server-blind: campos fixos + tenant. Sem payloads em claro.
	•	Custos:
	•	Transferência (egress R2/Workers) por tenant (sum por prefixo + métricas).
	•	Armazenamento (R2 objeto; Postgres tamanho por schema/relfilenode).
	•	CPU Edge/DO: contadores por tenant (meter no Worker/DO).
	•	SLOs por tenant (p99 tool/call < 300 ms; erro < 1%).

⸻

8) Deploy & Rotação (por tenant)
	•	Infra (Worker/Proxy/Core API) é única; o que muda por tenant é KV/Access/policy.
	•	Pipeline:
	1.	Validar pack_next no tenant alvo.
	2.	wrangler kv key put (namespaced).
	3.	/_reload?stage=next&tenant=…
	4.	Smoke por tenant.
	5.	Promover a prod.
	•	Rollback: apontar pack para pack_prev do tenant.

⸻

9) Segurança (invariantes)
	•	Sem segredos cross-tenant.
	•	RLS ativa no Postgres.
	•	Zero-Trust em Edge e Proxy (mTLS + Access).
	•	Política do tenant sempre antes do roteamento sensível.
	•	Headers de appsec fixos (HSTS, CSP estrita para consoles, etc.).

⸻

10) Testes de Aceite (matriz por tenant)

Por tenant (ubl, voulezvous, …):
	1.	Health/Warmup: GET /warmup (200).
	2.	Policy status: GET /_policy/status (version/stage coerentes).
	3.	MCP tools/list: com meta.scope.tenant = {tenant} → lista correta; sem -320xx indevido.
	4.	Admin gate: /admin/**
	•	ubl → 200 (com Access)
	•	voulezvous → 403 (FORBIDDEN)
	5.	CORS: origem https://voulezvous.tv → Allow-Origin correto.
	6.	Rate/Quota: estourar → BACKPRESSURE/RATE_LIMIT com retry_after_ms.
	7.	Idempotência: repetir op_id → mesmo result (cached=true).
	8.	Logs/Métricas: presença da label tenant.

⸻

11) Runbook (rotina do dia a dia)
	•	Novo tenant:
	1.	Adicionar a TENANT_HOST_MAP.
	2.	Criar Access App → preencher ACCESS_*_MAP.
	3.	Gerar policy:{new}:yaml/pack.
	4.	Publicar em KV; /_reload?stage=next&tenant={new}.
	5.	Smoke + promover.
	•	Rotação de chave/política: repetir ciclo por tenant.
	•	Incidente: travar pelo Output deny da política do tenant; rollback do pack local ao tenant.
	•	Backup: Postgres diário + R2 replicado; exercícios mensais de restore por tenant.

⸻

12) Contratos mínimos (para todos os componentes)
	•	Headers de entrada sempre considerados:
	•	Cf-Access-Jwt-Assertion (se requerido pelo tenant)
	•	X-Ubl-Tenant (opcional — override)
	•	Origin (CORS)
	•	MCP meta: scope.tenant obrigatório; sem isso → FORBIDDEN_SCOPE.
	•	ErrorToken fechado (com retry_after_ms quando cabível).

⸻

13) Exemplo “ativar dois tenants”

KV

# UBL (admin)
wrangler kv key put --binding=POLICY_KV policy:ubl:yaml  @policies/ubl_core_v3.yaml
wrangler kv key put --binding=POLICY_KV policy:ubl:pack  @/tmp/ubl_pack_v3.json
# VOULEZVOUS (app)
wrangler kv key put --binding=POLICY_KV policy:voulezvous:yaml @policies/vvz_core_v1.yaml
wrangler kv key put --binding=POLICY_KV policy:voulezvous:pack @/tmp/vvz_pack_v1.json

Reload (next)

curl -s "https://api.ubl.agency/_reload?stage=next&tenant=ubl"
curl -s "https://api.ubl.agency/_reload?stage=next&tenant=voulezvous"

Smoke (MCP)

node scripts/ws-call.mjs tools/list --wss wss://api.ubl.agency/mcp --meta '{
 "client_id":"dev:kit",
 "op_id":"01X-VVZ",
 "session_type":"work",
 "mode":"commitment",
 "scope":{"tenant":"voulezvous"}
}'


⸻

14) DoD (Definition of Done)
	•	TENANT_HOST_MAP ativo; TENANT_DEFAULT=ubl.
	•	ACCESS_*_MAP preenchidos; Access Apps criadas por tenant.
	•	policy:{tenant}:pack publicados (ubl + voulezvous).
	•	/_policy/status OK por tenant; reload next→prod funcionando.
	•	CORS coerente por tenant; Vary: Origin.
	•	Admin gate: ubl=200, voulezvous=403 em /admin/**.
	•	Métricas/logs com label tenant.
	•	Backups e RLS verificados.
	•	Matriz de testes (item 10) PASS para cada tenant.

⸻

15) Por que isso é “solução permanente”
	•	Código único; variam só políticas/vars por tenant.
	•	Rollback atômico por tenant (sem afetar os demais).
	•	Custos, métricas e SLAs segregados.
	•	Chip-as-Code como fonte de verdade do comportamento (audível e versionável).
	•	Cresce para N tenants sem bifurcar repositório.

Se quiser, eu já te entrego um vvz_core_v1.yaml inicial (com W_App_ZeroTrust, MCP e CORS de voulezvous.tv) pronto para assinar e subir nas chaves policy:voulezvous:*.