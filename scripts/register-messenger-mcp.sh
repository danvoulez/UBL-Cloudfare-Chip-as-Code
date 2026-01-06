#!/bin/bash
# Registra Messenger no MCP Registry

set -e

source "$(dirname "$0")/../env" 2>/dev/null || true

REGISTRY_URL="${MCP_REGISTRY_URL:-https://mcp-registry-office.dan-1f4.workers.dev}"
MESSENGER_WS_URL="wss://messenger.api.ubl.agency/mcp"

echo "📝 Registrando Messenger no MCP Registry..."
echo "   Registry: ${REGISTRY_URL}"
echo "   Messenger WS: ${MESSENGER_WS_URL}"
echo ""

PAYLOAD=$(cat <<JSON
{
  "name": "ubl-messenger",
  "description": "UBL Messenger MCP Server (PWA + Gateway integration)",
  "transports": [
    {
      "type": "ws",
      "url": "${MESSENGER_WS_URL}"
    }
  ],
  "tags": ["messenger", "ubl", "pwa", "gateway"]
}
JSON
)

RESPONSE=$(curl -s -X POST "${REGISTRY_URL}/v1/servers" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

echo "Response:"
echo "${RESPONSE}" | jq -r '.' || echo "${RESPONSE}"

if echo "${RESPONSE}" | jq -e '.ok' > /dev/null 2>&1; then
  echo ""
  echo "✅ Messenger registrado com sucesso!"
else
  echo ""
  echo "⚠️  Registro pode ter falhado ou já existe"
fi
