# 🔐 Runbook: Criar Access Apps (Plano Relâmpago)

## 📋 Ordem de Execução

Siga nesta ordem exata:

---

## 1️⃣ Criar Access Apps (Zero Trust → Access → Applications)

### A. UBL Flagship (obrigatória)

1. Acesse: https://dash.cloudflare.com → **Zero Trust** → **Access** → **Applications**
2. Clique em **"Add an application"** → **Self-hosted**
3. Configure:
   - **Type:** Self-hosted
   - **Name:** `UBL Flagship`
   - **Application domain:** `api.ubl.agency`
   - **Session duration:** `24h` (ou sua política)
4. **Policy "Allow":**
   - Adicione seu grupo de ops (ex.: `ubl-ops`)
   - Ou configure conforme sua necessidade
5. Salve

**Resultado esperado:**
- Aparece um **Audience (AUD)** único
- JWKS do seu team: `https://SEU-TIME.cloudflareaccess.com/cdn-cgi/access/certs`

### B. Voulezvous Admin (recomendado só para /admin)

**Estratégia:** O site público (`voulezvous.tv`) continua aberto, e só `/admin/*` recebe proteção do Access.

**Subdomínio dedicado (padrão)**
1. Crie subdomínio DNS: `admin.voulezvous.tv` (proxied ☁️ laranja)
2. Acesse: https://dash.cloudflare.com → **Zero Trust** → **Access** → **Applications**
3. Clique em **"Add an application"** → **Self-hosted**
4. Configure:
   - **Type:** Self-hosted
   - **Name:** `Voulezvous Admin`
   - **Application domain:** `admin.voulezvous.tv`
   - **Session duration:** `24h`
5. **Policy "Allow":**
   - Adicione seu grupo admin
6. Salve

**Por que assim?**
- Site público (`voulezvous.tv`) continua aberto (sem Access)
- Apenas `admin.voulezvous.tv` recebe `Cf-Access-Jwt-Assertion`
- Worker valida JWT apenas em `admin.voulezvous.tv`
- Gating por host (mais simples e compatível com todos os planos)

---

## 2️⃣ Descobrir Valores e Preencher

### 2.1 Descobrir AUD/JWKS

```bash
bash scripts/discover-access.sh
```

O script vai mostrar:
- `AUD_UBL` (UBL Flagship)
- `AUD_VVZ` (Voulezvous Admin)
- `JWKS_TEAM` (URL do time)

### 2.2 Exportar e Preencher

```bash
# Exporte os 3 valores retornados (exemplo)
export AUD_UBL="...aud da app UBL..."
export AUD_VVZ="...aud da app Voulezvous Admin..."
export JWKS_TEAM="https://SEU-TIME.cloudflareaccess.com/cdn-cgi/access/certs"

# Aplica nos wranglers
bash scripts/fill-placeholders.sh
```

**Verificar:**
```bash
# Não deve haver placeholders
grep -E "<AUD_UBL>|<AUD_VVZ>|<JWKS_TEAM>" policy-worker/wrangler.toml
# (não deve retornar nada)
```

---

## 3️⃣ (Opcional) Criar KV/D1 para Media

Se for ligar Media API agora:

```bash
# KV
wrangler kv namespace create KV_MEDIA
# Anote o ID retornado

# D1
wrangler d1 create ubl-media
# Anote o ID retornado

# Schema
wrangler d1 execute ubl-media --file=apps/media-api-worker/schema.sql

# Preencher placeholders
export KV_MEDIA_ID="<id_retornado>"
export D1_MEDIA_ID="<id_retornado>"
bash scripts/fill-placeholders.sh
```

**Nota:** Se ainda não for usar Media, pode pular este passo — o Gateway funciona sem ele.

---

## 4️⃣ Deploy + Smoke

### 4.1 Deploy Gateway

```bash
wrangler deploy --name ubl-flagship-edge --config policy-worker/wrangler.toml
```

### 4.2 (Opcional) Deploy Media API

```bash
wrangler deploy --name ubl-media-api --config apps/media-api-worker/wrangler.toml
```

### 4.3 Smoke Test

```bash
bash scripts/smoke.sh
```

**Esperado:**
- `/_policy/status` e `/warmup` → 200 com `"tenant":"voulezvous"`
- CORS preflight refletindo `https://voulezvous.tv`
- (Se Media ativo) presign retorna JSON

---

## 5️⃣ Proof of Done (Checklist)

Marque ✅ quando completar:

- [ ] **Access Apps criadas:**
  - [ ] UBL Flagship → `api.ubl.agency`
  - [ ] Voulezvous Admin → `admin.voulezvous.tv`
- [ ] **DNS configurado:**
  - [ ] `admin.voulezvous.tv` → registro proxied (☁️ laranja)

- [ ] **Valores descobertos:**
  - [ ] `AUD_UBL` obtido
  - [ ] `AUD_VVZ` obtido
  - [ ] `JWKS_TEAM` obtido

- [ ] **Placeholders preenchidos:**
  - [ ] `policy-worker/wrangler.toml` sem placeholders
  - [ ] (Opcional) `apps/media-api-worker/wrangler.toml` sem placeholders

- [ ] **Deploy:**
  - [ ] `wrangler deployments list` mostra `ubl-flagship-edge` ativo
  - [ ] (Opcional) `ubl-media-api` ativo

- [ ] **Validação:**
  - [ ] `curl -s https://api.ubl.agency/_policy/status -H 'Host: voulezvous.tv' | jq .tenant` → `"voulezvous"`
  - [ ] `/_policy/status` retorna `access.jwks_ok: true` e `tenant: ubl/voulezvous` conforme o Host
  - [ ] (Admin) Acessar `https://voulezvous.tv/admin/...` pede login do Access e injeta `Cf-Access-Jwt-Assertion`

---

## 🔍 Validação Rápida

```bash
# Status do tenant (voulezvous)
curl -s https://api.ubl.agency/_policy/status \
  -H 'Host: voulezvous.tv' | jq .

# Status do tenant (ubl)
curl -s https://api.ubl.agency/_policy/status \
  -H 'Host: api.ubl.agency' | jq .

# Warmup
curl -s https://api.ubl.agency/warmup \
  -H 'X-Tenant: voulezvous' | jq .
```

---

## 📝 Notas sobre Voulezvous Admin

**Padrão congelado:**
- Site público (`voulezvous.tv`) → **aberto** (sem Access)
- Subdomínio admin (`admin.voulezvous.tv`) → **protegido** (com Access)

**Worker valida:**
- JWT apenas em rotas que exigem autenticação
- Policy `vvz_core_v1.yaml` já configurada para isso

**Exemplos no repo:**
- Scripts já refletem esse padrão
- Smoke tests validam tenant correto
- Documentação atualizada

---

## 🆘 Troubleshooting

**Erro: "Access App não encontrada"**
- Verifique se criou as apps no dashboard
- Execute `bash scripts/discover-access.sh` novamente

**Erro: "Placeholders ainda presentes"**
- Verifique se exportou todas as variáveis
- Execute `bash scripts/fill-placeholders.sh` novamente

**Erro: "CORS bloqueado"**
- Verifique se `ORIGIN_ALLOWLIST` está configurado
- Verifique se DNS está proxied (☁️ laranja)

**Admin não pede login:**
- Verifique se a Access App está configurada para o path correto
- Verifique se o Worker está deployado
- Verifique logs: `wrangler tail ubl-flagship-edge`
