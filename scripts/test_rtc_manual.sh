#!/usr/bin/env bash
# Script auxiliar para testar RTC manualmente com 2 clientes
# Gera comandos prontos para copy-paste

set -euo pipefail

ROOM_ID="${ROOM_ID:-lab-demo-$(date +%s)}"
TENANT="${TENANT:-voulezvous}"
RTC_URL="${RTC_URL:-wss://rtc.voulezvous.tv/rooms}"

echo "🔥 RTC Manual Test — 2 Clientes"
echo "==============================="
echo ""
echo "📋 Configuração:"
echo "   Room ID: $ROOM_ID"
echo "   Tenant: $TENANT"
echo ""

# Verificar qual ferramenta está disponível
if command -v websocat >/dev/null 2>&1; then
  WS_CMD="websocat"
  WS_TYPE="websocat"
elif command -v wscat >/dev/null 2>&1; then
  WS_CMD="wscat -c"
  WS_TYPE="wscat"
else
  WS_CMD="wscat -c"
  WS_TYPE="wscat"
  echo "⚠️  websocat ou wscat não encontrado"
  echo "   Instale: cargo install websocat"
  echo "   Ou: npm install -g wscat"
  echo ""
  echo "   Continuando com comandos de exemplo..."
  echo ""
fi

if [ "$WS_TYPE" != "none" ]; then
  echo "✅ Comandos para: $WS_CMD"
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TERMINAL A (Alice)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ "$WS_CMD" = "websocat" ]; then
  echo "$WS_CMD \"${RTC_URL}/${ROOM_ID}?client_id=alice&tenant=${TENANT}\""
else
  echo "$WS_CMD \"${RTC_URL}/${ROOM_ID}?client_id=alice&tenant=${TENANT}\""
fi
echo ""
echo "Comandos para enviar:"
echo ""
echo "1. Handshake:"
echo "{\"type\":\"hello\",\"client_id\":\"alice\",\"room_id\":\"${ROOM_ID}\"}"
echo ""
echo "2. Presence:"
echo "{\"type\":\"presence.update\",\"status\":\"online\"}"
echo ""
echo "3. Ping (3x):"
echo "{\"type\":\"ping\",\"t\":$(date +%s%3N)}"
echo "{\"type\":\"ping\",\"t\":$(date +%s%3N)}"
echo "{\"type\":\"ping\",\"t\":$(date +%s%3N)}"
echo ""
echo "4. Signal para Bob:"
echo "{\"type\":\"signal\",\"to\":\"bob\",\"payload\":{\"kind\":\"offer\",\"sdp\":\"TEST\"}}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TERMINAL B (Bob)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ "$WS_CMD" = "websocat" ]; then
  echo "$WS_CMD \"${RTC_URL}/${ROOM_ID}?client_id=bob&tenant=${TENANT}\""
else
  echo "$WS_CMD \"${RTC_URL}/${ROOM_ID}?client_id=bob&tenant=${TENANT}\""
fi
echo ""
echo "Comandos para enviar:"
echo ""
echo "1. Handshake:"
echo "{\"type\":\"hello\",\"client_id\":\"bob\",\"room_id\":\"${ROOM_ID}\"}"
echo ""
echo "2. Ping (3x):"
echo "{\"type\":\"ping\",\"t\":$(date +%s%3N)}"
echo "{\"type\":\"ping\",\"t\":$(date +%s%3N)}"
echo "{\"type\":\"ping\",\"t\":$(date +%s%3N)}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VALIDAÇÕES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Ambos recebem ack após hello"
echo "✅ Bob recebe presence.update de Alice"
echo "✅ RTT (pong - ping) < 150ms (mediana de 3 pings)"
echo "✅ Bob recebe signal encaminhado por Alice"
echo ""
