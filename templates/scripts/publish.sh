#!/usr/bin/env bash
# Blueprint 16 — App Publish Script (Blue/Green)
# Uso: ./scripts/publish.sh <APP_ID>

set -euo pipefail

APP_ID="${1:-}"
if [ -z "$APP_ID" ]; then
  echo "❌ Uso: $0 <APP_ID>"
  exit 1
fi

POLICY_PRIVKEY_PEM="${POLICY_PRIVKEY_PEM:-/etc/ubl/nova/keys/policy_signing_private.pem}"
KV_NAMESPACE_ID="${KV_NAMESPACE_ID:-}"

if [ -z "$KV_NAMESPACE_ID" ]; then
  echo "❌ KV_NAMESPACE_ID não definido"
  exit 1
fi

if [ ! -f "$POLICY_PRIVKEY_PEM" ]; then
  echo "❌ Chave privada não encontrada: $POLICY_PRIVKEY_PEM"
  exit 1
fi

echo "📦 Publicando app: $APP_ID"
echo ""

# 1) Empacotar política conforme Constituição v3
echo "[1/4] Assinando política..."
./target/release/policy-signer \
  --id "${APP_ID}_v3" \
  --version 3 \
  --yaml policies/ubl_core_v3.yaml \
  --privkey_pem "$POLICY_PRIVKEY_PEM" \
  --out "/tmp/${APP_ID}_pack_v3.json"

if [ ! -f "/tmp/${APP_ID}_pack_v3.json" ]; then
  echo "❌ Falha ao assinar política"
  exit 1
fi

# 2) Publicar como 'next'
echo "[2/4] Publicando em KV (stage=next)..."
wrangler kv:key put \
  --namespace-id "$KV_NAMESPACE_ID" \
  --binding=UBL_FLAGS \
  --key=policy_yaml_next \
  --path=policies/ubl_core_v3.yaml

wrangler kv:key put \
  --namespace-id "$KV_NAMESPACE_ID" \
  --binding=UBL_FLAGS \
  --key=policy_pack_next \
  --path="/tmp/${APP_ID}_pack_v3.json"

# 3) Recarregar stage=next
echo "[3/4] Recarregando stage=next..."
RELOAD_RESP=$(curl -fsS "https://api.ubl.agency/_reload?stage=next" || echo '{"ok":false}')
if echo "$RELOAD_RESP" | jq -e '.ok == true' >/dev/null 2>&1; then
  echo "✅ Reload OK"
else
  echo "⚠️  Reload retornou: $RELOAD_RESP"
fi

# 4) Validar warmup
echo "[4/4] Validando warmup..."
WARMUP_RESP=$(curl -fsS "https://api.ubl.agency/warmup" || echo '{"ok":false}')
if echo "$WARMUP_RESP" | jq -e '.ok == true' >/dev/null 2>&1; then
  echo "✅ Warmup OK"
else
  echo "⚠️  Warmup retornou: $WARMUP_RESP"
fi

echo ""
echo "✅✅✅ Publish OK → stage=next"
echo ""
echo "Próximos passos:"
echo "  1. Rodar smoke: ./scripts/smoke.sh $APP_ID"
echo "  2. Rodar contract tests: tests/contract.http"
echo "  3. Promover: curl -XPOST 'https://api.ubl.agency/_reload?stage=prod'"
