# Office — Checklist de Deploy

## 📋 Recursos Cloudflare que serão criados/utilizados

### D1 Databases
- ✅ `OFFICE_DB` — Database principal (entities, files, anchors, versions, receipts, handovers)

### KV Namespaces
- ✅ `OFFICE_FLAGS` — Feature flags e configurações
- ✅ `OFFICE_CACHE` — Cache de respostas

### R2 Buckets
- ✅ `office-blobs` — Armazenamento de arquivos brutos

### Vectorize Indexes
- ⚠️ `OFFICE_VECTORS` — Índice vetorial (768 dims, cosine) — **criar manualmente**

### Durable Objects
- ✅ `OfficeSessionDO` — Sessão e token budget

### Workers AI
- ✅ Binding `AI` — Para embeddings e sumarização

## 👷 Workers que serão deployados

### 1. `office-api-worker`
- **Rotas principais:**
  - `/healthz` — Health check
  - `/inventory` — Lista de arquivos
  - `/api/files/*` — CRUD de arquivos
  - `/api/anchors/*` — Gerenciamento de âncoras
  - `/api/evidence/*` — Evidence Mode
  - `/api/frame/*` — Context Frame Builder
  - `/api/lenses/*` — Lens Engine
  - `/api/narrative/*` — Narrator
  - `/api/handover/*` — Session Handover
  - `/api/versions/*` — Version Graph
  - `/api/admin/*` — Admin endpoints
- **Bindings:** D1, KV (FLAGS, CACHE), R2, Vectorize, AI, DO

### 2. `office-indexer-worker`
- **Função:** Indexação de arquivos e geração de embeddings
- **Cron:** Diário (0 0 * * *), horário (0 * * * *), 6h (0 */6 * * *)
- **Bindings:** D1, Vectorize, AI, R2

### 3. `office-dreamer-worker`
- **Função:** Dreaming Cycle (consolidação de memória)
- **Cron:** Horário (0 * * * *)
- **Bindings:** D1, AI

## 📊 Schema D1

### Tabelas principais:
- `entities` — Entidades do Office
- `files` — Arquivos indexados
- `anchors` — Âncoras (segmentos citáveis)
- `versions` — Versionamento de arquivos
- `receipts` — Receipts assinados
- `handovers` — Handovers de sessão

### Migrations/Deltas (se existirem):
- `schemas/d1/migrations/*.sql`
- `d1/*.sql` (deltas do Drop 18)

## 🔐 Secrets (opcionais)

- `RECEIPT_PRIVATE_KEY` — Chave privada Ed25519 para assinar receipts
- `RECEIPT_HMAC_KEY` — Chave HMAC para receipts

## 📝 Configurações

- **R2 CORS** — Configurado via `setup-r2-cors.sh`
- **Routes** — Configurar manualmente no Cloudflare Dashboard (se necessário)

## ✅ Resumo rápido

**Recursos:** 1 D1, 2 KV, 1 R2, 1 Vectorize (manual), 1 DO, 1 AI binding  
**Workers:** 3 workers (api, indexer, dreamer)  
**Crons:** 2 workers com triggers agendados  
**Secrets:** 2 opcionais (receipts)
