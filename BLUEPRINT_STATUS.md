# Status de Implementação — Blueprints

**Data:** 2026-01-04  
**Última atualização:** 2026-01-04

Verificação blueprint por blueprint do que já foi implementado.

---

## 📋 Blueprint 01 — Edge Gateway (Worker + Chip)

### ✅ Implementado:
- ✅ Worker: `policy-worker/src/worker.mjs`
  - ✅ `/warmup` endpoint (valida pack assinado)
  - ✅ `/panic/on` e `/panic/off` (gated por ubl-ops)
  - ✅ Policy evaluation com WASM
  - ✅ Verificação de Access (Cf-Access-Jwt-Assertion)
  - ✅ Roteamento por prefixo (`/core/**` → UPSTREAM_CORE, `/webhooks/**` → UPSTREAM_WEBHOOKS)
  - ✅ ES256 JWT verification (`jwks.mjs`)
  - ✅ Shadow promotion (`policy_yaml_active/pack_active` com fallback)
  - ✅ CORS por tenant (Blueprint 17)

### ⚠️ Parcial:
- ⚠️ Rate-limit leve (estrutura pronta, precisa configurar buckets)
- ⚠️ Validação de webhooks (estrutura pronta, precisa implementar verificação)

### ❌ Pendente:
- ❌ KV para rate buckets (`rate:{sub}:{route}`)
- ❌ KV para webhook secrets (`webhook:partner:<name>`)

**Status:** 🟢 **80% completo** — Core funcional com roteamento por prefixo implementado

---

## 📋 Blueprint 02 — Policy-Proxy (LAB 256)

### ✅ Implementado:
- ✅ Proxy Rust/Axum: `policy-proxy/src/main.rs`
  - ✅ `POST /_reload` (carrega e valida pack)
  - ✅ `GET /metrics` (Prometheus)
  - ✅ `POST /__breakglass` e `POST /__breakglass/clear`
  - ✅ Policy evaluation (mesmo engine do Worker)
  - ✅ Ledger NDJSON (`/var/log/ubl/nova-ledger.ndjson`)
  - ✅ Systemd service: `infra/systemd/nova-policy-rs.service`

### ⚠️ Parcial:
- ⚠️ Roteamento interno (estrutura pronta, precisa configurar upstreams)
- ⚠️ Reload com `?stage=next` (estrutura pronta, precisa testar)

### ❌ Pendente:
- ❌ Integração com Caddy (mTLS headers)

**Status:** 🟢 **90% completo** — Funcional, shadow promotion parcialmente implementado

---

## 📋 Blueprint 03 — Core API (Axum)

### ✅ Implementado:
- ✅ Core API: `apps/core-api/src/main.rs`
  - ✅ Estrutura Axum básica
  - ✅ JWKS endpoint: `GET /auth/jwks.json` (ES256)
- ✅ Voulezvous Core: `apps/core-api/src/bin/vvz-core.rs`
  - ✅ `GET /healthz`
  - ✅ `GET /whoami` (stub: lê cookie)
  - ✅ `POST /api/session/exchange` (stub: recebe token UBL, emite cookie `sid` first-party)

### ⚠️ Parcial:
- ⚠️ Session exchange (stub funcional, precisa validação JWT real via JWKS)

### ❌ Pendente:
- ❌ `POST /files/presign/upload`
- ❌ `POST /files/presign/download`
- ❌ `POST /core/clients`, `GET /core/clients/:id`
- ❌ `POST /core/projects`, `GET /core/projects/:id`
- ❌ `POST /core/contracts`, `GET /core/contracts/:id`
- ❌ JSON✯Atomic generation
- ❌ D1/Postgres integration
- ❌ R2 presign integration
- ❌ Validação JWT ES256 no `vvz-core.rs` (session exchange)

**Status:** 🟡 **20% completo** — Estrutura, JWKS e vvz-core básico

---

## 📋 Blueprint 04 — Files / R2

### ✅ Implementado:
- ✅ Estrutura no Core API (placeholder)

