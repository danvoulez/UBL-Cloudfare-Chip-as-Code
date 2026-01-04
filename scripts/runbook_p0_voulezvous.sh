#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------
# Voulezvous P0 Deploy & Smoke (DNS/RTC/Core/Tunnel/Gateway)
# Usage:
#   export CF_API_TOKEN=...           # Cloudflare API token (Zone:Edit DNS, Account:Cloudflare Tunnel)
#   export UBL_ZONE=ubl.agency        # optional (default: ubl.agency)
#   export VVZ_ZONE=voulezvous.tv     # optional (default: voulezvous.tv)
#   export CF_ACCOUNT_ID=1f43a14fe5bb62b97e7262c5b6b7c476  # from env
#   ./runbook_p0_voulezvous.sh
# ---------------------------------------------------------------------

# Load env if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -f "${PROJECT_ROOT}/env" ]; then
  set -a
  source "${PROJECT_ROOT}/env"
  set +a
fi

UBL_ZONE="${UBL_ZONE:-ubl.agency}"
VVZ_ZONE="${VVZ_ZONE:-voulezvous.tv}"
CF_API="https://api.cloudflare.com/client/v4"
CF_BEARER="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-}}"
NEEDS_WRANGLER="${NEEDS_WRANGLER:-1}"  # set to 0 to skip wrangler deploy step
VVZ_CORE_PORT="${VVZ_CORE_PORT:-8787}"

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ missing dependency: $1"
    exit 1
  fi
}

echo "🔎 Checking deps..."
require curl
require jq
require cloudflared
if [ "${NEEDS_WRANGLER}" = "1" ]; then require wrangler; fi
echo "✅ Deps OK"

if [ -z "$CF_BEARER" ]; then
  echo "❌ CF_API_TOKEN not set"; exit 1
fi

if [ -z "$CF_ACCOUNT_ID" ]; then
  echo "❌ CF_ACCOUNT_ID not set"; exit 1
fi

api() {
  local method="$1"; shift
  local path="$1"; shift
  curl -sS -X "$method" \
    -H "Authorization: Bearer $CF_BEARER" \
    -H "Content-Type: application/json" \
    "${CF_API}${path}" "$@"
}

get_zone_id() {
  local zone="$1"
  api GET "/zones?name=${zone}" | jq -r '.result[0].id // empty'
}

ensure_rtc_dns() {
  local zone="$1"
  local zone_id="$2"
  echo "🌐 Ensuring DNS for rtc.${zone} ..."
  # Check existing
  local id
  id=$(api GET "/zones/${zone_id}/dns_records?name=rtc.${zone}" | jq -r '.result[0].id // empty')
  if [ -n "$id" ]; then
    echo "✅ DNS record exists: rtc.${zone}"
  else
    # Proxied A record to reserved IP
    api POST "/zones/${zone_id}/dns_records" \
      --data "{\"type\":\"A\",\"name\":\"rtc.${zone}\",\"content\":\"192.0.2.1\",\"proxied\":true}" >/dev/null
    echo "✅ Created DNS: rtc.${zone} → 192.0.2.1 (proxied)"
  fi
}

wait_http_ok() {
  local url="$1"
  local name="$2"
  local tries=60
  local sleep_s=2
  echo "⏳ Waiting for ${name} @ ${url}"
  for i in $(seq 1 $tries); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)
    if [ "$code" = "200" ]; then
      echo "✅ ${name} OK (200)"
      return 0
    fi
    sleep "$sleep_s"
  done
  echo "❌ ${name} not ready"; return 1
}

# ---------------------------------------------------------------------
# 1) Resolve Zone IDs
# ---------------------------------------------------------------------
echo "🔐 Resolving zone IDs..."
UBL_ZONE_ID="$(get_zone_id "$UBL_ZONE")"
VVZ_ZONE_ID="$(get_zone_id "$VVZ_ZONE")"
if [ -z "$UBL_ZONE_ID" ] || [ -z "$VVZ_ZONE_ID" ]; then
  echo "❌ Could not resolve zone ids. Check token scopes and zone names."
  exit 1
fi
echo "• ${UBL_ZONE}  → ${UBL_ZONE_ID}"
echo "• ${VVZ_ZONE} → ${VVZ_ZONE_ID}"

# ---------------------------------------------------------------------
# 2) DNS for rtc.voulezvous.tv
# ---------------------------------------------------------------------
ensure_rtc_dns "$VVZ_ZONE" "$VVZ_ZONE_ID"

# ---------------------------------------------------------------------
# 3) Cloudflare Tunnel for core.voulezvous.tv
# ---------------------------------------------------------------------
echo "🛣️  Ensuring Tunnel vvz-core → core.${VVZ_ZONE} ..."

# Check if authenticated (try to list tunnels, suppress errors)
TUNNEL_LIST_OUTPUT=$(cloudflared tunnel list 2>&1) || TUNNEL_LIST_OUTPUT=""
if echo "$TUNNEL_LIST_OUTPUT" | grep -q "origin cert\|origincert\|login"; then
  echo "🔐 Cloudflared not authenticated. Please login first:"
  echo "   cloudflared tunnel login"
  echo ""
  echo "⚠️  Skipping tunnel setup. You can run this step manually:"
  echo "   cloudflared tunnel create vvz-core"
  echo "   cloudflared tunnel route dns vvz-core core.${VVZ_ZONE}"
  echo ""
  echo "Continuing with other steps..."
  TUNNEL_READY=false
