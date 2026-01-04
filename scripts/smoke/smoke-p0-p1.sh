#!/usr/bin/env bash
# Smoke tests para P0 e P1 — validação completa

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
  local name=$1
  local cmd=$2
  local expected=$3
  
  echo -n "  ✓ $name... "
  if eval "$cmd" > /dev/null 2>&1; then
    local result=$(eval "$cmd" 2>&1)
    if echo "$result" | grep -q "$expected"; then
      echo -e "${GREEN}OK${NC}"
      return 0
    else
      echo -e "${YELLOW}WARN${NC} (resposta diferente)"
      echo "     Resultado: $result"
      return 1
    fi
  else
    echo -e "${RED}FAIL${NC}"
    return 1
  fi
}

echo "🔥 Smoke Tests P0 + P1"
echo ""

echo "P0 — Plano de Controle"
echo "======================"

echo ""
echo "1️⃣  Core online via Tunnel"
check "Core /healthz" "curl -s https://core.voulezvous.tv/healthz" "ok"

echo ""
echo "2️⃣  Gateway → Core (proxy)"
check "Gateway /core/healthz" "curl -s https://voulezvous.tv/core/healthz" "ok"

echo ""
echo "3️⃣  Gate de Admin (Access)"
echo "  → Sem login (deve redirecionar):"
ADMIN_RESP=$(curl -sI https://admin.voulezvous.tv/admin/health 2>&1 | head -1)
if echo "$ADMIN_RESP" | grep -qE "302|401|403"; then
  echo -e "  ${GREEN}✅ OK${NC} (redireciona sem login)"
else
  echo -e "  ${YELLOW}⚠️  WARN${NC} (resposta: $ADMIN_RESP)"
fi

echo ""
echo "P1 — Plano de Mídia"
echo "==================="

echo ""
echo "4️⃣  RTC health"
RTC_RESP=$(curl -s https://rtc.voulezvous.tv/healthz 2>&1)
if echo "$RTC_RESP" | jq -e '.ok == true' >/dev/null 2>&1; then
  echo -e "  ${GREEN}✅ OK${NC}"
else
  echo -e "  ${RED}❌ FAIL${NC}"
  echo "     Resposta: $RTC_RESP"
fi

echo ""
echo "5️⃣  Media API primitives"
echo "  → Presign:"
PRESIGN_RESP=$(curl -s -X POST https://api.ubl.agency/internal/media/presign \
  -H 'content-type: application/json' \
  -d '{"tenant":"voulezvous","mime":"image/png","bytes":1234}' 2>&1)
if echo "$PRESIGN_RESP" | jq -e '.id' >/dev/null 2>&1; then
  echo -e "  ${GREEN}✅ OK${NC} (presign funcionando)"
else
  echo -e "  ${RED}❌ FAIL${NC}"
  echo "     Resposta: $PRESIGN_RESP"
fi

echo "  → Link (test-id):"
LINK_RESP=$(curl -s https://api.ubl.agency/internal/media/link/test-id 2>&1 | head -1)
if echo "$LINK_RESP" | grep -qE "200|404|403"; then
  echo -e "  ${GREEN}✅ OK${NC} (endpoint responde)"
else
  echo -e "  ${YELLOW}⚠️  WARN${NC} (resposta: $LINK_RESP)"
fi

echo ""
echo "6️⃣  DNS verificado (hosts principais)"
for h in voulezvous.tv www.voulezvous.tv admin.voulezvous.tv core.voulezvous.tv rtc.voulezvous.tv; do
  echo -n "  → $h: "
  RESP=$(curl -sI "https://$h" 2>&1 | head -1)
  if echo "$RESP" | grep -q "HTTP/"; then
    echo -e "${GREEN}OK${NC} ($(echo "$RESP" | cut -d' ' -f2))"
  else
    echo -e "${RED}FAIL${NC} (NXDOMAIN ou erro)"
  fi
done

echo ""
echo "✅✅✅ Smoke tests completos!"
echo ""
echo "📋 Resumo:"
echo "  • Core: $(curl -s https://core.voulezvous.tv/healthz 2>/dev/null || echo 'N/A')"
echo "  • Gateway: $(curl -s https://voulezvous.tv/core/healthz 2>/dev/null | head -1 || echo 'N/A')"
echo "  • RTC: $(curl -s https://rtc.voulezvous.tv/healthz 2>/dev/null | jq -r '.ok // "N/A"' || echo 'N/A')"