### ❌ Pendente:
- ❌ `POST /files/presign/upload` (R2 real)
- ❌ `POST /files/presign/download` (R2 real)
- ❌ Layout de chaves R2 (`tenant/kind/id/v{n}/`)
- ❌ Lifecycle rules (expiração tmp/)
- ❌ Átomo `file.created`
- ❌ CORS configuration

**Status:** 🔴 **5% completo** — Apenas estrutura

---

## 📋 Blueprint 05 — Webhooks (parceiros)

### ❌ Pendente:
- ❌ `POST /webhooks/{partner}` endpoint
- ❌ Verificação HMAC-SHA256 / Ed25519
- ❌ Dedupe por `event_id` ou `sha256(base)`
- ❌ Postgres table `webhook_events`
- ❌ DLQ no R2
- ❌ Retry com backoff exponencial
- ❌ KV para secrets (`webhook:partner:<name>:key:<id>`)

**Status:** 🔴 **0% completo** — Não iniciado

---

## 📋 Blueprint 06 — Identity & Access (Gateway)

### ✅ Implementado:
- ✅ Gateway: `apps/gateway/src/identity/tokens.rs`
  - ✅ `TokenManager` com ES256 (ECDSA P-256)
  - ✅ `mint()` e `verify()` functions
  - ✅ JWKS support (`load_jwks_from_kv`, `save_jwks_to_kv`)
  - ✅ Rotas: `apps/gateway/src/http/routes_tokens.rs`
    - ✅ `POST /tokens/mint` (stub)
    - ⚠️ `POST /tokens/refresh` (placeholder)
    - ⚠️ `POST /tokens/revoke` (placeholder)
  - ✅ Scripts: `infra/identity/scripts/generate-es256-keypair.sh`, `generate-jwks.sh`
  - ✅ Documentação: `infra/identity/README.md`, `ROTATION.md`

### ⚠️ Parcial:
- ⚠️ WebAuthn/Passkey (estrutura em `apps/gateway/src/identity/webauthn.rs` — placeholder)
- ⚠️ Cloudflare Access integration (estrutura em `apps/gateway/src/identity/access.rs` — placeholder)
- ⚠️ ABAC evaluation (estrutura em `apps/gateway/src/identity/abac.rs` — placeholder)
- ⚠️ Identity storage (estrutura em `apps/gateway/src/identity/storage.rs` — placeholder)

### ❌ Pendente:
- ❌ `GET /auth/passkey/register`
- ❌ `POST /auth/passkey/finish`
- ❌ `GET /session`
- ❌ `POST /auth/logout`
- ❌ `POST /internal/tokens/verify` (Axum extractor)
- ❌ D1/Postgres para credenciais WebAuthn
- ❌ Cookie `sid` management
- ❌ CSRF token management

**Status:** 🟡 **40% completo** — Core JWT ES256 pronto, faltam WebAuthn e integrações

---

## 📋 Blueprint 07 — Messenger (PWA + MCP Client)

### ❌ Pendente:
- ❌ App PWA (`apps/messenger/`)
- ❌ WebSocket client (Office/RoomDO)
- ❌ REST client (Gateway/Core)
- ❌ Crypto (E2EE)
- ❌ UI Kit (RoomsPanel, Thread, Composer, etc.)
- ❌ State management (rooms, messages, presence)
- ❌ PWA manifest

**Status:** 🔴 **0% completo** — Não iniciado

---

## 📋 Blueprint 08 — Office: RoomDO (WebSocket)

### ✅ Implementado:
- ✅ Gateway MCP: `apps/gateway/src/mcp/`
  - ✅ WebSocket JSON-RPC: `GET /mcp`
  - ✅ `ping`, `tools/list`, `session.brief.get/set`, `tool/call`
  - ✅ Idempotência por `{client_id, op_id}`
  - ✅ ErrorToken padronizado
  - ✅ Session management com cache

### ⚠️ Parcial:
- ⚠️ Tools de media/stream (estrutura em `apps/media-api/src/mcp/handlers.rs` — stub)

