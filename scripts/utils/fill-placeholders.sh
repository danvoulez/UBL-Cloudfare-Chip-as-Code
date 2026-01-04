#!/usr/bin/env bash
# Script para preencher placeholders nos wrangler.toml
# Uso: exporte as variáveis e execute: bash scripts/fill-placeholders.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Função sed cross-platform (BSD/macOS e GNU)
sed_i() {
  if sed --version >/dev/null 2>&1; then
    # GNU sed
    sed -i "$@"
  else
    # macOS/BSD sed
    local file="${@: -1}"
    local exprs=("${@:1:$#-1}")
    sed -i '' "${exprs[@]}" "$file"
  fi
}

echo "🔧 Preenchendo placeholders nos wrangler.toml..."
echo ""

# Verificar variáveis obrigatórias para Gateway
if [ -z "${AUD_UBL:-}" ] || [ -z "${AUD_VVZ_ADMIN:-}" ]; then
    echo "⚠️  Variáveis obrigatórias não definidas!"
    echo ""
    echo "Para o Gateway (policy-worker), você precisa:"
    echo "  export AUD_UBL=\"<audience_da_app_UBL>\""
    echo "  export AUD_VVZ_ADMIN=\"<audience_da_app_Voulezvous_Admin>\""
    echo ""
    echo "💡 Dica: Execute 'bash scripts/discover-access.sh' para obter esses valores"
    echo "   JWKS já está fixo no wrangler.toml (não precisa mais)"
    echo ""
    exit 1
fi

# 1) Gateway multitenant (policy-worker/wrangler.toml)
echo "1️⃣  Atualizando policy-worker/wrangler.toml..."
sed_i "s|<AUD_UBL>|$AUD_UBL|g" policy-worker/wrangler.toml
sed_i "s|<AUD_VVZ_ADMIN>|$AUD_VVZ_ADMIN|g" policy-worker/wrangler.toml

# Validar Gateway
if grep -nE '<AUD_UBL>|<AUD_VVZ_ADMIN>' policy-worker/wrangler.toml >/dev/null 2>&1; then
    echo "   ❌ Ainda há placeholders em policy-worker/wrangler.toml"
    grep -nE '<AUD_UBL>|<AUD_VVZ_ADMIN>' policy-worker/wrangler.toml
    exit 1
else
    echo "   ✅ policy-worker/wrangler.toml ok (sem placeholders)"
    echo "   ✅ JWKS já está fixo (não precisa mais preencher)"
fi

# 2) Voulezvous Edge (policy-worker/wrangler.vvz.toml) - opcional
if [ -n "${VVZ_ZONE_ID:-}" ]; then
    echo ""
    echo "2️⃣  Atualizando policy-worker/wrangler.vvz.toml..."
    
    sed_i "s|<VVZ_ZONE_ID>|$VVZ_ZONE_ID|g" policy-worker/wrangler.vvz.toml
    sed_i "s|<AUD_UBL>|${AUD_UBL}|g" policy-worker/wrangler.vvz.toml
    sed_i "s|<AUD_VVZ>|${AUD_VVZ_ADMIN:-${AUD_VVZ}}|g" policy-worker/wrangler.vvz.toml
    
    # Validar Voulezvous Edge
    if grep -nE '<VVZ_ZONE_ID>|<AUD_UBL>|<AUD_VVZ>|<JWKS_TEAM>' policy-worker/wrangler.vvz.toml >/dev/null 2>&1; then
        echo "   ⚠️  Ainda há placeholders em policy-worker/wrangler.vvz.toml"
        grep -nE '<VVZ_ZONE_ID>|<AUD_UBL>|<AUD_VVZ>|<JWKS_TEAM>' policy-worker/wrangler.vvz.toml
    else
        echo "   ✅ policy-worker/wrangler.vvz.toml ok (sem placeholders)"
    fi
else
    echo ""
    echo "2️⃣  Voulezvous Edge: pulando (VVZ_ZONE_ID não definido)"
    echo "   💡 Para preencher depois:"
    echo "      bash scripts/discover-vvz-zone.sh"
    echo "      export VVZ_ZONE_ID=\"<id>\""
    echo "      bash scripts/fill-placeholders.sh"
fi

# 3) Media API (apps/media-api-worker/wrangler.toml) - opcional
if [ -n "${KV_MEDIA_ID:-}" ] || [ -n "${D1_MEDIA_ID:-}" ]; then
    echo ""
    echo "3️⃣  Atualizando apps/media-api-worker/wrangler.toml..."
    
    [ -n "${KV_MEDIA_ID:-}" ] && sed_i "s|<KV_MEDIA_ID>|$KV_MEDIA_ID|g" apps/media-api-worker/wrangler.toml
    [ -n "${D1_MEDIA_ID:-}" ] && sed_i "s|<D1_MEDIA_ID>|$D1_MEDIA_ID|g" apps/media-api-worker/wrangler.toml
    
    # Validar Media API
    if grep -nE '<KV_MEDIA_ID>|<D1_MEDIA_ID>' apps/media-api-worker/wrangler.toml >/dev/null 2>&1; then
        echo "   ⚠️  Ainda há placeholders em apps/media-api-worker/wrangler.toml"
        grep -nE '<KV_MEDIA_ID>|<D1_MEDIA_ID>' apps/media-api-worker/wrangler.toml
    else
        echo "   ✅ apps/media-api-worker/wrangler.toml ok (sem placeholders)"
    fi
else
    echo ""
    echo "3️⃣  Media API: pulando (KV_MEDIA_ID e D1_MEDIA_ID não definidos)"
    echo "   💡 Para preencher depois:"
    echo "      export KV_MEDIA_ID=\"<id>\""
    echo "      export D1_MEDIA_ID=\"<id>\""
    echo "      bash scripts/fill-placeholders.sh"
fi

echo ""
echo "✅✅✅ Placeholders preenchidos!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Deploy Gateway: wrangler deploy --name ubl-flagship-edge --config policy-worker/wrangler.toml"
if [ -n "${VVZ_ZONE_ID:-}" ]; then
    echo "   2. Deploy Voulezvous Edge: wrangler deploy --name vvz-edge --config policy-worker/wrangler.vvz.toml"
fi
if [ -n "${KV_MEDIA_ID:-}" ] && [ -n "${D1_MEDIA_ID:-}" ]; then
    echo "   3. Deploy Media: wrangler deploy --name ubl-media-api --config apps/media-api-worker/wrangler.toml"
fi
echo "   4. Smoke test: bash scripts/smoke_vvz.sh"
