#!/usr/bin/env bash
set -euo pipefail

### === CONFIG RÁPIDA ===
CF_API_BASE="https://api.cloudflare.com/client/v4"

# Carregar account_id e token do env se disponível
if [ -f "$(dirname "$0")/../env" ]; then
  source "$(dirname "$0")/../env"
  ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
  CF_API_TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
fi

# Validar token
: "${CF_API_TOKEN:?export CF_API_TOKEN=... ou configure CLOUDFLARE_API_TOKEN no env}"

# Descobrir account_id se não veio do env
if [ -z "${ACCOUNT_ID:-}" ]; then
  ACCOUNT_ID=""
fi

# domínios/apps a proteger
APP_ID_HOST="id.ubl.agency"
APP_LLM_HOST="office-llm.ubl.agency"

# emails/domínios/grupos (ajuste às suas realidades)
STAFF_EMAIL_DOMAIN="ubl.agency"
PARTNER_GROUP_NAME="Partners"
ADMINS_GROUP_NAME="ubl-ops"  # Grupo padrão do UBL Flagship

# nomes das reusable policies
POL_ALLOW_STAFF="Allow UBL Staff"
POL_ALLOW_PARTNERS="Allow Partners"
POL_ALLOW_SERVICE_TOKENS="Allow Any Service Token"
POL_ALLOW_ADMINS="Allow Admins"
POL_DENY_ALL="Default Deny"

hdr(){ echo -e "\n\033[1m$*\033[0m"; }

j(){ jq -r "$1"; }

cf() { curl -sS -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$@"; }

### 0) descobrir ACCOUNT_ID (se não veio do env)
if [ -z "$ACCOUNT_ID" ]; then
  hdr "0) Descobrindo account_id"
  ACCOUNT_ID="$(cf "$CF_API_BASE/accounts" | jq -r '.result[0].id')"
  echo "ACCOUNT_ID=$ACCOUNT_ID"
  [ -n "$ACCOUNT_ID" ] || { echo "Falha ao obter account_id"; exit 1; }
else
  hdr "0) Usando ACCOUNT_ID do env"
  echo "ACCOUNT_ID=$ACCOUNT_ID"
fi

### 1) resolver Access Groups (IDs) p/ Admins/Partners (se existirem)
hdr "1) Buscando Access Groups"
GROUPS_JSON="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/groups")"
# Verificar se há resultado válido
if echo "$GROUPS_JSON" | jq -e '.result' >/dev/null 2>&1; then
  ADMINS_GROUP_ID="$(echo "$GROUPS_JSON" | jq -r --arg n "$ADMINS_GROUP_NAME" '.result[]? | select(.name==$n) | .id' | head -1)"
  PARTNER_GROUP_ID="$(echo "$GROUPS_JSON" | jq -r --arg n "$PARTNER_GROUP_NAME" '.result[]? | select(.name==$n) | .id' | head -1)"
else
  ADMINS_GROUP_ID=""
  PARTNER_GROUP_ID=""
fi
echo "ADMINS_GROUP_ID=${ADMINS_GROUP_ID:-<não encontrado>}"
echo "PARTNER_GROUP_ID=${PARTNER_GROUP_ID:-<não encontrado>}"

### 2) (opcional) criar Service Token p/ S2S e reusar seu client_id
hdr "2) Criando/Validando Access Service Token (S2S)"
ST_NAME="office-internal-s2s"
# tenta achar por nome
ST_JSON="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/service_tokens")"
if echo "$ST_JSON" | jq -e '.result' >/dev/null 2>&1; then
  EXISTING_ST_ID="$(echo "$ST_JSON" | jq -r --arg n "$ST_NAME" '.result[]? | select(.name==$n) | .id' | head -1)"
else
  EXISTING_ST_ID=""
fi
if [ -z "${EXISTING_ST_ID:-}" ]; then
  ST_CREATE_RES="$(cf -X POST "$CF_API_BASE/accounts/$ACCOUNT_ID/access/service_tokens" \
    --data "{\"name\":\"$ST_NAME\",\"duration\":\"8760h\"}")" # 1 ano
  ST_ID="$(echo "$ST_CREATE_RES" | j '.result.id')"
  ST_CLIENT_ID="$(echo "$ST_CREATE_RES" | j '.result.client_id')"
  ST_CLIENT_SECRET="$(echo "$ST_CREATE_RES" | j '.result.client_secret')"
  echo "✅ Service Token criado:"
  echo "SERVICE_TOKEN_ID=$ST_ID"
  echo "SERVICE_TOKEN_CLIENT_ID=$ST_CLIENT_ID"
  echo "SERVICE_TOKEN_CLIENT_SECRET=$ST_CLIENT_SECRET"
  echo ""
  echo "⚠️  IMPORTANTE: Salve o CLIENT_SECRET agora (não será mostrado novamente):"
  echo "   export SERVICE_TOKEN_CLIENT_SECRET='$ST_CLIENT_SECRET'"
