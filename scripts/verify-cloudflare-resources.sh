#!/bin/bash
# Script para verificar recursos reais do Cloudflare e atualizar CLOUDFLARE_DEPLOYED.md
# Requer: wrangler CLI instalado e autenticado

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/CLOUDFLARE_DEPLOYED_VERIFIED.md"

echo "🔍 Verificando recursos Cloudflare..."
echo ""

# Verificar se wrangler está instalado
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler não encontrado. Instale com: npm install -g wrangler"
    exit 1
fi

# Verificar autenticação
if ! wrangler whoami &> /dev/null; then
    echo "❌ Não autenticado. Execute: wrangler login"
    exit 1
fi

echo "✅ wrangler autenticado"
echo ""

# Função para extrair ID de JSON (compatível com macOS)
extract_id_from_json() {
    local json="$1"
    local key="$2"
    if command -v jq &> /dev/null; then
        echo "$json" | jq -r ".[] | select(.title | ascii_downcase | contains(\"$key\")) | .id" 2>/dev/null | head -1 || echo "NOT_FOUND"
    else
        # Fallback: usar sed/awk
        echo "$json" | sed -n "s/.*\"id\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*\"title\"[[:space:]]*:[[:space:]]*\"[^\"]*$key[^\"]*\".*/\1/p" | head -1 || echo "NOT_FOUND"
    fi
}

# Workers (listar todos e filtrar)
echo "📋 Workers:"
echo "----------"
WORKERS=$(wrangler deployments list 2>/dev/null || echo "")
if echo "$WORKERS" | grep -qE "ubl-flagship-edge|ubl-media-api"; then
    echo "$WORKERS" | grep -E "ubl-flagship-edge|ubl-media-api" || echo "$WORKERS"
else
    echo "⚠️  Workers ubl-flagship-edge ou ubl-media-api não encontrados"
    echo "   (pode não estar deployado ou usar outro nome)"
    if [ -n "$WORKERS" ]; then
        echo "   Workers encontrados:"
        echo "$WORKERS" | head -5
    fi
fi
echo ""

