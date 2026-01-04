#!/usr/bin/env bash
# Criar Access Apps via API do Cloudflare
# Cria UBL Flagship e Voulezvous automaticamente

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$PROJECT_ROOT/env" 2>/dev/null || true

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

echo "🚀 Criando Access Apps via API..."
echo ""

# Verificar permissões do token
echo "🔍 Verificando permissões do token..."
VERIFY_RESPONSE=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json")

if ! echo "$VERIFY_RESPONSE" | grep -q '"success":true'; then
    echo "❌ Token inválido ou sem permissões"
    echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
    exit 1
fi

# Verificar se tem permissão para Access (tentar diferentes formatos)
PERMISSIONS=$(echo "$VERIFY_RESPONSE" | jq -r '.result.permissions[]? | select(.id? | contains("access") or contains("zero") or contains("zt")) | .id' 2>/dev/null || echo "")
if [ -z "$PERMISSIONS" ]; then
    # Tentar verificar via teste de criação (mais direto)
    TEST_RESPONSE=$(curl -s -X POST \
      "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/access/apps" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"name":"__TEST__","domain":"test.example.com","type":"self_hosted","session_duration":"1h"}' 2>&1)
    
    if echo "$TEST_RESPONSE" | grep -q "Authentication error\|permission\|unauthorized"; then
        echo "⚠️  Token não tem permissão para criar Access Apps"
        echo ""
        echo "📝 Para criar Access Apps via API, o token precisa ter:"
        echo "   - Zero Trust → Access → Write"
        echo ""
        echo "💡 Como criar um token com permissões corretas:"
        echo "   1. Acesse: https://dash.cloudflare.com/profile/api-tokens"
        echo "   2. Clique em 'Create Token'"
        echo "   3. Use 'Edit Cloudflare Zero Trust' template"
        echo "   4. Ou crie custom com:"
        echo "      - Account → Zero Trust → Access → Edit"
        echo "   5. Copie o token e atualize no arquivo env"
        echo ""
        echo "📚 Veja: scripts/create-access-apps-with-permissions.md"
        echo ""
        echo "⚠️  Alternativa: Criar Access Apps manualmente no dashboard"
        echo "   https://dash.cloudflare.com → Zero Trust → Access → Applications"
        echo "   Depois execute: bash scripts/discover-access.sh"
        echo ""
        exit 1
    fi
fi

echo "✅ Token verificado (tentando criar apps...)"
echo ""

# Função para criar Access App
create_access_app() {
    local name="$1"
    local domain="$2"
    local session_duration="${3:-24h}"
    
    echo "📝 Criando: $name (domain: $domain)..."
    
    # Preparar payload JSON
    local payload=$(cat <<EOF
{
  "name": "$name",
  "domain": "$domain",
  "type": "self_hosted",
  "session_duration": "$session_duration",
  "app_launcher_visible": true,
  "enable_binding_cookie": false
}
EOF
)
    
    # Criar app via API
    local response=$(curl -s -w "\n%{http_code}" -X POST \
      "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/access/apps" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$payload")
    
    # Separar body e status code
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    local response="$body"
    
    # Verificar sucesso
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        if echo "$response" | grep -q '"success":true'; then
        local aud=$(echo "$response" | jq -r '.result.aud' 2>/dev/null || echo "")
        local app_id=$(echo "$response" | jq -r '.result.id' 2>/dev/null || echo "")
        
        if [ -n "$aud" ] && [ "$aud" != "null" ]; then
            echo "   ✅ Criada com sucesso!"
            echo "   AUD: $aud"
            echo "   App ID: $app_id"
            echo ""
            echo "$aud"
            return 0
        else
            echo "   ⚠️  Criada, mas não foi possível extrair AUD"
            echo "$response" | jq '.' 2>/dev/null || echo "$response"
            return 1
        fi
        else
            echo "   ❌ Resposta não indica sucesso:"
            echo "$response" | jq '.' 2>/dev/null || echo "$response"
            return 1
        fi
    else
        # Verificar se já existe
        if echo "$response" | grep -qi "already exists\|duplicate"; then
            echo "   ℹ️  App já existe, buscando AUD..."
            # Buscar app existente
            local list_response=$(curl -s -X GET \
              "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/access/apps" \
              -H "Authorization: Bearer ${API_TOKEN}" \
              -H "Content-Type: application/json")
            
            local existing_aud=$(echo "$list_response" | jq -r ".result[] | select(.domain == \"$domain\" or .name == \"$name\") | .aud" 2>/dev/null | head -1)
            
            if [ -n "$existing_aud" ] && [ "$existing_aud" != "null" ]; then
                echo "   ✅ App encontrada!"
                echo "   AUD: $existing_aud"
                echo ""
                echo "$existing_aud"
                return 0
            fi
        fi
        
        echo "   ❌ Erro ao criar app:"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        return 1
    fi
}

# 1. Criar UBL Flagship
echo "1️⃣  UBL Flagship..."
AUD_UBL=$(create_access_app "UBL Flagship" "api.ubl.agency" "24h")
if [ $? -ne 0 ] || [ -z "$AUD_UBL" ]; then
    echo "   ❌ Falha ao criar UBL Flagship"
    exit 1
fi

# 2. Criar Voulezvous Admin
echo "2️⃣  Voulezvous Admin..."
# Voulezvous Admin: subdomínio dedicado admin.voulezvous.tv
# O site público (voulezvous.tv) continua aberto, só admin.voulezvous.tv recebe Cf-Access-Jwt-Assertion
AUD_VVZ=$(create_access_app "Voulezvous Admin" "admin.voulezvous.tv" "24h")
if [ $? -ne 0 ] || [ -z "$AUD_VVZ" ]; then
    echo "   ❌ Falha ao criar Voulezvous"
    exit 1
fi

# JWKS é o mesmo para ambos (mesmo Account ID)
JWKS_TEAM="https://${ACCOUNT_ID}.cloudflareaccess.com/cdn-cgi/access/certs"

echo "✅✅✅ Access Apps criadas com sucesso!"
echo ""
echo "📋 Valores obtidos:"
echo "   AUD_UBL: $AUD_UBL"
echo "   AUD_VVZ: $AUD_VVZ"
echo "   JWKS_TEAM: $JWKS_TEAM"
echo ""

# Exportar para uso imediato
export AUD_UBL
export AUD_VVZ
export JWKS_TEAM

echo "📝 Para preencher placeholders automaticamente:"
echo "   bash scripts/fill-placeholders.sh"
echo ""
echo "💡 Ou exporte manualmente:"
echo "   export AUD_UBL=\"$AUD_UBL\""
echo "   export AUD_VVZ=\"$AUD_VVZ\""
echo "   export JWKS_TEAM=\"$JWKS_TEAM\""