else
  echo "✅ Service Token já existe: $EXISTING_ST_ID"
fi
# pegue o client_id real (relist)
ST_RELIST="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/service_tokens")"
if echo "$ST_RELIST" | jq -e '.result' >/dev/null 2>&1; then
  SERVICE_TOKEN_CLIENT_ID="$(echo "$ST_RELIST" | jq -r --arg n "$ST_NAME" '.result[]? | select(.name==$n) | .client_id' | head -1)"
else
  SERVICE_TOKEN_CLIENT_ID=""
fi
echo "SERVICE_TOKEN_CLIENT_ID=$SERVICE_TOKEN_CLIENT_ID"

### 3) criar REUSABLE POLICIES
hdr "3) Criando reusable policies"

create_policy() {
  local NAME="$1" DECISION="$2" INCLUDE_JSON="$3" REQUIRE_JSON="$4" EXCLUDE_JSON="$5"
  # Verificar se já existe
  local EXIST_ID; EXIST_ID="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/policies" \
    | jq -r --arg n "$NAME" '.result[] | select(.name==$n and (.reusable // false)==true) | .id' | head -1)"
  if [ -n "$EXIST_ID" ]; then
    echo "$EXIST_ID"
    return
  fi
  
  local PAYLOAD=$(jq -n \
    --arg name "$NAME" --arg decision "$DECISION" \
    --argjson include "$INCLUDE_JSON" \
    --argjson require "$REQUIRE_JSON" \
    --argjson exclude "$EXCLUDE_JSON" '
    {
      name: $name,
      decision: $decision,          # "allow" | "deny"
      reusable: true,               # <- chave p/ reusable policy
      include: $include,            # regras que entram
      require: $require,            # pré-condições
      exclude: $exclude             # exceções
    }')
  cf -X POST "$CF_API_BASE/accounts/$ACCOUNT_ID/access/policies" --data "$PAYLOAD" | jq -r '.result.id'
}

# Helpers de regra (cada item é um objeto com o tipo)
rule_email_domain() { jq -n --arg d "$1" '{email_domain:{domain:$d}}'; }
rule_group()        { jq -n --arg id "$1" '{group:{id:$id}}'; }
rule_service_any()  { jq -n '{any_valid_service_token:{}}'; }
rule_service_id()   { jq -n --arg id "$1" '{service_token:{identity_provider_id:$id}}'; } # quando aplicável
rule_everyone()     { jq -n '{everyone:{}}'; }

# Montagem dos arrays
INCLUDE_STAFF="$(jq -s '.' < <(rule_email_domain "$STAFF_EMAIL_DOMAIN"))"
INCLUDE_PARTNERS="$( [ -n "${PARTNER_GROUP_ID:-}" ] && jq -s '.' < <(rule_group "$PARTNER_GROUP_ID") || jq -n '[]' )"
INCLUDE_ADMINS="$( [ -n "${ADMINS_GROUP_ID:-}" ] && jq -s '.' < <(rule_group "$ADMINS_GROUP_ID") || jq -n '[]' )"
INCLUDE_SERVICE_ANY="$(jq -s '.' < <(rule_service_any))"
EVERYONE_ARR="$(jq -s '.' < <(rule_everyone))"

REQ_EMPTY='[]'
EXC_EMPTY='[]'

POL_ALLOW_STAFF_ID="$(create_policy "$POL_ALLOW_STAFF" "allow" "$INCLUDE_STAFF" "$REQ_EMPTY" "$EXC_EMPTY")"
POL_ALLOW_PARTNERS_ID="$(create_policy "$POL_ALLOW_PARTNERS" "allow" "$INCLUDE_PARTNERS" "$REQ_EMPTY" "$EXC_EMPTY")"
POL_ALLOW_SERVICE_TOKENS_ID="$(create_policy "$POL_ALLOW_SERVICE_TOKENS" "allow" "$INCLUDE_SERVICE_ANY" "$REQ_EMPTY" "$EXC_EMPTY")"
POL_ALLOW_ADMINS_ID="$(create_policy "$POL_ALLOW_ADMINS" "allow" "$INCLUDE_ADMINS" "$REQ_EMPTY" "$EXC_EMPTY")"
POL_DENY_ALL_ID="$(create_policy "$POL_DENY_ALL" "deny" "$EVERYONE_ARR" "$REQ_EMPTY" "$EXC_EMPTY")"

