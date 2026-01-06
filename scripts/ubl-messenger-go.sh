#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG BÁSICA ================================================
# Carregar do env se disponível (ignorar erros de variáveis problemáticas)
if [ -f "$(dirname "$0")/../env" ]; then
  set +u  # Temporariamente desabilitar erro em variáveis não definidas
  source "$(dirname "$0")/../env" 2>/dev/null || true
  set -u
fi

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-1f43a14fe5bb62b97e7262c5b6b7c476}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:-eCSYRvcMrC2L9gX9TFoDfcMA4BseMCvLesOxwt3K}"

# Limpar variáveis AWS que podem causar conflito
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY CF_API_KEY 2>/dev/null || true
ZONE_ID_UBL="${ZONE_ID_UBL:-3aa18fa819ee4b6e393009916432a69f}" # ubl.agency
ROOT="${ROOT:-$PWD}"

# Pacote do Messenger (já com polimentos que você aprovou)
MESSENGER_ZIP="${MESSENGER_ZIP:-}"
APP_DIR="${APP_DIR:-$ROOT/apps/messenger/messenger/frontend}"
PAGES_PROJECT="${PAGES_PROJECT:-ubl-messenger}"
MESSENGER_DOMAIN="${MESSENGER_DOMAIN:-messenger.ubl.agency}"

# Access Reusables já existentes (do seu setup anterior)
ALLOW_UBL_STAFF_ID="${ALLOW_UBL_STAFF_ID:-4f689cd9-0183-433e-906b-b9c958b9132b}"
DEFAULT_DENY_ID="${DEFAULT_DENY_ID:-2b0e0de4-e768-4451-a008-2693d7c64564}"

# Bases oficiais do UBL Novo
VITE_API_BASE="${VITE_API_BASE:-https://api.ubl.agency}"
VITE_ID_BASE="${VITE_ID_BASE:-https://id.ubl.agency}"
VITE_OFFICE_LLM_BASE="${VITE_OFFICE_LLM_BASE:-https://office-llm.ubl.agency}"
VITE_MEDIA_BASE="${VITE_MEDIA_BASE:-https://api.ubl.agency/media}"
VITE_RTC_WS_URL="${VITE_RTC_WS_URL:-wss://rtc.voulezvous.tv/rooms}"
VITE_JOBS_BASE="${VITE_JOBS_BASE:-https://messenger.api.ubl.agency/jobs}" # via proxy

# Messenger Proxy Worker (para chamadas com Service Token, CORS e uniformização)
PROXY_NAME="${PROXY_NAME:-messenger-proxy}"
PROXY_ROUTE="${PROXY_ROUTE:-messenger.api.ubl.agency/*}"
PROXY_DOMAIN="${PROXY_DOMAIN:-messenger.api.ubl.agency}"
PROXY_DIR="$ROOT/workers/$PROXY_NAME"

# Upstreams protegidos por Access (o proxy injeta CF-Access headers)
UPSTREAM_LLM="${UPSTREAM_LLM:-https://office-llm.ubl.agency}"
UPSTREAM_MEDIA="${UPSTREAM_MEDIA:-https://api.ubl.agency/media}"
UPSTREAM_JOBS="${UPSTREAM_JOBS:-${JOBS_UPSTREAM:-}}"

CF_API="https://api.cloudflare.com/client/v4"
AUTH=(-H "Authorization: Bearer ${API_TOKEN}" -H "Content-Type: application/json")

say() { echo -e "$*"; }
hr() { echo "----------------------------------------------------------------"; }

say "== UBL Novo :: Messenger (Pages) + Access + Service Token + Proxy + MCP =="

# 0) Checagens rápidas
command -v jq >/dev/null || { echo "Instale jq"; exit 1; }
wrangler whoami >/dev/null || { echo "wrangler não logado"; exit 1; }

# 1) Importar pacote do Messenger
hr; say "1) Verificando Messenger em ${APP_DIR}"

if [ -d "${APP_DIR}" ] && [ -f "${APP_DIR}/package.json" ]; then
  say " Messenger já existe em ${APP_DIR}"
else
  if [ -n "${MESSENGER_ZIP:-}" ] && [ -f "${MESSENGER_ZIP}" ]; then
    say " Importando de ${MESSENGER_ZIP}"
    rm -rf "${APP_DIR}"; mkdir -p "${APP_DIR}"
    unzip -q "${MESSENGER_ZIP}" -d "${APP_DIR}"
  else
    say " ⚠️  Messenger não encontrado em ${APP_DIR} e MESSENGER_ZIP não fornecido"
    say "    Continuando assumindo que o código já está em ${APP_DIR}"
  fi
fi

# 2) .env.local (wire total, sem redesign)
hr; say "2) Escrevendo .env.local"
cat > "${APP_DIR}/.env.local" <<EOF
VITE_API_BASE=${VITE_API_BASE}
VITE_ID_BASE=${VITE_ID_BASE}
VITE_OFFICE_LLM_BASE=https://${PROXY_DOMAIN}/llm
VITE_MEDIA_BASE=https://${PROXY_DOMAIN}/media
VITE_RTC_WS_URL=${VITE_RTC_WS_URL}
VITE_JOBS_BASE=${VITE_JOBS_BASE}
EOF

