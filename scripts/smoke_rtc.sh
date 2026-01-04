#!/usr/bin/env bash
# P1.1 — RTC estável (2 clientes na mesma sala)
# Testa WebSocket RTC com handshake, presence, ping/pong e signal

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOM_ID="${ROOM_ID:-lab-demo-$(date +%s)}"
TENANT="${TENANT:-voulezvous}"
RTC_URL="${RTC_URL:-wss://rtc.voulezvous.tv/rooms}"
API_URL="${API_URL:-https://api.ubl.agency}"

echo "🔥 P1.1 — RTC estável (2 clientes)"
echo "===================================="
echo ""
echo "📋 Configuração:"
echo "   Room ID: $ROOM_ID"
echo "   Tenant: $TENANT"
echo "   RTC URL: $RTC_URL"
echo ""

# Verificar dependências
check_dep() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}❌ $1 não encontrado${NC}"
    echo "   Instale: $2"
    return 1
  fi
  return 0
}

echo "🔍 Verificando dependências..."
MISSING=0
check_dep "curl" "já instalado" || MISSING=1
check_dep "jq" "brew install jq (macOS) ou apt-get install jq (Linux)" || MISSING=1

# Verificar websocat ou wscat
HAS_WEBSOCAT=false
HAS_WSCAT=false

if command -v websocat >/dev/null 2>&1; then
  HAS_WEBSOCAT=true
  echo -e "  ${GREEN}✅ websocat encontrado${NC}"
elif command -v wscat >/dev/null 2>&1; then
  HAS_WSCAT=true
  echo -e "  ${GREEN}✅ wscat encontrado${NC}"
else
  echo -e "  ${YELLOW}⚠️  websocat/wscat não encontrado${NC}"
  echo "     Instale: cargo install websocat (Rust)"
  echo "     Ou: npm install -g wscat"
  echo ""
  echo "     Continuando com testes HTTP apenas..."
fi

if [ $MISSING -eq 1 ]; then
  exit 1
fi

echo ""

