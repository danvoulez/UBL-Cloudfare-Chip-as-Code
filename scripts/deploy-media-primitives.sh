#!/usr/bin/env bash
# Deploy Media Primitives (KV/D1 + Media API Worker)

set -euo pipefail

echo "🚀 Deploy Media Primitives"
echo "=========================="
echo ""

# 1) Criar KV
echo "[1/4] Criando KV namespace..."
KV_OUTPUT=$(wrangler kv namespace create KV_MEDIA 2>&1 || true)

# Tentar extrair ID do output
KV_ID=$(echo "$KV_OUTPUT" | grep -oE 'id = "[^"]+"' | head -1 | sed 's/id = "//;s/"//' || echo "")

# Se não encontrou, verificar se já existe
if [ -z "$KV_ID" ]; then
    echo "⚠️  KV já existe ou erro ao criar. Verificando..."
    KV_LIST=$(wrangler kv namespace list 2>&1 || echo "")
    KV_ID=$(echo "$KV_LIST" | grep -i "KV_MEDIA" | head -1 | grep -oE '[a-f0-9]{32}' | head -1 || echo "")
fi

if [ -z "$KV_ID" ]; then
    echo "❌ Não foi possível obter KV_MEDIA ID"
    echo "   Output: $KV_OUTPUT"
    echo ""
    echo "💡 Tente criar manualmente:"
    echo "   wrangler kv namespace create KV_MEDIA"
    echo "   # Copie o ID retornado e exporte:"
    echo "   export KV_MEDIA_ID=\"<id>\""
    exit 1
fi

echo "   ✅ KV_MEDIA ID: $KV_ID"
echo ""

# 2) Criar D1
echo "[2/4] Criando D1 database..."
D1_OUTPUT=$(wrangler d1 create ubl-media 2>&1 || true)

# Tentar extrair ID do output
D1_ID=$(echo "$D1_OUTPUT" | grep -oE 'database_id = "[^"]+"' | head -1 | sed 's/database_id = "//;s/"//' || echo "")

# Se não encontrou, verificar se já existe
if [ -z "$D1_ID" ]; then
    echo "⚠️  D1 já existe ou erro ao criar. Verificando..."
    D1_LIST=$(wrangler d1 list 2>&1 || echo "")
    D1_ID=$(echo "$D1_LIST" | grep -i "ubl-media" | head -1 | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1 || echo "")
fi

if [ -z "$D1_ID" ]; then
    echo "❌ Não foi possível obter D1_MEDIA ID"
    echo "   Output: $D1_OUTPUT"
    echo ""
    echo "💡 Tente criar manualmente:"
    echo "   wrangler d1 create ubl-media"
    echo "   # Copie o database_id retornado e exporte:"
    echo "   export D1_MEDIA_ID=\"<id>\""
    exit 1
fi

echo "   ✅ D1_MEDIA ID: $D1_ID"
echo ""

# 3) Executar schema
echo "[3/4] Executando schema D1..."
wrangler d1 execute ubl-media --file=apps/media-api-worker/schema.sql
echo "   ✅ Schema executado"
echo ""

# 4) Atualizar wrangler.toml e deploy
echo "[4/4] Atualizando wrangler.toml e fazendo deploy..."

# Função sed cross-platform
sed_i() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"
  else
    local file="${@: -1}"
    local exprs=("${@:1:$#-1}")
    sed -i '' "${exprs[@]}" "$file"
  fi
}

sed_i "s|<KV_MEDIA_ID>|$KV_ID|g" apps/media-api-worker/wrangler.toml
sed_i "s|<D1_MEDIA_ID>|$D1_ID|g" apps/media-api-worker/wrangler.toml

echo "   ✅ wrangler.toml atualizado"
echo ""

wrangler deploy --name ubl-media-api --config apps/media-api-worker/wrangler.toml

echo ""
echo "✅✅✅ Media Primitives deployado!"
echo ""
echo "📋 Proof of Done:"
echo "   curl -s -X POST https://api.ubl.agency/internal/media/presign \\"
echo "     -H 'content-type: application/json' \\"
echo "     -d '{}' | jq .ok"
echo "   # Deve retornar: true"
