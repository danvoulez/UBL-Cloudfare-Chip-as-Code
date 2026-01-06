#!/usr/bin/env bash
# Importar todos os domínios exportados no Cloudflare
set -euo pipefail

# Carregar do env
if [ -f "$(dirname "$0")/../env" ]; then
  source "$(dirname "$0")/../env"
  CF_API_TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
fi

: "${CF_API_TOKEN:?export CF_API_TOKEN=... ou configure CLOUDFLARE_API_TOKEN no env}"

DOMAINS=("logline.foundation" "logline.world" "voulezvous.ai")

hdr(){ echo -e "\n\033[1m$*\033[0m"; }

hdr "Importando domínios no Cloudflare"

for domain in "${DOMAINS[@]}"; do
  echo ""
  echo ">> $domain"
  
  # Encontrar diretório de exportação mais recente para este domínio
  EXPORT_DIR=""
  for dir in route53-export-*; do
    if [ -d "$dir" ] && [ -f "$dir/cloudflare-import.json" ]; then
      # Verificar se o arquivo tem registros deste domínio
      if jq -e --arg d "$domain" '.[] | select(.name == $d or .name == ($d + "."))' "$dir/cloudflare-import.json" >/dev/null 2>&1; then
        EXPORT_DIR="$dir"
        break
      fi
    fi
  done
  
  if [ -z "$EXPORT_DIR" ]; then
    echo "   ⚠️  Exportação não encontrada - execute: bash scripts/route53-to-cloudflare.sh $domain"
    continue
  fi
  
  echo "   📁 Usando: $EXPORT_DIR"
  bash scripts/cloudflare-import-dns.sh "$domain" "$EXPORT_DIR/cloudflare-import.json" 2>&1 | tail -15
done

echo ""
hdr "Resumo"
echo "Domínios processados: ${#DOMAINS[@]}"
echo ""
echo "📝 Próximos passos:"
echo "   1. Verificar nameservers de cada domínio"
echo "   2. Atualizar nameservers no registrar"
echo "   3. Aguardar propagação DNS"
echo "   4. Verificar: dig <domain> NS +short"
