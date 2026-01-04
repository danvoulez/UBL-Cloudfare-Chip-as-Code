#!/usr/bin/env bash
# Smoke test completo para P0 Final — Login/Party/RTC

set -euo pipefail

echo "🔥 Smoke Test P0 Final — Login/Party/RTC"
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check() {
  local name=$1
  local cmd=$2
  echo -n "  ✓ $name... "
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
    return 0
  else
    echo -e "${RED}FAIL${NC}"
    return 1
  fi
}

echo "1️⃣  RTC Health"
check "RTC /healthz" "curl -s https://rtc.voulezvous.tv/healthz | jq -e '.ok == true'"

echo ""
echo "2️⃣  Core API"
check "Core /healthz" "curl -s https://core.voulezvous.tv/healthz | grep -q 'ok'"
check "Core /whoami" "curl -s https://core.voulezvous.tv/whoami | jq -e '.ok == true'"
check "Core /metrics" "curl -s https://core.voulezvous.tv/metrics | grep -q 'http_requests_total'"

echo ""
echo "3️⃣  Gateway → Core"
check "Gateway /core/healthz" "curl -s https://voulezvous.tv/core/healthz | grep -q 'ok'"
check "Gateway /core/whoami" "curl -s https://voulezvous.tv/core/whoami | jq -e '.ok == true'"

echo ""
echo "4️⃣  Media Primitives"
echo "  → Presign..."
PRESIGN_RESP=$(curl -s -X POST https://api.ubl.agency/internal/media/presign \
  -H 'content-type: application/json' \
  -d '{"tenant":"voulezvous","mime":"image/jpeg","bytes":1234,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}')

if echo "$PRESIGN_RESP" | jq -e '.id' > /dev/null 2>&1; then
  echo -e "  ✓ Presign ${GREEN}OK${NC}"
  MEDIA_ID=$(echo "$PRESIGN_RESP" | jq -r '.id')
  UPLOAD_URL=$(echo "$PRESIGN_RESP" | jq -r '.url')
  
  # Upload simulado
  echo "test content" | curl -s -X PUT "$UPLOAD_URL" --data-binary @- -H "Content-Type: image/jpeg" > /dev/null
  
  # Commit
  COMMIT_RESP=$(curl -s -X POST https://api.ubl.agency/internal/media/commit \
    -H 'content-type: application/json' \
    -d "{\"id\":\"$MEDIA_ID\"}")
  
  if echo "$COMMIT_RESP" | jq -e '.ok == true' > /dev/null 2>&1; then
    echo -e "  ✓ Commit ${GREEN}OK${NC}"
    
    # Link
    LINK_RESP=$(curl -s https://api.ubl.agency/internal/media/link/$MEDIA_ID)
    if echo "$LINK_RESP" | jq -e '.url' > /dev/null 2>&1; then
      echo -e "  ✓ Link ${GREEN}OK${NC}"
    else
      echo -e "  ✗ Link ${RED}FAIL${NC}"
    fi
  else
    echo -e "  ✗ Commit ${RED}FAIL${NC}"
  fi
else
  echo -e "  ✗ Presign ${RED}FAIL${NC}"
fi

echo ""
echo "5️⃣  Admin Routes"
echo "  ⚠️  Admin routes requerem Access token"
echo "  → Teste manual:"
echo "    curl -i https://admin.voulezvous.tv/admin/health"
echo "    curl -i -X POST https://admin.voulezvous.tv/admin/policy/promote?tenant=voulezvous&stage=next"

echo ""
echo "6️⃣  Observabilidade"
check "Core /metrics" "curl -s https://core.voulezvous.tv/metrics | grep -q 'http_requests_total'"

echo ""
echo "✅✅✅ Smoke Test Completo!"
echo ""
echo "📋 Status:"
echo "  • RTC: $(curl -s https://rtc.voulezvous.tv/healthz 2>/dev/null | jq -r '.ok // "N/A"')"
echo "  • Core: $(curl -s https://core.voulezvous.tv/healthz 2>/dev/null | grep -o 'ok' || echo 'N/A')"
echo "  • Gateway: $(curl -s https://voulezvous.tv/core/healthz 2>/dev/null | grep -o 'ok' || echo 'N/A')"
