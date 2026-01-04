#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://api.ubl.agency}"
: "${TOKEN:?export TOKEN first}"

echo ">> PREPARE"
SESSION_ID=$(curl -fsS -X POST "$BASE_URL/stream/prepare" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"mode":"stage","latency":"ll-hls","title":"CLI Smoke","privacy":"public","record":false}' \
  | jq -r '.session_id')
echo "session_id=$SESSION_ID"

echo ">> GO LIVE"
curl -fsS -X POST "$BASE_URL/stream/go_live" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\"}" | jq .

echo ">> SNAPSHOT (optional)"
curl -fsS -X POST "$BASE_URL/stream/snapshot" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\"}" | jq . || true

echo ">> END"
curl -fsS -X POST "$BASE_URL/stream/end" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\"}" | jq .

echo "OK."
