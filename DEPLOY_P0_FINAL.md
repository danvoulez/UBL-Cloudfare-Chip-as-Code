# Deploy P0 Final — Login/Party/RTC Redondo

**Objetivo:** Deixar login/party/RTC redondo no ar.

## Prioridade de Deploy (6 passos)

### 1) DNS do RTC (desbloqueia os testes ao vivo)

**O que fazer:**
- Criar registro A `rtc.voulezvous.tv` (proxied ON) apontando para `192.0.2.1` (qualquer IP, Cloudflare vai proxyar)

**Por quê:** O Worker `vvz-rtc` já está no ar; sem DNS ele não responde.

**Proof of Done:**
```bash
curl -s https://rtc.voulezvous.tv/healthz | jq  # => {"ok":true,...}

# opcional: teste WebSocket
websocat "wss://rtc.voulezvous.tv/rooms?id=smoke"
# enviar: {"type":"hello"}  -> recebe {"type":"ack","ok":true}
```

---

### 2) Core API público para sessão (session exchange + whoami)

**O que fazer:**
- Escolher host: `core.voulezvous.tv` (recomendado)
- Opções:
  - **Opção A (Cloudflare Tunnel):** Expor `vvz-core` via Cloudflare Tunnel apontando para `core.voulezvous.tv`
  - **Opção B (Caddy/Nginx no LAB 256):** Reverse proxy apontando para `core.voulezvous.tv`
  - **Opção C (Worker Route):** Adicionar rota no `ubl-flagship-edge` para `core.voulezvous.tv/*` → upstream interno

**Por quê:** Hoje o gateway roteia `/core/**` para `https://origin.core.local` (placeholder). Colocar um core real evita 404.

**Proof of Done:**
```bash
# direto no host do Core
curl -s https://core.voulezvous.tv/healthz
curl -i https://core.voulezvous.tv/whoami
curl -s https://core.voulezvous.tv/metrics | head

# via gateway (depois de atualizar UPSTREAM_CORE e redeploy do policy-worker)
curl -i https://voulezvous.tv/core/healthz  # deve dar 200
```

---

### 3) Atualizar o Gateway com o novo UPSTREAM_CORE

**O que fazer:**
- ✅ **JÁ FEITO:** `policy-worker/wrangler.toml` → `UPSTREAM_CORE="https://core.voulezvous.tv"`
- Deploy: `cd policy-worker && wrangler deploy`

**Por quê:** Amarra o Edge à API real do Core.

**Proof of Done:**
```bash
curl -i https://voulezvous.tv/core/healthz  # deve dar 200
curl -i https://api.ubl.agency/core/healthz  # também deve funcionar
```

---

### 4) Media primitives — smoke completo (upload presign + commit)

**O que fazer:**
- Agora que `ubl-media-api` está deployado e D1/KV prontos, rodar o fluxo de ponta-a-ponta:
  1. `POST /internal/media/presign`
  2. Upload do arquivo para a URL retornada
  3. `POST /internal/media/commit`
  4. `GET /internal/media/link/:id`

**Por quê:** Valida R2/KV/D1 e garante que Party/Circle terão mídia básica operando.

**Proof of Done:**
```bash
# 1) presign
PRESIGN_RESP=$(curl -s -X POST https://api.ubl.agency/internal/media/presign \
  -H 'content-type: application/json' \
  -d '{"tenant":"voulezvous","mime":"image/jpeg","bytes":1234,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}')

echo "$PRESIGN_RESP" | jq
UPLOAD_URL=$(echo "$PRESIGN_RESP" | jq -r '.url')
MEDIA_ID=$(echo "$PRESIGN_RESP" | jq -r '.id')

# 2) PUT no URL retornado (simulado)
echo "test content" | curl -X PUT "$UPLOAD_URL" --data-binary @- -H "Content-Type: image/jpeg"

# 3) commit
COMMIT_RESP=$(curl -s -X POST https://api.ubl.agency/internal/media/commit \
  -H 'content-type: application/json' \
  -d "{\"id\":\"$MEDIA_ID\"}")

echo "$COMMIT_RESP" | jq

# 4) link
curl -i https://api.ubl.agency/internal/media/link/$MEDIA_ID
```

---

### 5) Admin protegido — rotas básicas

**O que fazer:**
- ✅ **JÁ FEITO:** 2 endpoints mínimos atrás do Access (no mesmo `policy-worker`):
  - `GET /admin/health`
  - `POST /admin/policy/promote?tenant=...&stage=next`

**Por quê:** Fecha o ciclo de operação (health e promoção de política sem SSH).

**Proof of Done:**
```bash
# Exige login via Access; depois 200
curl -i https://admin.voulezvous.tv/admin/health

# Promover policy (exige ubl-ops group)
curl -i -X POST https://admin.voulezvous.tv/admin/policy/promote?tenant=voulezvous&stage=next \
  -H "Cf-Access-Jwt-Assertion: <token>" \
  -H "Cf-Access-Groups: ubl-ops"
```

---

### 6) Observabilidade P0 (mínimo que ajuda agora)

**O que fazer:**
- ✅ **JÁ FEITO:** `/metrics` no `vvz-core` (stub Prometheus)
- Subir `otel-collector` no LAB 512 (arquivo já no kit: `observability-starter-kit/otel-collector/config.yaml`)
- Configurar o core para exportar métricas/traços para o collector (OTLP)

**Por quê:** Enxergar erros e latência nas rotas críticas desde o dia 1.

**Proof of Done:**
```bash
# Collector ativo
curl -s http://<collector>:4318/  # porta ativa

# Métricas do Core
curl -s https://core.voulezvous.tv/metrics | head
```

---

## Resultado Esperado

Ao final desses 6 passos:
- ✅ `voulezvous.tv` com gateway funcional e upstream core real
- ✅ `rtc.voulezvous.tv` respondendo WS e health
- ✅ Upload/commit/link de mídia funcionando
- ✅ Painel admin básico protegido por Access
- ✅ Métricas visíveis (ao menos no Core), prontos para grafana/alerts

---

## Patches Aplicados

### ✅ `policy-worker/wrangler.toml`
```toml
UPSTREAM_CORE = "https://core.voulezvous.tv"
```

### ✅ `apps/core-api/src/bin/vvz-core.rs`
- Adicionado endpoint `/metrics` (stub Prometheus)

### ✅ `policy-worker/src/worker.mjs`
- Adicionado `GET /admin/health`
- Adicionado `POST /admin/policy/promote`

---

## Scripts de Deploy

### Deploy Gateway (passo 3)
```bash
cd policy-worker
wrangler deploy
```

### Smoke Test Completo
```bash
# Ver scripts/smoke_p0_final.sh (criar)
```

---

## Próximos Passos

1. **DNS RTC:** Criar A record `rtc.voulezvous.tv` (proxied)
2. **Core API:** Expor `vvz-core` via Tunnel/Caddy → `core.voulezvous.tv`
3. **Deploy Gateway:** `wrangler deploy` no `policy-worker`
4. **Smoke Media:** Rodar fluxo completo de upload
5. **Test Admin:** Validar `/admin/health` e `/admin/policy/promote`
6. **Observabilidade:** Subir `otel-collector` e validar `/metrics`
