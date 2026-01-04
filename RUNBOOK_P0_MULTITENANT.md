# 🚀 Runbook P0 — Multitenant Cloudflare

## Status: Base Pronta ✅

- ✅ `ubl-flagship-edge` (Gateway) com multitenant
- ✅ `scripts/smoke.sh` criado
- ✅ `policies/vvz_core_v1.yaml` existe
- ✅ Placeholders configurados nos `wrangler.toml`

---

## 1️⃣ Cloudflare Access (AUD/JWKS)

### Opções

**Opção A (recomendada):** Mesmo Zero Trust Team para ambas apps
- Cada app tem AUD próprio
- JWKS é o mesmo (do time)

**Opção B (isolamento forte):** Voulezvous em outro Team/conta
- JWKS diferente por tenant
- Suportado pelo `ACCESS_JWKS_MAP` tenant-aware

### Criar as Apps

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

### Descobrir Valores

```bash
bash scripts/discover-access.sh
```

Anote:
- `<AUD_UBL>` (UBL Flagship)
- `<AUD_VVZ>` (Voulezvous)
- `<JWKS_TEAM>` (URL do time: `...cloudflareaccess.com/cdn-cgi/access/certs`)

### Preencher Placeholders

**Opção 1: Script automático (recomendado)**
```bash
export AUD_UBL="<audience_UBL>"
export AUD_VVZ="<audience_Voulezvous>"
export JWKS_TEAM="https://SEU-TIME.cloudflareaccess.com/cdn-cgi/access/certs"
bash scripts/fill-placeholders.sh
```

**Opção 2: Manual**
Edite `policy-worker/wrangler.toml`:
```toml
ACCESS_AUD_MAP  = "{\"ubl\":\"<AUD_UBL>\",\"voulezvous\":\"<AUD_VVZ>\"}"
ACCESS_JWKS_MAP = "{\"ubl\":\"<JWKS_TEAM>\",\"voulezvous\":\"<JWKS_TEAM>\"}"
```

---

## 2️⃣ DNS (requerido para as rotas pegarem)

Cloudflare DNS → crie (ou confirme) registros proxied (☁️ laranja):

- `api.ubl.agency` → CNAME para raiz/apex (ou "dummy" 192.0.2.1)
- `media.api.ubl.agency` → idem
- `voulezvous.tv` e `www.voulezvous.tv` → apontar para onde servirá o site (Pages/host)

**Importante:** Todos devem estar proxied (☁️ laranja) para CORS/Access funcionarem.

---

## 3️⃣ Media: KV/D1 e Schema (Opcional)

Se for usar Media API agora:

```bash
# Criar KV
wrangler kv namespace create KV_MEDIA
# Anote o ID retornado

# Criar D1
wrangler d1 create ubl-media
# Anote o ID retornado

# Aplicar schema
wrangler d1 execute ubl-media --file=apps/media-api-worker/schema.sql
```

Preencher em `apps/media-api-worker/wrangler.toml`:
```bash
export KV_MEDIA_ID="<id_retornado>"
export D1_MEDIA_ID="<id_retornado>"
bash scripts/fill-placeholders.sh
```

**Nota:** Se ainda não for usar Media, pode pular este bloco — o Gateway funciona sem ele.

---

## 4️⃣ Publicar Políticas na KV (Tenants)

### UBL (já deve existir v2/v3)

Verifique se já está na KV:
```bash
wrangler kv:key get --binding UBL_FLAGS policy_yaml_active
```

### Voulezvous (nova)

**Se já assinou a policy:**
```bash
wrangler kv:key put --binding UBL_FLAGS policy_voulezvous_yaml --path policies/vvz_core_v1.yaml
wrangler kv:key put --binding UBL_FLAGS policy_voulezvous_pack --path /tmp/pack_v1.json

# Ativos (promover)
wrangler kv:key put --binding UBL_FLAGS policy_voulezvous_yaml_active --path policies/vvz_core_v1.yaml
wrangler kv:key put --binding UBL_FLAGS policy_voulezvous_pack_active --path /tmp/pack_v1.json
```

