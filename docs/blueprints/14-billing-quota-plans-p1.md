Blueprint 14 — Billing/Quota & Plans (P1)

0) Resultado que queremos (em 1 frase)

Cobrar/limitar de forma previsível por tenant com auditoria completa (UBL), sem gambiarras, usando token-bucket em tempo-real para requests e rating batch para bytes/minutos.

⸻

1) O que é medido (tabela fechada v1)

Métrica	Unidade	Quando mede	Como usa
tool_call	call	Toda tool/call (Gateway/Office)	Quota + Billing
messenger_envelope	item	Envio de envelope cifrado	Quota + Billing
rtc_min	min	Tempo conectado em WebRTC	Billing (batch)
egress_bytes	byte	HLS/DASH/HTTP (Stage/Playback)	Billing (batch)
storage_bytes_month	B·mo	R2 (mídia armazenada)	Billing (batch)
encode_min	min	Transcode/packaging	Billing (batch)

Request-bound (tempo real): tool_call, messenger_envelope
Batch-bound (rating por janela): rtc_min, egress_bytes, storage_bytes_month, encode_min

⸻

2) Onde ficam as verdades
	•	Tempo real (limite/consumo): QuotaDO (Durable Object por tenant_id), autoritativo.
	•	Auditoria imutável: UBL ledger (JSON✯Atomic) — todos os “usage.events.*” mínimos.
	•	Consulta/relatório: D1 (ou Postgres no LAB 256) via BillingIndexer (cron) agregando do ledger/logs.
	•	Planos/creditos/flags: KV (rápido) + sombra em D1 (consistência).

⸻

3) Chaves & Schemas (KV + D1)

3.1 KV (config de plano/limites)
	•	plans/{plan_id} → JSON do plano (ver 3.3)
	•	tenant/{tenant_id}/plan_id → pro, business, etc.
	•	tenant/{tenant_id}/credits → inteiro (créditos livres)
	•	limits/{tenant_id} → JSON de buckets efetivos (merge plan + overrides)

3.2 D1 (relato consolidado)
	•	usage_daily(tenant_id, yyyymmdd, meter, qty) — somas por dia/métrica
	•	charges_monthly(tenant_id, yyyymm, amount_cents, detail_json) — fechamento
	•	credits_ledger(id, tenant_id, delta, reason, ts) — créditos

3.3 Plan schema (exemplo)

{
  "plan_id": "pro",
  "features": {
    "stage_live": true,
    "vod": true,
    "roulette": true
  },
  "buckets": {
    "tool_call":         { "rate_per_min": 120, "burst": 240, "daily_cap": 5000 },
    "messenger_envelope":{ "rate_per_min": 300, "burst": 600, "daily_cap": 20000 },
    "rtc_min":           { "monthly_quota": 5000 },
    "egress_bytes":      { "monthly_quota": 200000000000 },  // 200 GB
    "storage_bytes_month": { "monthly_quota": 50000000000 }, // 50 GB·mo
    "encode_min":        { "monthly_quota": 1000 }
  },
  "rating": {
    "overage": {
      "tool_call": 0.002,            // $0.002 por call excedente
      "messenger_envelope": 0.0005,
      "rtc_min": 0.01,
      "egress_gb": 0.08,
      "storage_gb_month": 0.02,
      "encode_min": 0.05
    }
  },
  "stripe": { "price_ids": { "monthly": "price_..." } }
}


⸻

4) Enforcement (ordem e decisões)
	1.	ABAC / Autenticação / Idempotência (já definidos)
	2.	QuotaDO.check_and_consume(meta, cost):
	•	token-bucket por métrica request-bound
	•	retorna OK ou BACKPRESSURE (preferível) ou RATE_LIMIT (vocabulário fechado de ErrorToken)
	3.	Se OK: executa a operação; emite usage.event.min (UBL) mínimo (sem payload sensível)
	4.	Batch rating: BillingIndexer agrega rtc/egress/storage/encode e grava em D1; calcula excedentes/overage

Insucesso: manter o vocabulário de erro fechado (sem inventar “INSUFFICIENT_CREDITS”). Use RATE_LIMIT com remediação “Upgrade plan / add credits”.

⸻

5) Fluxos

5.1 tool_call / messenger (tempo real)
	•	Gateway/Office → QuotaDO.consume("tool_call", 1)
	•	Se exceder rate/burst: BACKPRESSURE (com retry_after_ms)
	•	Se exceder daily_cap: RATE_LIMIT
	•	Ledger: usage.event.min com {meter:"tool_call", qty:1}

5.2 RTC minutes (batch)
	•	Room server escreve rtc.session.started/ended no UBL (durations)
	•	Indexer (cron 1 min): soma minutos por tenant/dia → D1
	•	Se ultrapassa monthly_quota: marca excedente para cobrança

5.3 Egress (HLS/DASH)
	•	Worker de playback mede bytes servidos por request (counter in-process) e envia amostras ao ledger (ou Logpush → R2 → Indexer)
	•	Indexer agrega por dia → D1 (egress_bytes)

