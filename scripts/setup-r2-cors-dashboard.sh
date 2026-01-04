#!/usr/bin/env bash
# Instruções para configurar CORS via Dashboard (não precisa de credenciais)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar env
if [ -f "${PROJECT_ROOT}/env" ]; then
  set -a
  source "${PROJECT_ROOT}/env"
  set +a
fi

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-1f43a14fe5bb62b97e7262c5b6b7c476}"
BUCKET="${R2_MEDIA_BUCKET:-ubl-media}"

echo "📋 Configurar CORS via Dashboard"
echo "================================="
echo ""
echo "🔗 Link direto:"
echo "   https://dash.cloudflare.com/${ACCOUNT_ID}/r2/buckets/${BUCKET}/settings"
echo ""
echo "📋 Passos:"
echo "   1. Acesse o link acima"
echo "   2. Role até a seção 'CORS'"
echo "   3. Clique em 'Add CORS rule'"
echo ""
echo "📋 Regra 1 (GET/HEAD público):"
echo "   • Allowed Origins:"
echo "     - https://voulezvous.tv"
echo "     - https://www.voulezvous.tv"
echo "   • Allowed Methods: GET, HEAD"
echo "   • Allowed Headers: *"
echo "   • Exposed Headers: ETag"
echo "   • Max Age: 86400"
echo ""
echo "📋 Regra 2 (PUT/POST admin):"
echo "   • Allowed Origins:"
echo "     - https://admin.voulezvous.tv"
echo "   • Allowed Methods: PUT, POST"
echo "   • Allowed Headers: *"
echo "   • Exposed Headers: ETag"
echo "   • Max Age: 86400"
echo ""
echo "✅ Após configurar, execute o smoke test:"
echo "   export MEDIA_API_BASE=\"https://api.ubl.agency\""
echo "   ./scripts/smoke_files_r2.sh"
echo ""
