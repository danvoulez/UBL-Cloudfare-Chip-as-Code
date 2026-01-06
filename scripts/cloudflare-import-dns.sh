#!/usr/bin/env bash
# Cloudflare — Importar DNS do Route 53
set -euo pipefail

### === CONFIG ===
DOMAIN="${1:-}"
IMPORT_FILE="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$IMPORT_FILE" ]; then
  echo "Uso: $0 <domain> <cloudflare-import.json>"
  echo "Exemplo: $0 example.com route53-export-*/cloudflare-import.json"
  exit 1
fi

# Carregar do env
if [ -f "$(dirname "$0")/../env" ]; then
  source "$(dirname "$0")/../env"
  CF_API_TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
  CF_API_KEY="${CF_API_KEY:-}"
  CF_API_EMAIL="${CF_API_EMAIL:-${CLOUDFLARE_ACCOUNT_EMAIL:-}}"
  CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"
fi

CF_API_BASE="https://api.cloudflare.com/client/v4"

hdr(){ echo -e "\n\033[1m$*\033[0m"; }

# Usar Global API Key se disponível, senão usar Token
if [ -n "$CF_API_KEY" ] && [ -n "$CF_API_EMAIL" ]; then
  cf(){ curl -sS -H "X-Auth-Email: $CF_API_EMAIL" -H "X-Auth-Key: $CF_API_KEY" -H "Content-Type: application/json" "$@"; }
elif [ -n "$CF_API_TOKEN" ]; then
  cf(){ curl -sS -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$@"; }
else
  echo "❌ Configure CF_API_KEY + CF_API_EMAIL ou CF_API_TOKEN"
  exit 1
fi

### 1) Descobrir Zone ID
hdr "1) Descobrindo Zone ID no Cloudflare"

if [ -z "${CLOUDFLARE_ZONE_ID:-}" ]; then
  ZONE_ID="$(cf "$CF_API_BASE/zones?name=$DOMAIN" | jq -r '.result[0].id // empty')"
else
  ZONE_ID="$CLOUDFLARE_ZONE_ID"
fi

if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "null" ]; then
  echo "❌ Zone não encontrada para $DOMAIN"
  echo ""
  echo "Criar zone primeiro:"
  echo "  curl -X POST \"$CF_API_BASE/zones\" \\"
  echo "    -H \"Authorization: Bearer \$CF_API_TOKEN\" \\"
  echo "    -H \"Content-Type: application/json\" \\"
  echo "    --data '{\"name\":\"$DOMAIN\"}'"
  exit 1
fi

echo "✅ Zone ID: $ZONE_ID"

### 2) Validar arquivo de importação
hdr "2) Validando arquivo de importação"

if [ ! -f "$IMPORT_FILE" ]; then
  echo "❌ Arquivo não encontrado: $IMPORT_FILE"
  exit 1
fi

RECORD_COUNT="$(jq 'length' "$IMPORT_FILE")"
echo "✅ $RECORD_COUNT registros encontrados"

### 3) Importar registros
hdr "3) Importando registros no Cloudflare"

SUCCESS=0
FAILED=0

# Usar process substitution para evitar subshell e manter contadores
while IFS= read -r record; do
  NAME="$(echo "$record" | jq -r '.name')"
  TYPE="$(echo "$record" | jq -r '.type')"
  
  # Preparar payload
  PAYLOAD="$(echo "$record" | jq -c --arg zone "$DOMAIN" '{
    type: .type,
    name: (if .name == $zone or .name == ($zone + ".") then $zone else .name end),
    content: .content,
    ttl: (if .ttl then .ttl else 1 end),
    priority: (if .priority then .priority else null end)
  } | with_entries(select(.value != null))')"
  
  # Criar registro
  RESPONSE="$(cf -X POST "$CF_API_BASE/zones/$ZONE_ID/dns_records" --data "$PAYLOAD")"
  
  if echo "$RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
    echo "✅ $TYPE $NAME"
    SUCCESS=$((SUCCESS + 1))
  else
    ERROR="$(echo "$RESPONSE" | jq -r '.errors[0].message // "unknown error"')"
    echo "❌ $TYPE $NAME: $ERROR"
    FAILED=$((FAILED + 1))
  fi
done < <(jq -c '.[]' "$IMPORT_FILE")

### 4) Verificar nameservers
hdr "4) Nameservers do Cloudflare"

NS="$(cf "$CF_API_BASE/zones/$ZONE_ID" | jq -r '.result.name_servers[]')"
echo "Nameservers para configurar no registrar:"
for ns in $NS; do
  echo "  • $ns"
done

### 5) Resumo
hdr "5) Resumo"

echo "✅ Importação concluída"
echo "   • Sucesso: $SUCCESS"
echo "   • Falhas: $FAILED"
echo ""
echo "📝 Próximos passos:"
echo "   1. Atualizar nameservers no registrar para:"
for ns in $NS; do
  echo "      $ns"
done
echo "   2. Aguardar propagação DNS (pode levar até 48h)"
echo "   3. Verificar: dig $DOMAIN NS +short"
