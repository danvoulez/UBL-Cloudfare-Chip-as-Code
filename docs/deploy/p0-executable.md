# Deploy P0 — Executável (6 Passos)

**Objetivo:** Colocar `voulezvous.tv` em pé com multitenancy funcional.

**Última atualização:** 2026-01-04

---

## ⚠️ Pré-requisito: Criar Access Apps

**Você precisa criar 2 Access Apps no dashboard antes de começar:**

1. **UBL Flagship**
   - Dashboard: https://dash.cloudflare.com → Zero Trust → Access → Applications
   - Add an application → Self-hosted
   - Name: `UBL Flagship`
   - Domain: `api.ubl.agency`
   - Session: `24h`

2. **Voulezvous Admin**
   - Add an application → Self-hosted
   - Name: `Voulezvous Admin`
   - Domain: `admin.voulezvous.tv`
   - Session: `24h`

**Depois, execute:**
```bash
bash scripts/discover-access.sh
# Anote: AUD_UBL=... e AUD_VVZ_ADMIN=...
```

---

## 🚀 Sequência de Deploy (6 Passos)

### 1️⃣ Cloudflare Access (Bloqueador #1)

```bash
# Descobrir AUDs das Access Apps criadas
bash scripts/discover-access.sh
```

**Anotar:**
- `AUD_UBL=...`
- `AUD_VVZ_ADMIN=...`

**Proof of Done:**
```bash
bash scripts/discover-access.sh | grep AUD_
# Deve exibir AUD_UBL e AUD_VVZ_ADMIN

curl -s https://voulezvous.cloudflareaccess.com/cdn-cgi/access/certs | jq '.keys | length'
# Deve retornar > 0
```

---

### 2️⃣ Preencher Placeholders + Publicar Políticas

```bash
# Exportar variáveis (valores do passo 1)
export AUD_UBL="<valor_do_discover-access.sh>"
export AUD_VVZ_ADMIN="<valor_do_discover-access.sh>"

# Preencher placeholders
bash scripts/fill-placeholders.sh

# Publicar políticas na KV (active)
bash scripts/publish.sh --tenant ubl --yaml policies/ubl_core_v3.yaml
bash scripts/publish.sh --tenant voulezvous --yaml policies/vvz_core_v1.yaml
```

**Proof of Done:**
```bash
curl -s "https://api.ubl.agency/_policy/status?tenant=ubl" | jq .active.version
# Deve retornar versão válida

curl -s "https://api.ubl.agency/_policy/status?tenant=voulezvous" | jq .active.version
# Deve retornar versão válida
```

---

### 3️⃣ Deploy do Edge (Gateway Multitenant)

```bash
wrangler deploy --name ubl-flagship-edge --config policy-worker/wrangler.toml
```

**Proof of Done:**
```bash
# Público (sem Access)
curl -sI https://voulezvous.tv/_policy/status | head -n1
# Deve retornar: HTTP/2 200

# Admin (sem Access token deve negar)
curl -sI https://admin.voulezvous.tv/_policy/status | head -n1
# Deve retornar: HTTP/2 401 ou 403
```

---

### 4️⃣ Media Primitives (KV + D1) e Deploy do Media API

```bash
# Criar KV
wrangler kv namespace create KV_MEDIA
# Anotar o ID retornado

# Criar D1
wrangler d1 create ubl-media
# Anotar o ID retornado

# Executar schema
wrangler d1 execute ubl-media --file=apps/media-api-worker/schema.sql

# Editar apps/media-api-worker/wrangler.toml
# Substituir <KV_MEDIA_ID> e <D1_MEDIA_ID> pelos IDs retornados

# Deploy
wrangler deploy --name ubl-media-api --config apps/media-api-worker/wrangler.toml
```

**Proof of Done:**
```bash
wrangler kv namespace list | grep KV_MEDIA
# Deve listar KV_MEDIA

wrangler d1 list | grep ubl-media
# Deve listar ubl-media

curl -s -X POST https://api.ubl.agency/internal/media/presign \
  -H 'content-type: application/json' \
  -d '{}' | jq .ok
# Deve retornar: true (ou erro esperado, não 404)
```

**Nota:** Se o bucket R2 `ubl-media` ainda não existir:
- Criar via Dashboard ou Terraform
- Configurar CORS para `voulezvous.tv` e `www.voulezvous.tv`

---

### 5️⃣ DNS/Routes Finais (Cloudflare DNS)

**No Dashboard:**
- `voulezvous.tv` → registro A/AAAA proxied (☁️ laranja)
- `admin.voulezvous.tv` → registro A/AAAA proxied (☁️ laranja)

**Proof of Done:**
```bash
nslookup voulezvous.tv
# Deve resolver para IPs do Cloudflare

nslookup admin.voulezvous.tv
# Deve resolver para IPs do Cloudflare
```

---

### 6️⃣ Smokes Finais

```bash
bash scripts/smoke_multitenant.sh
bash scripts/smoke_vvz.sh
```

**Proof of Done:**
- Todos os testes retornam "OK" (status 200/204)
- Nenhum erro crítico nos logs

---

## ✅ Entrega P0 (Checklist Final)

- [ ] 2 Access Apps criadas (UBL Flagship + Voulezvous Admin)
- [ ] `AUD_UBL` e `AUD_VVZ_ADMIN` descobertos
- [ ] Placeholders preenchidos (`fill-placeholders.sh`)
- [ ] Políticas publicadas (ubl v3 + voulezvous v1)
- [ ] Gateway deployado (`ubl-flagship-edge`)
- [ ] KV/D1 de Media criados
- [ ] Media API deployado (`ubl-media-api`)
- [ ] DNS proxied para `voulezvous.tv` e `admin.voulezvous.tv`
- [ ] Smoke tests passando

**Quando tudo acima estiver ✅:**
- ✅ Edge multitenant ativo (tenants: ubl, voulezvous)
- ✅ Admin protegido por Access (AUD verificado)
- ✅ Políticas v3 (ubl) e v1 (voulezvous) ativas na KV
- ✅ Media API on-air com KV/D1 criados (presign funcionando)

---

## 🆘 Troubleshooting Rápido

### Access Apps não aparecem
- Verificar se foram criadas no mesmo account
- Verificar permissões do API Token (`access:read`)

### Políticas não carregam
- Verificar KV: `wrangler kv key list --namespace-id fe402d39cc544ac399bd068f9883dddf`
- Verificar logs: `wrangler tail --name ubl-flagship-edge`

### Media API retorna 404
- Verificar rotas no `wrangler.toml`
- Verificar Zone ID correto

---

**Última atualização:** 2026-01-04
