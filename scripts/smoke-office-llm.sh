#!/usr/bin/env bash
# Office-LLM — Smoke Test
set -euo pipefail

LLM="${LLM:-https://office-llm.ubl.agency}"
AUTH="${AUTH:-https://id.ubl.agency}"

echo "== Office-LLM — Smoke Test =="
echo ""

# 1) Health
echo ">> 1) Health check..."
curl -s "$LLM/healthz" | jq '.'
echo ""

# 2) Policy
echo ">> 2) Policy..."
curl -s "$LLM/policy" | jq '.'
echo ""

# 3) Generate (default - prefer premium)
echo ">> 3) Generate (default policy)..."
curl -s -X POST "$LLM/llm/generate" \
  -H "content-type: application/json" \
  -H "X-Content-Policy: default" \
  -d '{
    "messages": [{"role": "user", "content": "Diga oi em 5 palavras."}],
    "max_tokens": 64
  }' | jq '.'
echo ""

# 4) Generate (adult - somente LAB)
echo ">> 4) Generate (adult policy)..."
curl -s -X POST "$LLM/llm/generate" \
  -H "content-type: application/json" \
  -H "X-Content-Policy: adult" \
  -d '{
    "messages": [{"role": "user", "content": "Diga oi em 5 palavras."}],
    "max_tokens": 64
  }' | jq '.'
echo ""

# 5) Generate com token (se tiver)
if [ -n "${ACCESS_TOKEN:-}" ]; then
  echo ">> 5) Generate com Authorization Bearer..."
  curl -s -X POST "$LLM/llm/generate" \
    -H "content-type: application/json" \
    -H "X-Content-Policy: default" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
      "messages": [{"role": "user", "content": "Teste com token."}],
      "max_tokens": 32
    }' | jq '.'
  echo ""
fi

echo "== OK =="