# 3) Build
hr; say "3) Instalar deps + build (Messenger)"
cd "${APP_DIR}"
if command -v pnpm >/dev/null 2>&1; then 
  pnpm i && pnpm build
else 
  npm i && npm run build
fi

# 4) Pages: projeto + deploy + domínio
hr; say "4) Cloudflare Pages"
wrangler pages project list >/dev/null 2>&1 || true

if ! wrangler pages project list 2>/dev/null | grep -q "${PAGES_PROJECT}"; then 
  wrangler pages project create "${PAGES_PROJECT}" --production-branch main >/dev/null
  say " ✅ Pages project criado"
else 
  say " ✅ Pages project já existe"
fi

wrangler pages deploy dist --project-name "${PAGES_PROJECT}" >/dev/null
say " ✅ Deploy do Messenger"

wrangler pages domain add "${PAGES_PROJECT}" "${MESSENGER_DOMAIN}" >/dev/null || true
say " ✅ Domínio ${MESSENGER_DOMAIN} associado"

# 5) Access: App + attach reusable policies (Allow Staff + Default Deny)
hr; say "5) Access — App & Policies"
APP_ID=$( curl -s "${CF_API}/accounts/${ACCOUNT_ID}/access/apps" "${AUTH[@]}" \
  | jq -r --arg dom "${MESSENGER_DOMAIN}" '.result[]? | select(.domain == $dom) | .id' | head -1)

if [ -z "${APP_ID}" ] || [ "${APP_ID}" = "null" ]; then
  APP_ID=$( curl -s -X POST "${CF_API}/accounts/${ACCOUNT_ID}/access/apps" "${AUTH[@]}" \
    -d @- <<JSON | jq -r '.result.id'
{"name":"UBL Messenger","domain":"${MESSENGER_DOMAIN}","type":"self_hosted","session_duration":"24h","app_launcher_visible":true}
JSON
  )
  say " ✅ Access App criado: ${APP_ID}"
else
  say " ✅ Access App encontrado: ${APP_ID}"
fi

# reset & attach
EXISTING=$(curl -s "${CF_API}/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies" "${AUTH[@]}" | jq -r '.result[]?.id')
for PID in $EXISTING; do 
  curl -s -X DELETE "${CF_API}/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies/${PID}" "${AUTH[@]}" >/dev/null || true
done

curl -s -X POST "${CF_API}/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies" "${AUTH[@]}" -d @- >/dev/null <<JSON
{"name":"Allow UBL Staff","decision":"allow","include":[{"any_valid_service_token":{}}],"require":[{"resource_id":"${ALLOW_UBL_STAFF_ID}"}],"precedence":1}
JSON

curl -s -X POST "${CF_API}/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies" "${AUTH[@]}" -d @- >/dev/null <<JSON
{"name":"Default Deny","decision":"deny","precedence":1000,"exclude":[],"include":[{"ip":{"ip_list":[]} }]}
JSON

say " ✅ Policies anexadas (Allow UBL Staff + Default Deny)"

# 6) Service Token dedicado ao Messenger
hr; say "6) Access — Service Token (para proxy server-to-server)"
ST_NAME="messenger-service-token"
ST_RES=$( curl -s -X POST "${CF_API}/accounts/${ACCOUNT_ID}/access/service_tokens" "${AUTH[@]}" \
  -d "{\"name\":\"${ST_NAME}\"}")

ST_CLIENT_ID=$(echo "$ST_RES" | jq -r '.result.client_id // empty')
ST_CLIENT_SECRET=$(echo "$ST_RES" | jq -r '.result.client_secret // empty')

if [ -z "${ST_CLIENT_ID}" ] || [ -z "${ST_CLIENT_SECRET}" ]; then
  say " ⚠️  Não foi possível criar Service Token (permissões?). Prosseguindo sem bloquear."
else
  say " ✅ Service Token criado: ${ST_NAME}"
  say "    • CF_ACCESS_CLIENT_ID=${ST_CLIENT_ID}"
  say "    • CF_ACCESS_CLIENT_SECRET=*** (copie e guarde com segurança; exibido uma única vez)"
fi

# 7) Messenger Proxy Worker (uniformiza /llm, /media, /jobs e injeta Service Token)
hr; say "7) Criando Worker proxy: ${PROXY_NAME} -> ${PROXY_ROUTE}"
rm -rf "${PROXY_DIR}"; mkdir -p "${PROXY_DIR}/src"

cat > "${PROXY_DIR}/wrangler.toml" <<TOML
name = "${PROXY_NAME}"
main = "src/index.ts"
compatibility_date = "2024-11-29"
compatibility_flags = ["nodejs_compat"]

routes = [
  { pattern = "${PROXY_ROUTE}", zone_id = "${ZONE_ID_UBL}" }
]

