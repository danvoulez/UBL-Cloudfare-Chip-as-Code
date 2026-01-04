#!/bin/bash
# Fase 3: Deploy no Edge — Worker + WASM
# Build WASM, configura Worker, publica na KV, deploy

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Verificar variáveis necessárias
if [ -z "$ACCESS_AUD" ] || [ -z "$ACCESS_JWKS" ]; then
    echo "❌ Erro: ACCESS_AUD e ACCESS_JWKS devem estar definidos"
    echo ""
    echo "Uso:"
    echo "  export ACCESS_AUD='seu-access-aud'"
    echo "  export ACCESS_JWKS='https://seu-team.cloudflareaccess.com/cdn-cgi/access/certs'"
    echo "  export POLICY_PUBKEY_B64='base64-da-chave-publica'"
    echo "  export KV_NAMESPACE_ID='id-do-kv-namespace'"
    echo "  bash scripts/deploy-phase3.sh"
    exit 1
fi

if [ -z "$POLICY_PUBKEY_B64" ]; then
    if [ -f /tmp/PUB_BASE64.txt ]; then
        POLICY_PUBKEY_B64=$(cat /tmp/PUB_BASE64.txt)
        echo "📝 Usando chave pública de /tmp/PUB_BASE64.txt"
    else
        echo "❌ Erro: POLICY_PUBKEY_B64 não definido e /tmp/PUB_BASE64.txt não existe"
        echo "   Execute primeiro: bash scripts/deploy-phase2.sh"
        exit 1
    fi
fi

if [ -z "$KV_NAMESPACE_ID" ]; then
    echo "⚠️  AVISO: KV_NAMESPACE_ID não definido"
    echo "   Tentando criar namespace KV automaticamente..."
    echo ""
    
    # Tentar criar o namespace
    KV_OUTPUT=$(wrangler kv namespace create "UBL_FLAGS" 2>&1)
    if echo "$KV_OUTPUT" | grep -q '"id"'; then
        # Extrair o ID do JSON retornado
        KV_NAMESPACE_ID=$(echo "$KV_OUTPUT" | grep -o '"id": "[^"]*"' | cut -d'"' -f4)
        echo "✅ Namespace KV criado: $KV_NAMESPACE_ID"
        export KV_NAMESPACE_ID
    else
        echo "❌ Falha ao criar namespace KV"
        echo "   Crie manualmente: wrangler kv namespace create \"UBL_FLAGS\""
        echo "   Depois defina: export KV_NAMESPACE_ID='id-retornado'"
        echo ""
        read -p "Continuar mesmo assim? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

echo "🚀 FASE 3: Deploy no Edge (Worker + WASM)"
echo ""

# 1. Build do WASM
echo "📝 1. Build do WASM..."
rustup target add wasm32-unknown-unknown 2>/dev/null || true
cargo build --release --target wasm32-unknown-unknown -p policy-engine

WASM_SRC="target/wasm32-unknown-unknown/release/policy_engine.wasm"
WASM_DST="workers/policy-worker/build/policy_engine.wasm"

mkdir -p workers/policy-worker/build
cp "$WASM_SRC" "$WASM_DST"
echo "✅ WASM copiado para $WASM_DST"
echo "   $(ls -lh "$WASM_DST" | awk '{print $5}')"
echo ""

# 2. Configurar wrangler.toml
echo "📝 2. Configurando wrangler.toml..."
cd policy-worker

# Backup do wrangler.toml original
cp wrangler.toml wrangler.toml.bak

# Substituir variáveis
sed -i.bak \
  -e "s|ACCESS_AUD = \".*\"|ACCESS_AUD = \"${ACCESS_AUD}\"|" \
  -e "s|ACCESS_JWKS = \".*\"|ACCESS_JWKS = \"${ACCESS_JWKS}\"|" \
  -e "s|POLICY_PUBKEY_B64 = \".*\"|POLICY_PUBKEY_B64 = \"${POLICY_PUBKEY_B64}\"|" \
  wrangler.toml

