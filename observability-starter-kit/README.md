# Observability Starter Kit (Blueprint 09)

**Versão:** v1.0 • **Data:** 2026-01-03 • **Status:** P0 Canônico

Starter kit completo para observabilidade server-blind, alinhado à Constituição, ErrorToken e JSON✯Atomic.

---

## 📋 Estrutura

```
observability-starter-kit/
  prometheus/
    prometheus.yml          # Scrape config + alerting rules
    alerts.yml              # Multi-burn rate SLO alerts
  otel-collector/
    config.yaml             # OTLP/HTTP → Prometheus
  grafana/
    dashboards/
      00-executive.json     # Executive — Latência & Erros
      10-office-mcp.json    # Office — MCP Tooling
      20-gateway.json       # Gateway — Latência & Access
      30-core-api.json      # Core API — DB & Throughput
    provisioning/
      datasources/         # Auto-provision Prometheus
      dashboards/          # Auto-load dashboards
  README.md
```

---

## 🚀 Quick Start

### 1) OpenTelemetry Collector

O Collector recebe métricas OTLP/HTTP do Worker e expõe `/metrics` no formato Prometheus.

```bash
# Start collector
otelcol --config ./otel-collector/config.yaml

# Listens on:
# - :4318 (OTLP/HTTP) — Worker envia aqui
# - :9464/metrics (Prometheus) — Prometheus scrape aqui
```

**Worker (Cloudflare):** Configure OTLP endpoint:
```typescript
const otlpEndpoint = 'http://<collector-host>:4318/v1/metrics';
```

**Rust services (Core/Office/Policy-Proxy):** Continuam expondo `/metrics` nativo.

---

### 2) Prometheus

Edite `prometheus/prometheus.yml`:
- Substitua `lab512.local` / `lab256.local` pelos seus hosts reais.
- Confirme que o target `otel-collector` está acessível em `:9464`.

```bash
prometheus --config.file=./prometheus/prometheus.yml
```

**Jobs configurados:**
- `otel-collector` (Worker metrics via OTLP)
- `gateway` (Core API /metrics)
- `office` (Office /metrics)
- `policy-proxy` (Policy-Proxy /metrics)

**Alertas:** Carregados de `alerts.yml` (multi-burn rate SLO).

---

### 3) Grafana

**Import dashboards:**
1. Acesse Grafana UI
2. Import os 4 JSONs de `grafana/dashboards/`:
   - **00-executive.json** — Executive (Latência & Erros)
   - **10-office-mcp.json** — Office/MCP
   - **20-gateway.json** — Gateway (Latência & Access)
   - **30-core-api.json** — Core API (DB & Throughput)

**Auto-provisioning (opcional):**
- Configure `grafana/provisioning/datasources/prometheus.yml`
- Configure `grafana/provisioning/dashboards/dashboards.yml`

---

## 📊 Métricas Esperadas

Os dashboards assumem estas métricas (ajuste PromQL se necessário):

### Gateway
- `gateway_http_requests_total{route,method,code}`
- `gateway_http_request_duration_seconds_bucket{route}`
- `gateway_backpressure_count`
- `webhook_delivery_total{dest,ok}`
- `webhook_delivery_duration_seconds_bucket{dest}`

### Office/MCP
- `office_mcp_call_total{tool,ok,err}`
- `office_mcp_call_duration_seconds_bucket{tool}`
- `office_ws_reconnect_ms_bucket`

### Core API
- `core_db_query_seconds_bucket{op}`
- `core_rate_limit_hits_total{bucket}`
- `core_http_requests_total{tenant}`
- `media_presign_total{ok}`

### Policy-Proxy
- `policy_eval_total{decision,reason}`
- `jwks_refresh_failure_total`

---

## 🚨 Alertas (SLO Multi-Burn Rate)

**Gateway:**
- Latência p99 > 300ms (5m & 30m windows)
- Erro 5xx > 1% (5m) OU > 0.3% (1h)

**Office:**
- BACKPRESSURE > 2% (15m)
- WS reconnect p95 > 500ms
- MCP tool/call p99 > 300ms

**Core API:**
- DB query p99 > 500ms
- Rate limit hits > 10/min

**Policy-Proxy:**
- Policy deny rate > 10%
- JWKS refresh failures >= 3 (5m)

---

## 📝 Logs (JSONL Server-Blind)

**Campos permitidos (lista fechada):**
```
ts, component, tenant, route, method, tool, session_id, correlation_id,
ok, err_token, code, latency_ms, bytes_in, bytes_out, cost_calls, node, trace_id
```

**Proibido:** `params`, `args`, `payload`, `plaintext`, `ciphertext`, mensagens.

**Amostragem:**
- Sucesso: 1% (ajustável)
- Erro: 100%
- Picos: 10% via flag

**Destino:**
- Tempo real: Loki (opcional) ou arquivo local NDJSON
- Diário: R2/MinIO → `logs/yyyy/mm/dd/*.ndjson`
- Retenção: 30 dias

---

## 🔐 Trilhas / Auditoria (JSON✯Atomic)

**Forma canônica:**
```json
{
  "id": "...",
  "ts": "2026-01-03T...",
  "kind": "office.tool_call",
  "scope": {"tenant": "ubl"},
  "actor": {"email": "..."},
  "refs": {},
  "data": {"tool": "...", "args_min": {...}},
  "meta": {"service": "..."},
  "sig": null
}
```

**Kinds mínimos:**
- `office.tool_call`, `office.event`, `office.handover`
- `gateway.request_min`, `policy.eval_min`
- `auth.login_min`, `access.denied_min`
- `media.presign_min`, `webhook.delivery_min`

**Rollup diário:**
```bash
./infra/observability/jobs/rollup_trails_to_r2.sh [date]
# Uploads to: r2://ubl-audit/audit/YYYY/MM/trails_YYYY-MM-DD.ndjson
```

---

## ✅ Health Checklist

- [ ] Prometheus UI mostra todos os jobs "UP"
- [ ] OTEL Collector `/metrics` expõe séries com prefixos corretos
- [ ] Dashboards renderizam sem "No data"
- [ ] Alertas configurados no Prometheus/Alertmanager
- [ ] Logs JSONL server-blind gravando (sem plaintext)
- [ ] Trilhas JSON✯Atomic em R2/MinIO
- [ ] Rollup diário funcionando (cron/systemd timer)

---

## 🔧 Próximos Passos (P1)

- [ ] Assinatura Ed25519 de trilhas (tenant-opt-in)
- [ ] `/trace/:id` lookup por trace_id
- [ ] Amostragem dinâmica via flag (per-route/tool)
- [ ] Export VOD de trilhas para auditor externo (bundle .tar.gz)

---

## 📚 Referências

- **Blueprint 09** — Observabilidade & Auditoria
- **CONSTITUTION.md** — Normas de observabilidade server-blind
- **ErrorToken** — Vocabulário fechado de erros
