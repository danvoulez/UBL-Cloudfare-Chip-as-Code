Blueprint 09 — Observabilidade & Auditoria (server-blind)

Versão: v1.0 • Data: 2026-01-03 • Status: P0 Canônico
Escopo: métrica + log + trilha para Gateway (Worker), Policy-Proxy (LAB 256), Core API (Axum) e Office (RoomDO). Tudo server-blind, alinhado à Constituição, ErrorToken e JSON✯Atomic.

⸻

0) Invariantes (não negociáveis)
	•	MUST não registrar plaintext de conteúdo (mensagens, prompts, anexos).
	•	MUST usar ErrorToken (vocabulário fechado) em erros de API/MCP.
	•	MUST separar 3 planos: Métricas (Prometheus), Logs (JSONL server-blind), Trilhas/Audit (JSON✯Atomic).
	•	SHOULD amostrar sucesso (≤1%) e 100% dos erros.
	•	MAY assinar trilhas com Ed25519 (sig) quando exigido.

⸻

1) Plano de Métricas (Prometheus)

1.1 Exporters / emissões
	•	Policy-Proxy (LAB 256) e Core API (Axum): /metrics (Prom-native).
	•	Worker (Cloudflare): envia OTLP/HTTP → Collector no LAB 512 (traduz para Prom).
	•	Office (RoomDO): expõe /metrics (Axum).

1.2 Nomes (prefixo por domínio)
	•	gateway_http_requests_total{route,method,code}
	•	gateway_http_request_duration_seconds_bucket{route}
	•	gateway_backpressure_count
	•	office_mcp_call_total{tool,ok}
	•	office_mcp_call_duration_seconds_bucket{tool}
	•	office_ws_reconnect_ms_bucket
	•	core_db_query_seconds_bucket{op}
	•	core_rate_limit_hits_total{bucket}
	•	policy_eval_total{decision} (allow/deny/backpressure/rate_limit)
	•	webhook_delivery_total{dest,ok} / _duration_seconds_bucket
	•	media_presign_total{ok}

1.3 SLOs (e orçamentos)
	•	Gateway/Core: p99 < 300ms em rotas internas; erro < 0.3%.
	•	Office: WS reconnect < 500ms p95; tool/call p99 < 300ms.
	•	Backpressure: p95 < 2% por 5min; >5% aciona alerta.

1.4 Alertas (multi-burn rate)
	•	SLO Latência: p99>300ms (5m & 30m).
	•	Erro 5xx: erro_rate>1% (5m) OU >0.3% (1h).
	•	BACKPRESSURE: office_mcp_call_total{ok="false",err="BACKPRESSURE"} burn > 2% (15m).
	•	Rate Limit: picos anormais por tenant (detecção simples).
	•	JWKS/Access: falha de refresh consecutiva (>=3).

⸻

2) Plano de Logs (JSONL server-blind)

2.1 Campos permitidos (lista fechada)

ts, component, tenant, route, method, tool, session_id, correlation_id,
ok, err_token, code, latency_ms, bytes_in, bytes_out, cost_calls, node, trace_id

Proibido: params, args, payload, plaintext, ciphertext (inteiro), mensagens.

2.2 Amostragem
	•	Sucesso: 1% (ajustável por rota/tool).
	•	Erro: 100%.
	•	Picos: elevar para 10% temporariamente via flag.

