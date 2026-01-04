#!/bin/bash
# Descobrir ACCESS_AUD e ACCESS_JWKS automaticamente via API do Cloudflare
# Suporta múltiplos tenants (ubl e voulezvous)

set -e

source "$(dirname "$0")/../env" 2>/dev/null || true

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

if [ -z "$API_TOKEN" ]; then
    echo "⚠️  CLOUDFLARE_API_TOKEN não definido no env"
    echo "   Configure no arquivo env ou exporte a variável"
    exit 1
fi

if [ -z "$ACCOUNT_ID" ]; then
    echo "⚠️  CLOUDFLARE_ACCOUNT_ID não definido no env"
    echo "   Configure no arquivo env ou exporte a variável"
    exit 1
fi

echo "📝 Descobrindo Access Apps via API..."
echo ""

# Listar Access Applications
RESPONSE=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/access/apps" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json")

# Verificar se a resposta foi bem-sucedida
if ! echo "$RESPONSE" | grep -q '"success":true'; then
    echo "❌ Erro ao listar apps:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

RESULT_COUNT=$(echo "$RESPONSE" | jq -r '.result | length' 2>/dev/null || echo "0")

if [ "$RESULT_COUNT" -eq 0 ]; then
    echo "⚠️  Nenhuma Access App encontrada no Cloudflare Access"
    echo ""
    echo "📝 Você precisa criar Access Apps para os tenants:"
    echo ""
    echo "1️⃣  Para UBL (tenant: ubl):"
    echo "   - Dashboard: https://dash.cloudflare.com → Zero Trust → Access → Applications"
    echo "   - Clique em 'Add an application' → Self-hosted"
    echo "   - Name: UBL Flagship"
    echo "   - Domain: api.ubl.agency"
    echo "   - Session Duration: 24h"
    echo ""
    echo "2️⃣  Para Voulezvous Admin (tenant: voulezvous):"
    echo "   - Dashboard: https://dash.cloudflare.com → Zero Trust → Access → Applications"
    echo "   - Clique em 'Add an application' → Self-hosted"
    echo "   - Name: Voulezvous Admin"
    echo "   - Domain: admin.voulezvous.tv (subdomínio dedicado)"
    echo "   - Session Duration: 24h"
    echo "   - Nota: Site público (voulezvous.tv) continua aberto, só admin.voulezvous.tv protegido"
    echo ""
    echo "Após criar as apps, execute este script novamente:"
    echo "   bash scripts/discover-access.sh"
    exit 0
fi

echo "✅ Apps encontradas ($RESULT_COUNT):"
echo "$RESPONSE" | jq -r '.result[] | "  - \(.name) (aud: \(.aud), domain: \(.domain))"' 2>/dev/null || echo "$RESPONSE"

# Tentar encontrar app para api.ubl.agency (tenant: ubl)
APP_UBL=$(echo "$RESPONSE" | jq -r '.result[] | select(.domain == "api.ubl.agency" or .domain == "*.api.ubl.agency" or (.name | ascii_downcase | contains("flagship")) or (.name | ascii_downcase | contains("ubl"))) | {name: .name, aud: .aud, domain: .domain}' 2>/dev/null | head -1)

# Tentar encontrar app para voulezvous (tenant: voulezvous)
# Busca por: admin.voulezvous.tv (preferencial) ou nome contendo "voulezvous admin"
APP_VVZ=$(echo "$RESPONSE" | jq -r '.result[] | select(.domain == "admin.voulezvous.tv" or (.name | ascii_downcase | contains("voulezvous admin")) or (.name | ascii_downcase | contains("voulezvous") and (.name | ascii_downcase | contains("admin")))) | {name: .name, aud: .aud, domain: .domain}' 2>/dev/null | head -1)

echo ""

if [ -n "$APP_UBL" ] && [ "$APP_UBL" != "null" ]; then
    ACCESS_AUD_UBL=$(echo "$APP_UBL" | jq -r '.aud' 2>/dev/null)
    ACCESS_JWKS_UBL="https://${ACCOUNT_ID}.cloudflareaccess.com/cdn-cgi/access/certs"
    
    echo "✅ App encontrada para UBL (api.ubl.agency):"
    echo "   ACCESS_AUD: $ACCESS_AUD_UBL"
    echo "   ACCESS_JWKS: $ACCESS_JWKS_UBL"
    echo ""
else
    echo "⚠️  Nenhuma app encontrada para api.ubl.agency (tenant: ubl)"
    echo "   Crie uma Access App no dashboard e execute este script novamente"
    echo ""
fi

if [ -n "$APP_VVZ" ] && [ "$APP_VVZ" != "null" ]; then
    ACCESS_AUD_VVZ_ADMIN=$(echo "$APP_VVZ" | jq -r '.aud' 2>/dev/null)
    ACCESS_JWKS_VVZ="https://voulezvous.cloudflareaccess.com/cdn-cgi/access/certs"
    
    echo "✅ App encontrada para Voulezvous Admin (admin.voulezvous.tv):"
    echo "   ACCESS_AUD (AUD_VVZ_ADMIN): $ACCESS_AUD_VVZ_ADMIN"
    echo "   ACCESS_JWKS: $ACCESS_JWKS_VVZ (fixo: team voulezvous)"
    echo ""
    echo "📋 Para atualizar wrangler.toml:"
    if [ -n "$APP_UBL" ] && [ "$APP_UBL" != "null" ] && [ -n "$APP_VVZ" ] && [ "$APP_VVZ" != "null" ]; then
        echo "  export AUD_UBL=\"$ACCESS_AUD_UBL\""
        echo "  export AUD_VVZ_ADMIN=\"$ACCESS_AUD_VVZ_ADMIN\""
        echo "  bash scripts/fill-placeholders.sh"
        echo ""
        echo "  (JWKS já está fixo no wrangler.toml, não precisa mais)"
    elif [ -n "$APP_VVZ" ] && [ "$APP_VVZ" != "null" ]; then
        echo "  export AUD_UBL=\"<criar_app_UBL_primeiro>\""
        echo "  export AUD_VVZ_ADMIN=\"$ACCESS_AUD_VVZ_ADMIN\""
        echo "  bash scripts/fill-placeholders.sh"
    else
        echo "  ⚠️  Crie as Access Apps primeiro (veja instruções acima)"
    fi
else
    echo "⚠️  Nenhuma app encontrada para voulezvous (tenant: voulezvous)"
    echo ""
    echo "📝 Para criar uma Access App para Voulezvous Admin:"
    echo "   1. Acesse: https://dash.cloudflare.com → Zero Trust → Access → Applications"
    echo "   2. Clique em 'Add an application' → Self-hosted"
    echo "   3. Configure:"
    echo "      - Name: Voulezvous Admin"
    echo "      - Domain: admin.voulezvous.tv (subdomínio dedicado)"
    echo "      - Session Duration: 24h"
    echo "   4. Nota: Site público (voulezvous.tv) continua aberto, só admin.voulezvous.tv protegido"
    echo "   5. Após criar, execute este script novamente:"
    echo "      bash scripts/discover-access.sh"
fi
