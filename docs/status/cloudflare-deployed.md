# Cloudflare — Recursos Deployados (Lista Exaustiva)

**Última atualização:** 2026-01-04  
**Baseado em:** `wrangler.toml`, `infra/terraform/main.tf`, Blueprints, `env.example`

⚠️ **IMPORTANTE:** Este documento foi gerado a partir dos arquivos de configuração. Para verificar recursos reais deployados, execute:
```bash
bash scripts/verify-cloudflare-resources.sh
```

Ou verifique manualmente no [Cloudflare Dashboard](https://dash.cloudflare.com).

---

## 📋 Workers

### 1. `ubl-flagship-edge` (Policy Worker)
- **Nome:** `ubl-flagship-edge`
- **Arquivo:** `policy-worker/src/worker.mjs`
- **Routes:**
  - `api.ubl.agency/*`
- **KV Namespaces:**
  - `UBL_FLAGS` (id: `fe402d39cc544ac399bd068f9883dddf`) ✅ **Confirmado no wrangler.toml**
- **Variáveis (vars) - Blueprint 17 (Multitenant):**
  - `TENANT_DEFAULT` = `ubl`
  - `TENANT_HOST_MAP` = `{"api.ubl.agency":"ubl","voulezvous.tv":"voulezvous","www.voulezvous.tv":"voulezvous"}`
  - `ACCESS_AUD_MAP` = `{"ubl":"ubl-flagship-aud","voulezvous":"AUD_VVZ_REPLACE"}` ⚠️ **Preencher AUD_VVZ_REPLACE**
  - `ACCESS_JWKS_MAP` = `{"ubl":"https://1f43a14fe5bb62b97e7262c5b6b7c476.cloudflareaccess.com/cdn-cgi/access/certs","voulezvous":"https://YOUR-VVZ-TEAM.cloudflareaccess.com/cdn-cgi/access/certs"}` ⚠️ **Preencher JWKS do voulezvous**
  - `ORIGIN_ALLOWLIST` = `{"voulezvous":["https://voulezvous.tv","https://www.voulezvous.tv"]}`
  - `POLICY_PUBKEY_B64` = `LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUNvd0JRWURLMlZ3QXlFQTkyZlFhcGVqZVhDanEydEZoU1piYnkxQk1lMTNpcmxKRGxnLzFMa2dCaUU9Ci0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo=`
  - `UPSTREAM_CORE` = `https://origin.core.local`
  - `UPSTREAM_WEBHOOKS` = `https://origin.webhooks.local`
- **Secrets (configurar via `wrangler secret put`):**
  - `ACCESS_AUD` (opcional, já em vars)
  - `ACCESS_JWKS` (opcional, já em vars)
  - `POLICY_PUBKEY_B64` (opcional, já em vars)
- **Queues (comentado - requer Workers Paid):**
  - `UBL_EVENTS` → `ubl-policy-events` (não ativo)
- **WASM:**
  - `build/policy_engine.wasm` (importado diretamente no código)
- **Endpoints:**
  - `GET /warmup` (tenant-aware)
  - `GET /_policy/status` (tenant-aware, Blueprint 17)
  - `POST /_reload?tenant={id}&stage={next|active}` (tenant-aware, Blueprint 17)
  - `POST /panic/on` (tenant-aware)
  - `POST /panic/off` (tenant-aware)
  - `/*` (gateway/roteador, multitenant)

### 2. `ubl-media-api` (Media API Worker)
- **Nome:** `ubl-media-api`
- **Arquivo:** `apps/media-api-worker/src/worker.ts`
- **Routes:**
  - `media.api.ubl.agency/*`
  - `api.ubl.agency/internal/media/*`
  - `api.ubl.agency/internal/stream/*`
  - `api.ubl.agency/media/stream-live/*`
  - `api.ubl.agency/media/tokens/*`
  - `api.ubl.agency/rtc/*`
- **R2 Buckets:**
  - `R2_MEDIA` → `ubl-media`
- **KV Namespaces:**
  - `KV_MEDIA` (id: `REPLACE_WITH_KV_ID` - **preencher**)
- **D1 Databases:**
  - `D1_MEDIA` → `ubl-media` (id: `REPLACE_WITH_D1_ID` - **preencher**)
- **Queues:**
  - `QUEUE_MEDIA_EVENTS` → `media-events`
- **Variáveis (vars):**
  - `MEDIA_API_VERSION` = `v1`
  - `R2_MEDIA_PREFIX` = `tenant`
  - `RTC_WS_URL` = `wss://rtc.api.ubl.agency/rooms`
  - `TURN_SERVERS` = `[{"urls":["stun:stun.l.google.com:19302"]}]`
- **Secrets (configurar via `wrangler secret put`):**
  - `STREAM_API_TOKEN` (opcional - Cloudflare Stream API)
  - `STREAM_ACCOUNT_ID` (opcional - Cloudflare Account ID)
- **Endpoints:**
  - `POST /internal/media/presign`
  - `POST /internal/media/commit`
  - `GET /internal/media/link/:id`
  - `POST /internal/stream/prepare`
  - `POST /internal/stream/go_live`
  - `POST /internal/stream/end`
  - `POST /internal/stream/tokens/refresh`
  - `POST /internal/stream/snapshot`
  - `POST /media/stream-live/inputs` (Blueprint 13)
  - `POST /media/tokens/stream` (Blueprint 13)
  - `POST /rtc/rooms` (Blueprint 13)

---

## 🗄️ KV Namespaces

### 1. `UBL_FLAGS` ✅ **VERIFICADO**
- **Binding:** `UBL_FLAGS`
- **ID:** `fe402d39cc544ac399bd068f9883dddf` ✅ **Confirmado no wrangler.toml e verificado via wrangler CLI**
- **Worker:** `ubl-flagship-edge`
- **Status:** ✅ Deployado e ativo
- **Chaves esperadas (Blueprint 17 - Multitenant):**
  - **UBL tenant:**
    - `policy_yaml` / `policy_yaml_active` / `policy_yaml_next` / `policy_yaml_prev`
    - `policy_pack` / `policy_pack_active` / `policy_pack_next` / `policy_pack_prev`
  - **Voulezvous tenant:**
    - `policy_voulezvous_yaml` / `policy_voulezvous_yaml_active` / `policy_voulezvous_yaml_next`
    - `policy_voulezvous_pack` / `policy_voulezvous_pack_active` / `policy_voulezvous_pack_next`
  - **Panic mode (por tenant):**
    - `panic_ubl_active` / `panic_ubl_expires_at` / `panic_ubl_reason`
    - `panic_voulezvous_active` / `panic_voulezvous_expires_at` / `panic_voulezvous_reason`
  - **Outros:**
    - `rate:{sub}:{route}` (contadores de janela)
    - `webhook:partner:{name}` (configuração de webhooks)

### 2. `KV_MEDIA`
- **Binding:** `KV_MEDIA`
- **ID:** `REPLACE_WITH_KV_ID` ⚠️ **PRECISA PREENCHER**
- **Worker:** `ubl-media-api`
- **Chaves esperadas:**
  - `media:{media_id}` (metadados de upload)
  - `session:{session_id}` (sessões de stream)
  - `rtc_room:{room_id}` (salas WebRTC)
  - `stream_input:{input_id}` (Live Inputs - Blueprint 13)

### 3. `PLANS_KV` (Billing Skeleton)
- **Binding:** `PLANS_KV`
- **ID:** `stub-will-be-filled-by-wrangler` ⚠️ **PRECISA PREENCHER**
- **Worker:** `quota-do` (billing skeleton)
- **Chaves esperadas:**
  - `plans/free`, `plans/pro` (definições de planos)
  - `tenant/{tenant_id}/plan_id` (mapeamento tenant → plano)
  - `limits/{tenant_id}` (overrides de limites)

---

## 🪣 R2 Buckets

### 1. `ubl-flagship`
- **Nome:** `ubl-flagship`
- **Location:** `weur` (West Europe)
- **Terraform:** `infra/terraform/main.tf`
- **Uso:** Eventos e logs (ledger imutável)
- **Estrutura esperada:**
  - `flagship/events/{hour}/...` (eventos agregados)
  - `flagship/logpush/...` (Logpush exports)
  - `flagship/ledger/...` (backup do ledger local)

### 2. `ubl-media`
- **Nome:** `ubl-media`
- **Binding:** `R2_MEDIA`
- **Worker:** `ubl-media-api`
- **Uso:** Mídia (upload, VOD, thumbnails)
- **Estrutura esperada:**
  - `tenant/{tenant}/room/{room_id}/{date}/{media_id}` (uploads)
  - `stream/{input_id}/master.m3u8` (HLS playlists - Blueprint 13)
  - `stream/{input_id}/manifest.mpd` (DASH manifests - Blueprint 13)

### 3. `ubl-ledger` (Mencionado em scripts)
- **Nome:** `ubl-ledger`
- **Uso:** Backup do ledger local (`/var/log/ubl/flagship-ledger.ndjson`)
- **Script:** `infra/ledger/ledger-sync-r2.sh`
- **Estrutura esperada:**
  - `ledger/{date}/flagship-ledger.ndjson`

### 4. `ubl-dlq` (Webhooks - Blueprint 05)
- **Nome:** `ubl-dlq`
- **Uso:** Dead Letter Queue para webhooks falhados
- **Estrutura esperada:**
  - `webhooks/{partner}/{date}/{id}.json`

### 5. `ubl-backups` ✅ **ENCONTRADO**
- **Nome:** `ubl-backups`
- **Status:** ✅ Deployado (verificado via wrangler)
- **Creation Date:** 2026-01-01T18:19:26.294Z
- **Uso:** Backups gerais do sistema

---

## 💾 D1 Databases

### 1. `ubl-media`
- **Nome:** `ubl-media`
- **Binding:** `D1_MEDIA`
- **ID:** `REPLACE_WITH_D1_ID` ⚠️ **PRECISA PREENCHER**
- **Worker:** `ubl-media-api`
- **Schema:** `apps/media-api-worker/schema.sql`
- **Tabelas:**
  - `media` (id, tenant, room_id, r2_key, mime, bytes, sha256, thumb_media_id, created_at, status)
  - `stream_sessions` (id, tenant, mode, audience, title, state, live, recording, playback_type, playback_url, created_at, live_at, ended_at, replay_media_id)

### 2. `BILLING_DB` (Billing Skeleton)
- **Nome:** `BILLING_DB`
- **Binding:** `BILLING_DB`
- **ID:** `stub-will-be-filled-by-wrangler` ⚠️ **PRECISA PREENCHER**
- **Worker:** `quota-do` (billing skeleton)
- **Schema:** `billing-quota-skeleton-v1/scripts/db/d1/schema.sql`
- **Tabelas:**
  - `usage_daily` (tenant_id, date, meter, value, ...)
  - `charges_monthly` (tenant_id, month, plan_id, base, overage, ...)
  - `credits` (tenant_id, amount, expires_at, ...)

---

## 📨 Queues

### 1. `ubl-policy-events`
- **Nome:** `ubl-policy-events`
- **Binding:** `UBL_EVENTS` (comentado no `policy-worker/wrangler.toml`)
- **Worker:** `ubl-flagship-edge`
- **Status:** ⚠️ **NÃO ATIVO** (requer Workers Paid plan)
- **Uso:** Eventos de política → R2 (ledger imutável)

### 2. `media-events`
- **Nome:** `media-events`
- **Binding:** `QUEUE_MEDIA_EVENTS`
- **Worker:** `ubl-media-api`
- **Uso:** Eventos de mídia (JSON✯Atomic: `media.upload.presigned`, `media.ingest.completed`, etc.)

---

## 🔐 Cloudflare Access

### Applications (Blueprint 17 - Multitenant)

#### 1. `UBL Flagship` (tenant: ubl)
- **Nome:** `UBL Flagship`
- **Domain:** `api.ubl.agency` (ou configurado via Terraform)
- **Session Duration:** `24h`
- **AUD:** `ubl-flagship-aud` ✅ **Confirmado no wrangler.toml**
- **JWKS:** `https://1f43a14fe5bb62b97e7262c5b6b7c476.cloudflareaccess.com/cdn-cgi/access/certs` ✅ **Confirmado no wrangler.toml**
- **Terraform:** `infra/terraform/main.tf`

#### 2. `Voulezvous` (tenant: voulezvous) ⚠️ **PRECISA CRIAR**
- **Nome:** `Voulezvous` (ou nome similar)
- **Domain:** `voulezvous.tv`, `www.voulezvous.tv` (ou configurado via Terraform)
- **Session Duration:** `24h`
- **AUD:** `AUD_VVZ_REPLACE` ⚠️ **PRECISA PREENCHER**
- **JWKS:** `https://YOUR-VVZ-TEAM.cloudflareaccess.com/cdn-cgi/access/certs` ⚠️ **PRECISA PREENCHER**

### Access Groups

#### 1. `ubl-ops`
- **Nome:** `ubl-ops`
- **Inclui:** `*@ubl.example.com` (ajustar no Terraform)
- **Uso:** Acesso admin (`/admin/*`)

#### 2. `ubl-ops-breakglass`
- **Nome:** `ubl-ops-breakglass`
- **Inclui:** `ops-lead@ubl.example.com` (ajustar no Terraform)
- **Uso:** Break-glass (emergência)

### Access Policies

#### 1. Admin Access
- **Nome:** `Admin Access`
- **Decision:** `allow`
- **Include:** Grupo `ubl-ops`
- **Precedence:** `1`
- **Aplica em:** `/admin/*`

---

## 🌐 Routes & Domains

### Domínios
- **Zone:** `ubl.agency`
- **Zone ID:** `3aa18fa819ee4b6e393009916432a69f` ✅ (do arquivo `env`)

### Routes (Workers)

#### `ubl-flagship-edge`:
- `api.ubl.agency/*`

#### `ubl-media-api`:
- `media.api.ubl.agency/*`
- `api.ubl.agency/internal/media/*`
- `api.ubl.agency/internal/stream/*`
- `api.ubl.agency/media/stream-live/*`
- `api.ubl.agency/media/tokens/*`
- `api.ubl.agency/rtc/*`

---

## 🔑 Secrets (Configurar via `wrangler secret put`)

### `ubl-flagship-edge`:
- `ACCESS_AUD` (opcional - já em vars)
- `ACCESS_JWKS` (opcional - já em vars)
- `POLICY_PUBKEY_B64` (opcional - já em vars)

### `ubl-media-api`:
- `STREAM_API_TOKEN` (opcional - Cloudflare Stream API)
- `STREAM_ACCOUNT_ID` (opcional - Cloudflare Account ID)

---

## 📊 Variáveis de Ambiente (vars)

### `ubl-flagship-edge`:
```toml
# Blueprint 17: Multitenant
TENANT_DEFAULT = "ubl"
TENANT_HOST_MAP = "{\"api.ubl.agency\":\"ubl\",\"voulezvous.tv\":\"voulezvous\",\"www.voulezvous.tv\":\"voulezvous\"}"
ACCESS_AUD_MAP = "{\"ubl\":\"ubl-flagship-aud\",\"voulezvous\":\"AUD_VVZ_REPLACE\"}"
ACCESS_JWKS_MAP = "{\"ubl\":\"https://1f43a14fe5bb62b97e7262c5b6b7c476.cloudflareaccess.com/cdn-cgi/access/certs\",\"voulezvous\":\"https://YOUR-VVZ-TEAM.cloudflareaccess.com/cdn-cgi/access/certs\"}"
ORIGIN_ALLOWLIST = "{\"voulezvous\":[\"https://voulezvous.tv\",\"https://www.voulezvous.tv\"]}"

POLICY_PUBKEY_B64 = "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUNvd0JRWURLMlZ3QXlFQTkyZlFhcGVqZVhDanEydEZoU1piYnkxQk1lMTNpcmxKRGxnLzFMa2dCaUU9Ci0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo="
UPSTREAM_CORE = "https://origin.core.local"
UPSTREAM_WEBHOOKS = "https://origin.webhooks.local"
```

### `ubl-media-api`:
```toml
MEDIA_API_VERSION = "v1"
R2_MEDIA_PREFIX = "tenant"
RTC_WS_URL = "wss://rtc.api.ubl.agency/rooms"
TURN_SERVERS = "[{\"urls\":[\"stun:stun.l.google.com:19302\"]}]"
```

---

## ⚠️ Placeholders que Precisam ser Preenchidos

### Recursos Cloudflare:
1. **KV_MEDIA ID:** `REPLACE_WITH_KV_ID` → Criar e atualizar `apps/media-api-worker/wrangler.toml`
2. **D1_MEDIA ID:** `REPLACE_WITH_D1_ID` → Criar e atualizar `apps/media-api-worker/wrangler.toml`
3. **PLANS_KV ID:** `stub-will-be-filled-by-wrangler` → Criar e atualizar `billing-quota-skeleton-v1/services/quota-do/wrangler.toml`
4. **BILLING_DB ID:** `stub-will-be-filled-by-wrangler` → Criar e atualizar `billing-quota-skeleton-v1/services/quota-do/wrangler.toml`

### Blueprint 17 (Multitenant):
5. **ACCESS_AUD_MAP (voulezvous):** `AUD_VVZ_REPLACE` → Criar Access App para voulezvous e preencher
6. **ACCESS_JWKS_MAP (voulezvous):** `https://YOUR-VVZ-TEAM.cloudflareaccess.com/cdn-cgi/access/certs` → Preencher com JWKS real

### Configuração Geral:
7. **CLOUDFLARE_ACCOUNT_ID:** ✅ `1f43a14fe5bb62b97e7262c5b6b7c476` (do arquivo `env`)
8. **CLOUDFLARE_ZONE_ID:** ✅ `3aa18fa819ee4b6e393009916432a69f` (do arquivo `env`)
9. **CLOUDFLARE_API_TOKEN:** ✅ Configurado no arquivo `env` (não expor)

---

## 🚀 Comandos para Criar Recursos Faltantes

```bash
# Carregar variáveis do env (se necessário)
source env

# KV para Media API
wrangler kv namespace create KV_MEDIA
# Copiar o ID retornado para apps/media-api-worker/wrangler.toml

# D1 para Media API
wrangler d1 create ubl-media
# Copiar o ID retornado para apps/media-api-worker/wrangler.toml
# Aplicar schema:
wrangler d1 execute ubl-media --file=apps/media-api-worker/schema.sql

# KV para Billing
wrangler kv namespace create PLANS_KV
# Copiar o ID para billing-quota-skeleton-v1/services/quota-do/wrangler.toml

# D1 para Billing
wrangler d1 create BILLING_DB
# Copiar o ID para billing-quota-skeleton-v1/services/quota-do/wrangler.toml
# Aplicar schema:
wrangler d1 execute BILLING_DB --file=billing-quota-skeleton-v1/scripts/db/d1/schema.sql

# R2 Buckets (se não criados via Terraform)
# R2 não tem CLI direto - usar Dashboard ou Terraform
```

## 🔍 Verificação Realizada

**Data da verificação:** 2026-01-04  
**Método:** `wrangler CLI`

### ✅ Recursos Confirmados:
- **KV Namespace `UBL_FLAGS`:** `fe402d39cc544ac399bd068f9883dddf` ✅
- **R2 Bucket `ubl-backups`:** Deployado (criado em 2026-01-01) ✅
- **Account ID:** `1f43a14fe5bb62b97e7262c5b6b7c476` ✅

### ⚠️ Recursos Não Encontrados (podem não estar deployados):
- Workers `ubl-flagship-edge` e `ubl-media-api` (não encontrados via `wrangler deployments list`)
- D1 Databases (nenhum encontrado)
- Queues (nenhuma encontrada)
- KV `KV_MEDIA` e `PLANS_KV` (não encontrados)

### 🔍 Para Verificar Novamente:

```bash
# Script de verificação
bash scripts/verify-cloudflare-resources.sh

# Ou manualmente:
wrangler kv namespace list
wrangler d1 list
wrangler r2 bucket list
wrangler queues list
wrangler deployments list
```

---

## 📝 Notas

- **Workers Paid Plan:** Necessário para Queues (`ubl-policy-events` está comentado)
- **Terraform:** R2 `ubl-flagship` e Access são gerenciados via `infra/terraform/main.tf`
- **Secrets:** Configurar via `wrangler secret put` (não commitar)
- **Routes:** Ajustar `zone_name` conforme configuração real do Cloudflare
- **Blueprint 17 (Multitenant):** Worker suporta múltiplos tenants com políticas isoladas
- **Verificação:** Execute `bash scripts/verify-cloudflare-resources.sh` para verificar recursos reais

---

**Última verificação:** 2026-01-04  
**Próxima revisão:** Após preencher placeholders e criar recursos faltantes
