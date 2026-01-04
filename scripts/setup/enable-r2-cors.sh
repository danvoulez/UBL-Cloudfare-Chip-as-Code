#!/usr/bin/env bash
# Habilita CORS no bucket R2 ubl-media
# Permite GET/HEAD para origens públicas e PUT/POST para admin

set -euo pipefail

: "${CLOUDFLARE_ACCOUNT_ID:?missing CLOUDFLARE_ACCOUNT_ID}"
: "${R2_BUCKET:?missing R2_BUCKET}"
: "${R2_ACCESS_KEY_ID:?missing R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?missing R2_SECRET_ACCESS_KEY}"
: "${VVZ_PUBLIC_ORIGINS:?missing VVZ_PUBLIC_ORIGINS}"
: "${VVZ_ADMIN_ORIGINS:?missing VVZ_ADMIN_ORIGINS}"

# Configura perfil 'r2' no AWS CLI (S3 compatível)
aws configure set profile.r2.aws_access_key_id     "$R2_ACCESS_KEY_ID"
aws configure set profile.r2.aws_secret_access_key "$R2_SECRET_ACCESS_KEY"
aws configure set profile.r2.region "auto"

ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Regra 1: GET/HEAD das páginas públicas
# Regra 2: PUT/POST (uploads diretos) vindo do admin
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

echo ">> Aplicando CORS no bucket ${R2_BUCKET}…"
aws --profile r2 --endpoint-url="$ENDPOINT" \
  s3api put-bucket-cors \
  --bucket "$R2_BUCKET" \
  --cors-configuration "$CORS_JSON"

echo ">> OK. Para verificar:"
echo "aws --profile r2 --endpoint-url=$ENDPOINT s3api get-bucket-cors --bucket $R2_BUCKET | jq"