if [ -n "$KV_NAMESPACE_ID" ]; then
    sed -i.bak "s|id = \".*\"|id = \"${KV_NAMESPACE_ID}\"|" wrangler.toml
fi

rm -f wrangler.toml.bak

echo "✅ wrangler.toml configurado"
echo ""

# 3. Publicar política na KV
echo "📝 3. Publicando política na KV..."

# Tentar encontrar pack.json (pode estar em /etc/ubl/nova/policy/ ou no projeto)
PACK_JSON=""
if [ -f /etc/ubl/nova/policy/pack.json ]; then
    PACK_JSON="/etc/ubl/nova/policy/pack.json"
elif [ -f "$PROJECT_ROOT/policies/pack.json" ]; then
    PACK_JSON="$PROJECT_ROOT/policies/pack.json"
elif sudo test -f /etc/ubl/nova/policy/pack.json 2>/dev/null; then
    # Tentar copiar com sudo se necessário
    sudo cp /etc/ubl/nova/policy/pack.json /tmp/pack.json 2>/dev/null && PACK_JSON="/tmp/pack.json" || true
fi

if [ -n "$PACK_JSON" ] && [ -f "$PACK_JSON" ]; then
    wrangler kv key put policy_pack --binding=UBL_FLAGS --path="$PACK_JSON"
    echo "✅ pack.json publicado na KV"
else
    echo "⚠️  AVISO: pack.json não encontrado"
    echo "   Execute primeiro: bash scripts/deploy-phase2.sh"
    exit 1
fi

# Tentar encontrar ubl_core_v1.yaml
POLICY_YAML=""
if [ -f /etc/ubl/nova/policy/ubl_core_v1.yaml ]; then
    POLICY_YAML="/etc/ubl/nova/policy/ubl_core_v1.yaml"
elif [ -f "$PROJECT_ROOT/policies/ubl_core_v1.yaml" ]; then
    POLICY_YAML="$PROJECT_ROOT/policies/ubl_core_v1.yaml"
elif sudo test -f /etc/ubl/nova/policy/ubl_core_v1.yaml 2>/dev/null; then
    sudo cp /etc/ubl/nova/policy/ubl_core_v1.yaml /tmp/ubl_core_v1.yaml 2>/dev/null && POLICY_YAML="/tmp/ubl_core_v1.yaml" || true
fi

if [ -n "$POLICY_YAML" ] && [ -f "$POLICY_YAML" ]; then
    wrangler kv key put policy_yaml --binding=UBL_FLAGS --path="$POLICY_YAML"
    echo "✅ ubl_core_v1.yaml publicado na KV"
else
    echo "⚠️  AVISO: ubl_core_v1.yaml não encontrado"
    exit 1
fi

echo ""

# 4. Deploy do Worker
echo "📝 4. Deploy do Worker..."
wrangler deploy

echo ""
echo "✅✅✅ FASE 3 COMPLETA!"
echo ""

# 5. Validar warmup
echo "📝 5. Validando Worker..."
sleep 2
WARMUP_RESPONSE=$(curl -sf https://api.ubl.agency/warmup || echo "")
if echo "$WARMUP_RESPONSE" | grep -q '"ok":true'; then
    echo "✅ Worker respondendo em https://api.ubl.agency/warmup"
    echo "$WARMUP_RESPONSE" | jq '.' 2>/dev/null || echo "$WARMUP_RESPONSE"
else
    echo "⚠️  Worker pode não estar respondendo ainda. Verifique:"
    echo "   curl -s https://api.ubl.agency/warmup | jq"
fi

echo ""
echo "Próximos passos:"
echo "  1. Executar smoke test: bash scripts/smoke_chip_as_code.sh"
echo "  2. Verificar métricas: curl -s http://127.0.0.1:9456/metrics"
echo "  3. Verificar ledger: tail -f /var/log/ubl/nova-ledger.ndjson"

cd "$PROJECT_ROOT"