echo "✅ Policies criadas/recuperadas:"
printf " - %s = %s\n" "$POL_ALLOW_STAFF" "$POL_ALLOW_STAFF_ID"
printf " - %s = %s\n" "$POL_ALLOW_PARTNERS" "$POL_ALLOW_PARTNERS_ID"
printf " - %s = %s\n" "$POL_ALLOW_SERVICE_TOKENS" "$POL_ALLOW_SERVICE_TOKENS_ID"
printf " - %s = %s\n" "$POL_ALLOW_ADMINS" "$POL_ALLOW_ADMINS_ID"
printf " - %s = %s\n" "$POL_DENY_ALL" "$POL_DENY_ALL_ID"

### 4) criar/atualizar APPS e anexar reusable policies (por ID)
hdr "4) Criando/atualizando apps e anexando reusable policies"

create_or_get_app() {
  local NAME="$1" DOMAIN="$2"
  local APPS_JSON; APPS_JSON="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps")"
  local EXIST_ID=""
  if echo "$APPS_JSON" | jq -e '.result' >/dev/null 2>&1; then
    EXIST_ID="$(echo "$APPS_JSON" | jq -r --arg n "$NAME" '.result[]? | select(.name==$n) | .id' | head -1)"
  fi
  if [ -n "$EXIST_ID" ]; then
    echo "$EXIST_ID"
  else
    cf -X POST "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps" --data "$(
      jq -n --arg name "$NAME" --arg dom "$DOMAIN" '{
        name: $name,
        domain: $dom,
        type: "self_hosted",
        session_duration: "24h"
      }'
    )" | jq -r '.result.id'
  fi
}

attach_policies_to_app() {
  local APP_ID="$1"; shift
  # Filtrar IDs válidos (não null)
  local POL_IDS=()
  for pol_id in "$@"; do
    if [ -n "$pol_id" ] && [ "$pol_id" != "null" ]; then
      POL_IDS+=("$pol_id")
    fi
  done
  
  if [ ${#POL_IDS[@]} -eq 0 ]; then
    echo "   ⚠️  Nenhuma policy válida para anexar"
    return
  fi
  
  # a maneira suportada é enviar a app com a lista de policies referenciando IDs reutilizáveis
  local POL_IDS_JSON; POL_IDS_JSON="$(printf '%s\n' "${POL_IDS[@]}" | jq -R . | jq -s 'map({id:.})')"
  local APP_CURR; APP_CURR="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps/$APP_ID" )"

  local BODY="$(echo "$APP_CURR" | jq -r '.result
    | {name, domain, type, session_duration, policies: []}')"  # zera políticas explícitas
  BODY="$(echo "$BODY" | jq --argjson pol "$POL_IDS_JSON" '.policies=$pol')"

  cf -X PUT "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps/$APP_ID" --data "$BODY" >/dev/null
}

APP_IDP_ID="$(create_or_get_app "UBL Identity" "$APP_ID_HOST")"
attach_policies_to_app "$APP_IDP_ID" \
  "$POL_ALLOW_ADMINS_ID" "$POL_ALLOW_STAFF_ID" "$POL_DENY_ALL_ID"

APP_LLM_ID="$(create_or_get_app "Office LLM Router" "$APP_LLM_HOST")"
attach_policies_to_app "$APP_LLM_ID" \
  "$POL_ALLOW_SERVICE_TOKENS_ID" "$POL_ALLOW_STAFF_ID" "$POL_DENY_ALL_ID"

echo "✅ Apps configurados:"
printf " - UBL Identity = %s (%s)\n" "$APP_IDP_ID" "$APP_ID_HOST"
printf " - Office LLM Router = %s (%s)\n" "$APP_LLM_ID" "$APP_LLM_HOST"

### 5) Proof-of-Done — listar policies reutilizáveis + apps com policies
hdr "5) Proof-of-Done"

echo "- Reusable Policies:"
cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/policies" \
  | jq -r '.result[] | select(.reusable == true) | "\(.id)\t\(.name)\tdecision=\(.decision)"' \
  | sort

echo -e "\n- Apps (nome → policies):"
cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps" \
 | jq -r '.result[] | select(.domain == "'"$APP_ID_HOST"'" or .domain == "'"$APP_LLM_HOST"'") | "\(.name)\t\(.domain)\tpolicies=" + ( (.policies // []) | map(.id) | join(","))'

echo -e "\n✅ Setup completo!"
echo ""
echo "📝 Próximos passos:"
echo "   1. Salvar SERVICE_TOKEN_CLIENT_SECRET no env (se criado)"
echo "   2. Testar acesso aos apps protegidos"
echo "   3. Usar Service Token para S2S (se necessário)"
