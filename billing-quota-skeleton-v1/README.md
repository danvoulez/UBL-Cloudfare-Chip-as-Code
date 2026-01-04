# Billing/Quota & Plans — Skeleton (v1)

This is a **minimal, production-shaped** skeleton for Blueprint 14. It includes:

- **Cloudflare Worker (Durable Object)** `QuotaDO` for real‑time quota enforcement
- **KV** seeds for plans and tenant mapping
- **D1** schema for daily usage & monthly charges
- **Axum Core API** stubs (public + admin endpoints)
- **Indexer (scheduled Worker)** stub to show how to aggregate batch meters
- **HTTP examples** to smoke test

> Target domain in examples: `api.ubl.agency` (adjust `wrangler.toml` if needed).

## Quickstart (dev)

### 1) Cloudflare side (QuotaDO + KV + D1 + Scheduler)

```bash
cd services/quota-do

# Login and ensure account id in wrangler.toml
npx wrangler login

# Create D1 and KV (first time only)
npx wrangler d1 create BILLING_DB
# capture the DB binding name printed and ensure it matches wrangler.toml
npx wrangler kv namespace create PLANS_KV

# Seed plans and tenant mapping
bash ../../scripts/kv/seed.sh

# Dev (local)
npx wrangler dev

# Deploy
npx wrangler deploy
```

### 2) Core API (Axum)

```bash
cd services/core-api
cargo run
# Server at http://127.0.0.1:8088
```

### 3) Test HTTP flows

Open `examples/billing.http` in your REST client (or use `curl` commands inside).

## Proof of Done (minimal)

1. Call `POST /quota/check_and_consume` 20x within a minute with meter `tool_call` and see **BACKPRESSURE** kick in when tokens are exhausted, then recover on the next minute window.
2. `GET /billing/me/plan` in Axum returns the effective plan stub for `tenant=demo`.
3. `GET /admin/billing/tenants/demo/usage/daily` returns empty/placeholder rows after D1 init (you'll wire Indexer later).
4. Change plan bucket in KV and repeat (1) to observe updated behavior **without changing code**.

---

Generated: 2026-01-04T00:19:07.820525Z
