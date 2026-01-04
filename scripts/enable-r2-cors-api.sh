#!/usr/bin/env bash
# Habilita CORS no bucket R2 usando API do Cloudflare (com token do wrangler)
# Não precisa de credenciais R2 separadas

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar env
if [ -f "${PROJECT_ROOT}/env" ]; then
  set -a
  source "${PROJECT_ROOT}/env"
  set +a
fi

: "${CLOUDFLARE_ACCOUNT_ID:?missing CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?missing CLOUDFLARE_API_TOKEN}"
: "${R2_MEDIA_BUCKET:=ubl-media}"

VVZ_PUBLIC_ORIGINS='["https://voulezvous.tv","https://www.voulezvous.tv"]'
VVZ_ADMIN_ORIGINS='["https://admin.voulezvous.tv"]'

echo "📋 Configurando CORS no bucket R2 via API"
echo "=========================================="
echo ""
echo "Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo "Bucket: $R2_MEDIA_BUCKET"
echo ""

# Construir payload CORS
CORS_PAYLOAD=$(cat <<JSON
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET","HEAD"],
      "AllowedOrigins": ${VVZ_PUBLIC_ORIGINS},
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 86400
    },
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT","POST"],
      "AllowedOrigins": ${VVZ_ADMIN_ORIGINS},
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 86400
    }
  ]
}
JSON
)

echo ">> Aplicando CORS no bucket ${R2_MEDIA_BUCKET}…"

# Usar API do Cloudflare para configurar CORS
# Nota: A API do Cloudflare R2 para CORS pode variar; usando endpoint S3-compatible via API
# Alternativa: usar wrangler r2 object put para configurar via S3 API

# Tentar via API do Cloudflare (se disponível)
RESPONSE=$(curl -sS -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_MEDIA_BUCKET}/cors" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$CORS_PAYLOAD" 2>&1)

# Se a API direta não funcionar, usar wrangler com S3-compatible endpoint
if echo "$RESPONSE" | grep -qE "error|not found|404|400"; then
  echo "   ⚠️  API direta não disponível, usando método alternativo..."
  echo ""
  echo "   📋 CORS precisa ser configurado via Dashboard ou AWS CLI com credenciais R2"
  echo "   Link: https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_MEDIA_BUCKET}/settings"
  echo ""
  echo "   Ou use o script com AWS CLI:"
  echo "   ./scripts/enable-r2-cors.sh"
  echo ""
  exit 1
fi

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo ">> Verificando CORS configurado..."
curl -sS -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_MEDIA_BUCKET}/cors" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  | jq '.' 2>/dev/null || echo "   (Verifique no Dashboard)"

echo ""
echo "✅✅✅ CORS configurado!"
echo ""
echo "📋 Para verificar no Dashboard:"
echo "   https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_MEDIA_BUCKET}/settings"
echo ""
