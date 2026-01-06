#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER_DIR="$ROOT/workers/auth-worker"

# -------- Config --------
: "${UBL_DOMAIN:=ubl.agency}"
: "${ID_HOST:=id.$UBL_DOMAIN}"
: "${ALLOW_ORIGIN:=*}"

echo "🔧 Preparing UBL ID deploy for domain: $UBL_DOMAIN (host: $ID_HOST)"

cd "$WORKER_DIR"

# Create KV namespace if missing and inject ID into wrangler.toml
echo "🔧 Ensuring DEVICE_KV exists..."
KV_ID=$(wrangler kv namespace list --json 2>/dev/null | python3 - <<'PY'
import json,sys
data=json.load(sys.stdin)
for ns in data:
    if ns.get("title")=="DEVICE_KV":
        print(ns["id"]); break
PY
) || true

if [ -z "${KV_ID:-}" ]; then
  wrangler kv namespace create DEVICE_KV
  KV_ID=$(wrangler kv namespace list --json 2>/dev/null | python3 - <<'PY'
import json,sys
data=json.load(sys.stdin)
for ns in data:
    if ns.get("title")=="DEVICE_KV":
        print(ns["id"]); break
PY
)
fi

# Patch wrangler.toml with values
echo "🔧 Patching wrangler.toml (KV ID, host)..."
sed -i'' -e "s|id = \"REPLACE_DEVICE_KV_ID\"|id = \"$KV_ID\"|g" wrangler.toml

# Set env vars (CORS / origin)
if ! grep -q 'ALLOW_ORIGIN' wrangler.toml; then
  cat >> wrangler.toml <<EOF

[vars]
ALLOW_ORIGIN = "$ALLOW_ORIGIN"
EOF
fi

echo
echo "🔑 You need ES256 JWK secrets (private+public)."
echo "   - JWT_PRIVATE_JWK: full EC JWK (P-256)"
echo "   - JWT_PUBLIC_JWK: matching public JWK"
echo
echo "👉 Paste private JWK now (press Ctrl+D when done):"
wrangler secret put JWT_PRIVATE_JWK
echo "👉 Paste public JWK now (press Ctrl+D when done):"
wrangler secret put JWT_PUBLIC_JWK

echo "🚀 Deploying auth-worker (ubl-id) at https://$ID_HOST ..."
wrangler deploy

echo
echo "✅ Done."
echo "   JWKS:     https://$ID_HOST/.well-known/jwks.json"
echo "   Start:    https://$ID_HOST/device/start (POST)"
echo "   Approve:  https://$ID_HOST/device/approve (POST, mobile after login)"
echo "   Poll:     https://$ID_HOST/device/poll (POST, TV)"
