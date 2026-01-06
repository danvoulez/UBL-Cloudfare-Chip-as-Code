#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
echo "Health:"
curl -s "$BASE/healthz" | jq .
echo "Inventory:"
curl -s "$BASE/inventory" | jq .
echo "Whoami:"
curl -s "$BASE/whoami" | jq .