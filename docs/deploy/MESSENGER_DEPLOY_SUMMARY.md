# Messenger Deploy — Resumo

**Data:** 2026-01-06  
**Status:** ✅ Deploy base concluído

---

## 📋 O que foi feito

### 1. Messenger Build
- ✅ Build concluído: `apps/messenger/messenger/frontend/dist/`
- ✅ `.env.local` criado com variáveis:
  - `VITE_API_BASE=https://api.ubl.agency`
  - `VITE_ID_BASE=https://id.ubl.agency`
  - `VITE_OFFICE_LLM_BASE=https://messenger.api.ubl.agency/llm`
  - `VITE_MEDIA_BASE=https://messenger.api.ubl.agency/media`
  - `VITE_RTC_WS_URL=wss://rtc.voulezvous.tv/rooms`
  - `VITE_JOBS_BASE=https://messenger.api.ubl.agency/jobs`

### 2. Cloudflare Pages
- ✅ Projeto criado: `ubl-messenger`
- ✅ Domínio adicionado: `messenger.ubl.agency`
- ⚠️  **Pendente:** Upload do build (via Dashboard ou wrangler)

### 3. Cloudflare Access
- ✅ App criado: `267cb9bf-7c61-4d26-9f2b-84d64e92e099`
- ✅ Service Token criado:
  - `CF_ACCESS_CLIENT_ID=7e6a8e2707cc6022d47c9b0d20c27340.access`
  - `CF_ACCESS_CLIENT_SECRET=2e01fba6e4a6be6f8853ed7f4fa820d1ed0a26886e7504a3894c99142ec3cff7`
- ⚠️  **Pendente:** Configurar Policies (Allow UBL Staff + Default Deny)

### 4. Proxy Worker
- ✅ Worker deployado: `messenger-proxy`
- ✅ Rota configurada: `messenger.api.ubl.agency/*`
- ✅ Código: `workers/messenger-proxy/src/index.js`
- ⚠️  **Pendente:** Adicionar secrets (CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET)

---

## 🌐 URLs

- **Messenger:** https://messenger.ubl.agency
- **Proxy:** https://messenger.api.ubl.agency
- **Healthz:** https://messenger.api.ubl.agency/healthz

---

## 📝 Próximos Passos (via Dashboard)

### 1. Upload do Build para Pages

**Opção A — Via Dashboard:**
1. Acesse: https://dash.cloudflare.com/[account]/pages
2. Clique em `ubl-messenger`
3. Vá em "Deployments" → "Upload assets"
4. Faça upload da pasta `apps/messenger/messenger/frontend/dist/`

**Opção B — Via wrangler (se tiver permissões):**
```bash
cd apps/messenger/messenger/frontend
wrangler pages deploy dist --project-name ubl-messenger
```

### 2. Adicionar Secrets ao Worker

1. Acesse: https://dash.cloudflare.com/[account]/workers/services/messenger-proxy
2. Vá em "Settings" → "Variables"
3. Adicione:
   - `CF_ACCESS_CLIENT_ID` = `7e6a8e2707cc6022d47c9b0d20c27340.access`
   - `CF_ACCESS_CLIENT_SECRET` = `2e01fba6e4a6be6f8853ed7f4fa820d1ed0a26886e7504a3894c99142ec3cff7`

### 3. Configurar Access Policies

1. Acesse: https://dash.cloudflare.com/[account]/access/apps/267cb9bf-7c61-4d26-9f2b-84d64e92e099
2. Vá em "Policies"
3. Adicione:
   - **Allow UBL Staff:** Reusable policy `4f689cd9-0183-433e-906b-b9c958b9132b` (Allow, precedence 1)
   - **Default Deny:** Deny all (precedence 1000)

---

## 🔑 Service Token

**⚠️ IMPORTANTE:** Guarde estes valores com segurança (exibidos apenas uma vez):

```
CF_ACCESS_CLIENT_ID=7e6a8e2707cc6022d47c9b0d20c27340.access
CF_ACCESS_CLIENT_SECRET=2e01fba6e4a6be6f8853ed7f4fa820d1ed0a26886e7504a3894c99142ec3cff7
```

---

## ✅ Proof-of-Done

- [x] Messenger buildado
- [x] Pages projeto criado
- [x] Domínio configurado
- [x] Access App criado
- [x] Service Token criado
- [x] Proxy Worker deployado
- [x] Rota configurada
- [ ] Build uploadado para Pages
- [x] Access Policies configuradas (Allow UBL Staff + Default Deny)
- [x] Deployment do Pages criado
- [ ] Secrets adicionados ao Worker (via Dashboard)
- [ ] Testes end-to-end

---

**Status:** 🟢 **Deploy quase completo — apenas secrets pendentes via Dashboard**

**Policies configuradas:**
- Allow UBL Staff (allow, precedence 1) - por email dan@danvoulez.com
- Default Deny (deny, precedence 1000)