# ============================================================================
# 1. Health check
# ============================================================================
echo "1️⃣  Health check"
echo "----------------"
HEALTH=$(curl -s https://rtc.voulezvous.tv/healthz 2>&1)
if echo "$HEALTH" | jq -e '.ok == true' >/dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Health OK${NC}"
  echo "     $HEALTH"
else
  echo -e "  ${RED}❌ Health FAIL${NC}"
  echo "     $HEALTH"
  exit 1
fi

echo ""

# ============================================================================
# 2. Criar sala (opcional)
# ============================================================================
echo "2️⃣  Criar sala (opcional)"
echo "------------------------"
ROOM_RESP=$(curl -s -X POST "${API_URL}/rtc/rooms" \
  -H 'content-type: application/json' \
  -d "{\"tenant\":\"${TENANT}\",\"room_id\":\"${ROOM_ID}\",\"ttl\":3600}" 2>&1)

if echo "$ROOM_RESP" | jq -e '.room_id' >/dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Sala criada${NC}"
  echo "     $ROOM_RESP" | jq .
else
  echo -e "  ${YELLOW}⚠️  Endpoint não disponível ou sala já existe${NC}"
  echo "     Continuando sem token..."
fi

echo ""

# ============================================================================
# 3. Testes WebSocket (se disponível)
# ============================================================================
if [ "$HAS_WEBSOCAT" = true ] || [ "$HAS_WSCAT" = true ]; then
  echo "3️⃣  Testes WebSocket (2 clientes)"
  echo "---------------------------------"
  echo ""
  echo -e "${YELLOW}⚠️  Testes WebSocket requerem 2 terminais${NC}"
  echo ""
  echo "Para testar manualmente:"
  echo ""
  echo -e "${BLUE}Terminal A (Alice):${NC}"
  if [ "$HAS_WEBSOCAT" = true ]; then
    echo "  websocat \"${RTC_URL}/${ROOM_ID}?client_id=alice&tenant=${TENANT}\""
  else
    echo "  wscat -c \"${RTC_URL}/${ROOM_ID}?client_id=alice&tenant=${TENANT}\""
  fi
  echo ""
  echo -e "${BLUE}Terminal B (Bob):${NC}"
  if [ "$HAS_WEBSOCAT" = true ]; then
    echo "  websocat \"${RTC_URL}/${ROOM_ID}?client_id=bob&tenant=${TENANT}\""
  else
    echo "  wscat -c \"${RTC_URL}/${ROOM_ID}?client_id=bob&tenant=${TENANT}\""
  fi
  echo ""
  echo "Comandos para enviar em cada terminal:"
  echo ""
  echo -e "${BLUE}1. Handshake (hello):${NC}"
  echo "  {\"type\":\"hello\",\"client_id\":\"alice\",\"room_id\":\"${ROOM_ID}\"}"
  echo "  Esperado: {\"type\":\"ack\",\"ok\":true}"
  echo ""
  echo -e "${BLUE}2. Presence (Alice):${NC}"
  echo "  {\"type\":\"presence.update\",\"status\":\"online\"}"
  echo "  Esperado em Bob: {\"type\":\"presence.update\",\"client_id\":\"alice\",\"status\":\"online\"}"
  echo ""
  echo -e "${BLUE}3. Ping (3x em cada):${NC}"
  echo "  {\"type\":\"ping\",\"t\":$(date +%s%3N)}"
  echo "  Esperado: {\"type\":\"pong\",\"t\":...}"
  echo ""
  echo -e "${BLUE}4. Signal (Alice → Bob):${NC}"
  echo "  {\"type\":\"signal\",\"to\":\"bob\",\"payload\":{\"kind\":\"offer\",\"sdp\":\"TEST\"}}"
  echo "  Esperado em Bob: {\"type\":\"signal\",\"from\":\"alice\",\"payload\":...}"
  echo ""
else
  echo "3️⃣  Testes WebSocket"
  echo "-------------------"
  echo -e "  ${YELLOW}⚠️  websocat/wscat não disponível${NC}"
  echo "     Instale para testar WebSocket:"
  echo "     - websocat: cargo install websocat"
  echo "     - wscat: npm install -g wscat"
fi

echo ""

# ============================================================================
# 4. Teste automatizado com curl (se possível)
# ============================================================================
echo "4️⃣  Validação de endpoints"
echo "-------------------------"
echo ""
echo "  → Verificando se endpoint aceita conexões..."
WS_TEST=$(curl -sI "https://rtc.voulezvous.tv/rooms/${ROOM_ID}" 2>&1 | head -1)
if echo "$WS_TEST" | grep -qE "426|101|400|401"; then
  echo -e "  ${GREEN}✅ Endpoint responde (esperado 426 Upgrade Required ou 101)${NC}"
else
  echo -e "  ${YELLOW}⚠️  Resposta: $WS_TEST${NC}"
fi

echo ""

# ============================================================================
# Resumo
# ============================================================================
echo "✅✅✅ Checklist P1.1"
echo "===================="
echo ""
echo "✅ Health check: OK"
echo "✅ Sala criada (ou endpoint não disponível)"
echo ""
if [ "$HAS_WEBSOCAT" = true ] || [ "$HAS_WSCAT" = true ]; then
  echo "📋 Testes WebSocket:"
  echo "   • Abra 2 terminais e siga as instruções acima"
  echo "   • Valide: ack, presence, ping/pong, signal"
else
  echo "📋 Para testar WebSocket:"
  echo "   1. Instale websocat ou wscat"
  echo "   2. Execute este script novamente"
  echo "   3. Siga as instruções para 2 terminais"
fi
echo ""
echo "📋 Proof of Done:"
echo "   • healthz → {\"ok\":true}"
echo "   • Ambos recebem ack após hello"
echo "   • Bob recebe presence.update de Alice"
echo "   • RTT (3 pings) mediana < 150ms"
echo "   • Bob recebe signal encaminhado por Alice"
echo ""
