#!/usr/bin/env bash
# Remove CORS do bucket R2 ubl-media

set -euo pipefail

: "${CLOUDFLARE_ACCOUNT_ID:?missing CLOUDFLARE_ACCOUNT_ID}"
: "${R2_BUCKET:?missing R2_BUCKET}"
: "${R2_ACCESS_KEY_ID:?missing R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?missing R2_SECRET_ACCESS_KEY}"

aws configure set profile.r2.aws_access_key_id     "$R2_ACCESS_KEY_ID"
aws configure set profile.r2.aws_secret_access_key "$R2_SECRET_ACCESS_KEY"
aws configure set profile.r2.region "auto"

ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo ">> Removendo CORS do bucket ${R2_BUCKET}…"
aws --profile r2 --endpoint-url="$ENDPOINT" \
  s3api delete-bucket-cors \
  --bucket "$R2_BUCKET"

echo ">> OK. Verifique (deve retornar erro NoSuchCORSConfiguration):"
echo "aws --profile r2 --endpoint-url=$ENDPOINT s3api get-bucket-cors --bucket $R2_BUCKET"
