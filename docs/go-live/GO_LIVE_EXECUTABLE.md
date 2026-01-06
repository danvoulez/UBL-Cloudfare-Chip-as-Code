# Go-Live Executável — UBL Flagship

**Data:** 2026-01-05  
**Status:** 🟢 Pronto para execução

---

## 🚀 Execução Rápida

```bash
cd "/Users/ubl-ops/Chip as Code at Cloudflare"
bash scripts/go-live-execute.sh
```

**O script executa:**
1. ✅ Verificação de Workers
2. ✅ Deploy sequencial (6 workers)
3. ✅ Assinatura e publicação de policies
4. ✅ Smoke tests automáticos
5. ✅ Resumo final

---

## 📋 Pré-requisitos

### 1. Variáveis de Ambiente

**Arquivo `env` deve conter:**
```bash
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_ZONE_ID=...
CLOUDFLARE_API_TOKEN=...

# KV Namespaces
UBL_FLAGS_KV_ID=...
KV_MEDIA_ID=...
PLANS_KV_ID=...

# D1 Databases
D1_MEDIA_ID=...
BILLING_DB_ID=...

# Policy Keys
POLICY_PRIVKEY_PATH=/etc/ubl/keys/policy_priv.pem
POLICY_PUBKEY_B64=...

# JWT Keys (UBL ID)
JWT_ES256_PRIV_KEY_PATH=/etc/ubl/keys/jwt_es256_priv.pem
JWT_ES256_PUB_KEY_PATH=/etc/ubl/keys/jwt_es256_pub.pem
JWT_KID=fOYJEW760OAfkL3nHzYGP4zaB9qpuuX4AR6jQpFz9FI
```

### 2. Secrets (via `wrangler secret put`)

**Antes do deploy, configurar:**
```bash
# Office-LLM (opcional)
cd workers/office-llm
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
cd ../..

# Auth Worker (se necessário)
cd workers/auth-worker
# Configurar secrets conforme necessário
cd ../..
```

### 3. Wrangler Logado

```bash
wrangler login
```

---

## 🔄 Deploy Manual (Passo a Passo)

### 1. Policy Worker (Gateway)

```bash
cd workers/policy-worker
npm install
wrangler deploy
cd ../..
```

**Verificar:**
```bash
curl -s https://api.ubl.agency/_policy/status | jq .
```

---

### 2. Auth Worker (UBL ID)

```bash
cd workers/auth-worker
npm install
wrangler deploy
cd ../..
```

**Verificar:**
```bash
curl -s https://id.ubl.agency/healthz | jq .
curl -s https://id.ubl.agency/.well-known/jwks.json | jq '.keys[0].kid'
```

---

### 3. Media API Worker

```bash
cd workers/media-api-worker
npm install
wrangler deploy
cd ../..
```

**Verificar:**
```bash
curl -s https://api.ubl.agency/media/healthz | jq .
```

---

### 4. RTC Worker

```bash
cd workers/rtc-worker
npm install
wrangler deploy
cd ../..
```

**Verificar:**
```bash
curl -s https://rtc.voulezvous.tv/healthz | jq .
```

---

### 5. Office API Worker

```bash
cd workers/office-api-worker
npm install
wrangler deploy
cd ../..
```

**Verificar:**
```bash
curl -s https://office-api-worker.dan-1f4.workers.dev/healthz | jq .
```

---

### 6. Office-LLM Worker

```bash
cd workers/office-llm
npm install
wrangler deploy
cd ../..
```

**Verificar:**
```bash
curl -s https://office-llm.ubl.agency/healthz | jq .
```

---

## 📝 Publicar Policies

### Assinar e Publicar UBL Core v3

```bash
# Assinar
cargo run --bin policy-signer -- \
  --yaml policies/ubl_core_v3.yaml \
  --id ubl_access_chip_v3 \
  --version v3 \
  --privkey_pem /etc/ubl/keys/policy_priv.pem \
  --out /tmp/pack_ubl_v3.json

# Publicar no KV
wrangler kv:key put "policy_ubl_pack_active" \
  --namespace-id="$UBL_FLAGS_KV_ID" \
  --path=/tmp/pack_ubl_v3.json

wrangler kv:key put "policy_ubl_yaml_active" \
  --namespace-id="$UBL_FLAGS_KV_ID" \
  --value="$(cat policies/ubl_core_v3.yaml)"
```

### Assinar e Publicar Voulezvous Core v1

```bash
# Assinar
cargo run --bin policy-signer -- \
  --yaml policies/vvz_core_v1.yaml \
  --id vvz_core_v1 \
  --version v1 \
  --privkey_pem /etc/ubl/keys/policy_priv.pem \
  --out /tmp/pack_vvz_v1.json

# Publicar no KV
wrangler kv:key put "policy_voulezvous_pack_active" \
  --namespace-id="$UBL_FLAGS_KV_ID" \
  --path=/tmp/pack_vvz_v1.json

wrangler kv:key put "policy_voulezvous_yaml_active" \
  --namespace-id="$UBL_FLAGS_KV_ID" \
  --value="$(cat policies/vvz_core_v1.yaml)"
```

---

## 🧪 Smoke Tests

### Smoke Completo

```bash
bash scripts/smoke-ubl-office.sh
```

### Smoke Office-LLM

```bash
bash scripts/smoke-office-llm.sh
```

### Smoke Multitenant

```bash
bash scripts/smoke_multitenant.sh
```

---

## 🔍 Verificação Pós-Deploy

### 1. Health Checks

```bash
# Gateway
curl -s https://api.ubl.agency/_policy/status | jq .

# Auth
curl -s https://id.ubl.agency/healthz | jq .

# Media
curl -s https://api.ubl.agency/media/healthz | jq .

# RTC
curl -s https://rtc.voulezvous.tv/healthz | jq .

# Office
curl -s https://office-api-worker.dan-1f4.workers.dev/healthz | jq .

# Office-LLM
curl -s https://office-llm.ubl.agency/healthz | jq .
```

### 2. JWKS

```bash
curl -s https://id.ubl.agency/.well-known/jwks.json | jq '.keys[0].kid'
# Esperado: fOYJEW760OAfkL3nHzYGP4zaB9qpuuX4AR6jQpFz9FI
```

### 3. Policies

```bash
# UBL
curl -s https://api.ubl.agency/_policy/status | jq '.tenant, .policy.id'

# Voulezvous
curl -s -H "Host: voulezvous.tv" https://api.ubl.agency/_policy/status | jq '.tenant, .policy.id'
```

---

## 🔄 Rollback

### Rollback de Worker

```bash
# Listar deployments
wrangler deployments list --name <worker-name>

# Rollback
wrangler rollback --name <worker-name>
```

### Rollback de Policy

```bash
# Promover shadow (next → active)
curl -X POST "https://api.ubl.agency/admin/policy/promote?tenant=ubl&source_stage=next" \
  -H "CF-Access-Jwt-Assertion: $ACCESS_JWT"
```

---

## 📊 Monitoramento

### Logs

```bash
# Tail logs de um worker
wrangler tail --name <worker-name>
```

### Métricas

- **Grafana:** `infra/observability/grafana/dashboards/`
- **Prometheus:** `infra/observability/prometheus/`

---

## ✅ Checklist Final

- [ ] Todos os workers deployados
- [ ] Policies publicadas no KV
- [ ] Health checks passando
- [ ] JWKS retornando `kid` correto
- [ ] Smoke tests passando
- [ ] DNS configurado (se necessário)
- [ ] Secrets configurados
- [ ] Logs sendo coletados

---

**Status:** 🟢 **Pronto para Go-Live**
