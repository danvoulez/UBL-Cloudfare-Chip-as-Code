#!/usr/bin/env bash
# Seed mínimo do Office (R2 + D1 + reindex)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
API_DIR="$ROOT_DIR/workers/office-api-worker"
SAMPLES_DIR="$ROOT_DIR/apps/office/samples"
API_URL="${API_URL:-https://office-api-worker.dan-1f4.workers.dev}"

cd "$ROOT_DIR" || exit 1

echo "== Office: Seed Demo =="
echo ""

# 1. Criar arquivo de teste se não existir
echo ">> 1) Preparando arquivo de teste..."
mkdir -p "$SAMPLES_DIR"
if [ ! -f "$SAMPLES_DIR/spec-demo.pdf" ]; then
  cat > "$SAMPLES_DIR/spec-demo.pdf" <<'EOF'
# Office Demo File
Este é um arquivo de teste para o Office.
Conteúdo de exemplo para indexação e busca semântica.
EOF
  echo "   ✅ Arquivo criado: $SAMPLES_DIR/spec-demo.pdf"
else
  echo "   ✅ Arquivo já existe"
fi

# 2. Upload para R2
echo ""
echo ">> 2) Upload para R2..."
cd "$API_DIR"
wrangler r2 object put office-blobs/workspace/spec-demo.pdf --file "$SAMPLES_DIR/spec-demo.pdf" --remote 2>&1 | tail -3 || {
  echo "   ⚠️  Erro no upload R2 (pode já existir)"
}

# 3. Inserir no D1
echo ""
echo ">> 3) Inserindo registro no D1..."
# Tenta com size primeiro, se falhar tenta sem (compatibilidade com schemas antigos)
wrangler d1 execute OFFICE_DB --remote --command \
  "INSERT OR IGNORE INTO files (id, path, kind, canonical, size, hash) VALUES ('file:spec-demo', 'workspace/spec-demo.pdf', 'pdf', 1, 0, NULL);" 2>&1 | tail -5 || \
wrangler d1 execute OFFICE_DB --remote --command \
  "INSERT OR IGNORE INTO files (id, path, kind, canonical) VALUES ('file:spec-demo', 'workspace/spec-demo.pdf', 'pdf', 1);" 2>&1 | tail -5

# 4. Smoke tests
echo ""
echo ">> 4) Smoke tests..."
echo "   [health]"
curl -s "$API_URL/healthz" | jq . 2>/dev/null || curl -s "$API_URL/healthz"
echo ""
echo "   [inventory]"
curl -s "$API_URL/inventory" | jq . 2>/dev/null || curl -s "$API_URL/inventory"
echo ""

# 5. Criar job de indexação (se tabela existir)
echo ""
echo ">> 5) Criando job de indexação..."
wrangler d1 execute OFFICE_DB --remote --command \
  "INSERT OR IGNORE INTO index_job (id, path, status, created_at) VALUES ('job:spec-demo','workspace/spec-demo.pdf','pending',unixepoch());" 2>&1 | tail -5 || {
  echo "   ⚠️  Tabela index_job não existe (ok, será criada pelo indexer)"
}

echo ""
echo "== OK =="
echo ""
echo "📋 Próximos passos:"
echo "   1. Verificar /inventory retorna o arquivo"
echo "   2. (Opcional) Habilitar Vectorize e redeployar"
echo "   3. Aguardar indexação automática ou trigger manual"
