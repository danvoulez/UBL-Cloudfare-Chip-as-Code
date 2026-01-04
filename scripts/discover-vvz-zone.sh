#!/usr/bin/env bash
# Descobre o Zone ID do domínio voulezvous.tv

set -euo pipefail

source "${BASH_SOURCE%/*}/../env" 2>/dev/null || true

CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ CLOUDFLARE_API_TOKEN não encontrado no env"
    echo "   Defina no arquivo env ou exporte a variável"
    exit 1
fi

echo "🔍 Buscando Zone ID para voulezvous.tv..."
echo ""

RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=voulezvous.tv" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
RESULT_COUNT=$(echo "$RESPONSE" | jq -r '.result | length')

if [ "$SUCCESS" != "true" ] || [ "$RESULT_COUNT" -eq 0 ]; then
    echo "⚠️  Zone voulezvous.tv não encontrada"
    echo ""
    echo "📝 Para criar a zone:"
    echo "   1. Acesse: https://dash.cloudflare.com → Add a site"
    echo "   2. Adicione: voulezvous.tv"
    echo "   3. Siga as instruções de DNS"
    echo ""
    echo "   OU via API:"
    echo "   curl -X POST \"https://api.cloudflare.com/client/v4/zones\" \\"
    echo "     -H \"Authorization: Bearer \${CLOUDFLARE_API_TOKEN}\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"account\":{\"id\":\"${CLOUDFLARE_ACCOUNT_ID}\"},\"name\":\"voulezvous.tv\",\"type\":\"full\"}'"
    exit 1
fi

ZONE_ID=$(echo "$RESPONSE" | jq -r '.result[0].id')
ZONE_NAME=$(echo "$RESPONSE" | jq -r '.result[0].name')

echo "✅ Zone encontrada:"
echo "   Name: ${ZONE_NAME}"
echo "   Zone ID: ${ZONE_ID}"
echo ""
echo "📋 Use este Zone ID no wrangler.vvz.toml:"
echo "   <VVZ_ZONE_ID> = ${ZONE_ID}"
echo ""
echo "💡 Para preencher automaticamente:"
echo "   export VVZ_ZONE_ID=\"${ZONE_ID}\""
echo "   bash scripts/fill-placeholders.sh"