**Se ainda não assinou:**
```bash
./target/release/policy-signer \
  --id vvz_core_v1 \
  --version 1 \
  --yaml policies/vvz_core_v1.yaml \
  --privkey_pem /etc/ubl/nova/keys/policy_signing_private.pem \
  --out /tmp/pack_v1.json

# Depois publique na KV (comandos acima)
```

---

## 5️⃣ Deploy

### Opção 1: Script Completo (Recomendado)

```bash
bash scripts/deploy-multitenant.sh
```

Este script:
1. Descobre Access Apps automaticamente
2. Preenche placeholders
3. Faz deploy do Gateway
4. (Opcional) Faz deploy do Media API
5. Executa smoke test

### Opção 2: Manual

```bash
# Gateway multitenant
wrangler deploy --name ubl-flagship-edge --config policy-worker/wrangler.toml

# (Opcional) Media API
wrangler deploy --name ubl-media-api --config apps/media-api-worker/wrangler.toml
```

---

## 6️⃣ Smoke Test

```bash
bash scripts/smoke.sh
```

**Esperado:**
- `/_policy/status` e `/warmup` → 200 com `"tenant":"voulezvous"`
- CORS preflight refletindo `https://voulezvous.tv`
- (Se Media ativo) presign retorna JSON

---

## 7️⃣ Proof of Done (Checklist)

Marque ✅ quando completar:

- [ ] DNS proxied criado: `api.ubl.agency`, `media.api.ubl.agency`, `voulezvous.tv`, `www.voulezvous.tv`
- [ ] `ACCESS_AUD_MAP` e `ACCESS_JWKS_MAP` preenchidos (sem placeholders)
- [ ] `wrangler deployments list` mostra `ubl-flagship-edge` ativo
- [ ] `curl -s https://api.ubl.agency/_policy/status -H 'X-Tenant: voulezvous' | jq .` retorna `tenant:"voulezvous"`
- [ ] (Opcional) `apps/media-api-worker` deployado e presign responde

---

## 🔍 Validação Rápida

```bash
# Status do tenant
curl -s https://api.ubl.agency/_policy/status -H 'X-Tenant: voulezvous' | jq .

# Warmup
curl -s https://api.ubl.agency/warmup -H 'X-Tenant: voulezvous' | jq .

# Browser (no console de voulezvous.tv)
fetch("https://api.ubl.agency/_policy/status", {
  headers: { "X-Tenant": "voulezvous" },
  credentials: "include"
}).then(r=>r.json()).then(console.log)
```

---

## 📚 Scripts Disponíveis

1. **`scripts/discover-access.sh`** — Descobre Access Apps e mostra AUD/JWKS
2. **`scripts/fill-placeholders.sh`** — Preenche placeholders nos wrangler.toml
3. **`scripts/deploy-multitenant.sh`** — Script completo (descobre + preenche + deploy)
4. **`scripts/smoke.sh`** — Smoke test unificado (6 testes)

---

## 🆘 Troubleshooting

**Erro: "Nenhuma Access App encontrada"**
- Crie as Access Apps no dashboard primeiro
- Execute `bash scripts/discover-access.sh` novamente

**Erro: "Placeholders ainda presentes"**
- Verifique se exportou todas as variáveis: `AUD_UBL`, `AUD_VVZ`, `JWKS_TEAM`
- Execute `bash scripts/fill-placeholders.sh` novamente

**Erro: "DNS não resolve"**
- Verifique se os registros DNS estão proxied (☁️ laranja)
- Aguarde alguns minutos para propagação

**Erro: "CORS bloqueado"**
- Verifique se `ORIGIN_ALLOWLIST` está configurado corretamente
- Verifique se o DNS está proxied

---

## 📝 Notas

- **Teams:** Pode usar o mesmo Team do Zero Trust para UBL e Voulezvous — muda só o AUD por app; o JWKS é o mesmo.
- **Isolamento:** Se quiser isolamento forte, crie outro Team para Voulezvous e preencha `ACCESS_JWKS_MAP` com JWKS diferente. O Gateway já está pronto para isso.
