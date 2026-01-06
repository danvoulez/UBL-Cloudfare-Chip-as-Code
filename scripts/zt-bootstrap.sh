#!/usr/bin/env bash
# Zero Trust Bootstrap — Fechar gaps e provar em runtime
# Cria Groups, Service Token, reanexa policies e faz proof-of-done

set -euo pipefail

### === CONFIG ===
CF_API_BASE="https://api.cloudflare.com/client/v4"

# Carregar do env se disponível
if [ -f "$(dirname "$0")/../env" ]; then
  source "$(dirname "$0")/../env"
  ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
  CF_API_TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
fi

# Validar token
: "${CF_API_TOKEN:?export CF_API_TOKEN=... ou configure CLOUDFLARE_API_TOKEN no env}"

# Descobrir account_id se não veio do env
if [ -z "${ACCOUNT_ID:-}" ]; then
  ACCOUNT_ID="$(curl -sS -H "Authorization: Bearer $CF_API_TOKEN" "$CF_API_BASE/accounts" | jq -r '.result[0].id')"
fi

# Configurações
EMAIL_DOMAIN="ubl.agency"
ADMINS_GROUP_NAME="Admins"
PARTNERS_GROUP_NAME="Partners"
ST_NAME="office-internal-s2s"

# Apps
APP_IDP_NAME="UBL Identity"
APP_IDP_DOMAIN="id.ubl.agency"
APP_LLM_NAME="Office LLM Router"
APP_LLM_DOMAIN="office-llm.ubl.agency"

hdr(){ echo -e "\n\033[1m$*\033[0m"; }

cf(){ curl -sS -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$@"; }

### 1) Criar/ajustar Groups via API
hdr "1) Criando/ajustando Access Groups"

create_group_if_missing() {
  local NAME="$1" INCLUDE_JSON="$2"
  local GROUPS_JSON; GROUPS_JSON="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/groups")"
  local EXIST_ID=""
  
  if echo "$GROUPS_JSON" | jq -e '.result' >/dev/null 2>&1; then
    EXIST_ID="$(echo "$GROUPS_JSON" | jq -r --arg n "$NAME" '.result//[] | map(select(.name==$n)) | .[0].id // empty')"
  fi
  
  if [ -n "${EXIST_ID:-}" ] && [ "${EXIST_ID}" != "null" ]; then
    echo "$EXIST_ID"
  else
    cf -X POST "$CF_API_BASE/accounts/$ACCOUNT_ID/access/groups" \
      --data "$(jq -n --arg name "$NAME" --argjson include "$INCLUDE_JSON" '{name:$name, include:$include}')" \
      | jq -r '.result.id'
  fi
}

# Critérios de inclusão
INCLUDE_ADMIN="$(jq -n --arg d "$EMAIL_DOMAIN" '[{"email_domain":{"domain":$d}}]')"
INCLUDE_PARTNERS="$(jq -n '[{"email_domain":{"domain":"ubl.agency"}}]')"  # Ajuste conforme necessário

ADMINS_GROUP_ID="$(create_group_if_missing "$ADMINS_GROUP_NAME" "$INCLUDE_ADMIN")"
PARTNERS_GROUP_ID="$(create_group_if_missing "$PARTNERS_GROUP_NAME" "$INCLUDE_PARTNERS")"

echo "✅ Admins Group:   ${ADMINS_GROUP_ID}"
echo "✅ Partners Group: ${PARTNERS_GROUP_ID}"

### 2) Service Token para S2S
hdr "2) Criando/validando Access Service Token (S2S)"

ST_JSON="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/service_tokens")"
EXIST=""
if echo "$ST_JSON" | jq -e '.result' >/dev/null 2>&1; then
  EXIST="$(echo "$ST_JSON" | jq -r --arg n "$ST_NAME" '.result//[] | map(select(.name==$n)) | .[0].id // empty')"
fi

if [ -z "${EXIST:-}" ] || [ "$EXIST" = "null" ]; then
  RES="$(cf -X POST "$CF_API_BASE/accounts/$ACCOUNT_ID/access/service_tokens" \
    --data "{\"name\":\"$ST_NAME\",\"duration\":\"8760h\"}")"
  ST_ID="$(echo "$RES" | jq -r '.result.id')"
  ST_CLIENT_ID="$(echo "$RES" | jq -r '.result.client_id')"
  ST_CLIENT_SECRET="$(echo "$RES" | jq -r '.result.client_secret')"
  echo "✅ Service Token criado:"
  echo "SERVICE_TOKEN_ID=$ST_ID"
  echo "CF_ACCESS_CLIENT_ID=$ST_CLIENT_ID"
  echo "CF_ACCESS_CLIENT_SECRET=$ST_CLIENT_SECRET"
  echo ""
  echo "⚠️  IMPORTANTE: Salve o CLIENT_SECRET agora (não será mostrado novamente):"
  echo "   export CF_ACCESS_CLIENT_ID='$ST_CLIENT_ID'"
  echo "   export CF_ACCESS_CLIENT_SECRET='$ST_CLIENT_SECRET'"
