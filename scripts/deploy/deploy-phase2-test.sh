#!/bin/bash
# Fase 2: Teste local (sem sudo/systemd) — valida antes de executar no LAB 256

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧪 TESTE LOCAL — Fase 2 (validação)"
echo ""
echo "⚠️  Este script valida localmente. Para deploy real, execute no LAB 256:"
echo "   bash scripts/deploy-phase2.sh"
echo ""

# 1. Verificar binários
echo "📝 1. Verificando binários..."
for bin in policy-keygen policy-signer policy-proxy; do
    if [ -f "target/release/$bin" ]; then
        echo "   ✅ $bin: $(ls -lh target/release/$bin | awk '{print $5}')"
    else
        echo "   ❌ $bin: NÃO ENCONTRADO"
        exit 1
    fi
done
echo ""

# 2. Testar keygen (em /tmp)
echo "📝 2. Testando keygen..."
mkdir -p /tmp/test-ubl-keys
TEST_PUB=$(./target/release/policy-keygen \
  --out-dir /tmp/test-ubl-keys \
  --name test \
  --print-pub-b64)

echo "   ✅ Chave gerada: ${TEST_PUB:0:50}..."
echo "   ✅ Arquivos:"
ls -lh /tmp/test-ubl-keys/
echo ""

# 3. Verificar política
echo "📝 3. Verificando política..."
if [ -f "policies/ubl_core_v1.yaml" ]; then
    echo "   ✅ Política encontrada: policies/ubl_core_v1.yaml"
    echo "   📄 Tamanho: $(wc -l < policies/ubl_core_v1.yaml) linhas"
else
    echo "   ❌ Política não encontrada: policies/ubl_core_v1.yaml"
    exit 1
fi
echo ""

# 4. Testar signer (com chave de teste)
echo "📝 4. Testando signer..."
mkdir -p /tmp/test-ubl-policy
./target/release/policy-signer \
  --id test_v1 \
  --version 1 \
  --yaml policies/ubl_core_v1.yaml \
  --privkey_pem /tmp/test-ubl-keys/test_private.pem \
  --out /tmp/test-ubl-policy/pack.json

if [ -f /tmp/test-ubl-policy/pack.json ]; then
    echo "   ✅ pack.json gerado"
    echo "   📄 Conteúdo:"
    cat /tmp/test-ubl-policy/pack.json | jq '.' 2>/dev/null || cat /tmp/test-ubl-policy/pack.json
else
    echo "   ❌ pack.json não foi gerado"
    exit 1
fi
echo ""

# 5. Verificar service file
echo "📝 5. Verificando service file..."
if [ -f "infra/systemd/nova-policy-rs.service" ]; then
    echo "   ✅ Service file encontrado"
    echo "   📄 Preview:"
    grep -E "POLICY_PUBKEY_PEM_B64|ExecStart|Environment" infra/systemd/nova-policy-rs.service | head -5
else
    echo "   ❌ Service file não encontrado: infra/systemd/nova-policy-rs.service"
    exit 1
fi
echo ""

echo "✅✅✅ VALIDAÇÃO LOCAL COMPLETA!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Copiar este projeto para o LAB 256"
echo "   2. Executar: bash scripts/deploy-phase2.sh"
echo "   3. Após Fase 2, executar: bash scripts/deploy-phase3.sh"
echo ""
echo "🧹 Limpeza (opcional):"
echo "   rm -rf /tmp/test-ubl-keys /tmp/test-ubl-policy"
