#!/usr/bin/env bash
set -euo pipefail

DB="OFFICE_DB"
API_DIR="apps/office/workers/office-api-worker"
REMOTE_FLAG="--remote"  # Usar --remote para aplicar no database de produção

echo "== Office: padronizando schema 'files' =="

# helper: checar se coluna existe
has_col () {
  wrangler d1 execute "$DB" $REMOTE_FLAG --command "PRAGMA table_info(files);" \
    | grep -q "\"$1\"" || return 1
}

echo ">> 1) Aplicando schema base (se tabela não existir)"
cd "$API_DIR" || exit 1
wrangler d1 execute "$DB" $REMOTE_FLAG --file=../../schemas/d1/schema.sql 2>&1 | tail -3 || true

echo ">> 2) Adicionando colunas se faltarem (idempotente)"
wrangler d1 execute "$DB" $REMOTE_FLAG --command 'ALTER TABLE files ADD COLUMN path TEXT;' 2>&1 | grep -v "duplicate\|already exists" || echo "   - path: OK"
wrangler d1 execute "$DB" $REMOTE_FLAG --command 'ALTER TABLE files ADD COLUMN kind TEXT DEFAULT "blob";' 2>&1 | grep -v "duplicate\|already exists" || echo "   - kind: OK"
wrangler d1 execute "$DB" $REMOTE_FLAG --command 'ALTER TABLE files ADD COLUMN canonical INTEGER DEFAULT 0;' 2>&1 | grep -v "duplicate\|already exists" || echo "   - canonical: OK"

echo ">> 3) Backfill seguro (garantir defaults)"
wrangler d1 execute "$DB" $REMOTE_FLAG --command "UPDATE files SET path=COALESCE(path,'') WHERE path IS NULL;" 2>&1 | tail -3 || true
wrangler d1 execute "$DB" $REMOTE_FLAG --command "UPDATE files SET kind=COALESCE(kind,'blob') WHERE kind IS NULL;" 2>&1 | tail -3 || true
wrangler d1 execute "$DB" $REMOTE_FLAG --command "UPDATE files SET canonical=COALESCE(canonical,0) WHERE canonical IS NULL;" 2>&1 | tail -3 || true

echo ">> 4) Índices"
wrangler d1 execute "$DB" $REMOTE_FLAG --command "CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);" 2>&1 | tail -3 || true
wrangler d1 execute "$DB" $REMOTE_FLAG --command "CREATE INDEX IF NOT EXISTS idx_files_canonical ON files(canonical);" 2>&1 | tail -3 || true

echo ">> 5) Patch de compat no /inventory (mantém JSON mesmo em erro)"
INVENTORY_FILE="$API_DIR/src/http/routes_inventory.ts"
if [ -f "$INVENTORY_FILE" ]; then
  # Aplica versão tolerante a esquemas antigos
  cat > "$INVENTORY_FILE" <<'TS'
export const inventory = async (env: any) => {
  try {
    const rs = await env.OFFICE_DB
      .prepare("SELECT id, path, kind, canonical FROM files LIMIT 10")
      .all();
    return new Response(
      JSON.stringify({ ok: true, files: rs.results ?? [] }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("no such column")) {
      const fallback = await env.OFFICE_DB
        .prepare(
          "SELECT id, " +
          "       COALESCE(path, name, '') AS path, " +
          "       COALESCE(kind, mime, 'blob') AS kind, " +
          "       COALESCE(canonical, 0) AS canonical " +
          "FROM files LIMIT 10"
        )
        .all();
      return new Response(
        JSON.stringify({
          ok: true,
          files: fallback.results ?? [],
          note: "compat: inferred columns from name/mime"
        }),
        { headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
TS
  echo "   - inventory patch aplicado"
else
  echo "   - arquivo $INVENTORY_FILE não encontrado (pulando patch)"
fi

echo ">> 6) Smoke do D1"
wrangler d1 execute "$DB" $REMOTE_FLAG --command "SELECT COUNT(*) AS n, SUM(COALESCE(canonical,0)) AS canon_sum FROM files;" 2>&1 | tail -10

echo "== OK =="
