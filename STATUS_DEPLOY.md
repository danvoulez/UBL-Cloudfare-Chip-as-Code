# 📊 Status do Deploy — Multitenant

**Data:** 2026-01-04  
**Status:** ⚠️ Aguardando criação de Access Apps

---

## ✅ O que já está pronto

- ✅ Scripts criados:
  - `scripts/fill-placeholders.sh` — Preenche placeholders
  - `scripts/deploy-multitenant.sh` — Script completo de deploy
  - `scripts/smoke.sh` — Smoke test unificado
  - `scripts/discover-access.sh` — Descobre Access Apps

- ✅ Configuração:
  - `policy-worker/wrangler.toml` — Configurado com placeholders
  - `apps/media-api-worker/wrangler.toml` — Configurado com placeholders
  - `policies/vvz_core_v1.yaml` — Policy voulezvous criada

---

## ❌ Bloqueador principal

**Access Apps não criadas ainda**

Sem as Access Apps, não é possível:
- Obter valores de `AUD_UBL`, `AUD_VVZ`, `JWKS_TEAM`
- Preencher placeholders nos `wrangler.toml`
- Fazer deploy do Gateway

---

## 🔧 Ações que podem ser feitas agora

### 1. Criar recursos Media (KV/D1) — Opcional

```bash
# KV
wrangler kv namespace create KV_MEDIA
# Anote o ID retornado

# D1
wrangler d1 create ubl-media
# Anote o ID retornado

# Schema
wrangler d1 execute ubl-media --file=apps/media-api-worker/schema.sql
```

Depois, preencher em `apps/media-api-worker/wrangler.toml`:
```bash
export KV_MEDIA_ID="<id_retornado>"
export D1_MEDIA_ID="<id_retornado>"
bash scripts/fill-placeholders.sh
```

### 2. Assinar e publicar policy voulezvous na KV

```bash
# Assinar
./target/release/policy-signer \
  --id vvz_core_v1 \
  --version 1 \
  --yaml policies/vvz_core_v1.yaml \
  --privkey_pem /etc/ubl/nova/keys/policy_signing_private.pem \
  --out /tmp/pack_vvz_v1.json

# Publicar na KV
wrangler kv key put --binding=UBL_FLAGS --key=policy_voulezvous_yaml --path=policies/vvz_core_v1.yaml
wrangler kv key put --binding=UBL_FLAGS --key=policy_voulezvous_pack --path=/tmp/pack_vvz_v1.json

# Promover para ativo
wrangler kv key put --binding=UBL_FLAGS --key=policy_voulezvous_yaml_active --path=policies/vvz_core_v1.yaml
wrangler kv key put --binding=UBL_FLAGS --key=policy_voulezvous_pack_active --path=/tmp/pack_vvz_v1.json
```

---

## 📝 Próximo passo obrigatório

### Criar Access Apps no Cloudflare Dashboard

1. Acesse: https://dash.cloudflare.com → **Zero Trust** → **Access** → **Applications**
2. Clique em **"Add an application"** → **Self-hosted**

**UBL Flagship:**
- Name: `UBL Flagship`
- Domain: `api.ubl.agency`
- Session Duration: `24h`

**Voulezvous:**
- Name: `Voulezvous`
- Domain(s): `voulezvous.tv`, `www.voulezvous.tv`
- Session Duration: `24h`

---

## 🚀 Após criar as Access Apps

### 1. Descobrir valores

```bash
bash scripts/discover-access.sh
```

Anote:
- `AUD_UBL` (UBL Flagship)
- `AUD_VVZ` (Voulezvous)
- `JWKS_TEAM` (URL do time)

### 2. Preencher placeholders

```bash
export AUD_UBL="<audience_UBL>"
export AUD_VVZ="<audience_Voulezvous>"
export JWKS_TEAM="https://SEU-TIME.cloudflareaccess.com/cdn-cgi/access/certs"
bash scripts/fill-placeholders.sh
```

### 3. Deploy

```bash
# Gateway
wrangler deploy --name ubl-flagship-edge --config policy-worker/wrangler.toml

# (Opcional) Media API
wrangler deploy --name ubl-media-api --config apps/media-api-worker/wrangler.toml
```

### 4. Smoke test

```bash
bash scripts/smoke.sh
```

---

## 📋 Checklist final

- [ ] Access Apps criadas (UBL + Voulezvous)
- [ ] Valores AUD/JWKS obtidos via `discover-access.sh`
- [ ] Placeholders preenchidos via `fill-placeholders.sh`
- [ ] (Opcional) KV/D1 Media criados
- [ ] (Opcional) Policy voulezvous assinada e publicada na KV
- [ ] Gateway deployado
- [ ] (Opcional) Media API deployado
- [ ] Smoke test passando

---

## 🔍 Verificação rápida

```bash
# Verificar placeholders
grep -E "<AUD_UBL>|<AUD_VVZ>|<JWKS_TEAM>" policy-worker/wrangler.toml

# Verificar Access Apps
bash scripts/discover-access.sh

# Verificar Workers
wrangler deployments list
```
