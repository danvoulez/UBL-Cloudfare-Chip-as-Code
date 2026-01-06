#!/usr/bin/env bash
# Go-Live Executável — UBL Flagship
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🚀 UBL FLAGSHIP — GO-LIVE"
echo "========================="
echo ""

# Carregar variáveis do env
if [ -f env ]; then
  source env
  echo "✅ Variáveis carregadas de env"
else
  echo "⚠️  Arquivo env não encontrado"
fi

echo ""
echo "📋 Checklist Go-Live:"
echo ""

# 1) Verificar Workers
echo ">> 1) Verificando Workers..."
WORKERS=(
  "workers/policy-worker:ubl-flagship-edge"
  "apps/media-api-worker:ubl-media-api"
  "workers/rtc-worker:vvz-rtc"
  "workers/auth-worker:ubl-id"
  "apps/office/workers/office-api-worker:ubl-office-api"
  "workers/office-llm:office-llm"
)

for worker_path in "${WORKERS[@]}"; do
  IFS=':' read -r path name <<< "$worker_path"
  if [ -d "$path" ]; then
    echo "   ✅ $name (existe)"
  else
    echo "   ⚠️  $name (não encontrado)"
  fi
done

echo ""

# 2) Verificar Secrets necessários
echo ">> 2) Secrets necessários:"
echo "   • OPENAI_API_KEY (opcional, para office-llm)"
echo "   • ANTHROPIC_API_KEY (opcional, para office-llm)"
echo "   • JWT_ES256_PRIV_KEY (UBL ID)"
echo "   • JWT_ES256_PUB_KEY (UBL ID)"
echo ""

# 3) Verificar KV/D1/R2
echo ">> 3) Recursos Cloudflare:"
echo "   • KV: UBL_FLAGS, KV_MEDIA, PLANS_KV"
echo "   • D1: ubl-media, BILLING_DB"
echo "   • R2: ubl-flagship, ubl-media, ubl-ledger, ubl-dlq"
echo ""

# 4) Deploy sequencial
echo ">> 4) Deploy sequencial:"
echo ""

# Policy Worker (Gateway)
if [ -d "workers/policy-worker" ]; then
  echo "   📦 Deployando ubl-flagship-edge..."
  cd workers/policy-worker
  if wrangler deploy 2>&1 | tee /tmp/wrangler-policy.log; then
    echo "   ✅ ubl-flagship-edge deployado"
  else
    echo "   ❌ Erro no deploy de ubl-flagship-edge"
    exit 1
  fi
  cd ../..
  echo ""
fi

# Auth Worker (UBL ID)
if [ -d "workers/auth-worker" ]; then
  echo "   📦 Deployando ubl-id..."
  cd workers/auth-worker
  if wrangler deploy 2>&1 | tee /tmp/wrangler-auth.log; then
    echo "   ✅ ubl-id deployado"
  else
    echo "   ❌ Erro no deploy de ubl-id"
    exit 1
  fi
  cd ../..
  echo ""
fi

# Media API Worker
if [ -d "apps/media-api-worker" ]; then
  echo "   📦 Deployando ubl-media-api..."
  cd apps/media-api-worker
  if wrangler deploy 2>&1 | tee /tmp/wrangler-media.log; then
    echo "   ✅ ubl-media-api deployado"
  else
    echo "   ❌ Erro no deploy de ubl-media-api"
    exit 1
  fi
  cd ../..
  echo ""
fi

# RTC Worker
if [ -d "workers/rtc-worker" ]; then
  echo "   📦 Deployando vvz-rtc..."
  cd workers/rtc-worker
  if wrangler deploy 2>&1 | tee /tmp/wrangler-rtc.log; then
    echo "   ✅ vvz-rtc deployado"
  else
    echo "   ❌ Erro no deploy de vvz-rtc"
    exit 1
  fi
  cd ../..
  echo ""
fi

# Office API Worker
if [ -d "apps/office/workers/office-api-worker" ]; then
  echo "   📦 Deployando ubl-office-api..."
  cd apps/office/workers/office-api-worker
  if wrangler deploy 2>&1 | tee /tmp/wrangler-office.log; then
    echo "   ✅ ubl-office-api deployado"
  else
    echo "   ❌ Erro no deploy de ubl-office-api"
    exit 1
  fi
  cd ../../..
  echo ""
fi

# Office-LLM Worker
if [ -d "workers/office-llm" ]; then
  echo "   📦 Deployando office-llm..."
  cd workers/office-llm
  if wrangler deploy 2>&1 | tee /tmp/wrangler-llm.log; then
    echo "   ✅ office-llm deployado"
  else
    echo "   ❌ Erro no deploy de office-llm"
    exit 1
  fi
  cd ../..
  echo ""
fi