else
  echo "✅ Service Token já existe: $EXIST"
  ST_RELIST="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/service_tokens")"
  ST_CLIENT_ID="$(echo "$ST_RELIST" | jq -r --arg n "$ST_NAME" '.result[]? | select(.name==$n) | .client_id' | head -1)"
  echo "CF_ACCESS_CLIENT_ID=$ST_CLIENT_ID"
  echo "⚠️  Observação: o client_secret não é retornado depois — se perdeu, crie um novo token."
fi

### 3) Recriar policies com Groups (se necessário)
hdr "3) Verificando/criando reusable policies com Groups"

get_pol_id() {
  cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/policies" \
    | jq -r --arg n "$1" '.result//[] | map(select(.name==$n and (.reusable // false)==true)) | .[0].id // empty'
}

create_policy() {
  local NAME="$1" DECISION="$2" INCLUDE_JSON="$3" REQUIRE_JSON="$4" EXCLUDE_JSON="$5"
  local EXIST_ID; EXIST_ID="$(get_pol_id "$NAME")"
  
  if [ -n "$EXIST_ID" ] && [ "$EXIST_ID" != "null" ]; then
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
      decision: $decision,
      reusable: true,
      include: $include,
      require: $require,
      exclude: $exclude
    }')
  cf -X POST "$CF_API_BASE/accounts/$ACCOUNT_ID/access/policies" --data "$PAYLOAD" | jq -r '.result.id'
}

rule_email_domain() { jq -n --arg d "$1" '{email_domain:{domain:$d}}'; }
rule_group() { jq -n --arg id "$1" '{group:{id:$id}}'; }
rule_service_any() { jq -n '{any_valid_service_token:{}}'; }
rule_everyone() { jq -n '{everyone:{}}'; }

# Montar arrays
INCLUDE_STAFF="$(jq -s '.' < <(rule_email_domain "$EMAIL_DOMAIN"))"
INCLUDE_PARTNERS="$( [ -n "${PARTNERS_GROUP_ID:-}" ] && [ "$PARTNERS_GROUP_ID" != "null" ] && jq -s '.' < <(rule_group "$PARTNERS_GROUP_ID") || jq -n '[]' )"
INCLUDE_ADMINS="$( [ -n "${ADMINS_GROUP_ID:-}" ] && [ "$ADMINS_GROUP_ID" != "null" ] && jq -s '.' < <(rule_group "$ADMINS_GROUP_ID") || jq -n '[]' )"
INCLUDE_SERVICE_ANY="$(jq -s '.' < <(rule_service_any))"
EVERYONE_ARR="$(jq -s '.' < <(rule_everyone))"

REQ_EMPTY='[]'
EXC_EMPTY='[]'

POL_ALLOW_STAFF_ID="$(create_policy "Allow UBL Staff" "allow" "$INCLUDE_STAFF" "$REQ_EMPTY" "$EXC_EMPTY")"
POL_ALLOW_PARTNERS_ID="$(create_policy "Allow Partners" "allow" "$INCLUDE_PARTNERS" "$REQ_EMPTY" "$EXC_EMPTY")"
POL_ALLOW_SERVICE_TOKENS_ID="$(create_policy "Allow Any Service Token" "allow" "$INCLUDE_SERVICE_ANY" "$REQ_EMPTY" "$EXC_EMPTY")"
POL_ALLOW_ADMINS_ID="$(create_policy "Allow Admins" "allow" "$INCLUDE_ADMINS" "$REQ_EMPTY" "$EXC_EMPTY")"
POL_DENY_ALL_ID="$(create_policy "Default Deny" "deny" "$EVERYONE_ARR" "$REQ_EMPTY" "$EXC_EMPTY")"

echo "✅ Policies:"
printf " - Allow UBL Staff = %s\n" "$POL_ALLOW_STAFF_ID"
printf " - Allow Partners = %s\n" "${POL_ALLOW_PARTNERS_ID:-<não criada (grupo ausente)>}"
printf " - Allow Any Service Token = %s\n" "$POL_ALLOW_SERVICE_TOKENS_ID"
printf " - Allow Admins = %s\n" "${POL_ALLOW_ADMINS_ID:-<não criada (grupo ausente)>}"
printf " - Default Deny = %s\n" "$POL_DENY_ALL_ID"

### 4) Reanexar policies nos Apps (com ordem correta)
hdr "4) Reanexando policies nos apps (ordem: allow → deny)"

