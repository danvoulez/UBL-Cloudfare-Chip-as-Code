Blueprint 01 — Edge Gateway (Worker + Chip). Se curtir, na próxima mando o do Policy-Proxy.

Blueprint 01 — Edge Gateway (Worker + Chip)

1) Propósito

Primeira barreira de verdade. O Worker no Edge:
	•	avalia a Constituição (YAML v3),
	•	aplica rate-limit leve,
	•	valida webhooks,
	•	e roteia para os serviços internos via Tunnel — só se a política permitir.

2) Interfaces (públicas)
	•	GET /warmup → sanity + hash do pack ativo
	•	POST /panic/on { ttl_sec, reason } (só ubl-ops)
	•	POST /panic/off (só ubl-ops)
	•	/* → gateway/roteador: /core/**, /admin/**, /files/**, /webhooks/**

Encaminhamento sugerido

Prefixo	Upstream (via Tunnel)	Notas
/core/*	https://origin.core.local	Core API (Axum)
/admin/*	https://origin.core.local	mesma API; chip exige ubl-ops
/files/*	https://origin.core.local	presign R2
/webhooks/*	https://origin.webhooks.local	serviço leve de webhooks

A autenticação Cloudflare Access fica antes do Worker. O mTLS é cobrado no Caddy/Proxy local.

3) Política aplicada (chips)

Usa o pack YAML v3 (assinado):
	•	Bits: P_Transport_Secure, P_Device_Identity, P_User_Passkey, P_Rate_Bucket_OK, P_Is_Admin_Path, P_Role_Admin, P_Webhook_Verified, P_Legacy_JWT (off)
	•	Wires: W_ZeroTrust_Standard, W_Admin_Path_And_Role, W_Webhook_Trusted, W_Public_Warmup
	•	Saídas: deny_rate_limit, allow_admin_write, allow_webhook, allow_standard_access, allow_public_warmup, deny_invalid_access

4) Contexto que o Worker monta

{
  "transport": { "tls_version": 1.3 },
  "mtls": { "verified": true, "issuer": "UBL Local CA" },     // via header de origem (Proxy)
  "auth": { "method": "webauthn", "rp_id": "app.ubl.agency" },// via Access
  "user": { "groups": ["ubl-ops"] },                          // via Access
  "req": { "path": "/admin/deploy", "method": "POST" },
  "rate": { "ok": true },
  "webhook": { "verified": false },
  "legacy_jwt": { "valid": false }
}

5) Estado/KV (chaves)
	•	policy_yaml_active, policy_pack_active (ou policy_active=next/prev)
	•	rate:{sub}:{route} → contadores de janela (ex.: 60 req/60s)
	•	panic_ttl_until → ISO timestamp quando pânico deve expirar
	•	webhook:partner:<name> → {alg, secret|pubkey}

6) Variáveis de ambiente (Worker)
	•	ACCESS_AUD (Audience da app)
	•	ACCESS_JWKS (URL do JWKS do Access)
	•	POLICY_PUBKEY_B64 (chave pública Ed25519 do pack)
	•	UPSTREAM_CORE, UPSTREAM_WEBHOOKS (URLs dos upstreams via Tunnel)

7) Segurança
	•	Nunca armazenar chave privada de política no Edge.
	•	Headers de confiança: preserve Cf-Access-* até a origem; nunca ecoe JWT.
	•	No pânico, sempre TTL + log; sem “toggle permanente”.

8) Deploy (CLI — curto e completo)

# 1) KV e variáveis
wrangler kv namespace create UBL_FLAGS || true

# 2) Publicar o pack assinado em sombra (Blueprint 01: shadow → promote)
wrangler kv key put --binding=UBL_FLAGS policy_yaml_next --path=policy/ubl_core_v3.yaml
wrangler kv key put --binding=UBL_FLAGS policy_pack_next --path=policy/pack.json

# 3) Configurar env (vars ou secrets)
# Vars (públicas): editar wrangler.toml [vars]
# Secrets (privadas): wrangler secret put ACCESS_AUD
wrangler secret put ACCESS_AUD
wrangler secret put ACCESS_JWKS
wrangler secret put POLICY_PUBKEY_B64
# UPSTREAM_CORE e UPSTREAM_WEBHOOKS podem ser vars (não sensíveis)

# 4) Deploy
wrangler deploy

# 5) Promover política (ativação)
wrangler kv key put --binding=UBL_FLAGS policy_yaml_active --path=policy/ubl_core_v3.yaml
wrangler kv key put --binding=UBL_FLAGS policy_pack_active --path=policy/pack.json
# Worker carrega automaticamente policy_*_active (com fallback para policy_*)

9) Proof of Done (checks objetivos)
	•	GET /warmup → { "ok": true, "blake3": "<hash-do-pack>" }
	•	GET /admin/ping sem ubl-ops → 403
	•	GET /admin/ping com ubl-ops → 200
	•	disparo de 20 req/seg em /core/whoami → alguns 429 (rate-limit ativo)
	•	POST /webhooks/acme com X-Signature válida → 204; assinatura inválida → 403

10) Runbook (incidentes comuns)
	•	403 em tudo → conferir Access (AUD/JWKS) e policy_yaml_active (hash bate com o pack?)
	•	429 generalizado → revisar limites e reset parcial de buckets rate:*
	•	Pânico travado → limpar panic_ttl_until na KV e reexecutar /panic/off
	•	Roteamento quebrado → checar UPSTREAM_* e status do Tunnel

11) Rollback simples
	•	wrangler rollback (volta o Worker para build anterior)
	•	sobrescrever KV com policy_*_prev e redeploy
	•	GET /warmup deve refletir o blake3 antigo

12) Extensões (opcionais)
	•	Quota diária: KV quota:{sub}:YYYYMMDD (álgebra simples no Edge)
	•	A/B de política: policy_yaml_canary por subset de grupos/rotas (com métrica isolada)
	•	Caching de resoluções do chip por rota curta (apenas para GET)

⸻

