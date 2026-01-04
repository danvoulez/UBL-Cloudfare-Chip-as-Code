# 🔐 Cloudflare Access Apps — Setup Guide

## Status Atual

**⚠️ Access Apps ainda não foram criadas**

Os valores no `wrangler.toml` estão como placeholders:
- `ACCESS_AUD_MAP`: `{"ubl":"ubl-flagship-aud","voulezvous":"AUD_VVZ_REPLACE"}`
- `ACCESS_JWKS_MAP`: `{"ubl":"https://1f43a14fe5bb62b97e7262c5b6b7c476.cloudflareaccess.com/cdn-cgi/access/certs","voulezvous":"https://YOUR-VVZ-TEAM.cloudflareaccess.com/cdn-cgi/access/certs"}`

---

## 📝 Como Criar as Access Apps

### 1️⃣ UBL Flagship (tenant: ubl)

1. Acesse: https://dash.cloudflare.com → **Zero Trust** → **Access** → **Applications**
2. Clique em **"Add an application"** → **Self-hosted**
3. Configure:
   - **Name:** `UBL Flagship`
   - **Domain:** `api.ubl.agency`
   - **Session Duration:** `24h`
4. Após criar, anote o **Application Audience (AUD)** que aparece na página da app

### 2️⃣ Voulezvous (tenant: voulezvous)

1. Acesse: https://dash.cloudflare.com → **Zero Trust** → **Access** → **Applications**
2. Clique em **"Add an application"** → **Self-hosted**
3. Configure:
   - **Name:** `Voulezvous`
   - **Domain:** `voulezvous.tv, www.voulezvous.tv` (múltiplos domínios)
   - **Session Duration:** `24h`
4. Após criar, anote o **Application Audience (AUD)** que aparece na página da app

---

## 🔍 Como Obter os Valores (AUD e JWKS)

### Opção 1: Script Automático (recomendado)

Após criar as Access Apps, execute:

```bash
bash scripts/discover-access.sh
```

O script vai:
- Listar todas as Access Apps
- Identificar apps para `api.ubl.agency` e `voulezvous.tv`
- Mostrar os valores de `ACCESS_AUD` e `ACCESS_JWKS` para cada tenant
- Fornecer os comandos prontos para atualizar o `wrangler.toml`

### Opção 2: Manual (Dashboard)

1. Acesse a Access App no dashboard
2. Na página da app, você verá:
   - **Application Audience (AUD)**: Um ID único (ex: `a1b2c3d4e5f6g7h8`)
   - **JWKS Endpoint**: `https://{ACCOUNT_ID}.cloudflareaccess.com/cdn-cgi/access/certs`
     - O `ACCOUNT_ID` é: `1f43a14fe5bb62b97e7262c5b6b7c476` (do seu `env`)

---

## ✅ Após Obter os Valores

Atualize o `policy-worker/wrangler.toml`:

```toml
ACCESS_AUD_MAP = "{\"ubl\":\"AUD_UBL_AQUI\",\"voulezvous\":\"AUD_VVZ_AQUI\"}"
ACCESS_JWKS_MAP = "{\"ubl\":\"https://1f43a14fe5bb62b97e7262c5b6b7c476.cloudflareaccess.com/cdn-cgi/access/certs\",\"voulezvous\":\"https://1f43a14fe5bb62b97e7262c5b6b7c476.cloudflareaccess.com/cdn-cgi/access/certs\"}"
```

**Nota:** O JWKS é o mesmo para ambos os tenants (usa o mesmo Account ID), apenas o AUD muda.

---

## 🚀 Próximos Passos

1. ✅ Criar Access Apps no dashboard
2. ✅ Executar `bash scripts/discover-access.sh` para obter AUDs
3. ✅ Atualizar `wrangler.toml` com os valores reais
4. ✅ Deploy do Worker: `cd policy-worker && wrangler deploy`
5. ✅ Testar multitenancy: `bash scripts/smoke_multitenant.sh`

---

## 📚 Referências

- [Cloudflare Access Documentation](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Blueprint 17 — Multitenant](Blueprint%2017%20—%20Multitenant%20(Gateway%20+%20Po.md)
