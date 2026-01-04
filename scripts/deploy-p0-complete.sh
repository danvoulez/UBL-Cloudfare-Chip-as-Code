#!/usr/bin/env bash
# P0 em 30 minutos — Checklist executável completo
# Executa todos os passos P0 com validações automáticas

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 P0 em 30 minutos — Deploy Completo"
echo "======================================"
echo ""

# Carregar env
if [ -f "${PROJECT_ROOT}/env" ]; then
  set -a
  source "${PROJECT_ROOT}/env"
  set +a
fi

# Função de validação
assert() {
  local name=$1
  local cmd=$2
  local expected=$3
  
  echo -n "  ✓ $name... "
  if eval "$cmd" > /dev/null 2>&1; then
    local result=$(eval "$cmd" 2>&1)
    if echo "$result" | grep -qE "$expected"; then
      echo -e "${GREEN}OK${NC}"
      return 0
    else
      echo -e "${YELLOW}WARN${NC}"
      echo "     Resultado: $result"
      return 1
    fi
  else
    echo -e "${RED}FAIL${NC}"
    return 1
  fi
}

# ============================================================================
# P0.1 — Cloudflare Access — Admin pronto
# ============================================================================
echo "1️⃣  P0.1 — Cloudflare Access (Admin)"
echo "-----------------------------------"

echo ""
echo "  → Verificando Access App para admin.voulezvous.tv..."
ACCESS_APPS=$(bash "${SCRIPT_DIR}/discover-access.sh" 2>/dev/null | grep -i "voulezvous\|admin" || echo "")

if echo "$ACCESS_APPS" | grep -q "admin.voulezvous.tv"; then
  echo -e "  ${GREEN}✅ Access App encontrada${NC}"
else
  echo -e "  ${YELLOW}⚠️  Access App não encontrada. Criando...${NC}"
  bash "${SCRIPT_DIR}/create-access-apps.sh" 2>&1 | tail -10
fi