### ❌ Pendente:
- ❌ RoomDO (Durable Object) para WebSocket por sala
- ❌ `GET /office/ws/rooms/:roomId`
- ❌ Eventos: `hello`, `presence.update`, `ack`, `confirm`, `message.append`
- ❌ `GET /office/rooms/:roomId/messages?since=<seq>` (replay)
- ❌ `GET /office/rooms/:roomId/presence`
- ❌ D1 tables (`msg`, `presence`)
- ❌ Policy bits: `P_Room_RateLimit`, `P_Room_Size_Cap`, `P_Payload_Size`

**Status:** 🟡 **30% completo** — MCP base pronto, faltam RoomDO e persistência

---

## 📋 Blueprint 09 — Observabilidade & Auditoria

### ✅ Implementado:
- ✅ Observability starter kit: `observability-starter-kit/`
  - ✅ Prometheus config: `prometheus/prometheus.yml`
  - ✅ Alerts: `prometheus/alerts.yml`
  - ✅ OTLP Collector: `otel-collector/config.yaml`
  - ✅ Grafana dashboards:
    - ✅ `20-gateway.json`
    - ✅ `30-core-api.json`
  - ✅ Rollup script: `infra/observability/jobs/rollup_trails_to_r2.sh`

### ⚠️ Parcial:
- ⚠️ Métricas no Proxy (`/metrics` existe, precisa validar nomes)
- ⚠️ Métricas no Core API (estrutura pronta)

### ❌ Pendente:
- ❌ OTLP client no Worker (Gateway)
- ❌ Logs JSONL server-blind (estrutura pronta, precisa implementar)
- ❌ Trilhas JSON✯Atomic (estrutura pronta, precisa implementar)
- ❌ Dashboards: `00-executive.json`, `10-office-mcp.json`
- ❌ Integração completa (Worker → Collector → Prometheus)

**Status:** 🟡 **50% completo** — Infra pronta, falta integração completa

---

## 📋 Blueprint 10 — Media & Video

### ✅ Implementado:
- ✅ Media API Worker: `apps/media-api-worker/src/worker.ts`
  - ✅ `POST /internal/media/presign` (R2 presign)
  - ✅ `POST /internal/media/commit` (verifica sha256)
  - ✅ `GET /internal/media/link/:id` (signed URL)
  - ✅ `POST /internal/stream/prepare` (KV session)
  - ✅ `POST /internal/stream/go_live` (KV state)
  - ✅ `POST /internal/stream/end` (Queue event)
  - ✅ Bindings: R2_MEDIA, KV_MEDIA, D1_MEDIA, QUEUE_MEDIA_EVENTS
  - ✅ Schema D1: `schema.sql`
  - ✅ Contratos: `.http` files, `smoke_stage.sh`
  - ✅ Schemas JSON: `media.descriptor.v1.json`, `stream.session.v1.json`
  - ✅ Gateway MCP tools: `media@v1.*`, `stream@v1.*`

### ⚠️ Parcial:
- ⚠️ R2 presign real (estrutura pronta, precisa configurar R2)
- ⚠️ Tokens refresh/snapshot (placeholder)

### ❌ Pendente:
- ❌ SFU WebRTC (LAB 512)
- ❌ LL-HLS packager (LAB 512)
- ❌ Recording (LAB 512)
- ❌ Player persistente (`<VideoShell/>`)
- ❌ Stage URL estável (`voulezvous.tv/@user`)

**Status:** 🟡 **60% completo** — API pronta, faltam SFU/packager/player

---

## 📋 Blueprint 11 — (Não definido)

**Status:** ⚪ **N/A** — Blueprint não existe

---

## 📋 Blueprint 12 — Admin & Operações (P0)

### ✅ Implementado:
- ✅ Policy bit `P_Is_Admin_Path` (detecta `/admin/**`)
- ✅ Wiring `W_Admin_Path_And_Role` (combina ZeroTrust + Admin Path + Admin Role)
- ✅ Endpoints `/panic/on` e `/panic/off` (gated por ubl-ops)
- ✅ Ledger hardening (logrotate + sync R2)

