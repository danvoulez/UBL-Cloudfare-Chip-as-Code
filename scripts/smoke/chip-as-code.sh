#!/usr/bin/env bash
set -euo pipefail

# Chip-as-Code Smoke Test (edge + proxy)
# Usage:
#   EDGE_HOST=https://api.ubl.agency \
#   PROXY_URL=http://127.0.0.1:9456 \
#   ADMIN_PATH=/admin/deploy \
#   bash smoke_chip_as_code.sh
#
# Defaults:
EDGE_HOST="${EDGE_HOST:-https://api.ubl.agency}"
PROXY_URL="${PROXY_URL:-http://127.0.0.1:9456}"
ADMIN_PATH="${ADMIN_PATH:-/admin/deploy}"
LEDGER_PATH="${LEDGER_PATH:-/var/log/ubl/nova-ledger.ndjson}"

echo "== Chip-as-Code Smoke Test =="
echo "EDGE_HOST = $EDGE_HOST"
echo "PROXY_URL = $PROXY_URL"
echo "ADMIN_PATH = $ADMIN_PATH"
echo

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing dependency: $1"; exit 2; }; }
need curl

pass() { echo -e "✅  $*"; }
fail() { echo -e "❌  $*"; exit 1; }

json_ok_true() {
  # crude check for {"ok":true}
  grep -q '"ok"[[:space:]]*:[[:space:]]*true' >/dev/null 2>&1
}

# 0) take ledger line count snapshot (if readable)
LEDGER_BEFORE=-1
if [ -r "$LEDGER_PATH" ]; then
  LEDGER_BEFORE=$(wc -l <"$LEDGER_PATH" || echo -1)
fi

# 1) Proxy: _reload (verifica assinatura + blake3 do YAML)
echo "-- [1] Proxy reload"
RELOAD=$(curl -sS "$PROXY_URL/_reload" || true)
if echo "$RELOAD" | json_ok_true; then
  pass "proxy reload OK ($RELOAD)"
else
  echo "$RELOAD"
  fail "proxy reload falhou — confira POLICY_PUBKEY_PEM_B64 e pack.json"
fi

# 2) Worker: /warmup (carrega chip no WASM e valida pack assinado)
echo "-- [2] Worker warmup"
WARM=$(curl -sS -w " HTTP.%{http_code}" "$EDGE_HOST/warmup" || true)
BODY="${WARM% HTTP.*}"
CODE="${WARM##* HTTP.}"
if [ "$CODE" = "200" ] && echo "$BODY" | json_ok_true; then
  BLAKE3=$(echo "$BODY" | sed -n 's/.*"blake3"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || echo "")
  if [ -n "$BLAKE3" ]; then
    pass "worker warmup OK (blake3=${BLAKE3:0:16}...)"
  else
    pass "worker warmup OK ($BODY)"
  fi
else
  echo "$BODY"
  echo "↪ Dica: garanta KV: policy_pack + policy_yaml e POLICY_PUBKEY_B64 no wrangler.toml"
  fail "worker warmup falhou (HTTP $CODE)"
fi

# 3) Proxy: exercitar decisão + gerar métricas e ledger (HEAD para evitar custo upstream)
echo "-- [3] Exercitar decisão no proxy (HEAD ${ADMIN_PATH})"
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X HEAD "$PROXY_URL${ADMIN_PATH}" || true)
# Mesmo que upstream 5xx, decisão foi avaliada e ledger/metrics devem marcar
echo "proxy respondeu HTTP $HTTP (ok para este teste)"

# 4) Métricas básicas
echo "-- [4] Métricas do proxy"
MET=$(curl -sS "$PROXY_URL/metrics" || true)
echo "$MET" | sed -n '1,20p' || true
echo "$MET" | grep -q "policy_eval_count" && pass "metrics expostas" || fail "sem métricas"

# 5) Ledger: verificar incremento de linha (se acessível)
if [ "$LEDGER_BEFORE" -ge 0 ] && [ -r "$LEDGER_PATH" ]; then
  LEDGER_AFTER=$(wc -l <"$LEDGER_PATH" || echo -1)
  if [ "$LEDGER_AFTER" -gt "$LEDGER_BEFORE" ]; then
    tail -n 1 "$LEDGER_PATH" || true
    pass "ledger NDJSON incrementou ($LEDGER_BEFORE -> $LEDGER_AFTER)"
  else
    echo "↪ ledger não incrementou (talvez sem permissão de leitura do arquivo ou proxy sem write)."
  fi
else
  echo "↪ sem acesso ao ledger em $LEDGER_PATH (ok)."
fi

pass "GO — Chip-as-Code operacional (proxy+edge)"