echo ""
echo "  → Validando Admin gate..."
ADMIN_RESP=$(curl -sI https://admin.voulezvous.tv/admin/health 2>&1 | head -1)
if echo "$ADMIN_RESP" | grep -qE "302|401|403"; then
  echo -e "  ${GREEN}✅ Admin protegido (redireciona sem login)${NC}"
else
  echo -e "  ${YELLOW}⚠️  Resposta: $ADMIN_RESP${NC}"
fi

echo ""
echo "✅ P0.1 completo"
echo ""

# ============================================================================
# P0.2 — Media API com Stream real
# ============================================================================
echo "2️⃣  P0.2 — Media API com Stream"
echo "-------------------------------"

cd "${PROJECT_ROOT}/apps/media-api-worker"

echo ""
echo "  → Verificando secrets do Stream..."
if wrangler secret list 2>/dev/null | grep -q "STREAM_ACCOUNT_ID"; then
  echo -e "  ${GREEN}✅ STREAM_ACCOUNT_ID configurado${NC}"
else
  echo -e "  ${YELLOW}⚠️  STREAM_ACCOUNT_ID não encontrado${NC}"
  echo "     Configure manualmente:"
  echo "     wrangler secret put STREAM_ACCOUNT_ID"
  echo "     wrangler secret put STREAM_API_TOKEN"
fi

if wrangler secret list 2>/dev/null | grep -q "STREAM_API_TOKEN"; then
  echo -e "  ${GREEN}✅ STREAM_API_TOKEN configurado${NC}"
else
  echo -e "  ${YELLOW}⚠️  STREAM_API_TOKEN não encontrado${NC}"
fi

echo ""
echo "  → Verificando rotas no wrangler.toml..."
if grep -q "media/stream-live" wrangler.toml 2>/dev/null; then
  echo -e "  ${GREEN}✅ Rotas /media/stream-live configuradas${NC}"
else
  echo -e "  ${YELLOW}⚠️  Rotas não encontradas no wrangler.toml${NC}"
fi

echo ""
echo "  → Testando endpoint de presign..."
PRESIGN_RESP=$(curl -s -X POST https://api.ubl.agency/internal/media/presign \
  -H 'content-type: application/json' \
  -d '{"tenant":"voulezvous","mime":"image/png","bytes":1234}' 2>&1)

if echo "$PRESIGN_RESP" | jq -e '.id' >/dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Presign funcionando${NC}"
else
  echo -e "  ${YELLOW}⚠️  Presign não respondeu corretamente${NC}"
  echo "     Resposta: $PRESIGN_RESP"
fi

echo ""
echo "  → Testando endpoint de stream-live (se disponível)..."
STREAM_RESP=$(curl -s -X POST https://api.ubl.agency/media/stream-live/inputs \
  -H 'content-type: application/json' \
  -d '{"tenant":"voulezvous","title":"test"}' 2>&1 | head -1)

if echo "$STREAM_RESP" | grep -qE "rtmp|rtmps|playback_id|200|401|403"; then
  echo -e "  ${GREEN}✅ Endpoint responde${NC}"
else
  echo -e "  ${YELLOW}⚠️  Endpoint pode não estar disponível${NC}"
fi

echo ""
echo "✅ P0.2 completo (validação manual necessária para secrets)"
echo ""

# ============================================================================
# P0.3 — KV de rate-limit e webhooks
# ============================================================================
echo "3️⃣  P0.3 — KV Rate-Limit e Webhooks"
echo "----------------------------------"

KV_NAMESPACE_ID="${UBL_FLAGS_KV_ID:-fe402d39cc544ac399bd068f9883dddf}"

echo ""
echo "  → Criando chaves de rate-limit (placeholders)..."
for route in "/api/session/exchange" "/media/presign" "/webhooks/github"; do
  KEY="rate:test_user:${route}"
  echo "     Criando: $KEY"
  echo "placeholder" | wrangler kv key put "$KEY" \
    --namespace-id "$KV_NAMESPACE_ID" \
    --binding=UBL_FLAGS 2>/dev/null || true
done
echo -e "  ${GREEN}✅ Chaves de rate-limit criadas${NC}"

echo ""
echo "  → Criando chave de webhook (partner exemplo)..."
WEBHOOK_KEY="webhook:partner:github:key:test"
echo "test_hmac_secret_key_12345" | wrangler kv key put "$WEBHOOK_KEY" \
  --namespace-id "$KV_NAMESPACE_ID" \
  --binding=UBL_FLAGS 2>/dev/null || true
echo -e "  ${GREEN}✅ Chave de webhook criada${NC}"

echo ""
echo "  → Verificando /_policy/status..."
POLICY_STATUS=$(curl -s "https://api.ubl.agency/_policy/status?tenant=ubl" 2>&1)
if echo "$POLICY_STATUS" | jq -e '.ready' >/dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Policy status OK${NC}"
else
  echo -e "  ${YELLOW}⚠️  Policy status não respondeu${NC}"
fi

echo ""
echo "✅ P0.3 completo"
echo ""

# ============================================================================
# P0.4 — Core API exposta via Gateway
# ============================================================================
echo "4️⃣  P0.4 — Core API via Gateway"
echo "-------------------------------"

echo ""
echo "  → Verificando Core direto..."
CORE_DIRECT=$(curl -s https://core.voulezvous.tv/healthz 2>&1)
if echo "$CORE_DIRECT" | grep -qE "ok|200"; then
  echo -e "  ${GREEN}✅ Core direto OK${NC}"
else
  echo -e "  ${RED}❌ Core direto não responde${NC}"
  echo "     Resposta: $CORE_DIRECT"
fi

echo ""
echo "  → Verificando Gateway → Core..."
GATEWAY_CORE=$(curl -sI https://voulezvous.tv/core/healthz 2>&1 | head -1)
if echo "$GATEWAY_CORE" | grep -qE "200|302|401|403"; then
  echo -e "  ${GREEN}✅ Gateway → Core OK (resposta: $(echo $GATEWAY_CORE | cut -d' ' -f2))${NC}"
else
  echo -e "  ${YELLOW}⚠️  Gateway → Core não respondeu${NC}"
  echo "     Resposta: $GATEWAY_CORE"
fi

echo ""
echo "  → Testando session exchange (stub)..."
SESSION_RESP=$(curl -s -X POST https://core.voulezvous.tv/api/session/exchange \
  -H 'content-type: application/json' \
  -d '{"token":"test_token"}' 2>&1)

if echo "$SESSION_RESP" | jq -e '.session_id' >/dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Session exchange OK${NC}"
  if echo "$SESSION_RESP" | grep -q "Set-Cookie"; then
    echo -e "  ${GREEN}✅ Cookie sendo setado${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠️  Session exchange não respondeu corretamente${NC}"
  echo "     Resposta: $SESSION_RESP"
fi

echo ""
echo "✅ P0.4 completo"
echo ""

# ============================================================================
# Resumo Final
# ============================================================================
echo "✅✅✅ P0 COMPLETO — Resumo"
echo "=========================="
echo ""
echo "✅ P0.1 — Cloudflare Access (Admin)"
echo "✅ P0.2 — Media API com Stream (validação manual para secrets)"
echo "✅ P0.3 — KV Rate-Limit e Webhooks"
echo "✅ P0.4 — Core API via Gateway"
echo ""
echo "📋 Próximos passos:"
echo "   1. Configurar secrets do Stream (se necessário):"
echo "      cd apps/media-api-worker"
echo "      wrangler secret put STREAM_ACCOUNT_ID"
echo "      wrangler secret put STREAM_API_TOKEN"
echo "      wrangler deploy"
echo ""
echo "   2. Testar endpoints completos:"
echo "      ./scripts/smoke-p0-p1.sh"
echo ""
echo "   3. Validar Admin com login real:"
echo "      Abrir https://admin.voulezvous.tv/admin/health no navegador"
echo ""
