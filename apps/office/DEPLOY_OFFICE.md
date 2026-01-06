# Deploy — Office (Cloudflare Workers)

## Prereqs
- `wrangler` logged in
- Cloudflare account and zone (for your domains)
- Create D1, KV, R2 as needed (bindings placeholders in `wrangler.toml`)

## Quick Start
```bash
# 1) Apply D1 schema
./scripts/d1-apply-schema.sh

# 2) Dev server (per worker)
cd workers/office-api-worker && wrangler dev
cd workers/office-indexer-worker && wrangler dev

# 3) Deploy (per worker)
cd workers/office-api-worker && wrangler deploy
cd workers/office-indexer-worker && wrangler deploy
```

Bindings to set (example):
- D1: OFFICE_DB
- KV: OFFICE_KV
- R2: OFFICE_R2
- Durable Object: OfficeSessionDO