# KV Namespaces
echo "🗄️  KV Namespaces:"
echo "-----------------"
KV_NAMESPACES=$(wrangler kv namespace list 2>/dev/null || echo "")
if [ -n "$KV_NAMESPACES" ]; then
    echo "$KV_NAMESPACES"
    
    # Tentar extrair IDs específicos usando jq ou fallback
    if command -v jq &> /dev/null; then
        UBL_FLAGS_ID=$(echo "$KV_NAMESPACES" | jq -r '.[] | select(.title | ascii_downcase | contains("ubl_flags") or contains("flags")) | .id' 2>/dev/null | head -1 || echo "NOT_FOUND")
        KV_MEDIA_ID=$(echo "$KV_NAMESPACES" | jq -r '.[] | select(.title | ascii_downcase | contains("media")) | .id' 2>/dev/null | head -1 || echo "NOT_FOUND")
        PLANS_KV_ID=$(echo "$KV_NAMESPACES" | jq -r '.[] | select(.title | ascii_downcase | contains("plans") or contains("billing")) | .id' 2>/dev/null | head -1 || echo "NOT_FOUND")
    else
        # Fallback: buscar manualmente no JSON
        UBL_FLAGS_ID=$(echo "$KV_NAMESPACES" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/' || echo "NOT_FOUND")
        KV_MEDIA_ID="NOT_FOUND"
        PLANS_KV_ID="NOT_FOUND"
    fi
    
    echo ""
    echo "IDs encontrados:"
    [ "$UBL_FLAGS_ID" != "NOT_FOUND" ] && echo "  ✅ UBL_FLAGS: $UBL_FLAGS_ID"
    [ "$KV_MEDIA_ID" != "NOT_FOUND" ] && echo "  ✅ KV_MEDIA: $KV_MEDIA_ID"
    [ "$PLANS_KV_ID" != "NOT_FOUND" ] && echo "  ✅ PLANS_KV: $PLANS_KV_ID"
else
    echo "⚠️  Não foi possível listar KV namespaces"
fi
echo ""

# D1 Databases
echo "💾 D1 Databases:"
echo "---------------"
D1_DBS=$(wrangler d1 list 2>/dev/null || echo "")
if [ -n "$D1_DBS" ]; then
    echo "$D1_DBS"
    
    # Tentar extrair IDs específicos
    D1_MEDIA_ID=$(echo "$D1_DBS" | grep -i "ubl-media\|media" | extract_id || echo "NOT_FOUND")
    BILLING_DB_ID=$(echo "$D1_DBS" | grep -i "BILLING\|billing" | extract_id || echo "NOT_FOUND")
    
    echo ""
    echo "IDs encontrados:"
    [ "$D1_MEDIA_ID" != "NOT_FOUND" ] && echo "  D1_MEDIA: $D1_MEDIA_ID"
    [ "$BILLING_DB_ID" != "NOT_FOUND" ] && echo "  BILLING_DB: $BILLING_DB_ID"
else
    echo "⚠️  Não foi possível listar D1 databases"
fi
echo ""

# R2 Buckets
echo "🪣 R2 Buckets:"
echo "-------------"
R2_BUCKETS=$(wrangler r2 bucket list 2>/dev/null || echo "")
if [ -n "$R2_BUCKETS" ]; then
    echo "$R2_BUCKETS"
else
    echo "⚠️  Não foi possível listar R2 buckets (pode precisar verificar no Dashboard)"
fi
echo ""

# Queues
echo "📨 Queues:"
echo "---------"
QUEUES=$(wrangler queues list 2>/dev/null || echo "")
if [ -n "$QUEUES" ]; then
    echo "$QUEUES"
else
    echo "⚠️  Não foi possível listar Queues (pode precisar verificar no Dashboard)"
fi
echo ""

# Account ID
echo "🔑 Account Info:"
echo "---------------"
ACCOUNT_ID=$(wrangler whoami 2>/dev/null | sed -n 's/.*Account ID: \([^ ]*\).*/\1/p' || echo "NOT_FOUND")
if [ "$ACCOUNT_ID" != "NOT_FOUND" ]; then
    echo "  Account ID: $ACCOUNT_ID"
else
    # Tentar do env
    if [ -f "$PROJECT_ROOT/env" ]; then
        ACCOUNT_ID=$(grep "^CLOUDFLARE_ACCOUNT_ID=" "$PROJECT_ROOT/env" 2>/dev/null | cut -d= -f2 || echo "NOT_FOUND")
        if [ "$ACCOUNT_ID" != "NOT_FOUND" ]; then
            echo "  Account ID: $ACCOUNT_ID (do arquivo env)"
        else
            echo "  Account ID: NOT_FOUND"
        fi
    else
        echo "  Account ID: NOT_FOUND"
    fi
fi
echo ""

# Zone ID (precisa ser fornecido manualmente ou via API)
echo "🌐 Zone Info:"
echo "------------"
echo "  Zone ID: (verificar no Dashboard: Cloudflare → ubl.agency → Overview → Zone ID)"
echo ""

echo "✅✅✅ Verificação concluída!"
echo ""
echo "📝 Próximos passos:"
echo "  1. Revisar os IDs encontrados acima"
echo "  2. Atualizar CLOUDFLARE_DEPLOYED.md com os valores reais"
echo "  3. Verificar no Dashboard do Cloudflare:"
echo "     - Workers: https://dash.cloudflare.com → Workers & Pages"
echo "     - KV: https://dash.cloudflare.com → Workers & Pages → KV"
echo "     - R2: https://dash.cloudflare.com → R2"
echo "     - D1: https://dash.cloudflare.com → Workers & Pages → D1"
echo "     - Queues: https://dash.cloudflare.com → Workers & Pages → Queues"
echo "     - Access: https://dash.cloudflare.com → Zero Trust → Access → Applications"
echo ""
echo "💡 Dica: Use 'wrangler kv namespace list' para ver todos os KV namespaces"
echo "💡 Dica: Use 'wrangler d1 list' para ver todos os D1 databases"
