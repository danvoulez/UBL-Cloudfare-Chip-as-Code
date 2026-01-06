#!/usr/bin/env bash
# Adicionar secrets ao Worker usando Global API Key via wrangler
set -euo pipefail

# Carregar do env
if [ -f "$(dirname "$0")/../env" ]; then
  set +u
  source "$(dirname "$0")/../env" 2>/dev/null || true
  set -u
fi

WORKER_NAME="${1:-messenger-proxy}"
ST_CLIENT_ID="${2:-7e6a8e2707cc6022d47c9b0d20c27340.access}"
ST_CLIENT_SECRET="${3:-2e01fba6e4a6be6f8853ed7f4fa820d1ed0a26886e7504a3894c99142ec3cff7}"

# Limpar API Token para forçar uso de Global API Key
unset CLOUDFLARE_API_TOKEN 2>/dev/null || true

# Configurar Global API Key
export CF_API_KEY="${CLOUDFLARE_API_KEY:-3e42b64df2d9bef99f59cffbf543ad78981a3}"
export CF_API_EMAIL="${CLOUDFLARE_ACCOUNT_EMAIL:-dan@danvoulez.com}"

cd "$(dirname "$0")/../workers/${WORKER_NAME}"

echo "🔧 Adicionando secrets ao Worker ${WORKER_NAME}..."
echo ""
echo "   CF_ACCESS_CLIENT_ID..."
echo "$ST_CLIENT_ID" | wrangler secret put CF_ACCESS_CLIENT_ID 2>&1 | tail -3

echo ""
echo "   CF_ACCESS_CLIENT_SECRET..."
echo "$ST_CLIENT_SECRET" | wrangler secret put CF_ACCESS_CLIENT_SECRET 2>&1 | tail -3

echo ""
echo "✅ Secrets adicionados (ou tentado)"
