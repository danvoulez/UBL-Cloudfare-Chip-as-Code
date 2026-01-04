#!/usr/bin/env bash
# P1 — Webhooks Worker (HMAC + DLQ)
# Deploy do Worker de webhooks com verificação HMAC e DLQ

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔗 P1 — Webhooks Worker (HMAC + DLQ)"
echo "===================================="
echo ""

# Carregar env
if [ -f "${PROJECT_ROOT}/env" ]; then
  set -a
  source "${PROJECT_ROOT}/env"
  set +a
fi

echo "1️⃣  Criar KV Namespace para segredos"
echo "-----------------------------------"

KV_NAMESPACE_ID=""
KV_LIST=$(wrangler kv namespace list 2>/dev/null || echo "[]")
if echo "$KV_LIST" | jq -e '.[] | select(.title == "WEBHOOK_SECRETS")' >/dev/null 2>&1; then
  echo -e "   ${GREEN}✅ WEBHOOK_SECRETS já existe${NC}"
  KV_NAMESPACE_ID=$(echo "$KV_LIST" | jq -r '.[] | select(.title == "WEBHOOK_SECRETS") | .id' | head -1)
else
  echo "   Criando WEBHOOK_SECRETS..."
  KV_OUTPUT=$(wrangler kv namespace create "WEBHOOK_SECRETS" 2>&1)
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

echo "2️⃣  Verificar R2 DLQ"
echo "-------------------"

R2_DLQ="ubl-dlq"
if wrangler r2 bucket list 2>/dev/null | grep -q "$R2_DLQ"; then
  echo -e "   ${GREEN}✅ R2 bucket $R2_DLQ existe${NC}"
else
  echo "   Criando R2 bucket $R2_DLQ..."
  wrangler r2 bucket create "$R2_DLQ" 2>&1 | head -5
  echo -e "   ${GREEN}✅ R2 bucket criado${NC}"
fi

echo ""

echo "3️⃣  Criar estrutura do Worker"
echo "----------------------------"

WEBHOOKS_DIR="${PROJECT_ROOT}/apps/webhooks-worker"
mkdir -p "${WEBHOOKS_DIR}/src"

# Criar wrangler.toml
cat > "${WEBHOOKS_DIR}/wrangler.toml" <<EOF
name = "webhooks-worker"
main = "src/worker.ts"
compatibility_date = "2024-11-07"

routes = [
  { pattern = "api.ubl.agency/webhooks/*", zone_id = "${CLOUDFLARE_ZONE_ID:-3aa18fa819ee4b6e393009916432a69f}" }
]

[[kv_namespaces]]
binding = "WEBHOOK_SECRETS"
id = "${KV_NAMESPACE_ID}"

[[r2_buckets]]
binding = "DLQ"
bucket_name = "${R2_DLQ}"
EOF

# Criar worker.ts básico
cat > "${WEBHOOKS_DIR}/src/worker.ts" <<'EOF'
// Webhooks Worker — HMAC verification + DLQ
export interface Env {
  WEBHOOK_SECRETS: KVNamespace;
  DLQ: R2Bucket;
}

async function verifyHMAC(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(body);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const computedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return computedSignature === signature.replace('sha256=', '');
}

async function sendToDLQ(env: Env, partner: string, eventId: string, body: string, reason: string): Promise<void> {
  const key = `webhooks/${partner}/${eventId}-${Date.now()}.json`;
  const payload = JSON.stringify({
    partner,
    event_id: eventId,
    body,
    reason,
    timestamp: new Date().toISOString()
  });
  
  await env.DLQ.put(key, payload, {
    httpMetadata: { contentType: 'application/json' }
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (pathParts.length < 2 || pathParts[0] !== 'webhooks') {
      return new Response('Not found', { status: 404 });
    }
    
    const partner = pathParts[1];
    const signature = req.headers.get('X-Signature') || req.headers.get('X-Hub-Signature-256') || '';
    
    if (!signature) {
      return new Response(JSON.stringify({ error: 'missing_signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Buscar secret do parceiro
    const secretKey = `webhook:partner:${partner}:key:default`;
    const secret = await env.WEBHOOK_SECRETS.get(secretKey);
    
    if (!secret) {
      return new Response(JSON.stringify({ error: 'partner_not_configured' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Ler body
    const body = await req.text();
    
    // Verificar HMAC
    const isValid = await verifyHMAC(body, signature, secret);
    
    if (!isValid) {
      const eventId = req.headers.get('X-GitHub-Delivery') || 
                     req.headers.get('X-Event-ID') || 
                     `unknown-${Date.now()}`;
      
      // Enviar para DLQ
      ctx.waitUntil(sendToDLQ(env, partner, eventId, body, 'invalid_signature'));
      
      return new Response(JSON.stringify({ error: 'invalid_signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Dedupe por event_id
    const eventId = req.headers.get('X-GitHub-Delivery') || 
                   req.headers.get('X-Event-ID') || 
                   `gen-${Date.now()}`;
    
    const dedupeKey = `webhook:dedupe:${partner}:${eventId}`;
    const existing = await env.WEBHOOK_SECRETS.get(dedupeKey);
    
    if (existing) {
      return new Response(JSON.stringify({ ok: true, cached: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Marcar como processado (TTL 24h)
    await env.WEBHOOK_SECRETS.put(dedupeKey, 'processed', { expirationTtl: 86400 });
    
    // Processar webhook (stub)
    try {
      // TODO: Processar webhook real aqui
      return new Response(JSON.stringify({ ok: true, event_id: eventId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      // Em caso de erro, enviar para DLQ
      ctx.waitUntil(sendToDLQ(env, partner, eventId, body, `error: ${e}`));
      
      return new Response(JSON.stringify({ error: 'processing_failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
EOF

# Criar package.json
cat > "${WEBHOOKS_DIR}/package.json" <<EOF
{
  "name": "webhooks-worker",
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
cat > "${WEBHOOKS_DIR}/tsconfig.json" <<EOF
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

echo "4️⃣  Configurar secret de exemplo"
echo "-------------------------------"

SECRET_KEY="webhook:partner:github:key:default"
SECRET_VALUE="test_hmac_secret_key_12345"

echo "$SECRET_VALUE" | wrangler kv key put "$SECRET_KEY" \
  --namespace-id="$KV_NAMESPACE_ID" \
  --binding=WEBHOOK_SECRETS 2>&1 | head -3

echo -e "   ${GREEN}✅ Secret configurado${NC}"

echo ""

echo "5️⃣  Deploy do Worker"
echo "------------------"

cd "${WEBHOOKS_DIR}"

if [ ! -d "node_modules" ]; then
  echo "   Instalando dependências..."
  npm install 2>&1 | tail -5
fi

echo "   Fazendo deploy..."
wrangler deploy 2>&1 | tail -10

echo ""

echo "✅✅✅ Webhooks Worker Deployado!"
echo "================================="
echo ""
echo "📋 Proof of Done:"
echo ""
echo "1. Testar webhook válido (com HMAC correto):"
echo "   # Calcular HMAC SHA256"
echo "   echo -n '{}' | openssl dgst -sha256 -hmac 'test_hmac_secret_key_12345' | cut -d' ' -f2"
echo "   # Usar no header X-Signature"
echo ""
echo "2. Testar webhook inválido:"
echo "   curl -s -X POST https://api.ubl.agency/webhooks/github \\"
echo "     -H 'X-Signature: invalid' \\"
echo "     -d '{}'"
echo "   # Deve retornar 401"
echo ""
echo "3. Verificar DLQ:"
echo "   wrangler r2 object list ubl-dlq --prefix webhooks/"
echo ""
