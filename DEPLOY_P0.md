# Deploy P0 — Bloqueadores Imediatos

**Objetivo:** Colocar `voulezvous.tv` em pé com multitenancy funcional.

**Última atualização:** 2026-01-04

---

## 🎯 Pré-requisitos

- ✅ Cloudflare Account ID e API Token configurados no `env`
- ✅ Team Zero Trust: `voulezvous` (subdomínio)
- ✅ JWKS fixo: `https://voulezvous.cloudflareaccess.com/cdn-cgi/access/certs`

---

## 📋 P0 — Sequência de Deploy (6 passos)

### 1️⃣ Criar as 2 Cloudflare Access Apps

**No Dashboard:**
1. Acesse: https://dash.cloudflare.com → **Zero Trust** → **Access** → **Applications**
2. Clique em **"Add an application"** → **Self-hosted**

**App 1: UBL Flagship**
- **Name:** `UBL Flagship`
- **Domain:** `api.ubl.agency`
- **Session Duration:** `24h`
- **Policy:** Grupo `ubl-ops` (ou o que preferir)

**App 2: Voulezvous Admin**
- **Name:** `Voulezvous Admin`
- **Domain:** `admin.voulezvous.tv`
- **Session Duration:** `24h`
- **Policy:** Grupo `vvz-ops` (ou o que preferir)

**Proof of Done:**
```bash
bash scripts/discover-access.sh
# Deve listar 2 apps e exibir:
# ✅ ACCESS_AUD (AUD_UBL): <valor>
# ✅ ACCESS_AUD (AUD_VVZ_ADMIN): <valor>
```

**Validar JWKS:**
```bash
curl -s https://voulezvous.cloudflareaccess.com/cdn-cgi/access/certs | jq '.keys | length'
# Deve retornar > 0
```

---

### 2️⃣ Preencher Placeholders e Publicar Políticas

**Exportar variáveis:**
```bash
# Pegar os valores do passo 1
export AUD_UBL="<valor_do_discover-access.sh>"
export AUD_VVZ_ADMIN="<valor_do_discover-access.sh>"
```

**Preencher placeholders:**
```bash
bash scripts/fill-placeholders.sh
```

**Publicar políticas por tenant:**
```bash
# Política UBL (v3)
bash scripts/publish.sh --tenant ubl --yaml policies/ubl_core_v3.yaml

# Política Voulezvous (v1)
bash scripts/publish.sh --tenant voulezvous --yaml policies/vvz_core_v1.yaml
```

**Proof of Done:**
```bash
# Verificar políticas ativas
curl -s "https://api.ubl.agency/_policy/status?tenant=ubl" | jq .active.version
curl -s "https://api.ubl.agency/_policy/status?tenant=voulezvous" | jq .active.version
# Deve retornar versões válidas
```

---

### 3️⃣ Deploy do Gateway Multitenant

```bash
wrangler deploy --name ubl-flagship-edge --config policy-worker/wrangler.toml
```

**Proof of Done:**
```bash
# Verificar deploy
wrangler deployments list | grep ubl-flagship-edge

# Testar endpoints
curl -sI https://api.ubl.agency/_policy/status | head -n1       # 200 ou 401 (conforme Access)
curl -sI https://voulezvous.tv/_policy/status | head -n1        # 200 (público)
curl -sI https://admin.voulezvous.tv/_policy/status | head -n1  # 401/403 sem token (protegido)
```

---

### 4️⃣ Recursos de Mídia + Media API Worker

**Criar recursos:**
```bash
# KV para Media
wrangler kv namespace create KV_MEDIA
# Anotar o ID retornado

# D1 para Media
wrangler d1 create ubl-media
# Anotar o ID retornado

# Executar schema
wrangler d1 execute ubl-media --file=apps/media-api-worker/schema.sql
```

**Atualizar wrangler.toml:**
```bash
# Editar apps/media-api-worker/wrangler.toml
# Substituir <KV_MEDIA_ID> e <D1_MEDIA_ID> pelos IDs retornados
```

**Deploy:**
```bash
wrangler deploy --name ubl-media-api --config apps/media-api-worker/wrangler.toml
```

