#!/usr/bin/env bash
# Smoke test completo: presign → upload → commit → link → download

set -euo pipefail

: "${MEDIA_API_BASE:?missing MEDIA_API_BASE}"

TMPDIR="$(mktemp -d)"
trap "rm -rf $TMPDIR" EXIT

TESTFILE="$TMPDIR/test-upload.bin"
dd if=/dev/urandom of="$TESTFILE" bs=1k count=64 >/dev/null 2>&1
BYTES=$(stat -f%z "$TESTFILE" 2>/dev/null || stat -c%s "$TESTFILE")
SHA256=$(shasum -a 256 "$TESTFILE" 2>/dev/null | awk '{print $1}')
MIME="application/octet-stream"

echo ">> 1) PRESIGN"
RESP_PRESIGN="$TMPDIR/presign.json"
curl -sS -X POST "${MEDIA_API_BASE}/internal/media/presign" \
  -H 'content-type: application/json' \
  -d "{\"mime\":\"${MIME}\",\"bytes\":${BYTES}}" | tee "$RESP_PRESIGN" >/dev/null

UPLOAD_URL=$(jq -r '.upload_url // .url // .put_url' "$RESP_PRESIGN")
MEDIA_ID=$(jq -r '.id // .media_id // .key' "$RESP_PRESIGN")
CT=$(jq -r '.content_type // "application/octet-stream"' "$RESP_PRESIGN")

if [[ -z "$UPLOAD_URL" || "$UPLOAD_URL" == "null" ]]; then
  echo "ERRO: presign não retornou URL de upload"
  cat "$RESP_PRESIGN"
  exit 1
fi
echo "   - media_id: $MEDIA_ID"
echo "   - upload_url: $UPLOAD_URL"

echo ">> 2) UPLOAD (PUT presigned)"
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X PUT "$UPLOAD_URL" \
  -H "content-type: ${CT}" --data-binary @"$TESTFILE")
if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "204" ]]; then
  echo "ERRO: upload falhou (HTTP $HTTP_CODE)"
  exit 1
fi
echo "   - upload OK (HTTP $HTTP_CODE)"

echo ">> 3) COMMIT (verificação sha256 no D1/KV)"
RESP_COMMIT="$TMPDIR/commit.json"
curl -sS -X POST "${MEDIA_API_BASE}/internal/media/commit" \
  -H 'content-type: application/json' \
  -d "{\"id\":\"${MEDIA_ID}\",\"sha256\":\"${SHA256}\",\"bytes\":${BYTES},\"mime\":\"${MIME}\"}" \
  | tee "$RESP_COMMIT" >/dev/null
OK=$(jq -r '.ok' "$RESP_COMMIT")
[[ "$OK" == "true" ]] || { echo "ERRO: commit falhou"; cat "$RESP_COMMIT"; exit 1; }
echo "   - commit OK"

echo ">> 4) LINK (signed GET)"
RESP_LINK="$TMPDIR/link.json"
curl -sS "${MEDIA_API_BASE}/internal/media/link/${MEDIA_ID}" \
  | tee "$RESP_LINK" >/dev/null
GET_URL=$(jq -r '.url // .get_url' "$RESP_LINK")
[[ -n "$GET_URL" && "$GET_URL" != "null" ]] || { echo "ERRO: link não retornou URL"; exit 1; }

echo ">> 5) DOWNLOAD e validação"
DLFILE="$TMPDIR/download.bin"
curl -sS "$GET_URL" -o "$DLFILE"
SHA256_DL=$(shasum -a 256 "$DLFILE" 2>/dev/null | awk '{print $1}')

if [[ "$SHA256" != "$SHA256_DL" ]]; then
  echo "ERRO: SHA256 divergente (orig=$SHA256 dl=$SHA256_DL)"
  exit 1
fi

echo "✅ Smoke Files/R2 OK"
echo "   media_id: $MEDIA_ID"
echo "   sha256:   $SHA256"
echo "   bytes:    $BYTES"
