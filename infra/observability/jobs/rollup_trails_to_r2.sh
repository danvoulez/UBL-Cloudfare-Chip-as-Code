#!/bin/bash
# Rollup trails (JSON✯Atomic) to R2/MinIO
# Blueprint 09 — Observabilidade & Auditoria
# Usage: ./rollup_trails_to_r2.sh [date] (default: yesterday)

set -euo pipefail

DATE="${1:-$(date -u -d 'yesterday' +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d 2>/dev/null || date -u -d '1 day ago' +%Y-%m-%d)}"
YEAR="${DATE%%-*}"
MONTH="${DATE%-*}"
MONTH="${MONTH#*-}"

# Config (from env or defaults)
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_BUCKET="${R2_BUCKET:-ubl-audit}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
TRAILS_SOURCE="${TRAILS_SOURCE:-/var/log/ubl/trails}"
R2_ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"

if [[ -z "$R2_ACCOUNT_ID" || -z "$R2_ACCESS_KEY_ID" || -z "$R2_SECRET_ACCESS_KEY" ]]; then
    echo "ERROR: R2 credentials not set (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)" >&2
    exit 1
fi

# Create temp dir
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Collect trails from source
echo "Collecting trails for ${DATE}..."
find "${TRAILS_SOURCE}" -name "*.ndjson" -type f -newermt "${DATE} 00:00:00" ! -newermt "${DATE} 23:59:59" -exec cat {} \; > "${TMPDIR}/trails_${DATE}.ndjson" || true

if [[ ! -s "${TMPDIR}/trails_${DATE}.ndjson" ]]; then
    echo "No trails found for ${DATE}"
    exit 0
fi

# Compute checksum
CHECKSUM=$(sha256sum "${TMPDIR}/trails_${DATE}.ndjson" | cut -d' ' -f1)

# Upload to R2 (S3-compatible)
R2_KEY="audit/${YEAR}/${MONTH}/trails_${DATE}.ndjson"

echo "Uploading to r2://${R2_BUCKET}/${R2_KEY}..."

# Use awscli or rclone (prefer awscli if available)
if command -v aws &> /dev/null; then
    AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
    aws s3 cp "${TMPDIR}/trails_${DATE}.ndjson" \
        "s3://${R2_BUCKET}/${R2_KEY}" \
        --endpoint-url "${R2_ENDPOINT}" \
        --metadata "checksum=${CHECKSUM},date=${DATE}"
elif command -v rclone &> /dev/null; then
    rclone copy "${TMPDIR}/trails_${DATE}.ndjson" \
        "r2:${R2_BUCKET}/${R2_KEY}" \
        --s3-access-key-id "${R2_ACCESS_KEY_ID}" \
        --s3-secret-access-key "${R2_SECRET_ACCESS_KEY}" \
        --s3-endpoint "${R2_ENDPOINT}"
else
    echo "ERROR: aws or rclone required" >&2
    exit 1
fi

# Write manifest
MANIFEST="${TMPDIR}/manifest_${DATE}.json"
cat > "${MANIFEST}" <<EOF
{
  "date": "${DATE}",
  "checksum": "${CHECKSUM}",
  "key": "${R2_KEY}",
  "size": $(stat -f%z "${TMPDIR}/trails_${DATE}.ndjson" 2>/dev/null || stat -c%s "${TMPDIR}/trails_${DATE}.ndjson" 2>/dev/null || echo 0),
  "uploaded_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Upload manifest
MANIFEST_KEY="audit/${YEAR}/${MONTH}/manifest_${DATE}.json"
if command -v aws &> /dev/null; then
    AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
    aws s3 cp "${MANIFEST}" \
        "s3://${R2_BUCKET}/${MANIFEST_KEY}" \
        --endpoint-url "${R2_ENDPOINT}"
else
    rclone copy "${MANIFEST}" \
        "r2:${R2_BUCKET}/${MANIFEST_KEY}" \
        --s3-access-key-id "${R2_ACCESS_KEY_ID}" \
        --s3-secret-access-key "${R2_SECRET_ACCESS_KEY}" \
        --s3-endpoint "${R2_ENDPOINT}"
fi

echo "✅ Rollup complete: ${R2_KEY} (checksum: ${CHECKSUM})"