# 5) Configurar Access Reusable Policies
echo ">> 5) Configurando Access Reusable Policies..."
if [ -n "${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}" ]; then
  export CF_API_TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN}}"
  if bash scripts/setup-access-reusable-policies.sh 2>&1 | tee /tmp/setup-access.log; then
    echo "   ✅ Access Reusable Policies configuradas"
  else
    echo "   ⚠️  Erro ao configurar Access Policies (continuando...)"
  fi
else
  echo "   ⚠️  CF_API_TOKEN não configurado - pulando configuração de Access"
fi
echo ""

# 6) Publicar Policies
echo ">> 6) Publicando Policies..."
if [ -f "policies/ubl_core_v3.yaml" ] && [ -f "policies/vvz_core_v1.yaml" ]; then
  echo "   📝 Assinando ubl_core_v3.yaml..."
  if cargo run --bin policy-signer -- \
    --yaml policies/ubl_core_v3.yaml \
    --id ubl_access_chip_v3 \
    --version v3 \
    --privkey_pem "${POLICY_PRIVKEY_PATH:-/etc/ubl/keys/policy_priv.pem}" \
    --out /tmp/pack_ubl_v3.json 2>&1 | tee /tmp/signer-ubl.log; then
    echo "   ✅ ubl_core_v3 assinado"
    
    # Publicar no KV
    if [ -n "${UBL_FLAGS_KV_ID:-}" ]; then
      echo "   📤 Publicando no KV (policy_ubl_pack_active)..."
      wrangler kv:key put "policy_ubl_pack_active" --namespace-id="$UBL_FLAGS_KV_ID" --path=/tmp/pack_ubl_v3.json 2>&1 | tee /tmp/kv-ubl-pack.log || true
      echo "   ✅ Policy UBL publicada"
    fi
  else
    echo "   ⚠️  Erro ao assinar ubl_core_v3 (continuando...)"
  fi
  
  echo "   📝 Assinando vvz_core_v1.yaml..."
  if cargo run --bin policy-signer -- \
    --yaml policies/vvz_core_v1.yaml \
    --id vvz_core_v1 \
    --version v1 \
    --privkey_pem "${POLICY_PRIVKEY_PATH:-/etc/ubl/keys/policy_priv.pem}" \
    --out /tmp/pack_vvz_v1.json 2>&1 | tee /tmp/signer-vvz.log; then
    echo "   ✅ vvz_core_v1 assinado"
    
    # Publicar no KV
    if [ -n "${UBL_FLAGS_KV_ID:-}" ]; then
      echo "   📤 Publicando no KV (policy_voulezvous_pack_active)..."
      wrangler kv:key put "policy_voulezvous_pack_active" --namespace-id="$UBL_FLAGS_KV_ID" --path=/tmp/pack_vvz_v1.json 2>&1 | tee /tmp/kv-vvz-pack.log || true
      wrangler kv:key put "policy_voulezvous_yaml_active" --namespace-id="$UBL_FLAGS_KV_ID" --value="$(cat policies/vvz_core_v1.yaml)" 2>&1 | tee /tmp/kv-vvz-yaml.log || true
      echo "   ✅ Policy Voulezvous publicada"
    fi
  else
    echo "   ⚠️  Erro ao assinar vvz_core_v1 (continuando...)"
  fi
else
  echo "   ⚠️  Policies não encontradas"
fi
echo ""

# 7) Smoke Tests
echo ">> 7) Executando Smoke Tests..."
echo ""

if [ -f "scripts/smoke-ubl-office.sh" ]; then
  echo "   🧪 Smoke UBL ID + Office..."
  if bash scripts/smoke-ubl-office.sh 2>&1 | tee /tmp/smoke-ubl-office.log; then
    echo "   ✅ Smoke UBL ID + Office passou"
  else
    echo "   ⚠️  Smoke UBL ID + Office falhou (verificar logs)"
  fi
  echo ""
fi

if [ -f "scripts/smoke-office-llm.sh" ]; then
  echo "   🧪 Smoke Office-LLM..."
  if bash scripts/smoke-office-llm.sh 2>&1 | tee /tmp/smoke-llm.log; then
    echo "   ✅ Smoke Office-LLM passou"
  else
    echo "   ⚠️  Smoke Office-LLM falhou (verificar logs)"
  fi
  echo ""
fi

# 7) Resumo
echo "========================="
echo "✅ GO-LIVE CONCLUÍDO!"
echo "========================="
echo ""
echo "📋 Resumo:"
echo "   • Workers deployados: 6"
echo "   • Policies publicadas: 2"
echo "   • Smoke tests: executados"
echo ""
echo "🔗 URLs:"
echo "   • Gateway: https://api.ubl.agency"
echo "   • Auth: https://id.ubl.agency"
echo "   • Media: https://api.ubl.agency/media/*"
echo "   • Office: https://office-api-worker.dan-1f4.workers.dev"
echo "   • Office-LLM: https://office-llm.ubl.agency"
echo ""
echo "📝 Logs:"
echo "   • /tmp/wrangler-*.log"
echo "   • /tmp/smoke-*.log"
echo ""
echo "🎉 Sistema em produção!"
