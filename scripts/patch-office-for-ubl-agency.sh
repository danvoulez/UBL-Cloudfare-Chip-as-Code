#!/usr/bin/env bash
set -euo pipefail

# Patches env and workers to standardize identity under ubl.agency
# and advertises the LLM gateway "office-llm.ubl.agency".
: "${PROJECT_ROOT:=$(pwd)}"
: "${UBL_DOMAIN:=ubl.agency}"
: "${COOKIE_DOMAIN:=.ubl.agency}"
: "${ID_BASE:=https://id.$UBL_DOMAIN}"
: "${JWKS_URL:=$ID_BASE/.well-known/jwks.json}"
: "${LLM_GATEWAY_BASE:=https://office-llm.$UBL_DOMAIN}"

ENV_FILE="$PROJECT_ROOT/env"

echo "🔧 Patching env at: $ENV_FILE"
{
  echo ""
  echo "# ===== UBL Identity (standardized) ====="
  echo "ISSUER_BASE=$ID_BASE"
  echo "TOKEN_ISS=$ID_BASE"
  echo "JWKS_URL=$JWKS_URL"
  echo "COOKIE_DOMAIN=$COOKIE_DOMAIN"
  echo "RP_ID=$UBL_DOMAIN"
  echo ""
  echo "# ===== LLM Gateway ====="
  echo "LLM_GATEWAY_BASE=$LLM_GATEWAY_BASE"
} >> "$ENV_FILE"

echo "🔧 Updating known Worker wrangler.toml files with JWKS and cookie domain (if present)..."
while IFS= read -r f; do
  echo "  • $f"
  grep -q '\[vars\]' "$f" || echo "[vars]" >> "$f"
  grep -q 'JWKS_URL' "$f" && sed -i'' -e "s|^JWKS_URL.*|JWKS_URL = \"$JWKS_URL\"|g" "$f" || echo "JWKS_URL = \"$JWKS_URL\"" >> "$f"
  grep -q 'COOKIE_DOMAIN' "$f" && sed -i'' -e "s|^COOKIE_DOMAIN.*|COOKIE_DOMAIN = \"$COOKIE_DOMAIN\"|g" "$f" || echo "COOKIE_DOMAIN = \"$COOKIE_DOMAIN\"" >> "$f"
done < <(find "$PROJECT_ROOT" -name wrangler.toml \( -path "*/workers/*/wrangler.toml" -o -path "*/worker/*/wrangler.toml" \) -print)

echo "✅ Patch complete."
echo "   • Issuer:     $ID_BASE"
echo "   • JWKS:       $JWKS_URL"
echo "   • Cookie:     $COOKIE_DOMAIN"
echo "   • LLM GW:     $LLM_GATEWAY_BASE"
