#!/usr/bin/env bash
# Publica política por tenant na KV (Blueprint 16 + 17)
# Uso: bash scripts/publish.sh --tenant <tenant> --yaml <path_to_yaml>

set -euo pipefail

TENANT=""
YAML_PATH=""
STAGE="${STAGE:-active}"  # active ou next

while [[ $# -gt 0 ]]; do
    case $1 in
        --tenant)
            TENANT="$2"
            shift 2
            ;;
        --yaml)
            YAML_PATH="$2"
            shift 2
            ;;
        --stage)
            STAGE="$2"
            shift 2
            ;;
        *)
            echo "❌ Argumento desconhecido: $1"
            exit 1
            ;;
    esac
done

if [ -z "$TENANT" ] || [ -z "$YAML_PATH" ]; then
    echo "❌ Uso: $0 --tenant <ubl|voulezvous> --yaml <path_to_yaml> [--stage active|next]"
    exit 1
fi

if [ ! -f "$YAML_PATH" ]; then
    echo "❌ Arquivo YAML não encontrado: $YAML_PATH"
    exit 1
fi

# Carregar env
source "$(dirname "$0")/../env" 2>/dev/null || true

POLICY_PRIVKEY_PEM="${POLICY_PRIVKEY_PEM:-/etc/ubl/flagship/keys/policy_signing_private.pem}"
KV_NAMESPACE_ID="${KV_NAMESPACE_ID:-fe402d39cc544ac399bd068f9883dddf}"

if [ ! -f "$POLICY_PRIVKEY_PEM" ]; then
    echo "⚠️  Chave privada não encontrada: $POLICY_PRIVKEY_PEM"
    echo "   Usando modo stub (sem assinatura)"
    SIGN_MODE="stub"
else
    SIGN_MODE="real"
fi

echo "📦 Publicando política para tenant: $TENANT"
echo "   YAML: $YAML_PATH"
echo "   Stage: $STAGE"
echo ""

# Extrair ID e versão do YAML
POLICY_ID=$(grep -E "^id:" "$YAML_PATH" | head -1 | sed 's/^id:[[:space:]]*//' | tr -d '"' || echo "${TENANT}_core_v1")
POLICY_VERSION=$(grep -E "^version:" "$YAML_PATH" | head -1 | sed 's/^version:[[:space:]]*//' | tr -d '"' || echo "1")

echo "   Policy ID: $POLICY_ID"
echo "   Policy Version: $POLICY_VERSION"
echo ""

# 1) Assinar política (se tiver chave)
if [ "$SIGN_MODE" = "real" ]; then
    echo "[1/3] Assinando política..."
    PACK_JSON="/tmp/policy_${TENANT}_${STAGE}_pack.json"
    
    if ! cargo run --release -p policy-signer -- \
        --id "$POLICY_ID" \
        --version "$POLICY_VERSION" \
        --yaml "$YAML_PATH" \
        --privkey_pem "$POLICY_PRIVKEY_PEM" \
        --out "$PACK_JSON" 2>/dev/null; then
        echo "⚠️  Falha ao assinar (usando stub)"
        SIGN_MODE="stub"
    fi
else
    PACK_JSON=""
    echo "[1/3] Pulando assinatura (modo stub)"
fi

# 2) Publicar na KV
echo "[2/3] Publicando na KV (stage=$STAGE)..."

if [ "$STAGE" = "active" ]; then
    YAML_KEY="policy_${TENANT}_yaml_active"
    PACK_KEY="policy_${TENANT}_pack_active"
else
    YAML_KEY="policy_${TENANT}_yaml_next"
    PACK_KEY="policy_${TENANT}_pack_next"
fi

# Publicar YAML
wrangler kv key put "$YAML_KEY" \
    --namespace-id "$KV_NAMESPACE_ID" \
    --path "$YAML_PATH" 2>/dev/null || \
    wrangler kv key put "$YAML_KEY" \
        --namespace-id "$KV_NAMESPACE_ID" \
        --path "$YAML_PATH"

if [ "$SIGN_MODE" = "real" ] && [ -f "$PACK_JSON" ]; then
    # Publicar pack assinado
    wrangler kv key put "$PACK_KEY" \
        --namespace-id "$KV_NAMESPACE_ID" \
        --path "$PACK_JSON" 2>/dev/null || \
        wrangler kv key put "$PACK_KEY" \
            --namespace-id "$KV_NAMESPACE_ID" \
            --path "$PACK_JSON"
    echo "   ✅ Pack assinado publicado: $PACK_KEY"
else
    echo "   ⚠️  Pack não publicado (modo stub)"
fi

echo "   ✅ YAML publicado: $YAML_KEY"

# 3) Validar (se stage=active e worker estiver deployado)
if [ "$STAGE" = "active" ]; then
    echo "[3/3] Validando (aguardando 2s)..."
    sleep 2
    
    STATUS_URL="https://api.ubl.agency/_policy/status?tenant=${TENANT}"
    STATUS_RESP=$(curl -s "$STATUS_URL" || echo '{"error":"unreachable"}')
    
    if echo "$STATUS_RESP" | jq -e ".active.version" >/dev/null 2>&1; then
        ACTIVE_VERSION=$(echo "$STATUS_RESP" | jq -r ".active.version")
        echo "   ✅ Política ativa: versão $ACTIVE_VERSION"
    else
        echo "   ⚠️  Worker não respondeu ou ainda não está deployado"
    fi
else
    echo "[3/3] Stage=next (validação manual necessária)"
fi

echo ""
echo "✅✅✅ Política publicada para tenant: $TENANT (stage=$STAGE)"
echo ""
echo "📋 Próximos passos:"
if [ "$STAGE" = "next" ]; then
    echo "   1. Validar: curl -s 'https://api.ubl.agency/_policy/status?tenant=${TENANT}&stage=next'"
    echo "   2. Promover: bash scripts/publish.sh --tenant $TENANT --yaml $YAML_PATH --stage active"
else
    echo "   1. Smoke test: bash scripts/smoke_multitenant.sh"
    echo "   2. Verificar: curl -s 'https://api.ubl.agency/_policy/status?tenant=${TENANT}' | jq .active"
fi
