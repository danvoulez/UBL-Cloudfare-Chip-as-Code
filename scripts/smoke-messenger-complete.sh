#!/bin/bash
# Smoke test completo para Messenger

set -e

BASE="https://messenger.api.ubl.agency"
ST_CLIENT_ID="${CF_ACCESS_CLIENT_ID:-7e6a8e2707cc6022d47c9b0d20c27340.access}"
ST_CLIENT_SECRET="${CF_ACCESS_CLIENT_SECRET:-2e01fba6e4a6be6f8853ed7f4fa820d1ed0a26886e7504a3894c99142ec3cff7}"

echo "🧪 Smoke Test - Messenger Proxy"
echo "================================"
echo ""

echo "1. Healthz (sem auth):"
curl -s "${BASE}/healthz" | jq -r '.'
echo ""

echo "2. Testando proxy para LLM (com Service Token):"
curl -s -X POST "${BASE}/llm/chat" \
  -H "CF-Access-Client-Id: ${ST_CLIENT_ID}" \
  -H "CF-Access-Client-Secret: ${ST_CLIENT_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}' | jq -r '.' || echo "⚠️  Endpoint pode não estar implementado"
echo ""

echo "3. Testando proxy para Media (com Service Token):"
curl -s "${BASE}/media/healthz" \
  -H "CF-Access-Client-Id: ${ST_CLIENT_ID}" \
  -H "CF-Access-Client-Secret: ${ST_CLIENT_SECRET}" | jq -r '.' || echo "⚠️  Endpoint pode não existir"
echo ""

echo "✅ Smoke test completo!"
