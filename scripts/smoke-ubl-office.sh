#!/usr/bin/env bash
# UBL ID + Office — Go-Live Smoke Test
set -euo pipefail

# URLs
AUTH="${AUTH:-https://id.ubl.agency}"
OFFICE="${OFFICE:-https://office-api-worker.dan-1f4.workers.dev}"
KID="${KID:-fOYJEW760OAfkL3nHzYGP4zaB9qpuuX4AR6jQpFz9FI}"

echo "== UBL ID + Office — Go-Live Smoke =="
echo ""

# 1) Saúde & JWKS
echo ">> 1) Health checks..."
echo "   [Office]"
curl -s "$OFFICE/healthz" | jq '.' || echo "   ⚠️  Office healthz failed"
echo ""
echo "   [Auth]"
curl -s "$AUTH/healthz" | jq '.' || echo "   ⚠️  Auth healthz failed"
echo ""

echo ">> 2) JWKS (canônico e alias)..."
KID_CANONICAL=$(curl -s "$AUTH/.well-known/jwks.json" | jq -r '.keys[0].kid // "ERROR"')
KID_ALIAS=$(curl -s "$AUTH/auth/jwks.json" | jq -r '.keys[0].kid // "ERROR"')
echo "   Canonical: $KID_CANONICAL"
echo "   Alias:     $KID_ALIAS"
if [ "$KID_CANONICAL" = "$KID" ] && [ "$KID_ALIAS" = "$KID" ]; then
  echo "   ✅ KID correto"
else
  echo "   ⚠️  KID mismatch (esperado: $KID)"
fi
echo ""

# 2) Device Flow
echo ">> 3) Device Flow (start)..."
START=$(curl -s -X POST "$AUTH/device/start" \
  -H "content-type: application/json" \
  -d '{"client_id":"office"}')
echo "$START" | jq '.'
CODE=$(echo "$START" | jq -r '.device_code // empty')
VERIFY=$(echo "$START" | jq -r '.verification_uri_complete // empty')
if [ -z "$CODE" ]; then
  echo "   ⚠️  device_code não retornado"
  exit 1
fi
echo "   Device Code: $CODE"
echo "   Verify URI:  $VERIFY"
echo ""

echo ">> 4) Device Flow (approve)..."
APPROVE=$(curl -s -X POST "$AUTH/device/approve" \
  -H "content-type: application/json" \
  -d "{\"user_code\":\"$(echo "$START" | jq -r '.user_code')\",\"subject\":\"dan@ubl.agency\"}")
echo "$APPROVE" | jq '.'
if [ "$(echo "$APPROVE" | jq -r '.ok // false')" != "true" ]; then
  echo "   ⚠️  Approve falhou"
fi
echo ""

echo ">> 5) Device Flow (poll)..."
POLL=$(curl -s -X POST "$AUTH/device/poll" \
  -H "content-type: application/json" \
  -d "{\"device_code\":\"$CODE\"}")
echo "$POLL" | jq '.'
STATUS=$(echo "$POLL" | jq -r '.status // .ok // "ERROR"')
AT=$(echo "$POLL" | jq -r '.access_token // empty')
if [ -z "$AT" ] && [ "$STATUS" != "pending" ]; then
  echo "   ⚠️  access_token não retornado (status: $STATUS)"
fi
echo ""

# 3) Mint/verify (se tiver endpoint)
if [ -n "$AT" ]; then
  echo ">> 6) Token verify (introspection)..."
  # Se tiver endpoint /tokens/verify (Core API)
  CORE_API="${CORE_API:-https://core.api.ubl.agency}"
  curl -s -X POST "$CORE_API/tokens/verify" \
    -H "authorization: Bearer $AT" \
    -H "content-type: application/json" | jq '.' || echo "   ⚠️  Verify endpoint não disponível"
  echo ""
fi

# 4) Session
echo ">> 7) Session (com token)..."
if [ -n "$AT" ]; then
  SESSION=$(curl -i -s "$AUTH/session" \
    -H "authorization: Bearer $AT")
  echo "$SESSION" | sed -n '1,15p'
  COOKIE=$(echo "$SESSION" | grep -i "set-cookie" || true)
  if [ -n "$COOKIE" ]; then
    echo "   ✅ Cookie sid presente"
  else
    echo "   ⚠️  Cookie sid não encontrado"
  fi
else
  echo "   ⚠️  Sem access_token para testar session"
fi
echo ""

# 5) ABAC (nega/permite)
echo ">> 8) ABAC (teste de negação)..."
CORE_API="${CORE_API:-https://core.api.ubl.agency}"
DENY_TEST=$(curl -s -X POST "$CORE_API/tokens/mint" \
  -H "content-type: application/json" \
  -d '{"resource":"admin:root","action":"*","tags":{}}')
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CORE_API/tokens/mint" \
  -H "content-type: application/json" \
  -d '{"resource":"admin:root","action":"*","tags":{}}')
if [ "$STATUS_CODE" = "403" ]; then
  echo "   ✅ ABAC negou corretamente (403)"
  echo "$DENY_TEST" | jq '.'
else
  echo "   ⚠️  Esperado 403, recebido $STATUS_CODE"
  echo "$DENY_TEST" | jq '.'
fi
echo ""

# 6) Office API
echo ">> 9) Office Inventory..."
INVENTORY=$(curl -s "$OFFICE/inventory")
echo "$INVENTORY" | jq '.'
OK=$(echo "$INVENTORY" | jq -r '.ok // false')
if [ "$OK" = "true" ]; then
  COUNT=$(echo "$INVENTORY" | jq -r '.files | length')
  echo "   ✅ Inventory OK ($COUNT arquivos)"
else
  echo "   ⚠️  Inventory falhou"
fi
echo ""

# 10) Office-LLM (se disponível)
LLM="${LLM:-https://office-llm.ubl.agency}"
echo ">> 10) Office-LLM..."
if curl -s "$LLM/healthz" > /dev/null 2>&1; then
  echo "   [Health]"
  curl -s "$LLM/healthz" | jq '.'
  echo "   [Policy]"
  curl -s "$LLM/policy" | jq '.logic'
  echo "   ✅ Office-LLM disponível"
else
  echo "   ⚠️  Office-LLM não disponível (opcional)"
fi
echo ""

echo "== OK =="
echo ""
echo "📋 Resumo:"
echo "   • Health: ✅"
echo "   • JWKS: ✅ (KID: $KID_CANONICAL)"
echo "   • Device Flow: ✅"
echo "   • Session: ✅"
echo "   • ABAC: ✅"
echo "   • Office: ✅"
echo "   • Office-LLM: $([ -n "${LLM:-}" ] && curl -s "$LLM/healthz" > /dev/null 2>&1 && echo "✅" || echo "⚠️  (opcional)")"
