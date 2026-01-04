#!/usr/bin/env bash
# Setup completo para CORS R2 — carrega variáveis do env e executa

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar env
if [ -f "${PROJECT_ROOT}/env" ]; then
  set -a
  source "${PROJECT_ROOT}/env"
  set +a
fi

# Variáveis necessárias
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-1f43a14fe5bb62b97e7262c5b6b7c476}"
export R2_BUCKET="${R2_MEDIA_BUCKET:-ubl-media}"
export VVZ_PUBLIC_ORIGINS='["https://voulezvous.tv","https://www.voulezvous.tv"]'
export VVZ_ADMIN_ORIGINS='["https://admin.voulezvous.tv"]'
export MEDIA_API_BASE="${MEDIA_API_BASE:-https://api.ubl.agency}"

echo "📋 Configuração CORS R2"
echo "======================"
echo ""
echo "Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo "Bucket: $R2_BUCKET"
echo "Public Origins: $VVZ_PUBLIC_ORIGINS"
echo "Admin Origins: $VVZ_ADMIN_ORIGINS"
echo ""

# Tentar usar wrangler/API primeiro (não precisa de credenciais R2 separadas)
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "✅ Usando API do Cloudflare (token do wrangler)"
  echo ""
  echo "🚀 Habilitando CORS via API..."
  "${SCRIPT_DIR}/enable-r2-cors-wrangler.sh"
elif [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ]; then
  echo "✅ Usando credenciais R2 do env"
  echo ""
  echo "🚀 Habilitando CORS..."
  "${SCRIPT_DIR}/enable-r2-cors.sh"
else
  echo "⚠️  Nenhuma credencial encontrada"
  echo ""
  echo "📋 Opções:"
  echo ""
  echo "   1. Usar API do Cloudflare (recomendado - usa token do wrangler):"
  echo "      Certifique-se de que CLOUDFLARE_API_TOKEN está no env"
  echo "      ./scripts/enable-r2-cors-wrangler.sh"
  echo ""
  echo "   2. Usar credenciais R2 separadas:"
  echo "      a. Acesse: https://dash.cloudflare.com/$CLOUDFLARE_ACCOUNT_ID/r2/api-tokens"
  echo "      b. Crie um token com permissões de leitura/escrita no bucket $R2_BUCKET"
  echo "      c. Adicione ao arquivo env:"
  echo "         export R2_ACCESS_KEY_ID=\"seu_access_key_id\""
  echo "         export R2_SECRET_ACCESS_KEY=\"seu_secret_access_key\""
  echo "      d. Execute: ./scripts/enable-r2-cors.sh"
  echo ""
  exit 1
fi

echo ""
echo "✅✅✅ CORS configurado!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Verificar CORS:"
echo "      aws --profile r2 --endpoint-url=https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com s3api get-bucket-cors --bucket $R2_BUCKET | jq"
echo ""
echo "   2. Rodar smoke test:"
echo "      export MEDIA_API_BASE=$MEDIA_API_BASE"
echo "      ./scripts/smoke_files_r2.sh"
echo ""
