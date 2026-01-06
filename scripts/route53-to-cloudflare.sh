#!/usr/bin/env bash
# Route 53 → Cloudflare — Exportar DNS e preparar transferência
set -euo pipefail

### === CONFIG ===
DOMAIN="${1:-}"
AWS_PROFILE="${AWS_PROFILE:-}"
CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"

# Carregar do env se disponível
if [ -f "$(dirname "$0")/../env" ]; then
  source "$(dirname "$0")/../env"
  # Usar credenciais do env se disponíveis
  if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    export AWS_ACCESS_KEY_ID
    export AWS_SECRET_ACCESS_KEY
    AWS_PROFILE=""  # Não usar profile quando temos credenciais diretas
  fi
fi

if [ -z "$DOMAIN" ]; then
  echo "Uso: $0 <domain>"
  echo "Exemplo: $0 example.com"
  exit 1
fi

hdr(){ echo -e "\n\033[1m$*\033[0m"; }

### Pré-requisitos
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI não instalado. Instale: brew install awscli"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "❌ jq não instalado. Instale: brew install jq"; exit 1; }

### 1) Descobrir Hosted Zone ID no Route 53
hdr "1) Descobrindo Hosted Zone ID no Route 53"

# Usar profile se disponível, senão usar credenciais do env
if [ -n "$AWS_PROFILE" ]; then
  AWS_CMD="aws route53 --profile $AWS_PROFILE"
else
  AWS_CMD="aws route53"
fi

HOSTED_ZONE_ID="$($AWS_CMD list-hosted-zones \
  --query "HostedZones[?Name=='${DOMAIN}.'].[Id]" --output text 2>/dev/null | sed 's|/hostedzone/||' || echo "")"

if [ -z "$HOSTED_ZONE_ID" ]; then
  echo "❌ Hosted Zone não encontrada para $DOMAIN"
  echo ""
  echo "Zones disponíveis:"
  $AWS_CMD list-hosted-zones \
    --query "HostedZones[*].[Name,Id]" --output table
  exit 1
fi

echo "✅ Hosted Zone ID: $HOSTED_ZONE_ID"

### 2) Exportar registros DNS
hdr "2) Exportando registros DNS do Route 53"

OUTPUT_DIR="route53-export-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

# Exportar todos os registros
$AWS_CMD list-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  > "$OUTPUT_DIR/route53-records.json"

echo "✅ Registros exportados: $OUTPUT_DIR/route53-records.json"

# Converter para formato Cloudflare (BIND)
$AWS_CMD list-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[*].[Name,Type,TTL,ResourceRecords[0].Value]" \
  --output text \
  > "$OUTPUT_DIR/records.txt"

echo "✅ Lista de registros: $OUTPUT_DIR/records.txt"

### 3) Converter para formato Cloudflare (JSON)
hdr "3) Convertendo para formato Cloudflare"

# Converter para formato Cloudflare (JSON array)
# Usar o arquivo já exportado para garantir consistência
jq '.ResourceRecordSets[] | select(.Type != "NS" and .Type != "SOA")' "$OUTPUT_DIR/route53-records.json" \
  | jq -s 'map({
    name: (.Name | rtrimstr(".")),
    type: .Type,
    ttl: (if .TTL and .TTL > 0 then .TTL else 1 end),
    content: (if .ResourceRecords and (.ResourceRecords | length) > 0 then 
      (if .Type == "MX" then 
        (.ResourceRecords[0].Value | split(" ") | .[1]) 
      else 
        .ResourceRecords[0].Value 
      end)
    else "" end),
    priority: (if .Type == "MX" and .ResourceRecords and (.ResourceRecords | length) > 0 then 
      (.ResourceRecords[0].Value | split(" ") | .[0] | tonumber) 
    else null end)
  } | with_entries(select(.value != null and .value != "")))' \
  > "$OUTPUT_DIR/cloudflare-import.json"

echo "✅ Formato Cloudflare: $OUTPUT_DIR/cloudflare-import.json"

### 4) Listar registros importantes
hdr "4) Registros DNS encontrados"

echo "Registros (excluindo NS/SOA):"
$AWS_CMD list-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Type!='NS' && Type!='SOA'].[Name,Type,TTL,ResourceRecords[0].Value]" \
  --output table

### 5) Instruções para Cloudflare
hdr "5) Instruções para importar no Cloudflare"

cat > "$OUTPUT_DIR/CLOUDFLARE_IMPORT.md" <<EOF
# Importar DNS no Cloudflare

## 1. Criar Zone no Cloudflare

\`\`\`bash
# Via API
curl -X POST "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer \$CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"name":"$DOMAIN","account":{"id":"\$CLOUDFLARE_ACCOUNT_ID"}}'
\`\`\`

Ou via Dashboard: https://dash.cloudflare.com → Add a Site

## 2. Importar Registros

### Opção A: Via Dashboard
1. Acesse: https://dash.cloudflare.com → Selecione a zone
2. DNS → Records → Import
3. Cole o conteúdo de \`cloudflare-import.json\`

### Opção B: Via API (script)

\`\`\`bash
# Carregar registros
RECORDS=\$(cat cloudflare-import.json)

# Importar (ajuste ZONE_ID)
curl -X POST "https://api.cloudflare.com/client/v4/zones/\$ZONE_ID/dns_records/import" \
  -H "Authorization: Bearer \$CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "\$RECORDS"
\`\`\`

## 3. Atualizar Nameservers

Após criar a zone no Cloudflare, você receberá nameservers como:
- \`ns1.cloudflare.com\`
- \`ns2.cloudflare.com\`

### Atualizar no Route 53 (registrar)

1. Acesse o registrar do domínio (não Route 53)
2. Atualize os nameservers para os fornecidos pelo Cloudflare

### Ou via AWS CLI (se Route 53 for o registrar)

\`\`\`bash
# Listar nameservers atuais
$AWS_CMD get-hosted-zone --id $HOSTED_ZONE_ID

# Atualizar no registrar (fora do escopo deste script)
\`\`\`

## 4. Verificar

\`\`\`bash
# Verificar DNS propagation
dig $DOMAIN NS +short

# Verificar registros
dig $DOMAIN A +short
\`\`\`

## 5. Desativar Route 53 (após verificar)

Após confirmar que tudo está funcionando no Cloudflare:

\`\`\`bash
# ⚠️ CUIDADO: Isso deleta a hosted zone
# $AWS_CMD delete-hosted-zone --id $HOSTED_ZONE_ID
\`\`\`

**⚠️ IMPORTANTE:** Só delete a hosted zone após confirmar que o DNS está funcionando no Cloudflare!
EOF

echo "✅ Instruções salvas: $OUTPUT_DIR/CLOUDFLARE_IMPORT.md"

### 6) Resumo
hdr "6) Resumo"

echo "📁 Arquivos gerados em: $OUTPUT_DIR/"
echo "   • route53-records.json (export completo)"
echo "   • records.txt (lista simples)"
echo "   • cloudflare-import.json (formato Cloudflare)"
echo "   • CLOUDFLARE_IMPORT.md (instruções)"
echo ""
echo "📝 Próximos passos:"
echo "   1. Revisar $OUTPUT_DIR/cloudflare-import.json"
echo "   2. Criar zone no Cloudflare"
echo "   3. Importar registros"
echo "   4. Atualizar nameservers no registrar"
echo "   5. Verificar DNS propagation"
echo "   6. (Opcional) Deletar hosted zone no Route 53"
echo ""
echo "✅ Exportação completa!"
