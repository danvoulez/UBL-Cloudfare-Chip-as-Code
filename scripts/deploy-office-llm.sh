#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../workers/office-llm"

echo "== office-llm :: deploy =="
npm i
# Secrets (optional). Comment out if you won't use premium providers.
# wrangler secret put OPENAI_API_KEY
# wrangler secret put ANTHROPIC_API_KEY

wrangler deploy
echo "Deployed. Try: curl -s $(wrangler deployments list --name office-llm 2>/dev/null | awk '{print $NF}' | tail -1)/healthz"