valid_ids() {
  local ids=()
  for id in "$@"; do
    if [ -n "$id" ] && [ "$id" != "null" ]; then
      ids+=("$id")
    fi
  done
  if [ ${#ids[@]} -eq 0 ]; then
    jq -n '[]'
  else
    printf '%s\n' "${ids[@]}" | jq -R . | jq -s 'map({id:.})'
  fi
}

attach() {
  local APP_NAME="$1" APP_DOMAIN="$2"; shift 2
  local APPS_JSON; APPS_JSON="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps")"
  local APP_ID=""
  
  if echo "$APPS_JSON" | jq -e '.result' >/dev/null 2>&1; then
    APP_ID="$(echo "$APPS_JSON" | jq -r --arg n "$APP_NAME" '.result//[] | map(select(.name==$n)) | .[0].id // empty')"
  fi
  
  if [ -z "${APP_ID:-}" ] || [ "$APP_ID" = "null" ]; then
    APP_ID="$(cf -X POST "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps" \
      --data "$(jq -n --arg name "$APP_NAME" --arg dom "$APP_DOMAIN" '{name:$name, domain:$dom, type:"self_hosted", session_duration:"24h"}')" \
      | jq -r '.result.id')"
  fi
  
  local POLS_JSON; POLS_JSON="$(valid_ids "$@")"
  local CURR; CURR="$(cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps/$APP_ID")"
  local BODY; BODY="$(echo "$CURR" | jq -r '.result | {name,domain,type,session_duration,policies:[]}' \
    | jq --argjson pol "$POLS_JSON" '.policies=$pol')"
  cf -X PUT "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps/$APP_ID" --data "$BODY" >/dev/null
  echo "✅ $APP_NAME → OK"
}

# UBL Identity: admins/staff antes do deny
attach "$APP_IDP_NAME" "$APP_IDP_DOMAIN" \
  "$POL_ALLOW_ADMINS_ID" "$POL_ALLOW_STAFF_ID" "$POL_DENY_ALL_ID"

# Office LLM Router: service tokens/staff antes do deny
attach "$APP_LLM_NAME" "$APP_LLM_DOMAIN" \
  "$POL_ALLOW_SERVICE_TOKENS_ID" "$POL_ALLOW_STAFF_ID" "$POL_DENY_ALL_ID"

### 5) Proof-of-Done
hdr "5) Proof-of-Done"

echo "- Reusable Policies:"
cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/policies" \
  | jq -r '.result[] | select(.reusable == true) | "\(.id)\t\(.name)\tdecision=\(.decision)"' \
  | sort

echo -e "\n- Apps (nome → policies):"
cf "$CF_API_BASE/accounts/$ACCOUNT_ID/access/apps" \
  | jq -r --arg d1 "$APP_IDP_DOMAIN" --arg d2 "$APP_LLM_DOMAIN" \
    '.result[] | select(.domain == $d1 or .domain == $d2) | "\(.name)\t\(.domain)\tpolicies=" + ((.policies//[])|map(.id)|join(","))'

### 6) Provas de funcionamento (curl)
hdr "6) Provas de funcionamento (curl)"

echo "6.1) Sem credencial (deve bloquear):"
HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "https://$APP_LLM_DOMAIN/healthz" || echo "000")"
if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "302" ]; then
  echo "   ✅ Bloqueado corretamente (HTTP $HTTP_CODE)"
else
  echo "   ⚠️  HTTP $HTTP_CODE (esperado 403 ou 302)"
fi

echo ""
echo "6.2) Com Service Token (se disponível):"
if [ -n "${ST_CLIENT_ID:-}" ] && [ -n "${ST_CLIENT_SECRET:-}" ] && [ "$ST_CLIENT_SECRET" != "null" ]; then
  RESPONSE="$(curl -s "https://$APP_LLM_DOMAIN/healthz" \
    -H "CF-Access-Client-Id: $ST_CLIENT_ID" \
    -H "CF-Access-Client-Secret: $ST_CLIENT_SECRET" || echo '{"error":"failed"}')"
  if echo "$RESPONSE" | jq -e '.ok' >/dev/null 2>&1; then
    echo "   ✅ Acesso permitido: $(echo "$RESPONSE" | jq -r '.service // .ok')"
  else
    echo "   ⚠️  Resposta: $RESPONSE"
  fi
else
  echo "   ⚠️  Service Token secret não disponível (criar novo token para obter secret)"
fi

echo ""
echo "========================="
echo "✅ Bootstrap completo!"
echo "========================="
echo ""
echo "📝 Próximos passos:"
echo "   1. Salvar CF_ACCESS_CLIENT_ID e CF_ACCESS_CLIENT_SECRET no env (se criado)"
echo "   2. Testar acesso aos apps protegidos"
echo "   3. Usar Service Token para S2S nas requisições internas"