**Proof of Done:**
```bash
# Verificar recursos
wrangler kv namespace list | grep KV_MEDIA
wrangler d1 list | grep ubl-media

# Testar endpoint
curl -s -X POST https://api.ubl.agency/internal/media/presign \
  -H "Content-Type: application/json" \
  -d '{}' | jq .ok
# Deve retornar true ou erro esperado (não 404)
```

**Nota:** Se o bucket R2 `ubl-media` ainda não existir:
- Criar via Terraform/Dashboard
- Configurar CORS para `voulezvous.tv` e `www.voulezvous.tv`
- Sem isso, presign vai falhar

---

### 5️⃣ DNS/Routes Finais

**Garantir DNS proxied:**
- `voulezvous.tv` → proxied (☁️ laranja)
- `www.voulezvous.tv` → proxied (☁️ laranja)
- `admin.voulezvous.tv` → proxied (☁️ laranja)

**Verificar rotas no wrangler.toml:**
- As rotas já estão configuradas no `policy-worker/wrangler.toml`
- Se necessário, adicionar rotas para `voulezvous.tv` e `www.voulezvous.tv` (com Zone ID correto)

**Proof of Done:**
```bash
# Verificar DNS
nslookup voulezvous.tv
nslookup admin.voulezvous.tv

# Testar endpoints
curl -sI https://admin.voulezvous.tv/_policy/status | head -n1  # 401/403 sem Access
```

---

### 6️⃣ Smoke Tests

```bash
# Smoke multitenant
bash scripts/smoke_multitenant.sh

# Smoke Voulezvous
bash scripts/smoke_vvz.sh
```

**Proof of Done:**
- Todos os testes retornam "OK" (status 200/204)
- Nenhum erro crítico nos logs

---

## ✅ Checklist Final

- [ ] 2 Access Apps criadas (UBL Flagship + Voulezvous Admin)
- [ ] `discover-access.sh` retorna `AUD_UBL` e `AUD_VVZ_ADMIN`
- [ ] JWKS do voulezvous acessível (`voulezvous.cloudflareaccess.com`)
- [ ] Placeholders preenchidos (`fill-placeholders.sh`)
- [ ] Políticas publicadas por tenant (`publish.sh`)
- [ ] Gateway deployado (`ubl-flagship-edge`)
- [ ] KV/D1 de Media criados
- [ ] Media API Worker deployado (`ubl-media-api`)
- [ ] DNS proxied para `voulezvous.tv`, `www.voulezvous.tv`, `admin.voulezvous.tv`
- [ ] Smoke tests passando

---

## 🚀 P1 — Próximos Passos (após P0 no ar)

1. **Core API (Blueprint 03):**
   - Validar JWT ES256 no `vvz-core.rs` (session exchange)
   - Implementar `/files/presign/*` (R2 real)

2. **Observabilidade (Blueprint 09):**
   - Worker → OTLP Collector (métricas/logs)

3. **Streaming (Blueprint 13/10):**
   - Integrar Cloudflare Stream/WebRTC signaling
   - Preparar LL-HLS/SFU no LAB 512

---

## 📝 Notas Importantes

- **`voulezvous.tv`** permanece **público** (stream/party)
- **`admin.voulezvous.tv`** é **protegido** por Access (operações/admin)
- **CORS** já está restrito para o site público (`ORIGIN_ALLOWLIST`)
- **JWKS** está fixo no `wrangler.toml` (não precisa mais preencher)

---

## 🆘 Troubleshooting

### Access Apps não aparecem no `discover-access.sh`
- Verificar se as apps foram criadas no mesmo account
- Verificar permissões do API Token (`access:read`)

### Políticas não carregam
- Verificar se as chaves estão na KV (`wrangler kv key list --namespace-id <id>`)
- Verificar se o Worker está deployado
- Verificar logs: `wrangler tail --name ubl-flagship-edge`

### Media API retorna 404
- Verificar se as rotas estão configuradas no `wrangler.toml`
- Verificar se o Worker está deployado
- Verificar se o Zone ID está correto

---

**Última atualização:** 2026-01-04
