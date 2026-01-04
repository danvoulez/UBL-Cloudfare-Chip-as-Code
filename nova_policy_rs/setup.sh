#!/bin/bash
# Setup script para nova-policy-rs

set -e

echo "🔧 Setting up nova-policy-rs..."

# Criar diretórios necessários
echo "📁 Creating directories..."
sudo mkdir -p /opt/ubl/nova/bin
sudo mkdir -p /etc/ubl/nova/policy
sudo mkdir -p /var/log/ubl
sudo chown -R ubl-ops:ubl-ops /opt/ubl/nova
sudo chown -R ubl-ops:ubl-ops /var/log/ubl

# Verificar se policy files existem
if [ ! -f "/etc/ubl/nova/policy/ubl_core_v1.yaml" ]; then
    echo "⚠️  Policy YAML não encontrado em /etc/ubl/nova/policy/ubl_core_v1.yaml"
    echo "   Copie o arquivo de examples/ubl_core_v1.yaml"
fi

if [ ! -f "/etc/ubl/nova/policy/pack.json" ]; then
    echo "⚠️  pack.json não encontrado em /etc/ubl/nova/policy/pack.json"
    echo "   Gere com: cd ../policy-pack && ./target/release/pack-builder -y policy.yaml -k keys/private.pem -o pack.json"
fi

echo "✅ Setup completo!"
echo ""
echo "Próximos passos:"
echo "  1. Editar deploy/nova-policy-rs.service e colocar POLICY_PUBKEY_PEM_B64"
echo "  2. Copiar service: sudo cp deploy/nova-policy-rs.service /etc/systemd/system/"
echo "  3. Instalar binário: sudo install -D -m 0755 target/release/policy-proxy /opt/ubl/nova/bin/nova-policy-rs"
echo "  4. Iniciar: sudo systemctl daemon-reload && sudo systemctl enable --now nova-policy-rs"
