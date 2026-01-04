#!/usr/bin/env bash
# P0.1 — Core online via Tunnel (core.voulezvous.tv)
# Executa os passos necessários para colocar o Core online

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 P0.1 — Core online via Tunnel"
echo ""

# 1. Verificar se cloudflared está instalado
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ cloudflared não encontrado. Instale: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  exit 1
fi

# 2. Verificar se vvz-core está buildado
if [ ! -f "${PROJECT_ROOT}/target/release/vvz-core" ]; then
  echo "⚠️  vvz-core não está buildado. Buildando..."
  cd "${PROJECT_ROOT}/apps/core-api"
  cargo build --release --bin vvz-core
  cd "${PROJECT_ROOT}"
fi

# 3. Login no cloudflared (se necessário)
echo "1️⃣  Verificando autenticação cloudflared..."
if ! cloudflared tunnel list 2>/dev/null | grep -q "."; then
  echo "   ⚠️  Não autenticado. Fazendo login..."
  cloudflared tunnel login
else
  echo "   ✅ Já autenticado"
fi

# 4. Criar tunnel (se não existir)
echo ""
echo "2️⃣  Verificando tunnel vvz-core..."
if ! cloudflared tunnel list 2>/dev/null | grep -q "vvz-core"; then
  echo "   ⚠️  Tunnel não existe. Criando..."
  cloudflared tunnel create vvz-core
else
  echo "   ✅ Tunnel já existe"
fi

# 5. Rotear DNS
echo ""
echo "3️⃣  Roteando DNS core.voulezvous.tv..."
cloudflared tunnel route dns vvz-core core.voulezvous.tv 2>&1 || {
  echo "   ⚠️  Roteamento falhou (pode já estar configurado)"
}

# 6. Copiar credenciais (se necessário)
echo ""
echo "4️⃣  Verificando credenciais..."
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | awk '/vvz-core/{print $1}' | head -n1)
if [ -n "$TUNNEL_ID" ]; then
  CREDS_SRC="${HOME}/.cloudflared/${TUNNEL_ID}.json"
  CREDS_DST="/etc/cloudflared/vvz-core.json"
  
  if [ -f "$CREDS_SRC" ] && [ ! -f "$CREDS_DST" ]; then
    echo "   📋 Copiando credenciais para $CREDS_DST..."
    sudo mkdir -p /etc/cloudflared
    sudo cp "$CREDS_SRC" "$CREDS_DST"
    # macOS usa wheel como grupo, Linux usa root
    if [ "$(uname)" = "Darwin" ]; then
      sudo chown root:wheel "$CREDS_DST" 2>/dev/null || sudo chown root:staff "$CREDS_DST" 2>/dev/null || sudo chown root "$CREDS_DST"
    else
      sudo chown root:root "$CREDS_DST"
    fi
    sudo chmod 600 "$CREDS_DST"
    echo "   ✅ Credenciais copiadas"
  elif [ -f "$CREDS_DST" ]; then
    echo "   ✅ Credenciais já existem"
  else
    echo "   ⚠️  Credenciais não encontradas. Execute manualmente:"
    if [ "$(uname)" = "Darwin" ]; then
      echo "      sudo cp ${CREDS_SRC} ${CREDS_DST}"
      echo "      sudo chown root:wheel ${CREDS_DST} && sudo chmod 600 ${CREDS_DST}"
    else
      echo "      sudo cp ${CREDS_SRC} ${CREDS_DST}"
      echo "      sudo chown root:root ${CREDS_DST} && sudo chmod 600 ${CREDS_DST}"
    fi
  fi
fi

# 7. Instalar systemd units (opcional, se estiver em Linux)
if command -v systemctl >/dev/null 2>&1 && [ "$(uname)" != "Darwin" ]; then
  echo ""
  echo "5️⃣  Instalando systemd units..."
  if [ -f "${PROJECT_ROOT}/infra/systemd/install-vvz-core.sh" ]; then
    cd "${PROJECT_ROOT}/infra/systemd"
    sudo bash install-vvz-core.sh "${PROJECT_ROOT}/target/release/vvz-core"
    echo ""
    echo "   Para iniciar os serviços:"
    echo "      sudo systemctl enable --now vvz-core cloudflared-vvz-core"
  else
    echo "   ⚠️  Script de instalação não encontrado"
  fi
else
  echo ""
  echo "5️⃣  Systemd não disponível (macOS ou não-root)"
  echo "   Para iniciar manualmente:"
  echo "      Terminal 1: PORT=8787 RUST_LOG=info ${PROJECT_ROOT}/target/release/vvz-core"
  echo "      Terminal 2: cloudflared tunnel run vvz-core"
fi

echo ""
echo "✅✅✅ Setup completo!"
echo ""
echo "📋 Próximos passos:"
if command -v systemctl >/dev/null 2>&1 && [ "$(uname)" != "Darwin" ]; then
  echo "   1. Iniciar serviços: sudo systemctl start vvz-core cloudflared-vvz-core"
  echo "   2. Verificar: curl -s https://core.voulezvous.tv/healthz"
else
  echo "   1. Iniciar vvz-core em um terminal:"
  echo "      PORT=8787 RUST_LOG=info ${PROJECT_ROOT}/target/release/vvz-core"
  echo "   2. Iniciar tunnel em outro terminal:"
  echo "      cloudflared tunnel run vvz-core"
  echo "   3. Verificar: curl -s https://core.voulezvous.tv/healthz"
fi
