#!/usr/bin/env bash
# P1 — Billing "quota-do" (Durable Object + D1)
# Deploy do sistema de quota/billing com DO e D1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "💰 P1 — Billing Quota-DO"
echo "========================"
echo ""

# Carregar env
if [ -f "${PROJECT_ROOT}/env" ]; then
  set -a
  source "${PROJECT_ROOT}/env"
  set +a
fi

echo "1️⃣  Criar D1 Database"
echo "-------------------"

D1_DB_NAME="BILLING_DB"
D1_DB_ID=""

if wrangler d1 list 2>/dev/null | grep -q "$D1_DB_NAME"; then
  echo -e "   ${GREEN}✅ $D1_DB_NAME já existe${NC}"
  D1_DB_ID=$(wrangler d1 list 2>/dev/null | grep "$D1_DB_NAME" | awk '{print $2}' | head -1)
else
  echo "   Criando $D1_DB_NAME..."
  D1_OUTPUT=$(wrangler d1 create "$D1_DB_NAME" 2>&1)
  D1_DB_ID=$(echo "$D1_OUTPUT" | grep -oE '[a-f0-9-]{36}' | head -1)
  if [ -n "$D1_DB_ID" ]; then
    echo -e "   ${GREEN}✅ D1 criado: $D1_DB_ID${NC}"
  else
    echo -e "   ${RED}❌ Falha ao criar D1${NC}"
    echo "$D1_OUTPUT"
    exit 1
  fi
fi

echo ""

echo "2️⃣  Criar KV Namespace para planos"
echo "---------------------------------"

KV_NAMESPACE_ID=""
KV_LIST=$(wrangler kv namespace list 2>/dev/null || echo "[]")
if echo "$KV_LIST" | jq -e '.[] | select(.title == "PLANS_KV")' >/dev/null 2>&1; then
  echo -e "   ${GREEN}✅ PLANS_KV já existe${NC}"
  KV_NAMESPACE_ID=$(echo "$KV_LIST" | jq -r '.[] | select(.title == "PLANS_KV") | .id' | head -1)
else
  echo "   Criando PLANS_KV..."
  KV_OUTPUT=$(wrangler kv namespace create "PLANS_KV" 2>&1)
  KV_NAMESPACE_ID=$(echo "$KV_OUTPUT" | jq -r '.id // empty' 2>/dev/null || echo "$KV_OUTPUT" | grep -oE '[a-f0-9]{32}' | head -1)
  if [ -n "$KV_NAMESPACE_ID" ] && [ "$KV_NAMESPACE_ID" != "null" ]; then
    echo -e "   ${GREEN}✅ KV criado: $KV_NAMESPACE_ID${NC}"
  else
    echo -e "   ${RED}❌ Falha ao criar KV${NC}"
    echo "$KV_OUTPUT"
    exit 1
  fi
fi

echo ""

echo "3️⃣  Aplicar schema D1"
echo "-------------------"

SCHEMA_FILE="${PROJECT_ROOT}/infra/billing/schema.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
  echo "   Criando schema básico..."
  mkdir -p "${PROJECT_ROOT}/infra/billing"
  cat > "$SCHEMA_FILE" <<'EOF'
-- Billing/Quota D1 Schema
CREATE TABLE IF NOT EXISTS usage_daily (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON usage_daily (tenant, date);
CREATE INDEX IF NOT EXISTS idx_usage_resource ON usage_daily (resource_type, resource_id);

CREATE TABLE IF NOT EXISTS quotas (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  period TEXT NOT NULL, -- daily, monthly
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotas_tenant ON quotas (tenant, resource_type);
EOF
fi

echo "   Aplicando schema..."
wrangler d1 execute "$D1_DB_NAME" --file="$SCHEMA_FILE" 2>&1 | tail -5

echo -e "   ${GREEN}✅ Schema aplicado${NC}"

echo ""

echo "4️⃣  Criar estrutura do Worker (Quota DO)"
echo "---------------------------------------"

QUOTA_DIR="${PROJECT_ROOT}/apps/quota-do"
mkdir -p "${QUOTA_DIR}/src"

# Criar wrangler.toml
cat > "${QUOTA_DIR}/wrangler.toml" <<EOF
name = "quota-do"
main = "src/worker.ts"
compatibility_date = "2024-11-07"

routes = [
  { pattern = "api.ubl.agency/admin/quota/*", zone_id = "${CLOUDFLARE_ZONE_ID:-3aa18fa819ee4b6e393009916432a69f}" }
]

[[d1_databases]]
binding = "BILLING_DB"
database_name = "${D1_DB_NAME}"
database_id = "${D1_DB_ID}"

[[kv_namespaces]]
binding = "PLANS"
id = "${KV_NAMESPACE_ID}"

[durable_objects]
bindings = [
  { name = "QUOTA", class_name = "QuotaDO" }
]

migrations = [
  { tag = "v1", new_classes = ["QuotaDO"], new_sqlite_classes = ["QuotaDO"] }
]
EOF

# Criar worker.ts básico
cat > "${QUOTA_DIR}/src/worker.ts" <<'EOF'
// Quota Durable Object Worker
export interface Env {
  BILLING_DB: D1Database;
  PLANS: KVNamespace;
  QUOTA: DurableObjectNamespace;
}

export class QuotaDO {
  state: DurableObjectState;
  env: Env;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }
  
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    
    if (path === '/ping') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/usage' && req.method === 'POST') {
      const body = await req.json();
      const { tenant, resource_type, quantity } = body;
      
      // Registrar uso no D1
      const id = `${tenant}-${resource_type}-${Date.now()}`;
      const date = new Date().toISOString().split('T')[0];
      
      await this.env.BILLING_DB.prepare(
        `INSERT INTO usage_daily (id, tenant, resource_type, quantity, date)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(id, tenant, resource_type, quantity || 1, date).run();
      
      return new Response(JSON.stringify({ ok: true, id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    
    if (path === '/admin/quota/ping') {
      // Criar stub DO para ping
      const id = env.QUOTA.idFromName('default');
      const stub = env.QUOTA.get(id);
      return stub.fetch('https://do/ping');
    }
    
    return new Response('Not found', { status: 404 });
  }
};
EOF

# Criar package.json
cat > "${QUOTA_DIR}/package.json" <<EOF
{
  "name": "quota-do",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241106.0",
    "typescript": "^5.0.0",
    "wrangler": "^3.0.0"
  }
}
EOF

# Criar tsconfig.json
cat > "${QUOTA_DIR}/tsconfig.json" <<EOF
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
EOF

echo -e "   ${GREEN}✅ Estrutura criada${NC}"

echo ""

echo "5️⃣  Deploy do Worker"
echo "------------------"

cd "${QUOTA_DIR}"

if [ ! -d "node_modules" ]; then
  echo "   Instalando dependências..."
  npm install 2>&1 | tail -5
fi

echo "   Fazendo deploy..."
wrangler deploy 2>&1 | tail -10

echo ""

echo "✅✅✅ Billing Quota-DO Deployado!"
echo "================================="
echo ""
echo "📋 Proof of Done:"
echo ""
echo "1. Testar ping:"
echo "   curl -s https://api.ubl.agency/admin/quota/ping"
echo "   # Deve retornar: {\"ok\":true}"
echo ""
echo "2. Verificar usage_daily no D1:"
echo "   wrangler d1 execute $D1_DB_NAME --command='SELECT * FROM usage_daily LIMIT 5'"
echo ""
