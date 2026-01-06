#!/bin/bash
# Deploy Messenger Pages usando wrangler com login

set -e

cd "$(dirname "$0")/../apps/messenger"

echo "📦 Fazendo deploy do Messenger Pages..."
echo ""

# Verificar se dist existe
if [ ! -d "messenger/frontend/dist" ]; then
  echo "⚠️  Diretório dist não encontrado, fazendo build..."
  cd messenger/frontend
  npm run build
  cd ../..
fi

# Fazer deploy
echo "🚀 Deployando..."
wrangler pages deploy messenger/frontend/dist --project-name=ubl-messenger

echo ""
echo "✅ Deploy concluído!"
echo "🌐 URL: https://messenger.ubl.agency"
