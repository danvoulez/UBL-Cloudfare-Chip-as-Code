#!/usr/bin/env bash
# Script completo: descobrir Access, preencher placeholders e deploy
# Uso: bash scripts/deploy-multitenant.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "🚀 Deploy Multitenant — Runbook P0"
echo "=================================="
echo ""

# 1) Descobrir Access Apps
echo "1️⃣  Descobrindo Access Apps..."
echo ""

if ! bash scripts/discover-access.sh > /tmp/discover-access-output.txt 2>&1; then
    echo "⚠️  Erro ao descobrir Access Apps"
    echo ""
    echo "📝 Você precisa criar as Access Apps primeiro:"
    echo "   - UBL Flagship → api.ubl.agency"
    echo "   - Voulezvous → voulezvous.tv, www.voulezvous.tv"
    echo ""
    echo "   Dashboard: https://dash.cloudflare.com → Zero Trust → Access → Applications"
    echo ""
    exit 1
fi

# Extrair valores do output (se o script retornou apps)
if grep -q "App encontrada para UBL" /tmp/discover-access-output.txt; then
    AUD_UBL=$(grep -A 1 "App encontrada para UBL" /tmp/discover-access-output.txt | grep "ACCESS_AUD:" | sed 's/.*ACCESS_AUD: //' || echo "")
    JWKS_UBL=$(grep -A 1 "App encontrada para UBL" /tmp/discover-access-output.txt | grep "ACCESS_JWKS:" | sed 's/.*ACCESS_JWKS: //' || echo "")
fi

if grep -q "App encontrada para Voulezvous" /tmp/discover-access-output.txt; then
    AUD_VVZ=$(grep -A 1 "App encontrada para Voulezvous" /tmp/discover-access-output.txt | grep "ACCESS_AUD:" | sed 's/.*ACCESS_AUD: //' || echo "")
    JWKS_VVZ=$(grep -A 1 "App encontrada para Voulezvous" /tmp/discover-access-output.txt | grep "ACCESS_JWKS:" | sed 's/.*ACCESS_JWKS: //' || echo "")
fi

# Se não conseguiu extrair automaticamente, pedir ao usuário
if [ -z "${AUD_UBL:-}" ] || [ -z "${AUD_VVZ:-}" ]; then
    echo "⚠️  Não foi possível extrair valores automaticamente"
    echo ""
    echo "📝 Por favor, execute manualmente:"
    echo "   bash scripts/discover-access.sh"
    echo ""
    echo "E então exporte as variáveis:"
    echo "   export AUD_UBL=\"<audience_UBL>\""
    echo "   export AUD_VVZ=\"<audience_Voulezvous>\""
    echo "   export JWKS_TEAM=\"<jwks_url>\""
    echo ""
    echo "Depois execute:"
    echo "   bash scripts/fill-placeholders.sh"
    echo ""
    exit 1
fi

# JWKS é o mesmo para ambos (mesmo Team)
JWKS_TEAM="${JWKS_UBL:-${JWKS_VVZ:-}}"

if [ -z "$JWKS_TEAM" ]; then
    echo "⚠️  JWKS não encontrado. Use o formato:"
    echo "   https://<SEU-TIME>.cloudflareaccess.com/cdn-cgi/access/certs"
    echo ""
    read -p "Digite o JWKS_TEAM: " JWKS_TEAM
fi

export AUD_UBL
export AUD_VVZ
export JWKS_TEAM

echo "✅ Valores encontrados:"
echo "   AUD_UBL: $AUD_UBL"
echo "   AUD_VVZ: $AUD_VVZ"
echo "   JWKS_TEAM: $JWKS_TEAM"
echo ""

# 2) Preencher placeholders
echo "2️⃣  Preenchendo placeholders..."
bash scripts/fill-placeholders.sh

# 3) Deploy Gateway
echo ""
echo "3️⃣  Deploy Gateway (ubl-flagship-edge)..."
wrangler deploy --name ubl-flagship-edge --config policy-worker/wrangler.toml

# 4) (Opcional) Deploy Media API
if [ -n "${KV_MEDIA_ID:-}" ] && [ -n "${D1_MEDIA_ID:-}" ]; then
    echo ""
    echo "4️⃣  Deploy Media API (ubl-media-api)..."
    wrangler deploy --name ubl-media-api --config apps/media-api-worker/wrangler.toml
else
    echo ""
    echo "4️⃣  Media API: pulando (KV_MEDIA_ID e D1_MEDIA_ID não definidos)"
fi

# 5) Smoke test
echo ""
echo "5️⃣  Smoke test..."
bash scripts/smoke.sh

echo ""
echo "✅✅✅ Deploy completo!"
echo ""
echo "📋 Proof of Done:"
echo "   ✅ wrangler deployments list mostra ubl-flagship-edge ativo"
echo "   ✅ curl -s https://api.ubl.agency/_policy/status -H 'X-Tenant: voulezvous' | jq .tenant → \"voulezvous\""