5.4 Storage (R2)
	•	Nightly: lista objetos por tenant (ou usa inventário R2) → calcula GB·month proporcional → D1

5.5 Encode
	•	Pipeline de mídia emite encode.job.completed {minutes} → ledger → D1

5.6 Créditos e cobrança
	•	Stripe webhook (/billing/webhooks/stripe) → credits_ledger (+delta) e atualiza tenant/.../credits
	•	Fechamento mensal gera charges_monthly e envia invoice (ou desconta créditos)

⸻

6) APIs (admin + públicas)

6.1 Admin (hardenizado /admin/**)
	•	POST /admin/billing/plans — cria/atualiza plano (KV + D1)
	•	POST /admin/billing/tenants/{id}/plan — atribui plano ao tenant
	•	POST /admin/billing/tenants/{id}/credits/grant — adiciona créditos
	•	GET  /admin/billing/tenants/{id}/usage?from=&to= — relatório (D1)
	•	POST /admin/billing/promote-next — promove config staged (blue/green)

6.2 Públicas (tenant-escopo)
	•	GET  /billing/me/plan — plano efetivo + limites
	•	GET  /billing/me/usage/daily?from=&to= — visão por dia/métrica
	•	GET  /billing/me/costs/estimate — estimativa do mês corrente

Todas retornam server-blind (sem PII/payloads), só números e estados.

⸻

7) QuotaDO (contrato mínimo)

ID DO: quota:{tenant_id}

Métodos:
	•	check_and_consume({ meter, qty, window }) -> { ok, retry_after_ms? }
	•	refund_idem({ op_key }) — devolve consumo em caso de dedupe idempotente
	•	snapshot() — devolve counters minuto/dia/mês (para debug/admin)

Estados:
	•	Buckets (rate, burst, daily_cap) by meter
	•	Rolling counters (dia/mes) por meter
	•	Cache de idempotência (client_id:op_id → debit)

⸻

8) Ledger (usage events mínimos)

Exemplo (JSON✯Atomic):

{
  "id":"01JUSAGE...",
  "ts":"2026-01-04T16:10:00Z",
  "kind":"usage.event.min",
  "scope":{"tenant":"ubl","entity":null},
  "actor":"gateway",
  "refs":[],
  "data":{"meter":"tool_call","qty":1,"op_id":"01HOP..."},
  "meta":{"v":1},
  "sig":null
}

Sem payload sensível; só o necessário para auditoria.

⸻

9) Observabilidade & Alarmes (ligam SLOs do Blueprint 11)
	•	Métricas:
	•	quota.backpressure.count{meter,tenant}
	•	quota.ratelimit.count{meter,tenant}
	•	usage.request_bound{meter,tenant} (calls)
	•	usage.batch_bound{meter,tenant} (bytes/min)
	•	Alarmes:
	•	Backpressure > 5% por 5 min (por meter)
	•	90% de monthly_quota atingido (evento para Messenger/Admin)

⸻

10) Segurança & Governança
	•	/admin/ sob W_Admin_Path_And_Role (já aplicado)
	•	Alterações de plano/limite passam por policy v3 (Chip-as-Code, next→current)
	•	Todos os “rate decisions” devolvem ErrorToken com remediação curta

⸻

11) Migrações & Compatibilidade
	•	Migrar perfis de session_type (Office) → limits/{tenant} para manter coerência
	•	Se não existir plano: default = free (limites conservadores)
	•	Não quebrar vocabulário de erro (fechado)

⸻

12) Checklist (uma tela)

Infra
	•	☐ DO QuotaDO publicado e roteado por tenant_id
	•	☐ KV: plans/pro + tenant/* seeds
	•	☐ D1: usage_daily, charges_monthly, credits_ledger criadas

Tempo real
	•	☐ Gateway/Office chamam QuotaDO.check_and_consume em tool_call/messenger_envelope
	•	☐ ErrorToken: BACKPRESSURE / RATE_LIMIT coerentes

Batch
	•	☐ BillingIndexer (cron) agregando rtc_min, egress_bytes, storage_bytes_month, encode_min
	•	☐ Webhook Stripe → créditos

Auditoria
	•	☐ usage.event.min no ledger para tudo request-bound
	•	☐ Relatório /billing/me/usage/daily ok

Feature
	•	☐ /billing/me/plan mostra limites efetivos (merge plan+override)

⸻

13) Proof of Done (objetivo verificável)
	1.	Faça 1000 tool_call num tenant “pro”; receba BACKPRESSURE (janela) e RATE_LIMIT (cap diário) nos pontos certos, sempre com ErrorToken.
	2.	Suba um Stage por 3 min e toque por browser; Indexer reporta rtc_min e egress_bytes não-zero no D1.
	3.	Rode o relatório GET /billing/me/usage/daily?from=today-1d&to=today e veja as 5 métricas populadas.
	4.	Dê +1000 créditos via admin e repita tool_calls: consumo excedente passa, charges calculadas com overage.

⸻

Pergunta única

Quer que eu gere o esqueleto de código (Axum handlers + QuotaDO stub + Indexer cron + schemas D1/KV) com esses nomes/paths para você colar no repo agora?