# Office — Deploy Rápido

## 📦 Recursos Cloudflare

| Tipo | Nome | Status |
|-----|------|--------|
| D1 | `OFFICE_DB` | ✅ Auto |
| KV | `OFFICE_FLAGS` | ✅ Auto |
| KV | `OFFICE_CACHE` | ✅ Auto |
| R2 | `office-blobs` | ✅ Auto |
| Vectorize | `OFFICE_VECTORS` | ⚠️ Manual |
| DO | `OfficeSessionDO` | ✅ Auto |
| AI | Binding `AI` | ✅ Auto |

## 👷 Workers (3)

1. **`office-api-worker`** — API principal (rotas `/api/*`, `/healthz`, `/inventory`)
2. **`office-indexer-worker`** — Indexação + embeddings (cron)
3. **`office-dreamer-worker`** — Dreaming Cycle (cron)

## 🔐 Secrets (opcional)

- `RECEIPT_PRIVATE_KEY`
- `RECEIPT_HMAC_KEY`

## ✅ Total

**7 recursos** (6 auto + 1 manual) + **3 workers** + **2 secrets** (opcional)
