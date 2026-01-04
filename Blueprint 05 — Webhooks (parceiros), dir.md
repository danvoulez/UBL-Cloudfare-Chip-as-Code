Blueprint 05 — Webhooks (parceiros), direto, seguro e pronto pra plugar no chip.

05) Webhooks — verificação de assinatura + dedupe + reentrega

1) Propósito

Receber eventos de parceiros com prova, validar no Edge (chip), deduplicar, registrar no ledger e entregar internamente (Core/API). Sem prova → nega.

⸻

2) Interfaces (públicas)
	•	POST /webhooks/{partner} — recebe JSON; responde 204 se aceito.
	•	GET  /webhooks/_health — { ok:true } (para monitoramento).

Headers exigidos (mínimo):
	•	X-Timestamp (ISO ou unix seconds) — tolerância: ±300s
	•	X-Key-Id (identifica a chave/config do parceiro)
	•	X-Signature (formato scheme=...,sig=...)
	•	hmac-sha256=<base64> ou ed25519=<base64>

Body: JSON UTF-8 (máx. 256 KB). Tipos diferentes por parceiro → validação por schema.

⸻

3) Política (Chip-as-Code)
	•	Bit: P_Webhook_Verified (setado no Edge quando a assinatura confere).
	•	Wire: W_Webhook_Trusted → allow_webhook (204).
	•	Rate: P_Rate_Bucket_OK também vale (limite leve por X-Key-Id).

Se a verificação falhar: deny_invalid_access (403) e não toca backend.

⸻

4) Verificação de assinatura (Edge)

Base string: base = X-Timestamp + "." + raw_body

4.1 HMAC-SHA256
	•	Busca secret pela combinação {partner, X-Key-Id} (KV segura).
	•	calc = base64( HMAC_SHA256(secret, base) )
	•	constantTimeEqual(calc, X-Signature[hmac-sha256])

4.2 Ed25519
	•	Busca publicKey por {partner, X-Key-Id} (KV segura).
	•	verify_ed25519(publicKey, message=base, signature=base64(sig))

Replay protection:
	•	Rejeita se |now - X-Timestamp| > 300s.
	•	Dedupe por event_id (se existir) ou por sha256(base):
	•	KV wh:seen:{partner}:{hash} com TTL 24h → se existir, responde 204 (idempotente), sem reprocessar.

Contexto para o chip:

{
  "webhook": { "verified": true, "partner": "acme", "key_id": "k1" },
  "req": { "path": "/webhooks/acme", "method": "POST" }
}


⸻

5) Entrega interna (pós-verificação)

Sequência recomendada:
	1.	LogLine (linha curta no ledger: recebido+verificado).
	2.	Persist (append-only, Postgres: webhook_events).
	3.	Dispatch para o Core:
	•	síncrono: POST http://127.0.0.1:9458/core/hooks/ingest
	•	se 5xx → fila local (arquivo/DO/DB) e backoff exponencial com jitter.

Backoff sugerido: 2s, 4s, 8s, 16s, 32s (máx. 10 tentativas) → depois DLQ (R2).

⸻

6) Dados/Estado

6.1 KV (Edge)
	•	webhook:partner:<name>:key:<id> → { scheme, secret|publicKey, algo }
	•	wh:seen:{partner}:{hash} → dedupe TTL 24h

6.2 Postgres (LAB 256)

create table webhook_events (
  id            text primary key,         -- partner_event_id ou sha256(base)
  partner       text not null,
  key_id        text not null,
  ts_received   timestamptz not null default now(),
  payload       jsonb not null,
  status        text not null,            -- received|dispatched|failed|dlq
  attempts      int not null default 0,
  last_error    text
);
create index webhook_events_status_idx on webhook_events(status);

6.3 R2 (DLQ)
	•	r2://ubl-dlq/webhooks/{partner}/{date}/{id}.json (payload + metadados).

⸻

7) Segurança
	•	Body limit 256 KB; content-type: application/json obrigatório.
	•	Strict parsing do JSON (sem BOM, sem controle).
	•	Clock drift: sincronizar NTP no LAB 256.
	•	Chaves: rotação com janelas de sobreposição (aceitar K-1 e K na transição).
	•	Sem eco de segredos em respostas ou logs.

⸻

8) Deploy (CLI compacto)

8.1 Edge (config da KV)

# ACME por HMAC
wrangler kv key put --namespace UBL_POLICY webhook:partner:acme:key:k1 \
'{"scheme":"hmac","algo":"sha256","secret":"BASE64_OR_HEX"}'

# BETA por Ed25519
wrangler kv key put --namespace UBL_POLICY webhook:partner:beta:key:k9 \
'{"scheme":"ed25519","publicKey":"BASE64"}'

8.2 Serviço local (webhooks)
	•	Porta: 127.0.0.1:9460
	•	ENV:

PORT=9460
DATABASE_URL=postgres://ubl_ops:*****@127.0.0.1:5432/ubl
DISPATCH_URL=http://127.0.0.1:9458/core/hooks/ingest
DLQ_R2_BUCKET=ubl-dlq
RETRY_MAX=10
RETRY_BASE_SECONDS=2

	•	systemd para iniciar em boot; health em /webhooks/_health.

8.3 Roteamento
	•	Worker: /webhooks/* → UPSTREAM_WEBHOOKS
	•	Proxy revalida (opcional) e encaminha para 127.0.0.1:9460.

⸻

9) Proof of Done (testes objetivos)
	1.	Assinatura válida (HMAC):
	•	Gere X-Timestamp=$(date -u +%s) e X-Signature com o mesmo secret.
	•	curl -i -X POST https://api.ubl.agency/webhooks/acme ...
→ 204; linha no ledger; linha received no Postgres.
	2.	Assinatura inválida:
→ 403; sem toque no Core; métrica policy_deny_total{reason="policy_fail"} ↑.
	3.	Replay (mesmo body+timestamp):
→ 204 idempotente, sem nova entrega.
	4.	Backoff: simular DISPATCH_URL offline → attempts ↑ até DLQ no R2.

⸻

10) Runbook (incidentes comuns)
	•	403 inesperado: conferir drift de relógio, X-Key-Id, se a KV tem a chave certa, e se o Edge atualizou (/_reload e hash do pack).
	•	loop de retries: ver o erro raiz no last_error; se for schema inválido, não adianta retry (mover direto p/ DLQ).
	•	parceiro trocou chave: carregar a nova entrada KV como k2, aceitar k1 e k2 por 24h, depois remover k1.

⸻

11) Extras úteis
	•	Schema por parceiro (AJV/Valibot): valida antes de despachar.
	•	Assinatura de resposta (não-repúdio): setar X-Policy-Sign no 204.
	•	Observabilidade: métrica por parceiro (webhook_received_total{partner=...}), falhas e tempo até despacho.
	•	Sandbox local: endpoint POST /webhooks/_simulate (loopback-only) pra gerar eventos de teste com assinatura fake.

⸻

12) Exemplo de assinatura (HMAC) — client de teste

ts=$(date -u +%s)
body='{"event":"ping","id":"e_123"}'
base="${ts}.${body}"
sig=$(printf "%s" "$base" | openssl dgst -sha256 -hmac "$SECRET" -binary | openssl base64 -A)
curl -i -X POST "https://api.ubl.agency/webhooks/acme" \
  -H "content-type: application/json" \
  -H "X-Timestamp: $ts" \
  -H "X-Key-Id: k1" \
  -H "X-Signature: hmac-sha256=${sig}" \
  --data "$body"


⸻

