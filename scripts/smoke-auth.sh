#!/usr/bin/env bash
# UBL ID — Smoke Tests P0
# Domínio: id.ubl.agency

set -euo pipefail

IDP_BASE="${IDP_BASE:-https://id.ubl.agency}"
CORE_API="${CORE_API:-https://core.api.ubl.agency}"

echo "== UBL ID — Smoke Tests P0 =="
echo ""

# 1. Register Passkey
echo ">> 1) Register Passkey (start)..."
REG_START=$(curl -s -X POST "$IDP_BASE/auth/passkey/register/start" \
  -H "Content-Type: application/json" \
  -d '{"username":"test-user"}')
echo "$REG_START" | jq -r '.publicKey.challenge // "ERROR"'

CHALLENGE=$(echo "$REG_START" | jq -r '.publicKey.challenge')
echo "   Challenge: $CHALLENGE"

# Nota: finish requer resposta do browser (navigator.credentials.create)
echo "   ⚠️  Finish requer browser (navigator.credentials.create)"
echo ""

# 2. Login Passkey (se já tiver passkey)
echo ">> 2) Login Passkey (start)..."
LOGIN_START=$(curl -s -X POST "$IDP_BASE/auth/passkey/login/start" \
  -H "Content-Type: application/json")
echo "$LOGIN_START" | jq -r '.publicKey.challenge // "ERROR"'
echo ""

# 3. Session (com cookie sid)
echo ">> 3) GET /session (sem cookie)..."
curl -s "$IDP_BASE/session" | jq .
echo ""

# 4. Device Flow (para voulezvous.tv)
echo ">> 4) Device Flow (start)..."
DEVICE_START=$(curl -s -X POST "$IDP_BASE/device/start" \
  -H "Content-Type: application/json")
echo "$DEVICE_START" | jq .
USER_CODE=$(echo "$DEVICE_START" | jq -r '.user_code')
DEVICE_CODE=$(echo "$DEVICE_START" | jq -r '.device_code')
echo "   User Code: $USER_CODE"
echo "   Device Code: $DEVICE_CODE"
echo ""

# 5. Device Poll (pending)
echo ">> 5) Device Poll (pending)..."
curl -s -X POST "$IDP_BASE/device/poll" \
  -H "Content-Type: application/json" \
  -d "{\"device_code\":\"$DEVICE_CODE\"}" | jq .
echo ""

# 6. Tokens Mint (requer sid válido)
echo ">> 6) POST /tokens/mint (sem sid)..."
curl -s -X POST "$CORE_API/tokens/mint" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "lab.llm",
    "action": "call:provider",
    "tags": {"adult": true}
  }' | jq .
echo ""

# 7. Tokens Refresh (requer refresh_token)
echo ">> 7) POST /tokens/refresh (sem token)..."
curl -s -X POST "$CORE_API/tokens/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"test"}' | jq .
echo ""

# 8. Tokens Revoke
echo ">> 8) POST /tokens/revoke..."
curl -s -X POST "$CORE_API/tokens/revoke" \
  -H "Content-Type: application/json" \
  -d '{"jti":"test-jti"}' | jq .
echo ""

# 9. JWKS
echo ">> 9) GET /auth/jwks.json..."
curl -s "$CORE_API/auth/jwks.json" | jq .
echo ""

echo "== OK =="
echo ""
echo "📋 Próximos passos:"
echo "   1. Completar register/login no browser (WebAuthn)"
echo "   2. Testar mint com sid válido"
echo "   3. Testar refresh/revoke com tokens reais"
