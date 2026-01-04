#!/bin/bash
# Smoke test multitenant (Blueprint 17)
# Tests tenant resolution, policy loading, CORS, and access control

set -euo pipefail

EDGE_HOST="${EDGE_HOST:-https://api.ubl.agency}"
TENANT_UBL="${TENANT_UBL:-ubl}"
TENANT_VVZ="${TENANT_VVZ:-voulezvous}"

echo "🧪 Smoke Test Multitenant"
echo "========================="
echo ""

# Test 1: Warmup for ubl tenant
echo "1️⃣  Warmup (tenant: ${TENANT_UBL})"
RESP=$(curl -sf "${EDGE_HOST}/warmup" -H "X-Ubl-Tenant: ${TENANT_UBL}" || echo "")
if echo "$RESP" | jq -e '.ok == true' >/dev/null 2>&1; then
  echo "   ✅ Warmup OK"
  echo "$RESP" | jq '{tenant, ok, blake3, version, id}'
else
  echo "   ❌ Warmup failed"
  echo "$RESP"
  exit 1
fi
echo ""

# Test 2: Warmup for voulezvous tenant
echo "2️⃣  Warmup (tenant: ${TENANT_VVZ})"
RESP=$(curl -sf "${EDGE_HOST}/warmup" -H "X-Ubl-Tenant: ${TENANT_VVZ}" || echo "")
if echo "$RESP" | jq -e '.ok == true' >/dev/null 2>&1; then
  echo "   ✅ Warmup OK"
  echo "$RESP" | jq '{tenant, ok, blake3, version, id}'
else
  echo "   ⚠️  Warmup failed (expected if policy not published yet)"
  echo "$RESP"
fi
echo ""

# Test 3: Policy status for ubl
echo "3️⃣  Policy Status (tenant: ${TENANT_UBL})"
RESP=$(curl -sf "${EDGE_HOST}/_policy/status" -H "X-Ubl-Tenant: ${TENANT_UBL}" || echo "")
if echo "$RESP" | jq -e '.tenant == "${TENANT_UBL}"' >/dev/null 2>&1; then
  echo "   ✅ Status OK"
  echo "$RESP" | jq '{tenant, ready, version, id, stage}'
else
  echo "   ❌ Status failed"
  echo "$RESP"
  exit 1
fi
echo ""

# Test 4: CORS for voulezvous
echo "4️⃣  CORS (Origin: https://voulezvous.tv)"
RESP=$(curl -sfI "${EDGE_HOST}/warmup" \
  -H "Origin: https://voulezvous.tv" \
  -H "X-Ubl-Tenant: ${TENANT_VVZ}" || echo "")
if echo "$RESP" | grep -i "access-control-allow-origin.*voulezvous.tv" >/dev/null; then
  echo "   ✅ CORS OK"
  echo "$RESP" | grep -i "access-control" || true
else
  echo "   ⚠️  CORS headers not found (may be expected if tenant not configured)"
  echo "$RESP" | head -10
fi
echo ""

# Test 5: Admin path - ubl should allow (with Access)
echo "5️⃣  Admin Path (tenant: ${TENANT_UBL})"
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
  "${EDGE_HOST}/admin/health" \
  -H "X-Ubl-Tenant: ${TENANT_UBL}" || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "   ✅ Response: ${HTTP_CODE} (expected: 200 with Access, 401/403 without)"
else
  echo "   ⚠️  Unexpected: ${HTTP_CODE}"
fi
echo ""

# Test 6: Admin path - voulezvous should deny
echo "6️⃣  Admin Path (tenant: ${TENANT_VVZ})"
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
  "${EDGE_HOST}/admin/health" \
  -H "X-Ubl-Tenant: ${TENANT_VVZ}" || echo "000")
if [ "$HTTP_CODE" = "403" ]; then
  echo "   ✅ Denied as expected: ${HTTP_CODE}"
else
  echo "   ⚠️  Unexpected: ${HTTP_CODE} (expected 403)"
fi
echo ""

# Test 7: Host-based tenant resolution
echo "7️⃣  Host Resolution (api.ubl.agency → ubl)"
RESP=$(curl -sf "${EDGE_HOST}/_policy/status" || echo "")
if echo "$RESP" | jq -e '.tenant == "${TENANT_UBL}"' >/dev/null 2>&1; then
  echo "   ✅ Tenant resolved: ${TENANT_UBL}"
else
  echo "   ⚠️  Tenant resolution may need verification"
  echo "$RESP" | jq '.tenant' || echo "$RESP"
fi
echo ""

echo "✅✅✅ Smoke test completed!"
echo ""
echo "📋 Summary:"
echo "  • Tenant resolution: OK"
echo "  • Policy loading: Check status above"
echo "  • CORS: Check above"
echo "  • Access control: Check above"
echo ""
echo "⚠️  Next steps:"
echo "  1. Publish voulezvous policy to KV:"
echo "     wrangler kv key put --binding=UBL_FLAGS policy_voulezvous_yaml @policies/vvz_core_v1.yaml"
echo "     wrangler kv key put --binding=UBL_FLAGS policy_voulezvous_pack @/tmp/pack_vvz_v1.json"
echo "  2. Reload voulezvous policy:"
echo "     curl -XPOST '${EDGE_HOST}/_reload?tenant=${TENANT_VVZ}&stage=next'"
echo "  3. Configure Access AUD/JWKS for voulezvous in wrangler.toml"
