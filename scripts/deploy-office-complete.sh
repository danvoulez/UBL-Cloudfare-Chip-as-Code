#!/usr/bin/env bash
# Deploy completo do Office para Cloudflare
# Baseado nas instruções do Blueprint Office (docs/blueprints/Office)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OFFICE_DIR="${PROJECT_ROOT}/apps/office"

cd "$PROJECT_ROOT"

# Carregar variáveis do env
if [ -f "env" ]; then
  # Remover BOM se existir e source
  set +e
  source <(sed '1s/^\xEF\xBB\xBF//' env 2>/dev/null || cat env)
  set -e
fi

echo "🚀 Deploy Office — Cloudflare"
echo "=============================="
echo ""
echo "📋 Baseado nas instruções do Blueprint Office"
echo ""

# 0. Verificar recursos existentes
echo "0️⃣  Verificando recursos existentes na Cloudflare..."
echo ""

# D1 Databases
echo "   📊 D1 Databases existentes:"
wrangler d1 list 2>/dev/null | grep -i "office\|name" | head -10 || echo "      (nenhum encontrado ou erro ao listar)"
echo ""

# KV Namespaces
echo "   📦 KV Namespaces existentes:"
wrangler kv namespace list 2>/dev/null | grep -i "office\|title" | head -10 || echo "      (nenhum encontrado ou erro ao listar)"
echo ""

# R2 Buckets
echo "   🪣 R2 Buckets existentes:"
wrangler r2 bucket list 2>/dev/null | grep -i "office\|name" | head -10 || echo "      (nenhum encontrado ou erro ao listar)"
echo ""

# Vectorize Indexes
echo "   🔍 Vectorize Indexes existentes:"
wrangler vectorize list 2>/dev/null | grep -i "office\|name" | head -10 || echo "      (nenhum encontrado ou erro ao listar)"
echo ""

# Workers
echo "   👷 Workers existentes:"
wrangler deployments list 2>/dev/null | grep -i "office\|name" | head -10 || echo "      (nenhum encontrado ou erro ao listar)"
echo ""

read -p "   Continuar com criação/deploy? (Y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Nn]$ ]]; then
  echo "   ❌ Deploy cancelado pelo usuário"
  exit 0
fi
echo ""

# 1. Criar recursos Cloudflare
echo "1️⃣  Criando recursos Cloudflare..."
echo ""

# D1 Database
echo "   📊 Verificando/Criando D1 database: OFFICE_DB"

# Primeiro, tentar encontrar existente
OFFICE_DB_ID=$(wrangler d1 list --json 2>/dev/null | jq -r '.[] | select(.name == "OFFICE_DB" or .name == "office-db" or .name == "OFFICE_DB") | .uuid' | head -1 || echo "")

if [ -z "$OFFICE_DB_ID" ]; then
  # Tentar via texto simples
  OFFICE_DB_ID=$(wrangler d1 list 2>/dev/null | grep -iE "OFFICE_DB|office-db" | awk '{print $2}' | head -1 || echo "")
fi

if [ -z "$OFFICE_DB_ID" ]; then
  # Não existe, criar
  echo "      Criando novo D1 database..."
  CREATE_OUTPUT=$(wrangler d1 create OFFICE_DB 2>&1)
  # Extrair database_id (compatível com macOS BSD grep)
  OFFICE_DB_ID=$(echo "$CREATE_OUTPUT" | grep -oE 'database_id = "[^"]+"' | sed 's/database_id = "\([^"]*\)"/\1/' | head -1 || echo "")
  if [ -z "$OFFICE_DB_ID" ]; then
    # Tentar extrair UUID de outra forma
    OFFICE_DB_ID=$(echo "$CREATE_OUTPUT" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1 || echo "")
  fi
  if [ -z "$OFFICE_DB_ID" ]; then
    echo "      ⚠️  Não foi possível criar/obter D1 ID automaticamente"
    echo "      Execute: wrangler d1 create OFFICE_DB"
    read -p "      Digite o D1 database_id: " OFFICE_DB_ID
  else
    echo "      ✅ D1 criado: $OFFICE_DB_ID"
  fi
else
  echo "      ✅ D1 já existe: $OFFICE_DB_ID"
fi

