#!/usr/bin/env bash
set -euo pipefail

VVZ_HOST="${VVZ_HOST:-voulezvous.tv}"
VVZ_ADMIN_HOST="${VVZ_ADMIN_HOST:-admin.voulezvous.tv}"

echo "== Smoke: publiço carrega =="
curl -sS -I "https://${VVZ_HOST}" | head -n 1

echo "== Smoke: policy status (se exposto) =="
set +e
curl -sS "https://${VVZ_HOST}/_policy/status" | jq . 2>/dev/null || echo "(ok se 404)"
set -e

echo "== Smoke: admin exige Access (espera 302/403) =="
set +e
code=$(curl -s -o /dev/null -w "%{http_code}" "https://${VVZ_ADMIN_HOST}")
echo "admin http_code=${code}"
if [[ "${code}" == "200" ]]; then
  echo "⚠️ admin respondeu 200 sem Access — verifique as políticas"
else
  echo "ok: admin protegido (code=${code})"
fi
set -e

echo "== Smoke: session exchange (stub) =="
set +e
resp=$(curl -s -X POST "https://${VVZ_HOST}/api/session/exchange"   -H "content-type: application/json"   --data '{"token":"stub-token"}')
rc=$?
echo "${resp}"
if [[ $rc -ne 0 ]]; then
  echo "⚠️ exchange falhou (provável por ainda não estar roteado ao Core)"
fi
set -e

echo "DONE."