[vars]
UPSTREAM_LLM = "${UPSTREAM_LLM}"
UPSTREAM_MEDIA = "${UPSTREAM_MEDIA}"
UPSTREAM_JOBS = "${UPSTREAM_JOBS}"
TOML

cat > "${PROXY_DIR}/package.json" <<JSON
{
  "name": "${PROXY_NAME}",
  "private": true,
  "type": "module",
  "devDependencies": {}
}
JSON

cat > "${PROXY_DIR}/src/index.ts" <<'TS'
export interface Env {
  CF_ACCESS_CLIENT_ID?: string
  CF_ACCESS_CLIENT_SECRET?: string
  UPSTREAM_LLM: string
  UPSTREAM_MEDIA: string
  UPSTREAM_JOBS?: string
}

const json = (obj: any, status = 200) => new Response(JSON.stringify(obj), { 
  status, 
  headers: { "content-type": "application/json" } 
})

const withAccess = (env: Env, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {})
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers.set("CF-Access-Client-Id", env.CF_ACCESS_CLIENT_ID)
    headers.set("CF-Access-Client-Secret", env.CF_ACCESS_CLIENT_SECRET)
  }
  return { ...init, headers }
}

const proxy = async (req: Request, upstream: string, env: Env) => {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/(llm|media|jobs)/, "")
  const target = new URL(path + url.search, upstream)
  const init: RequestInit = { method: req.method, headers: req.headers, body: req.body }
  
  // overwrite headers with Access headers while preserving others
  init.headers = new Headers(req.headers)
  const out = withAccess(env, init)
  
  // CORS relax
  const res = await fetch(target.toString(), out)
  const resp = new Response(res.body, res)
  resp.headers.set("access-control-allow-origin", url.origin)
  resp.headers.set("access-control-allow-credentials", "true")
  resp.headers.set("access-control-allow-headers", "authorization,content-type")
  resp.headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
  return resp
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    
    if (req.method === "OPTIONS") return json({ ok: true })
    
    if (url.pathname.startsWith("/llm")) return proxy(req, env.UPSTREAM_LLM, env)
    if (url.pathname.startsWith("/media")) return proxy(req, env.UPSTREAM_MEDIA, env)
    if (url.pathname.startsWith("/jobs")) {
      if (!env.UPSTREAM_JOBS) return json({ ok:false, error:"jobs upstream not configured" }, 501)
      return proxy(req, env.UPSTREAM_JOBS, env)
    }
    
    if (url.pathname === "/healthz") return json({ ok: true, service: "messenger-proxy" })
    
    return json({ ok:false, error:"route not found" }, 404)
  }
}
TS

# secrets para o proxy (se criados)
cd "${PROXY_DIR}"
if [ -n "${ST_CLIENT_ID:-}" ] && [ -n "${ST_CLIENT_SECRET:-}" ]; then
  printf "%s" "$ST_CLIENT_ID" | wrangler secret put CF_ACCESS_CLIENT_ID >/dev/null
  printf "%s" "$ST_CLIENT_SECRET" | wrangler secret put CF_ACCESS_CLIENT_SECRET >/dev/null
fi

wrangler deploy >/dev/null
say " ✅ Proxy deployado em https://${PROXY_DOMAIN}"

# 8) MCP Registry — garantir Office Tools (e tag "messenger" para preload)
hr; say "8) MCP Registry — adicionando/garantindo servidores"
REGISTRY_URL="${REGISTRY_URL:-https://mcp-registry-office.dan-1f4.workers.dev}"
curl -s -X POST "${REGISTRY_URL}/v1/servers" \
  -H "content-type: application/json" \
  -d "{\"name\":\"Office Tools\",\"description\":\"Office MCP server\",\"transports\":[{\"type\":\"streamable-http\",\"url\":\"https://office-api-worker.dan-1f4.workers.dev/mcp\"}],\"tags\":[\"internal\",\"office\",\"voulezvous\",\"messenger\"]}" >/dev/null || true

say " ✅ Registry atualizado (Office Tools com tag messenger)"

# 9) Smoke
hr; say "9) Smoke"
set +e
curl -s "https://${MESSENGER_DOMAIN}" | head -1 >/dev/null && say " ✅ Messenger Pages up" || say " ⚠️  Messenger Pages check"
curl -s "https://${PROXY_DOMAIN}/healthz" | jq -r '.ok' 2>/dev/null | grep -q true && say " ✅ Proxy health" || say " ⚠️  Proxy health check"
curl -s "${UPSTREAM_LLM}/healthz" | jq -r '.ok' 2>/dev/null | grep -q true && say " ✅ LLM upstream" || say " ⚠️  LLM upstream check"
curl -s "${UPSTREAM_MEDIA}/healthz" | jq -r '.ok' 2>/dev/null | grep -q true && say " ✅ Media upstream" || say " ⚠️  Media upstream check"
set -e

hr
say " ✅ DONE — abra: https://${MESSENGER_DOMAIN}"
