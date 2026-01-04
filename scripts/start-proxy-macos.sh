#!/bin/bash
# Iniciar proxy manualmente no macOS (sem systemd)

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Carregar chave pública
if [ -f /tmp/PUB_BASE64.txt ]; then
    POLICY_PUBKEY_B64=$(cat /tmp/PUB_BASE64.txt)
else
    echo "❌ /tmp/PUB_BASE64.txt não encontrado"
    echo "   Execute primeiro: bash scripts/deploy-phase2.sh"
    exit 1
fi

echo "🚀 Iniciando proxy manualmente..."
echo ""

# Verificar se proxy está instalado
if [ ! -f /opt/ubl/nova/bin/nova-policy-rs ]; then
    echo "❌ Proxy não encontrado em /opt/ubl/nova/bin/nova-policy-rs"
    exit 1
fi

# Verificar se já está rodando
if lsof -Pi :9456 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Proxy já está rodando na porta 9456"
    echo "   Para parar: pkill -f nova-policy-rs"
    exit 1
fi

# Exportar variáveis de ambiente
export UPSTREAM="http://127.0.0.1:9453"
export POLICY_PUBKEY_PEM_B64="$POLICY_PUBKEY_B64"
export POLICY_YAML="/etc/ubl/nova/policy/ubl_core_v1.yaml"
export POLICY_PACK="/etc/ubl/nova/policy/pack.json"
export RUST_LOG="info"

echo "📝 Variáveis:"
echo "   UPSTREAM=$UPSTREAM"
echo "   POLICY_YAML=$POLICY_YAML"
echo "   POLICY_PACK=$POLICY_PACK"
echo "   POLICY_PUBKEY_B64=${POLICY_PUBKEY_B64:0:50}..."
echo ""

# Iniciar proxy em background com variáveis exportadas
echo "🚀 Iniciando proxy..."
env UPSTREAM="$UPSTREAM" \
    POLICY_PUBKEY_PEM_B64="$POLICY_PUBKEY_B64" \
    POLICY_YAML="$POLICY_YAML" \
    POLICY_PACK="$POLICY_PACK" \
    RUST_LOG="$RUST_LOG" \
    /opt/ubl/nova/bin/nova-policy-rs > /tmp/nova-policy-rs.log 2>&1 &
PROXY_PID=$!

sleep 2

# Verificar se está rodando
if kill -0 $PROXY_PID 2>/dev/null; then
    echo "✅ Proxy iniciado (PID: $PROXY_PID)"
    echo "   Log: /tmp/nova-policy-rs.log"
    echo ""
    
    # Testar
    if curl -sf http://127.0.0.1:9456/_reload | grep -q '"ok":true'; then
        echo "✅ Proxy respondendo em http://127.0.0.1:9456"
    else
        echo "⚠️  Proxy iniciado mas não está respondendo"
        echo "   Verifique: tail -f /tmp/nova-policy-rs.log"
    fi
else
    echo "❌ Proxy não iniciou"
    echo "   Verifique: cat /tmp/nova-policy-rs.log"
    exit 1
fi

echo ""
echo "📝 Para parar:"
echo "   pkill -f nova-policy-rs"
echo ""
echo "📝 Para ver logs:"
echo "   tail -f /tmp/nova-policy-rs.log"