### ❌ Pendente:
- ❌ Rotas `/admin/**` específicas (`/admin/health`, `/admin/policy/promote`, etc.)
- ❌ Browser Isolation configurado
- ❌ Rate-limit admin (30 req/min)
- ❌ Idempotency-Key support
- ❌ Eventos `admin.event` (JSON✯Atomic)

**Status:** 🟡 **30% completo** — Base de segurança pronta, faltam rotas admin

---

## 📋 Blueprint 13 — Streaming/Broadcast Plan (OMNI + UBL)

### ✅ Implementado:
- ✅ Media API Worker: `apps/media-api-worker/src/worker.ts`
  - ✅ `POST /media/stream-live/inputs` (Live Input creation)
  - ✅ `POST /media/tokens/stream` (Signed playback URLs)
  - ✅ `POST /rtc/rooms` (WebRTC room creation)
  - ✅ Exemplos: `hls-player.html`, `rtc-join.js`, `ffmpeg-publish.sh`
  - ✅ Contratos HTTP: `examples/stream-stage.http`, `examples/rtc-rooms.http`
  - ✅ Eventos JSON✯Atomic: `media.upload.presigned`, `media.ingest.completed`, `media.playback.granted`

### ⚠️ Parcial:
- ⚠️ Cloudflare Stream integration (estrutura pronta, precisa configurar secrets)
- ⚠️ WebSocket signaling para RTC (estrutura pronta)

### ❌ Pendente:
- ❌ SFU WebRTC (LAB 512)
- ❌ LL-HLS packager (LAB 512)
- ❌ Recording (LAB 512)
- ❌ Signed URLs reais (JWT ES256 para tokens)

**Status:** 🟡 **50% completo** — Endpoints e exemplos prontos, falta infra real

---

## 📋 Blueprint 14 — Billing:Quota & Plans (P1)

### ✅ Implementado:
- ✅ Billing skeleton: `billing-quota-skeleton-v1/`
  - ✅ Estrutura de serviços (quota-do, ledger-worker)
  - ✅ Scripts SQL (schema D1)
  - ✅ Exemplos HTTP

### ❌ Pendente:
- ❌ Durable Object `quota-do` (implementação completa)
- ❌ Ledger worker (agregação de eventos)
- ❌ Integração com Core API
- ❌ Métricas de quota por tenant
- ❌ Planos configuráveis (free/pro/enterprise)

**Status:** 🔴 **10% completo** — Apenas estrutura, falta implementação

---

## 📋 Blueprint 15 — Data & Schemas (JSON✯Atomic)

### ✅ Implementado:
- ✅ Schemas base: `schemas/atomic.schema.json`
- ✅ Schemas office: `ledger.office.tool_call`, `ledger.office.event`, `ledger.office.handover`
- ✅ Schemas media: `ledger.media.upload.presigned`, `ledger.media.ingest.*`, `ledger.media.playback.granted`, `ledger.media.retention.applied`
- ✅ Exemplos: `schemas/examples/*.json`
- ✅ Canonicalization: `schemas/cli/atomic_canonicalize.ts`, `apps/core-api/src/atomic/mod.rs`
- ✅ Signing/Verification: `schemas/cli/sign.ts`, `schemas/cli/verify.ts`
- ✅ Validation: `schemas/scripts/validate.sh`
- ✅ Integração no Media API Worker (emissão de eventos)

### ⚠️ Parcial:
- ⚠️ Integração completa no Gateway/Office (estrutura pronta)

### ❌ Pendente:
- ❌ Integração no Core API (emissão de átomos)
- ❌ Trilhas JSON✯Atomic completas (office.*, media.*)

**Status:** 🟢 **75% completo** — Schemas e tooling prontos, falta integração completa

---

## 📋 Blueprint 16 — Constituição & Anexos (Oficial)

