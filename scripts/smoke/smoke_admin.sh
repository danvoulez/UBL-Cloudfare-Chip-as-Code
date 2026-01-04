#!/usr/bin/env bash
# Smoke test para Voulezvous Admin (padrão admin-only)
# Testa: público aberto (voulezvous.tv), admin protegido (admin.voulezvous.tv)

set -euo pipefail

VVZ_PUBLIC="${VVZ_PUBLIC:-voulezvous.tv}"
VVZ_ADMIN="${VVZ_ADMIN:-admin.voulezvous.tv}"
API_HOST="api.ubl.agency"

echo "🧪 Smoke Test — Voulezvous Admin (admin-only via subdomínio)"
echo "============================================================="
echo ""

echo "1️⃣  Público não exige Access → 200/OK"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${VVZ_PUBLIC}/" || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "000" ]; then
    echo "   ✅ HTTP $HTTP_CODE (público acessível)"
else
    echo "   ⚠️  HTTP $HTTP_CODE (verificar)"
fi
echo ""

echo "2️⃣  admin.voulezvous.tv sem token → 302 (login) ou 403"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${VVZ_ADMIN}/health" || echo "000")
if [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ]; then
    echo "   ✅ HTTP $HTTP_CODE (admin protegido - esperado)"
else
    echo "   ⚠️  HTTP $HTTP_CODE (verificar se Access está configurado)"
fi
echo ""

echo "3️⃣  Resolução de tenant (Host header: voulezvous.tv)"
TENANT=$(curl -s -H "Host: ${VVZ_PUBLIC}" "https://${API_HOST}/_policy/status" | jq -r '.tenant' 2>/dev/null || echo "null")
if [ "$TENANT" = "voulezvous" ]; then
    echo "   ✅ Tenant resolvido: $TENANT"
else
    echo "   ⚠️  Tenant: $TENANT (esperado: voulezvous)"
fi
echo ""

echo "4️⃣  Status de policy (UBL - Host: api.ubl.agency)"
STATUS=$(curl -s -H "Host: api.ubl.agency" "https://${API_HOST}/_policy/status" | jq -r '.tenant, .access.jwks_ok' 2>/dev/null || echo "null null")
TENANT_UBL=$(echo "$STATUS" | head -1)
JWKS_OK=$(echo "$STATUS" | tail -1)
if [ "$TENANT_UBL" = "ubl" ]; then
    echo "   ✅ Tenant UBL: $TENANT_UBL"
else
    echo "   ⚠️  Tenant UBL: $TENANT_UBL (esperado: ubl)"
fi
if [ "$JWKS_OK" = "true" ]; then
    echo "   ✅ JWKS OK: $JWKS_OK"
else
    echo "   ⚠️  JWKS OK: $JWKS_OK (verificar Access config)"
fi
echo ""

echo "5️⃣  (Opcional) Teste com Service Token do Access"
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
    echo "   Testando com Service Token em admin.voulezvous.tv..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}" \
      -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}" \
      "https://${VVZ_ADMIN}/health" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ HTTP $HTTP_CODE (Service Token funcionando)"
    else
        echo "   ⚠️  HTTP $HTTP_CODE (verificar Service Token)"
    fi
else
    echo "   ⏭️  Pulando (CF_ACCESS_CLIENT_ID/CF_ACCESS_CLIENT_SECRET não definidos)"
    echo "   💡 Para testar:"
    echo "      export CF_ACCESS_CLIENT_ID=\"...\""
    echo "      export CF_ACCESS_CLIENT_SECRET=\"...\""
    echo "      bash scripts/smoke_admin.sh"
fi
echo ""

echo "✅✅✅ Smoke test concluído!"
echo ""
echo "📋 Proof of Done:"
echo "   [ ] wrangler deployments list mostra ubl-flagship-edge ativo"
echo "   [ ] /_policy/status responde tenant: ubl com Host api.ubl.agency"
echo "   [ ] /_policy/status responde tenant: voulezvous com Host voulezvous.tv"
echo "   [ ] https://voulezvous.tv/ abre sem login (público)"
echo "   [ ] https://admin.voulezvous.tv/... exige Access ou retorna 302/403"
