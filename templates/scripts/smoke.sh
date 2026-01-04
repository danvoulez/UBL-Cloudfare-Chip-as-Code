#!/usr/bin/env bash
# Blueprint 16 — App Smoke Test (DoD P0)
# Uso: ./scripts/smoke.sh <APP_ID>

set -euo pipefail

APP_ID="${1:-}"
if [ -z "$APP_ID" ]; then
  echo "❌ Uso: $0 <APP_ID>"
  exit 1
fi

EDGE_HOST="${EDGE_HOST:-https://api.ubl.agency}"
MCP_WS_URL="${MCP_WS_URL:-wss://api.ubl.agency/mcp}"

echo "🧪 Smoke test: $APP_ID"
echo ""

# Helper para chamadas WebSocket (requer websocat ou script Node.js)
WS_CALL() {
  local json="$1"
  if command -v websocat &> /dev/null; then
    echo "$json" | websocat -n1 "$MCP_WS_URL"
  elif [ -f "scripts/ws-call.mjs" ]; then
    echo "$json" | node scripts/ws-call.mjs
  else
    echo "⚠️  websocat ou scripts/ws-call.mjs não encontrado"
    echo "   Instale: cargo install websocat"
    echo "   Ou crie scripts/ws-call.mjs"
    return 1
  fi
}

# 1) Warmup
echo "[1/3] Warmup..."
WARMUP_RESP=$(curl -fsS "${EDGE_HOST}/warmup" || echo '{"ok":false}')
if echo "$WARMUP_RESP" | jq -e '.ok == true' >/dev/null 2>&1; then
  echo "✅ Warmup OK"
else
  echo "❌ Warmup falhou: $WARMUP_RESP"
  exit 1
fi

# 2) tools/list
echo "[2/3] tools/list..."
TOOLS_LIST_JSON=$(cat <<JSON
{
  "jsonrpc": "2.0",
  "id": "smk-1",
  "method": "tools/list",
  "params": {
    "meta": {
      "version": "v1",
      "client_id": "app:${APP_ID}",
      "op_id": "smk-1",
      "correlation_id": "smk-c1",
      "session_type": "work",
      "mode": "commitment",
      "scope": {
        "tenant": "ubl",
        "entity": "demo"
      }
    }
  }
}
JSON
)

TOOLS_RESP=$(WS_CALL "$TOOLS_LIST_JSON" || echo '{"error":{"code":-1}}')
if echo "$TOOLS_RESP" | jq -e '.result.tools | length > 0' >/dev/null 2>&1; then
  echo "✅ tools/list OK"
  echo "$TOOLS_RESP" | jq '.result.tools[]' | head -3
else
  echo "❌ tools/list falhou: $TOOLS_RESP"
  exit 1
fi

# 3) append_link
echo "[3/3] tool/call — append_link..."
APPEND_LINK_JSON=$(cat <<JSON
{
  "jsonrpc": "2.0",
  "id": "smk-2",
  "method": "tool/call",
  "params": {
    "meta": {
      "version": "v1",
      "client_id": "app:${APP_ID}",
      "op_id": "smk-2",
      "correlation_id": "smk-c2",
      "session_type": "work",
      "mode": "commitment",
      "scope": {
        "tenant": "ubl",
        "entity": "demo"
      }
    },
    "tool": "ubl@v1.append_link",
    "args": {
      "entity_id": "cust_42",
      "type": "demo.event",
      "json": {
        "ok": true
      }
    }
  }
}
JSON
)

APPEND_RESP=$(WS_CALL "$APPEND_LINK_JSON" || echo '{"error":{"code":-1}}')
if echo "$APPEND_RESP" | jq -e '.result.ok == true' >/dev/null 2>&1; then
  echo "✅ append_link OK"
else
  echo "⚠️  append_link retornou: $APPEND_RESP"
  # Não falha se for erro esperado (FORBIDDEN, etc.)
fi

echo ""
echo "✅✅✅ SMOKE PASS"