### ✅ Implementado:
- ✅ Constituição: `CONSTITUTION.md`
- ✅ ADR-001: `docs/ADR-001-policy-versioning.md`
- ✅ Templates: `templates/` (manifest, wiring, ABAC, MCP, tests, scripts)
- ✅ P0 Conformity Matrix: `templates/CONFORMITY_P0.md`
- ✅ Policy v3: `policies/ubl_core_v3.yaml`
- ✅ Pipeline Chip-as-Code (signer, pack, blue/green)

### ✅ Implementado (Anexos):
- ✅ App Manifest template (`app.manifest.yaml`)
- ✅ Wiring template (`app.wiring.yaml`)
- ✅ ABAC policy template (`abac.policy.json`)
- ✅ MCP manifest template (`mcp.manifest.json`)
- ✅ Contract tests template (`tests/contract.http`)
- ✅ Publish script template (`scripts/publish.sh`)
- ✅ Smoke test template (`scripts/smoke.sh`)

**Status:** 🟢 **95% completo** — Constituição e templates prontos, falta documentação final

---

## 📋 Blueprint 17 — Multitenant (Gateway + Policy + Storage)

### ✅ Implementado:
- ✅ Worker multitenant: `policy-worker/src/worker.mjs`
  - ✅ Resolução de tenant (host → header → default)
  - ✅ Carregamento de políticas por tenant (`policy_{tenant}_pack/yaml`)
  - ✅ CORS por tenant (`ORIGIN_ALLOWLIST`)
  - ✅ Access AUD/JWKS por tenant (`ACCESS_AUD_MAP`, `ACCESS_JWKS_MAP`)
  - ✅ Endpoints `/_reload` e `/_policy/status` com suporte a tenant
  - ✅ Panic mode por tenant
- ✅ Policy voulezvous: `policies/vvz_core_v1.yaml`
- ✅ Configuração: `policy-worker/wrangler.toml` (mapas de tenant)
- ✅ Smoke test: `scripts/smoke_multitenant.sh`
- ✅ **Kit Voulezvous completo:**
  - ✅ Worker Edge dedicado: `policy-worker/wrangler.vvz.toml` (tenant default: voulezvous)
  - ✅ Core API Voulezvous: `apps/core-api/src/bin/vvz-core.rs` (session exchange, whoami)
  - ✅ Documentação: `docs/voulezvous/` (HOSTS_TENANTS, OMNI-MODES, ACCESS_APPS_VVZ, DEEPLINKS)
  - ✅ Scripts: `scripts/smoke_vvz.sh`, `scripts/discover-vvz-zone.sh`
  - ✅ Template ABAC: `templates/abac.vvz.policy.json`
  - ✅ Padrão congelado: `voulezvous.tv` (público) + `admin.voulezvous.tv` (protegido por Access)

### ⚠️ Parcial:
- ⚠️ MCP tenant resolution (estrutura pronta, precisa integrar no Gateway MCP)
- ⚠️ Storage isolation (KV prefixos prontos, R2/Postgres precisa implementar)
- ⚠️ Session exchange JWT validation (stub funcional, precisa validação ES256 real)

### ❌ Pendente:
- ❌ RLS no Postgres (tenant_id + row-level security)
- ❌ Métricas por tenant (label `tenant` em todas as métricas)
- ❌ Backup/restore por tenant
- ❌ Quotas isoladas por tenant
- ❌ Validação JWT ES256 no `vvz-core.rs` (session exchange)

**Status:** 🟢 **85% completo** — Core multitenant funcional + Kit Voulezvous completo, falta isolamento de storage completo

---

## 📊 Resumo Geral

