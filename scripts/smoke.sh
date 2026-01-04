#!/usr/bin/env bash
set -euo pipefail

TENANT_VVZ="voulezvous"
ORIGIN_VVZ="https://voulezvous.tv"
API="https://api.ubl.agency"

echo "== Smoke 1/6: _policy/status (voulezvous) =="
curl -sS "${API}/_policy/status" \
  -H "X-Tenant: ${TENANT_VVZ}" \
  -H "Origin: ${ORIGIN_VVZ}" | jq .

echo "== Smoke 2/6: /warmup (voulezvous) =="
curl -sS "${API}/warmup" \
  -H "X-Tenant: ${TENANT_VVZ}" \
  -H "Origin: ${ORIGIN_VVZ}" | jq .

echo "== Smoke 3/6: CORS preflight (voulezvous) =="
curl -sS -i -X OPTIONS "${API}/_policy/status" \
  -H "Origin: ${ORIGIN_VVZ}" \
  -H "Access-Control-Request-Method: GET" | sed -n '1,20p'

echo "== Smoke 4/6: Core /healthz (se exposto) =="
set +e
curl -sS "${API}/core/healthz" -H "X-Tenant: ${TENANT_VVZ}" | jq .
set -e

echo "== Smoke 5/6: Media presign (se media-api ativo) =="
set +e
curl -sS -X POST "${API}/internal/media/presign" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT_VVZ}" \
  -d '{ "room_id":"room-smoke-1", "mime":"image/png", "bytes": 1234 }' | jq .
set -e

echo "== Smoke 6/6: Browser snippet (manual) =="
cat <<'JS'
// No console do navegador em https://voulezvous.tv (logado via Access):
fetch("https://api.ubl.agency/_policy/status", {
  headers: { "X-Tenant": "voulezvous" },
  credentials: "include"
}).then(r=>r.json()).then(console.log)
JS
echo "== DONE =="
