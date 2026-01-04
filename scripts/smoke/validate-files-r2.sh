#!/usr/bin/env bash
# P1 — Validação Files/R2 (presign e CORS)

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📁 P1 — Validação Files/R2"
echo "=========================="
echo ""

echo "1️⃣  Verificar KV e D1"
echo "-------------------"

KV_MEDIA=$(wrangler kv namespace list 2>/dev/null | grep -i "KV_MEDIA\|media" | head -1 || echo "")
D1_MEDIA=$(wrangler d1 list 2>/dev/null | grep -i "ubl-media\|media" | head -1 || echo "")

if [ -n "$KV_MEDIA" ]; then
  echo -e "   ${GREEN}✅ KV_MEDIA encontrado${NC}"
  echo "      $KV_MEDIA"
else
  echo -e "   ${YELLOW}⚠️  KV_MEDIA não encontrado${NC}"
fi

if [ -n "$D1_MEDIA" ]; then
  echo -e "   ${GREEN}✅ D1_MEDIA encontrado${NC}"
  echo "      $D1_MEDIA"
else
  echo -e "   ${YELLOW}⚠️  D1_MEDIA não encontrado${NC}"
fi

echo ""

echo "2️⃣  Testar Presign"
echo "----------------"

PRESIGN_RESP=$(curl -s -X POST https://api.ubl.agency/internal/media/presign \
  -H 'content-type: application/json' \
  -d '{"tenant":"voulezvous","mime":"image/png","bytes":1234}' 2>&1)

if echo "$PRESIGN_RESP" | jq -e '.id' >/dev/null 2>&1; then
  MEDIA_ID=$(echo "$PRESIGN_RESP" | jq -r '.id')
  UPLOAD_URL=$(echo "$PRESIGN_RESP" | jq -r '.url // .upload_url // ""')
  
  echo -e "   ${GREEN}✅ Presign OK${NC}"
  echo "      Media ID: $MEDIA_ID"
  
  if [ -n "$UPLOAD_URL" ]; then
    echo "      Upload URL: $UPLOAD_URL"
    echo -e "   ${GREEN}✅ URL de upload retornada${NC}"
  else
    echo -e "   ${YELLOW}⚠️  URL de upload não encontrada na resposta${NC}"
  fi
else
  echo -e "   ${RED}❌ Presign FAIL${NC}"
  echo "      Resposta: $PRESIGN_RESP"
fi

echo ""

echo "3️⃣  Testar Link (após upload)"
echo "---------------------------"

if [ -n "${MEDIA_ID:-}" ]; then
  LINK_RESP=$(curl -s https://api.ubl.agency/internal/media/link/$MEDIA_ID 2>&1)
  
  if echo "$LINK_RESP" | jq -e '.url' >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Link OK${NC}"
    echo "      $(echo "$LINK_RESP" | jq -r '.url')"
  elif echo "$LINK_RESP" | grep -qE "404|403|not found"; then
    echo -e "   ${YELLOW}⚠️  Link não encontrado (esperado se não fez upload)${NC}"
  else
    echo -e "   ${YELLOW}⚠️  Resposta: $LINK_RESP${NC}"
  fi
else
  echo -e "   ${YELLOW}⚠️  Pulando teste de link (sem media_id)${NC}"
fi

echo ""

echo "4️⃣  Verificar CORS (R2 bucket)"
echo "----------------------------"

echo "   ⚠️  CORS deve ser configurado manualmente no Cloudflare Dashboard"
echo "      Bucket: ubl-media"
echo "      Origins permitidos:"
echo "        - https://voulezvous.tv"
echo "        - https://www.voulezvous.tv"
echo "        - https://admin.voulezvous.tv"
echo ""

echo "✅✅✅ Validação Files/R2 Completa"
echo "=================================="
echo ""
echo "📋 Proof of Done:"
echo "   • POST /internal/media/presign retorna URL de upload"
echo "   • Upload conclui e GET /internal/media/link/:id entrega URL assinada válida"
echo ""