| Blueprint | Status | % Completo | Prioridade |
|-----------|--------|------------|------------|
| **01 — Edge Gateway** | 🟢 | 80% | P0 |
| **02 — Policy-Proxy** | 🟢 | 90% | P0 |
| **03 — Core API** | 🟡 | 20% | P0 |
| **04 — Files/R2** | 🔴 | 5% | P1 |
| **05 — Webhooks** | 🔴 | 0% | P1 |
| **06 — Identity & Access** | 🟡 | 40% | P0 |
| **07 — Messenger** | 🔴 | 0% | P1 |
| **08 — Office: RoomDO** | 🟡 | 30% | P0 |
| **09 — Observabilidade** | 🟡 | 50% | P0 |
| **10 — Media & Video** | 🟡 | 60% | P1 |
| **11 — (N/A)** | ⚪ | N/A | - |
| **12 — Admin & Operações** | 🟡 | 30% | P0 |
| **13 — Streaming/Broadcast** | 🟡 | 50% | P1 |
| **14 — Billing/Quota** | 🔴 | 10% | P1 |
| **15 — Data & Schemas** | 🟢 | 75% | P0 |
| **16 — Constituição & Anexos** | 🟢 | 95% | P0 |
| **17 — Multitenant** | 🟢 | 85% | P0 |

---

## 🎯 Próximos Passos Recomendados

### P0 (Crítico):
1. **Blueprint 03 — Core API**: Implementar validação JWT ES256 no `vvz-core.rs` e endpoints básicos (`/files/presign/*`)
2. **Blueprint 06 — Identity & Access**: Completar WebAuthn e integração Access
3. **Blueprint 12 — Admin & Operações**: Implementar rotas `/admin/**` completas
4. **Blueprint 08 — Office**: Implementar RoomDO (Durable Object)
5. **Blueprint 17 — Multitenant**: Completar isolamento de storage (RLS, métricas por tenant) e validação JWT no session exchange

### P1 (Importante):
6. **Blueprint 10 — Media**: Integrar SFU e LL-HLS packager
7. **Blueprint 13 — Streaming**: Integração Cloudflare Stream real e WebSocket signaling
8. **Blueprint 09 — Observabilidade**: Integração completa Worker → Collector
9. **Blueprint 04 — Files**: R2 presign real
10. **Blueprint 05 — Webhooks**: Implementação completa
11. **Blueprint 14 — Billing**: Implementar quota-do e ledger worker

### P2 (Futuro):
12. **Blueprint 07 — Messenger**: PWA completo

---

## 📝 Notas

### Mais Completos (🟢):
- **Blueprint 16** (95%) — Constituição e templates prontos
- **Blueprint 02** (90%) — Proxy funcional com shadow promotion
- **Blueprint 17** (85%) — Multitenant core funcional + Kit Voulezvous completo
- **Blueprint 01** (80%) — Worker com roteamento por prefixo e multitenant
- **Blueprint 15** (75%) — Schemas JSON✯Atomic prontos

### Em Progresso (🟡):
- **Blueprint 10** (60%) — API pronta, falta infra (SFU/packager)
- **Blueprint 09** (50%) — Infra pronta, falta integração
- **Blueprint 13** (50%) — Endpoints prontos, falta Stream real
- **Blueprint 06** (40%) — JWT ES256 pronto, falta WebAuthn
- **Blueprint 08** (30%) — MCP base pronto, falta RoomDO
- **Blueprint 12** (30%) — Base de segurança pronta, faltam rotas admin

### Pendentes (🔴):
- **Blueprints 03, 04, 05, 07, 14** precisam de implementação significativa

### Estatísticas:
- **Total de Blueprints:** 17 (11-16 definidos, 11 não existe)
- **Completos (≥75%):** 5 blueprints
- **Em progresso (30-74%):** 6 blueprints
- **Pendentes (<30%):** 5 blueprints

### 🆕 Atualizações Recentes (2026-01-04):
- ✅ **Kit Voulezvous integrado** (Blueprint 17):
  - Worker Edge dedicado (`vvz-edge`) com tenant default voulezvous
  - Core API Voulezvous (`vvz-core.rs`) com session exchange
  - Documentação completa (HOSTS_TENANTS, OMNI-MODES, ACCESS_APPS_VVZ, DEEPLINKS)
  - Scripts de deploy e smoke test
  - Padrão congelado: `voulezvous.tv` (público) + `admin.voulezvous.tv` (protegido)
- ✅ **Core API** (Blueprint 03):
  - Binário `vvz-core` adicionado com `/healthz`, `/whoami`, `/api/session/exchange`