else
  TUNNEL_READY=true
  # Ensure tunnel exists (creates if missing)
  if ! echo "$TUNNEL_LIST_OUTPUT" | grep -q "vvz-core"; then
    echo "📦 Creating tunnel vvz-core..."
    cloudflared tunnel create vvz-core 2>&1 || {
      echo "⚠️  Tunnel creation failed. Continuing anyway..."
      TUNNEL_READY=false
    }
  fi
  
  if [ "$TUNNEL_READY" = "true" ]; then
    # Route DNS to tunnel
    echo "🌐 Routing DNS core.${VVZ_ZONE} to tunnel..."
    cloudflared tunnel route dns vvz-core "core.${VVZ_ZONE}" 2>&1 || {
      echo "⚠️  DNS routing failed (may already exist). Continuing..."
    }
  fi
fi

# Print a sample config if missing and tunnel is ready
CFG="${HOME}/.cloudflared/config.yml"
if [ "$TUNNEL_READY" = "true" ] && [ ! -f "$CFG" ]; then
  TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | awk '/vvz-core/{print $1}' | head -n1)
  mkdir -p "$(dirname "$CFG")"
  with_creds=""
  if [ -n "$TUNNEL_ID" ]; then
    CREDS_FILE="${HOME}/.cloudflared/${TUNNEL_ID}.json"
    if [ -f "$CREDS_FILE" ]; then
      with_creds="credentials-file: ${CREDS_FILE}"
    fi
  fi
  cat >"$CFG" <<YAML
tunnel: vvz-core
${with_creds}
ingress:
  - hostname: core.${VVZ_ZONE}
    service: http://localhost:${VVZ_CORE_PORT}
  - service: http_status:404
YAML
  echo "📝 Wrote ${CFG} (adjust if needed)."
fi

# ---------------------------------------------------------------------
# 4) Start vvz-core locally (if binary exists)
# ---------------------------------------------------------------------
cd "$PROJECT_ROOT"
if [ -x "./target/release/vvz-core" ]; then
  echo "🚀 Starting vvz-core on :${VVZ_CORE_PORT} (background)"
  (PORT="${VVZ_CORE_PORT}" RUST_LOG=info ./target/release/vvz-core >/tmp/vvz-core.log 2>&1 & echo $! > /tmp/vvz-core.pid)
  sleep 1
else
  echo "ℹ️ vvz-core binary not found. Build & run manually in another shell:"
  echo "   cd $PROJECT_ROOT"
  echo "   cargo build --release --bin vvz-core"
  echo "   PORT=${VVZ_CORE_PORT} RUST_LOG=info ./target/release/vvz-core"
fi

# ---------------------------------------------------------------------
# 5) Run the Tunnel in background
# ---------------------------------------------------------------------
if [ "$TUNNEL_READY" = "true" ] && [ -f "$CFG" ]; then
  echo "🚇 Starting cloudflared tunnel (background)"
  (nohup cloudflared tunnel --config "$CFG" run vvz-core >/tmp/cloudflared.log 2>&1 & echo $! > /tmp/cloudflared.pid)
  sleep 2
else
  echo "⚠️  Tunnel not ready or config not found. Skipping tunnel start."
  echo "   To setup tunnel manually:"
  echo "   1. cloudflared tunnel login"
  echo "   2. cloudflared tunnel create vvz-core"
  echo "   3. cloudflared tunnel route dns vvz-core core.${VVZ_ZONE}"
  echo "   4. Create ~/.cloudflared/config.yml (see script output above)"
fi

# ---------------------------------------------------------------------
# 6) (Optional) Re-deploy Gateway
# ---------------------------------------------------------------------
if [ "${NEEDS_WRANGLER}" = "1" ]; then
  if [ -f "${PROJECT_ROOT}/policy-worker/wrangler.toml" ]; then
    echo "📦 Deploying Gateway (policy-worker)"
    (cd "${PROJECT_ROOT}/policy-worker" && wrangler deploy)
  else
    echo "ℹ️ policy-worker/wrangler.toml not found, skipping deploy"
  fi
fi

# ---------------------------------------------------------------------
# 7) Smoke checks
# ---------------------------------------------------------------------
wait_http_ok "https://rtc.${VVZ_ZONE}/healthz" "RTC /healthz"
wait_http_ok "https://core.${VVZ_ZONE}/healthz" "Core /healthz"
wait_http_ok "https://voulezvous.tv/_policy/status" "Gateway _policy/status"

# Core metrics (non-fatal)
curl -s "https://core.${VVZ_ZONE}/metrics" | head -n 5 || true

echo "✅ All P0 checks passed."
echo "🔎 Logs:"
echo "  tail -f /tmp/vvz-core.log"
echo "  tail -f /tmp/cloudflared.log"
