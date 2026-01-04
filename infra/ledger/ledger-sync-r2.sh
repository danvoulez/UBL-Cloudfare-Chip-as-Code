#!/bin/bash
# Sync ledger NDJSON to R2 (S3-compatible)
# Usage: ledger-sync-r2.sh [--force]

set -e

LEDGER_PATH="${LEDGER_PATH:-/var/log/ubl/flagship-ledger.ndjson}"
R2_ENV="${R2_ENV:-/etc/ubl/flagship/r2.env}"

# Carregar credenciais
if [ ! -f "$R2_ENV" ]; then
    echo "❌ R2 credentials not found: $R2_ENV" >&2
    exit 1
fi

source "$R2_ENV"

if [ -z "$R2_ACCOUNT_ID" ] || [ -z "$R2_BUCKET" ] || [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ]; then
    echo "❌ Missing R2 credentials in $R2_ENV" >&2
    exit 1
fi

# Verificar se ledger existe
if [ ! -f "$LEDGER_PATH" ]; then
    echo "⚠️  Ledger not found: $LEDGER_PATH" >&2
    exit 0
fi

# Verificar se há conteúdo novo (últimas 24h)
if [ "$1" != "--force" ]; then
    if [ -z "$(find "$LEDGER_PATH" -mtime -1 2>/dev/null)" ]; then
        echo "ℹ️  No new entries in last 24h, skipping sync"
        exit 0
    fi
fi

# Nome do arquivo no R2 (data + hash)
DATE=$(date +%Y%m%d)
HASH=$(sha256sum "$LEDGER_PATH" | cut -d' ' -f1 | head -c 16)
R2_KEY="ledger/${DATE}/flagship-ledger-${DATE}-${HASH}.ndjson.gz"

# Comprimir
TMP_GZ=$(mktemp)
gzip -c "$LEDGER_PATH" > "$TMP_GZ"

# Upload para R2 (usando AWS CLI ou curl)
if command -v aws &> /dev/null; then
    # AWS CLI
    export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
    AWS_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    
    aws s3 cp "$TMP_GZ" "s3://${R2_BUCKET}/${R2_KEY}" \
        --endpoint-url="$AWS_ENDPOINT" \
        --content-type "application/gzip" \
        --metadata "ledger-date=${DATE},source=flagship-policy-proxy"
    
    echo "✅ Uploaded to R2: s3://${R2_BUCKET}/${R2_KEY}"
else
    # Fallback: curl (requer assinatura S3 manual)
    echo "⚠️  AWS CLI not found, using curl (requires S3 signature)"
    echo "   Install: apt-get install awscli (or brew install awscli)"
    exit 1
fi

rm -f "$TMP_GZ"

echo "✅ Ledger synced to R2: ${R2_KEY}"
