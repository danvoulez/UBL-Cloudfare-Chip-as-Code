#!/usr/bin/env bash
set -euo pipefail

# Ensure wrangler is logged in, PLANS_KV + BILLING_DB bindings exist in wrangler.toml.

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$THIS_DIR/../.." && pwd)"
cd "$ROOT_DIR/services/quota-do"

echo "Seeding plans into KV (PLANS_KV) ..."
npx wrangler kv key put --binding=PLANS_KV plans/free < "$ROOT_DIR/scripts/kv/plan_free.json"
npx wrangler kv key put --binding=PLANS_KV plans/pro  < "$ROOT_DIR/scripts/kv/plan_pro.json"

echo "Mapping tenant 'demo' to plan 'pro' ..."
npx wrangler kv key put --binding=PLANS_KV tenant/demo/plan_id pro

echo "Optional: create D1 schema ..."
npx wrangler d1 execute BILLING_DB --file="$ROOT_DIR/scripts/db/d1/schema.sql"

echo "Done."