# KV Namespaces
echo "   📦 Verificando/Criando KV namespaces..."
for kv_name in "OFFICE_FLAGS" "OFFICE_CACHE"; do
  echo "      Verificando: $kv_name"
  
  # Extrair ID via JSON usando Python (mais robusto)
  KV_ID=$(wrangler kv namespace list 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for item in data:
        if item.get('title') == '$kv_name':
            print(item.get('id', ''))
            break
except:
    pass
" 2>/dev/null | head -1 || echo "")
  
  # Validar que o ID tem 32 caracteres (formato correto)
  if [ -z "$KV_ID" ] || [ "$KV_ID" = "null" ] || [ ${#KV_ID} -ne 32 ]; then
    # Fallback: extrair manualmente do JSON
    KV_RAW=$(wrangler kv namespace list 2>/dev/null | grep -A 3 "\"title\": \"$kv_name\"" | grep "\"id\"" | head -1 || echo "")
    KV_ID=$(echo "$KV_RAW" | sed 's/.*"id": "\([a-f0-9]\{32\}\)".*/\1/' | head -1 || echo "")
  fi
  
  if [ -z "$KV_ID" ]; then
    # Não existe, criar
    echo "         Criando novo KV namespace..."
    CREATE_OUTPUT=$(wrangler kv namespace create "$kv_name" 2>&1)
    # Extrair id (compatível com macOS BSD grep)
    KV_ID=$(echo "$CREATE_OUTPUT" | grep -oE 'id = "[^"]+"' | sed 's/id = "\([^"]*\)"/\1/' | head -1 || echo "")
    if [ -z "$KV_ID" ]; then
      echo "         ⚠️  Não foi possível criar/obter KV ID automaticamente"
      echo "         Execute: wrangler kv namespace create $kv_name"
      read -p "         Digite o KV namespace_id para $kv_name: " KV_ID
    else
      echo "         ✅ KV $kv_name criado: $KV_ID"
    fi
  else
    echo "         ✅ KV $kv_name já existe: $KV_ID"
  fi
  
  eval "export ${kv_name}_ID=\"$KV_ID\""
done

# R2 Bucket
echo "   🪣 Verificando/Criando R2 bucket: office-blobs"
R2_BUCKET_NAME="office-blobs"

# Verificar se já existe
BUCKET_EXISTS=$(wrangler r2 bucket list 2>/dev/null | grep -i "$R2_BUCKET_NAME" || echo "")

if [ -z "$BUCKET_EXISTS" ]; then
  # Não existe, criar
  echo "      Criando novo R2 bucket..."
  CREATE_OUTPUT=$(wrangler r2 bucket create "$R2_BUCKET_NAME" 2>&1)
  if echo "$CREATE_OUTPUT" | grep -qi "created\|success"; then
    echo "      ✅ R2 bucket criado: $R2_BUCKET_NAME"
  elif echo "$CREATE_OUTPUT" | grep -qi "already exists"; then
    echo "      ✅ R2 bucket já existe: $R2_BUCKET_NAME"
  else
    echo "      ⚠️  Erro ao criar R2 bucket (pode já existir): $R2_BUCKET_NAME"
  fi
else
  echo "      ✅ R2 bucket já existe: $R2_BUCKET_NAME"
fi

# Vectorize Index (opcional)
echo "   🔍 Verificando Vectorize index: OFFICE_VECTORS"
VECTORIZE_EXISTS=$(wrangler vectorize list 2>/dev/null | grep -i "OFFICE_VECTORS\|office-vectors" || echo "")

if [ -z "$VECTORIZE_EXISTS" ]; then
  echo "      ⚠️  Vectorize index não encontrado (opcional)"
  echo "      ⚠️  Vectorize será comentado no wrangler.toml"
  echo "      Para habilitar depois: wrangler vectorize create OFFICE_VECTORS --dimensions=768 --metric=cosine"
  VECTORIZE_ENABLED=false
else
  echo "      ✅ Vectorize index já existe: OFFICE_VECTORS"
  VECTORIZE_ENABLED=true
fi
echo ""

# 2. Criar wrangler.toml para cada worker (se não existir) - PRIMEIRO para poder usar D1
echo "3️⃣  Criando/configurando wrangler.toml para cada worker..."

# office-api-worker
if [ ! -f "${OFFICE_DIR}/workers/office-api-worker/wrangler.toml" ] || [ ! -s "${OFFICE_DIR}/workers/office-api-worker/wrangler.toml" ]; then
  cat > "${OFFICE_DIR}/workers/office-api-worker/wrangler.toml" <<EOF
name = "office-api-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "OFFICE_DB"
database_name = "OFFICE_DB"
database_id = "${OFFICE_DB_ID}"

[[kv_namespaces]]
binding = "OFFICE_FLAGS"
id = "${OFFICE_FLAGS_ID}"

[[kv_namespaces]]
binding = "OFFICE_CACHE"
id = "${OFFICE_CACHE_ID}"

[[vectorize]]
binding = "OFFICE_VECTORS"
index_name = "OFFICE_VECTORS"

[ai]
binding = "AI"

[[r2_buckets]]
binding = "OFFICE_BLOB"
bucket_name = "office-blobs"

[durable_objects]
bindings = [
  { name = "OFFICE_SESSION", class_name = "OfficeSessionDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["OfficeSessionDO"]

[vars]
TOPK_DEFAULT = "6"
EVIDENCE_MODE_DEFAULT = "answer"
ENVIRONMENT = "production"
EOFW
  echo "   ✅ office-api-worker/wrangler.toml criado"
else
  # Atualizar IDs existentes
  if [ -n "$OFFICE_DB_ID" ]; then
    sed -i '' "s|database_id = \".*\"|database_id = \"$OFFICE_DB_ID\"|g" "${OFFICE_DIR}/workers/office-api-worker/wrangler.toml" 2>/dev/null || \
    sed -i "s|database_id = \".*\"|database_id = \"$OFFICE_DB_ID\"|g" "${OFFICE_DIR}/workers/office-api-worker/wrangler.toml"
  fi
  if [ -n "$OFFICE_FLAGS_ID" ]; then
    sed -i '' "s|binding = \"OFFICE_FLAGS\"|binding = \"OFFICE_FLAGS\"|g; /binding = \"OFFICE_FLAGS\"/{n;s|id = \".*\"|id = \"$OFFICE_FLAGS_ID\"|g;}" "${OFFICE_DIR}/workers/office-api-worker/wrangler.toml" 2>/dev/null || \
    sed -i "/binding = \"OFFICE_FLAGS\"/{n;s|id = \".*\"|id = \"$OFFICE_FLAGS_ID\"|g;}" "${OFFICE_DIR}/workers/office-api-worker/wrangler.toml"
  fi
  if [ -n "$OFFICE_CACHE_ID" ]; then
    sed -i '' "s|binding = \"OFFICE_CACHE\"|binding = \"OFFICE_CACHE\"|g; /binding = \"OFFICE_CACHE\"/{n;s|id = \".*\"|id = \"$OFFICE_CACHE_ID\"|g;}" "${OFFICE_DIR}/workers/office-api-worker/wrangler.toml" 2>/dev/null || \
    sed -i "/binding = \"OFFICE_CACHE\"/{n;s|id = \".*\"|id = \"$OFFICE_CACHE_ID\"|g;}" "${OFFICE_DIR}/workers/office-api-worker/wrangler.toml"
  fi
  echo "   ✅ office-api-worker/wrangler.toml atualizado"
fi

# office-indexer-worker
if [ ! -f "${OFFICE_DIR}/workers/office-indexer-worker/wrangler.toml" ] || [ ! -s "${OFFICE_DIR}/workers/office-indexer-worker/wrangler.toml" ]; then
  cat > "${OFFICE_DIR}/workers/office-indexer-worker/wrangler.toml" <<EOF
name = "office-indexer-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "OFFICE_DB"
database_name = "OFFICE_DB"
database_id = "${OFFICE_DB_ID}"

[[vectorize]]
binding = "OFFICE_VECTORS"
index_name = "OFFICE_VECTORS"

[ai]
binding = "AI"

[[r2_buckets]]
binding = "OFFICE_BLOB"
bucket_name = "office-blobs"

[triggers]
crons = ["0 0 * * *", "0 * * * *", "0 */6 * * *"]
EOF
  echo "   ✅ office-indexer-worker/wrangler.toml criado"
else
  if [ -n "$OFFICE_DB_ID" ]; then
    sed -i '' "s|database_id = \".*\"|database_id = \"$OFFICE_DB_ID\"|g" "${OFFICE_DIR}/workers/office-indexer-worker/wrangler.toml" 2>/dev/null || \
    sed -i "s|database_id = \".*\"|database_id = \"$OFFICE_DB_ID\"|g" "${OFFICE_DIR}/workers/office-indexer-worker/wrangler.toml"
  fi
  echo "   ✅ office-indexer-worker/wrangler.toml atualizado"
fi

# office-dreamer-worker
if [ ! -f "${OFFICE_DIR}/workers/office-dreamer-worker/wrangler.toml" ] || [ ! -s "${OFFICE_DIR}/workers/office-dreamer-worker/wrangler.toml" ]; then
  cat > "${OFFICE_DIR}/workers/office-dreamer-worker/wrangler.toml" <<EOF
name = "office-dreamer-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "OFFICE_DB"
database_name = "OFFICE_DB"
database_id = "${OFFICE_DB_ID}"

[ai]
binding = "AI"

[triggers]
crons = ["0 * * * *"]
EOF
  echo "   ✅ office-dreamer-worker/wrangler.toml criado"
else
  if [ -n "$OFFICE_DB_ID" ]; then
    sed -i '' "s|database_id = \".*\"|database_id = \"$OFFICE_DB_ID\"|g" "${OFFICE_DIR}/workers/office-dreamer-worker/wrangler.toml" 2>/dev/null || \
    sed -i "s|database_id = \".*\"|database_id = \"$OFFICE_DB_ID\"|g" "${OFFICE_DIR}/workers/office-dreamer-worker/wrangler.toml"
  fi
  echo "   ✅ office-dreamer-worker/wrangler.toml atualizado"
fi

echo ""

# 4. Verificar e instalar dependências
echo "4️⃣  Verificando dependências dos workers..."
echo ""

# office-api-worker
if [ -d "${OFFICE_DIR}/workers/office-api-worker" ]; then
  cd "${OFFICE_DIR}/workers/office-api-worker"
  if [ -f "package.json" ]; then
    echo "   📦 Instalando dependências: office-api-worker"
    npm install --silent 2>&1 | tail -5 || true
  fi
  if [ -f "tsconfig.json" ] && command -v tsc >/dev/null 2>&1; then
    echo "   🔨 Compilando TypeScript: office-api-worker"
    npx tsc --noEmit 2>&1 | tail -5 || true
  fi
fi

# office-indexer-worker
if [ -d "${OFFICE_DIR}/workers/office-indexer-worker" ]; then
  cd "${OFFICE_DIR}/workers/office-indexer-worker"
  if [ -f "package.json" ]; then
    echo "   📦 Instalando dependências: office-indexer-worker"
    npm install --silent 2>&1 | tail -5 || true
  fi
  if [ -f "tsconfig.json" ] && command -v tsc >/dev/null 2>&1; then
    echo "   🔨 Compilando TypeScript: office-indexer-worker"
    npx tsc --noEmit 2>&1 | tail -5 || true
  fi
fi

# office-dreamer-worker
if [ -d "${OFFICE_DIR}/workers/office-dreamer-worker" ]; then
  cd "${OFFICE_DIR}/workers/office-dreamer-worker"
  if [ -f "package.json" ]; then
    echo "   📦 Instalando dependências: office-dreamer-worker"
    npm install --silent 2>&1 | tail -5 || true
  fi
  if [ -f "tsconfig.json" ] && command -v tsc >/dev/null 2>&1; then
    echo "   🔨 Compilando TypeScript: office-dreamer-worker"
    npx tsc --noEmit 2>&1 | tail -5 || true
  fi
fi

cd "$PROJECT_ROOT"
echo ""

# 5. Deploy workers
echo "5️⃣  Deployando workers..."
echo ""

# office-api-worker
if [ -d "${OFFICE_DIR}/workers/office-api-worker" ]; then
  echo "   📤 Deployando office-api-worker..."
  cd "${OFFICE_DIR}/workers/office-api-worker"
  wrangler deploy 2>&1 | tail -10
  echo "   ✅ office-api-worker deployado"
  echo ""
fi

# office-indexer-worker
if [ -d "${OFFICE_DIR}/workers/office-indexer-worker" ]; then
  echo "   📤 Deployando office-indexer-worker..."
  cd "${OFFICE_DIR}/workers/office-indexer-worker"
  wrangler deploy 2>&1 | tail -10
  echo "   ✅ office-indexer-worker deployado"
  echo ""
fi

# office-dreamer-worker
if [ -d "${OFFICE_DIR}/workers/office-dreamer-worker" ]; then
  echo "   📤 Deployando office-dreamer-worker..."
  cd "${OFFICE_DIR}/workers/office-dreamer-worker"
  wrangler deploy 2>&1 | tail -10
  echo "   ✅ office-dreamer-worker deployado"
  echo ""
fi

cd "$PROJECT_ROOT"

# 6. Verificar secrets necessários
echo "6️⃣  Verificando secrets necessários..."
echo ""
MISSING_SECRETS=0
if ! wrangler secret list --name office-api-worker 2>/dev/null | grep -q "RECEIPT_PRIVATE_KEY"; then
  echo "   ⚠️  RECEIPT_PRIVATE_KEY não configurado (opcional para receipts)"
  MISSING_SECRETS=1
fi
if ! wrangler secret list --name office-api-worker 2>/dev/null | grep -q "RECEIPT_HMAC_KEY"; then
  echo "   ⚠️  RECEIPT_HMAC_KEY não configurado (opcional para receipts)"
  MISSING_SECRETS=1
fi
if [ $MISSING_SECRETS -eq 0 ]; then
  echo "   ✅ Secrets configurados"
else
  echo "   💡 Para configurar secrets:"
  echo "      wrangler secret put RECEIPT_PRIVATE_KEY --name office-api-worker"
  echo "      wrangler secret put RECEIPT_HMAC_KEY --name office-api-worker"
fi
echo ""

# 7. Configurar R2 CORS (se script existir)
if [ -f "${OFFICE_DIR}/scripts/setup-r2-cors.sh" ]; then
  echo "7️⃣  Configurando R2 CORS..."
  bash "${OFFICE_DIR}/scripts/setup-r2-cors.sh" 2>&1 | tail -5
  echo ""
else
  echo "7️⃣  R2 CORS (pular - script não encontrado)"
  echo ""
fi

# 8. Seed dados demo (opcional)
echo "8️⃣  Seed dados demo (opcional)..."
read -p "   Deseja executar seed demo? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if [ -f "${OFFICE_DIR}/scripts/seed-demo.sh" ]; then
    # Corrigir nome do database no script seed
    sed -i '' "s|office-db|OFFICE_DB|g" "${OFFICE_DIR}/scripts/seed-demo.sh" 2>/dev/null || \
    sed -i "s|office-db|OFFICE_DB|g" "${OFFICE_DIR}/scripts/seed-demo.sh"
    bash "${OFFICE_DIR}/scripts/seed-demo.sh" 2>&1 | tail -10
  else
    echo "   ⚠️  Script seed-demo.sh não encontrado"
  fi
fi
echo ""

# 9. Smoke tests
echo "9️⃣  Executando smoke tests..."
if [ -f "${OFFICE_DIR}/scripts/smoke-office.sh" ]; then
  # Tentar descobrir URL do worker
  API_URL=$(wrangler deployments list --name office-api-worker 2>/dev/null | grep -oE 'https://[^\s]+' | head -1 || echo "")
  if [ -z "$API_URL" ]; then
    # Tentar via wrangler dev URL
    API_URL="http://127.0.0.1:8787"
    echo "   ⚠️  URL não detectada, usando: $API_URL"
  else
    echo "   🔍 Testando em: $API_URL"
  fi
  bash "${OFFICE_DIR}/scripts/smoke-office.sh" "$API_URL" 2>&1 | tail -10
else
  echo "   ⚠️  Script smoke-office.sh não encontrado"
fi
echo ""

echo "✅✅✅ DEPLOY OFFICE COMPLETO!"
echo "=============================="
echo ""
echo "📋 Recursos criados:"
echo "   • D1: OFFICE_DB ($OFFICE_DB_ID)"
echo "   • KV: OFFICE_FLAGS, OFFICE_CACHE"
echo "   • R2: office-blobs"
echo "   • DO: OfficeSessionDO"
echo "   • Vectorize: OFFICE_VECTORS (criar manualmente)"
echo ""
echo "📋 Workers deployados:"
echo "   • office-api-worker"
echo "   • office-indexer-worker"
echo "   • office-dreamer-worker"
echo ""
echo "📋 Próximos passos:"
echo "   1. Criar Vectorize index 'OFFICE_VECTORS' (768 dims, cosine):"
echo "      wrangler vectorize create OFFICE_VECTORS --dimensions=768 --metric=cosine"
echo ""
echo "   2. Configurar secrets (opcional, para receipts):"
echo "      wrangler secret put RECEIPT_PRIVATE_KEY --name office-api-worker"
echo "      wrangler secret put RECEIPT_HMAC_KEY --name office-api-worker"
echo ""
echo "   3. Configurar routes no Cloudflare Dashboard (se necessário)"
echo ""
echo "   4. Testar endpoints conforme smoke tests"
echo ""
echo "📋 Notas importantes:"
echo "   • O script d1-apply-schema.sh usa 'office-db' mas o database é 'OFFICE_DB'"
echo "   • Se houver migrations adicionais, elas serão aplicadas automaticamente"
echo "   • Workers TypeScript são compilados automaticamente (se tsc disponível)"
echo "   • Vectorize requer criação manual via Dashboard ou wrangler"
echo ""
