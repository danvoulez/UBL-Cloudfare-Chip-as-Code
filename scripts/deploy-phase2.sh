#!/bin/bash
# Fase 2: Preparação no LAB 256 — modo turbo
# Gera chaves, assina política, configura proxy

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 FASE 2: Preparação no LAB 256"
echo ""

# 1. Gerar chaves (PKCS#8) + pegar pública em base64
echo "📝 1. Gerando chaves Ed25519..."
sudo install -d -m 750 /etc/ubl/nova/keys
sudo install -d -m 750 /etc/ubl/nova/policy

PUB_BASE64=$(sudo ./target/release/policy-keygen \
  --out-dir /etc/ubl/nova/keys \
  --name policy_signing \
  --print-pub-b64)

echo "$PUB_BASE64" | sudo tee /tmp/PUB_BASE64.txt > /dev/null
echo "✅ Chave pública (base64) salva em /tmp/PUB_BASE64.txt"
echo "   ${PUB_BASE64:0:50}..."
echo ""

# 2. Salvar a política
echo "📝 2. Copiando política..."
sudo cp policies/ubl_core_v1.yaml /etc/ubl/nova/policy/ubl_core_v1.yaml
sudo chmod 644 /etc/ubl/nova/policy/ubl_core_v1.yaml
echo "✅ Política salva em /etc/ubl/nova/policy/ubl_core_v1.yaml"
echo ""

# 3. Assinar e gerar pack.json
echo "📝 3. Assinando política..."
sudo ./target/release/policy-signer \
  --id ubl_access_chip_v1 \
  --version 1 \
  --yaml /etc/ubl/nova/policy/ubl_core_v1.yaml \
  --privkey_pem /etc/ubl/nova/keys/policy_signing_private.pem \
  --out /etc/ubl/nova/policy/pack.json

echo "✅ pack.json gerado em /etc/ubl/nova/policy/pack.json"
echo ""

# 4. Build do proxy
echo "📝 4. Build do proxy..."
cargo build --release -p policy-proxy
echo "✅ Proxy compilado: target/release/policy-proxy"
echo ""

# 5. Instalar proxy
echo "📝 5. Instalando proxy..."
sudo install -d -m 755 /opt/ubl/nova/bin
sudo install -m 755 target/release/policy-proxy /opt/ubl/nova/bin/nova-policy-rs
echo "✅ Proxy instalado em /opt/ubl/nova/bin/nova-policy-rs"
echo ""

# 6. Configurar service
echo "📝 6. Configurando systemd service..."
sudo install -d -m 755 /etc/systemd/system
sudo cp infra/systemd/nova-policy-rs.service /tmp/nova-policy-rs.service.tmp

# Substituir __FILL_ME__ pela chave pública
sudo sed -i.bak "s|POLICY_PUBKEY_PEM_B64=__FILL_ME__|POLICY_PUBKEY_PEM_B64=${PUB_BASE64}|" /tmp/nova-policy-rs.service.tmp
sudo mv /tmp/nova-policy-rs.service.tmp /etc/systemd/system/nova-policy-rs.service
sudo rm -f /tmp/nova-policy-rs.service.tmp.bak

echo "✅ Service configurado: /etc/systemd/system/nova-policy-rs.service"
echo ""

# 7. Ativar e iniciar service
echo "📝 7. Ativando service..."
sudo systemctl daemon-reload
sudo systemctl enable nova-policy-rs
sudo systemctl restart nova-policy-rs

sleep 2

# 8. Validar
echo "📝 8. Validando proxy..."
if curl -sf http://127.0.0.1:9456/_reload | grep -q '"ok":true'; then
    echo "✅ Proxy respondendo em http://127.0.0.1:9456"
else
    echo "❌ Proxy não está respondendo. Verifique:"
    echo "   sudo systemctl status nova-policy-rs"
    echo "   sudo journalctl -u nova-policy-rs -n 50"
    exit 1
fi

echo ""
echo "✅✅✅ FASE 2 COMPLETA!"
echo ""
echo "Próximos passos:"
echo "  1. Configurar Caddy para apontar para 127.0.0.1:9456"
echo "  2. Executar scripts/deploy-phase3.sh para deploy do Worker"
echo ""
echo "Chave pública (base64) para o Worker:"
echo "  ${PUB_BASE64}"
