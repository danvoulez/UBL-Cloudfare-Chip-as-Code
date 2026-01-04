#!/usr/bin/env bash
# Habilita CORS no bucket R2 usando API do Cloudflare (com token do wrangler)
# Gera credenciais R2 temporárias via API e usa AWS CLI para configurar CORS

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

echo "📋 Configurando CORS no bucket R2 (via API do Cloudflare)"
echo "=========================================================="
echo ""
echo "Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo "Bucket: $R2_MEDIA_BUCKET"
echo ""

# Verificar se AWS CLI está instalado
if ! command -v aws >/dev/null 2>&1; then
  echo "❌ AWS CLI não encontrado"
  echo ""
  echo "📋 Instale o AWS CLI:"
  echo "   macOS: brew install awscli"
  echo "   Linux: sudo apt-get install awscli"
  echo ""
  exit 1
fi

# Gerar credenciais R2 temporárias via API
echo ">> Gerando credenciais R2 temporárias..."
CREDS_RESPONSE=$(curl -sS -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/tokens" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"cors-setup-temp-$(date +%s)\",
    \"permissions\": {
      \"buckets\": [
        {
          \"name\": \"${R2_MEDIA_BUCKET}\",
          \"permissions\": [\"object_read_write\", \"bucket_config_read_write\"]
        }
      ]
    }
  }" 2>&1)

ACCESS_KEY=$(echo "$CREDS_RESPONSE" | jq -r '.result.access_key_id // empty' 2>/dev/null)
SECRET_KEY=$(echo "$CREDS_RESPONSE" | jq -r '.result.secret_access_key // empty' 2>/dev/null)
TOKEN_ID=$(echo "$CREDS_RESPONSE" | jq -r '.result.id // empty' 2>/dev/null)

if [[ -z "$ACCESS_KEY" || -z "$SECRET_KEY" ]]; then
  echo "   ❌ Falha ao gerar credenciais R2"
  echo "$CREDS_RESPONSE" | jq '.' 2>/dev/null || echo "$CREDS_RESPONSE"
  echo ""
  echo "   📋 Verifique:"
  echo "      • CLOUDFLARE_API_TOKEN está correto"
  echo "      • Token tem permissões de R2"
  echo "      • Bucket ${R2_MEDIA_BUCKET} existe"
  echo ""
  echo "   📋 Alternativa: Configure CORS manualmente no Dashboard"
  echo "   https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_MEDIA_BUCKET}/settings"
  exit 1
fi

echo "   ✅ Credenciais geradas (token ID: $TOKEN_ID)"
echo ""

# Configurar AWS CLI com credenciais temporárias
aws configure set profile.r2-temp.aws_access_key_id "$ACCESS_KEY"
aws configure set profile.r2-temp.aws_secret_access_key "$SECRET_KEY"
aws configure set profile.r2-temp.region "auto"

ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Construir payload CORS
CORS_JSON=$(cat <<JSON
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
aws --profile r2-temp --endpoint-url="$ENDPOINT" \
  s3api put-bucket-cors \
  --bucket "$R2_MEDIA_BUCKET" \
  --cors-configuration "$CORS_JSON"

if [ $? -eq 0 ]; then
  echo "   ✅ CORS configurado com sucesso"
else
  echo "   ❌ Falha ao configurar CORS"
  exit 1
fi

echo ""
echo ">> Verificando CORS..."
aws --profile r2-temp --endpoint-url="$ENDPOINT" \
  s3api get-bucket-cors \
  --bucket "$R2_MEDIA_BUCKET" \
  | jq '.' 2>/dev/null || echo "   (Verifique no Dashboard)"

# Limpar credenciais temporárias do AWS CLI
aws configure set profile.r2-temp.aws_access_key_id ""
aws configure set profile.r2-temp.aws_secret_access_key ""

# Opcional: deletar token R2 temporário (comentado para debug)
# echo ""
# echo ">> Removendo token R2 temporário..."
# curl -sS -X DELETE \
#   "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/tokens/${TOKEN_ID}" \
#   -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
#   | jq '.' 2>/dev/null || true

echo ""
echo "✅✅✅ CORS configurado!"
echo ""
echo "📋 Para verificar no Dashboard:"
echo "   https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_MEDIA_BUCKET}/settings"
echo ""
