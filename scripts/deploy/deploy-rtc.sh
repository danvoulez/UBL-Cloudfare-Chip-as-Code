#!/usr/bin/env bash
# Deploy RTC Signaling Worker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT/rtc-worker"

echo "🚀 Deploy RTC Signaling Worker"
echo "=============================="
echo ""

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "[1/2] Instalando dependências..."
    npm install
    echo ""
fi

# Deploy
echo "[2/2] Deploy do RTC Worker..."
wrangler deploy --name vvz-rtc --config wrangler.toml

echo ""
echo "✅✅✅ RTC Worker deployado!"
echo ""
echo "📋 Proof of Done:"
echo "   curl -s https://rtc.voulezvous.tv/healthz | jq"
echo "   # Deve retornar: {\"ok\":true,\"ts\":...}"
echo ""
echo "   # WebSocket (usando websocat):"
echo "   websocat -v 'wss://rtc.voulezvous.tv/rooms?id=smoke'"
echo "   # Envie: {\"type\":\"hello\"}"
echo "   # Deve responder: {\"type\":\"ack\",\"ok\":true}"