2.3 Destino/retensão
	•	Em tempo real: Loki (opcional) ou arquivo local NDJSON (LAB 256).
	•	Diário: rotação para R2/MinIO → logs/yyyy/mm/dd/*.ndjson.
	•	Retenção: 30 dias (logs), 14 dias (métricas em TSDB).

⸻

3) Trilhas / Auditoria (JSON✯Atomic)

3.1 Forma canônica (ordem de chaves)

id, ts, kind, scope, actor, refs, data, meta, sig

3.2 Kinds mínimos (opt-in, sem conteúdos)
	•	office.tool_call (tool, args_min, cost)
	•	office.event (brief.delta_min)
	•	office.handover (summary_min, counters)
	•	gateway.request_min (route, method, cost)
	•	policy.eval_min (bits, decision)
	•	auth.login_min / access.denied_min
	•	media.presign_min (bytes clas.)
	•	webhook.delivery_min (dest, state)

args_min: apenas IDs, tipos e contadores (nunca texto livre).

3.3 Assinatura (opcional por tenant)
	•	Campo sig com Ed25519 (hash BLAKE3).
	•	Bucket: audit/yyyy/mm/dd/*.ndjson (7–90 dias, por política).

⸻

4) Backpressure & Rate (observável)
	•	Quando exceder quotas: retornar ErrorToken BACKPRESSURE ou RATE_LIMIT com retry_after_ms.
	•	Métricas: contadores específicos por session_type.
	•	UI: Messenger exibe retry suave (silencioso) e degradação (ex.: truncar refs 100→40→10).

⸻

5) Health, Debug & Safe-ops

5.1 Endpoints
	•	/_health (liveness/readiness simples)
	•	/_metrics (Prometheus)
	•	/_trace/:id (lookup de trace_id → mostra apenas metadados)
	•	/_reload?stage=next (já existente; auditável)

5.2 Safe-ops
	•	Feature-flags (amostragem, níveis de log) via KV/env.
	•	Blue/Green para Policy e Worker (já definido na Constituição).
	•	Chaos Light: injetar 1% delay 120–300ms em sandbox para validar backpressure.

⸻

6) Integração por componente

6.1 Gateway (Worker)
	•	Envia contadores/latência via OTLP/HTTP → Collector (LAB 512).
	•	Log push server-blind (NDJSON) → R2.
	•	Emite trilhas gateway.request_min, policy.eval_min (minificado).

6.2 Policy-Proxy (LAB 256, Rust)
	•	/metrics nativo; tracing → stdout JSONL.
	•	Emite policy.eval_min + access.denied_min.
	•	Expõe /_health com snapshot de buckets (rate).

6.3 Core API (Axum)
	•	Middlewares: tracing, ErrorToken on fail, sampling.
	•	Métricas por rota; DB timings (core_db_query_seconds_bucket).
	•	Trilhas para mudanças significativas (append_link/event minificado).

6.4 Office (RoomDO)
	•	Contadores de tool/call, latência, WS reconnect.
	•	Trilhas opt-in: office.* (min).
	•	NUNCA conteúdo de mensagens.

⸻

7) Dashboards (Grafana — P0)
	1.	Executive

	•	Latência p50/p95/p99 por domínio
	•	Erro % por domínio
	•	BACKPRESSURE últimos 24h
	•	Top tenants por consumo

	2.	Office/MCP

	•	tool/call por tool
	•	Reconnect WS p95
	•	ErrorToken breakdown

	3.	Gateway

	•	Latência por rota interna
	•	Access/JWKS health
	•	Webhook deliveries ok/fail

	4.	Core API

	•	DB timings por operação
	•	Rate limits por bucket
	•	Throughput por tenant

⸻

8) Segurança & Privacidade
	•	Sem PII em métricas/logs/trilhas.
	•	Lista fechada de campos.
	•	Redação automática de valores fora da whitelist.
	•	Assinatura opcional de trilhas (integridade).
	•	Acesso a dashboards por ABAC (ops-only).

⸻

9) P0 (escopo fechadinho)
	•	Exporters/OTLP funcionando (Gateway→Collector).
	•	/metrics em Core/Office/Proxy.
	•	Logs JSONL server-blind com amostragem.
	•	Trilhas JSON✯Atomic (min) gravando em R2/MinIO.
	•	4 dashboards prontos + 5 alertas ativos.
	•	Script de rotação diário para NDJSON.

⸻

10) P1 (logo depois)
	•	Assinatura Ed25519 de trilhas (tenant-opt-in).
	•	/trace lookup por trace_id.
	•	Amostragem dinâmica via flag (per-route/tool).
	•	Export VOD de trilhas para auditor externo (bundle .tar.gz com manifest).

⸻

11) DoD (Proof of Done)
	1.	Carga sintética: 5k req/min → p99<300ms; erro<0.3%.
	2.	WS kill e reconectar: recupera últimos 100 eventos.
	3.	BACKPRESSURE induzido: ErrorToken com retry_after_ms correto; métricas sobem; alerta dispara.
	4.	Privacy scan: grep por campos proibidos ⇒ 0 ocorrência.
	5.	NDJSON roll diário presente em R2 com checksum.

⸻

12) Deliverables (repo)

infra/observability/
  prometheus.yml
  grafana/
    dashboards/
      00-executive.json
      10-office-mcp.json
      20-gateway.json
      30-core-api.json
  otel-collector/
    config.yaml
apps/gateway/obs/
  otlp_client.ts          # emissor OTLP/HTTP
apps/core/src/middleware/
  metrics.rs
  logging.rs
  error_token.rs
apps/office/src/
  metrics.rs
  trails_min.rs
apps/policy-proxy/src/
  metrics.rs
  trails_min.rs
jobs/
  rollup_trails_to_r2.sh  # rotação diária NDJSON


⸻

Quer que eu já te entregue os templates base (Prometheus, Collector OTLP e 2 dashboards Grafana) para você colar no repo e subir? Se sim, eu já mando prontos no próximo passo.