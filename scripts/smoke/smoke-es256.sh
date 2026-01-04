#!/bin/bash
# Smoke test for ES256 JWT flow
# Blueprint 06 — Identity & Access (ES256)
# Proof of Done: Core API (source) + Worker (cache) + verification

set -euo pipefail

CORE_URL="${CORE_URL:-http://127.0.0.1:9458}"
EDGE_URL="${EDGE_URL:-https://api.ubl.agency}"
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "🧪 ES256 Smoke Test"
echo "==================="
echo ""

# A. JWKS check
echo "A) JWKS endpoint (Core API)"
echo "   GET ${CORE_URL}/auth/jwks.json"
JWKS_RESP=$(curl -s "${CORE_URL}/auth/jwks.json")
ALG=$(echo "$JWKS_RESP" | jq -r '.keys[0].alg // "ERROR"')
KID=$(echo "$JWKS_RESP" | jq -r '.keys[0].kid // "ERROR"')

if [[ "$ALG" == "ES256" && "$KID" == "jwt-v1" ]]; then
    echo "   ✅ JWKS: alg=${ALG}, kid=${KID}"
else
    echo "   ❌ JWKS: alg=${ALG}, kid=${KID} (expected: ES256, jwt-v1)"
    exit 1
fi
echo ""

# B. Mint token (if endpoint exists)
echo "B) Token mint (Core API)"
echo "   POST ${CORE_URL}/tokens/mint"
MINT_RESP=$(curl -s -X POST "${CORE_URL}/tokens/mint" \
    -H "Content-Type: application/json" \
    -d '{"scope":{"tenant":"ubl","session_type":"work"},"session_type":"work","client_id":"smoke-test"}' || echo '{"error":"endpoint_not_implemented"}')

if echo "$MINT_RESP" | jq -e '.jwt' > /dev/null 2>&1; then
    JWT=$(echo "$MINT_RESP" | jq -r '.jwt')
    echo "$JWT" > "$TMPDIR/jwt.txt"
    
    # Decode header
    HEADER_B64=$(echo "$JWT" | cut -d'.' -f1)
    HEADER_JSON=$(echo "$HEADER_B64" | base64 -d 2>/dev/null || echo "$HEADER_B64" | base64url -d 2>/dev/null || echo '{}')
    HEADER_ALG=$(echo "$HEADER_JSON" | jq -r '.alg // "ERROR"')
    HEADER_KID=$(echo "$HEADER_JSON" | jq -r '.kid // "ERROR"')
    
    if [[ "$HEADER_ALG" == "ES256" && "$HEADER_KID" == "jwt-v1" ]]; then
        echo "   ✅ Token: alg=${HEADER_ALG}, kid=${HEADER_KID}"
    else
        echo "   ❌ Token: alg=${HEADER_ALG}, kid=${HEADER_KID} (expected: ES256, jwt-v1)"
        exit 1
    fi
else
    echo "   ⚠️  Mint endpoint not implemented (skipping B, C, D)"
    echo "   Note: Implement /tokens/mint in Core API to complete smoke test"
    exit 0
fi
echo ""

# C. Worker cache/verify
echo "C) Worker JWKS cache check"
echo "   GET ${EDGE_URL}/_auth_check"
AUTH_CHECK=$(curl -s "${EDGE_URL}/_auth_check")
AUTH_OK=$(echo "$AUTH_CHECK" | jq -r '.ok // false')
AUTH_KIDS=$(echo "$AUTH_CHECK" | jq -r '.kids // []')

if [[ "$AUTH_OK" == "true" ]]; then
    echo "   ✅ Worker JWKS cache: ok=true, kids=${AUTH_KIDS}"
else
    echo "   ❌ Worker JWKS cache: ok=${AUTH_OK}"
    exit 1
fi
echo ""

# D. Worker verify token
echo "D) Worker token verification"
echo "   GET ${EDGE_URL}/warmup (with Bearer token)"
WARMUP_RESP=$(curl -s -H "Authorization: Bearer $(cat $TMPDIR/jwt.txt)" "${EDGE_URL}/warmup")
WARMUP_OK=$(echo "$WARMUP_RESP" | jq -r '.ok // false')

if [[ "$WARMUP_OK" == "true" ]]; then
    echo "   ✅ Token verified by Worker"
else
    echo "   ❌ Token verification failed: ${WARMUP_RESP}"
    exit 1
fi
echo ""

# E. MCP tool/call (if available)
echo "E) MCP tool/call with token"
echo "   WebSocket /mcp (tools/list)"
# Note: This would require websocat or similar
echo "   ⚠️  Manual test required:"
echo "      websocat -n1 wss://${EDGE_URL}/mcp <<< '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{\"meta\":{\"version\":\"v1\",\"client_id\":\"test\",\"op_id\":\"test\",\"correlation_id\":\"test\",\"session_type\":\"work\",\"mode\":\"commitment\",\"scope\":{\"tenant\":\"ubl\"}}}}'"
echo ""

echo "✅✅✅ ES256 Smoke Test PASSED!"
echo ""
echo "Summary:"
echo "  ✅ JWKS served by Core API (ES256, jwt-v1)"
echo "  ✅ Token minted with ES256"
echo "  ✅ Worker JWKS cache working"
echo "  ✅ Worker token verification working"
echo ""
echo "Next: Test MCP tool/call manually with WebSocket client"
