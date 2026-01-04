# Deploy P0 — Próximos Passos

**Status:** P0 base no ar ✅  
**Próximo:** Media Primitives + RTC Signaling

---

## 🎯 Sequência de Deploy (P0 Imediato)

### 1️⃣ Media Primitives (KV/D1 + Media API Worker)

**Por quê:** Habilita upload/presign, sessões de live e tokens — base para Party/Stage.

```bash
bash scripts/deploy-media-primitives.sh
```

**O que faz:**
- Cria KV namespace `KV_MEDIA`
- Cria D1 database `ubl-media`
- Executa schema SQL
- Atualiza `apps/media-api-worker/wrangler.toml` com IDs
- Deploy do Media API Worker

**Proof of Done:**
```bash
curl -s -X POST https://api.ubl.agency/internal/media/presign \
  -H 'content-type: application/json' \
  -d '{}' | jq .ok
# Deve retornar: true
```

---

### 2️⃣ RTC Signaling (Durable Object RoomDO)

**Por quê:** Necessário para presença/câmeras no Party/Circle (sem SFU ainda).

**Pré-requisito: DNS**
No Cloudflare DNS, adicione:
- **Name:** `rtc`
- **Type:** A
- **IPv4:** `192.0.2.1` (dummy)
- **Proxy:** Proxied (☁️ laranja)

**Deploy:**
```bash
cd rtc-worker
npm install
wrangler deploy --name vvz-rtc --config wrangler.toml
# OU
bash scripts/deploy-rtc.sh
```

**Proof of Done:**
```bash
# Health
curl -s https://rtc.voulezvous.tv/healthz | jq
# => {"ok":true,"ts":...}

# WebSocket (usando websocat)
websocat -v "wss://rtc.voulezvous.tv/rooms?id=smoke"
# Envie: {"type":"hello"}
# Deve responder: {"type":"ack","ok":true}
```

**Eventos suportados:**
- `hello` → `ack` (handshake)
- `presence.update` → fan-out (contagem online)
- `signal` → pass-through (SDP/ICE para WebRTC)
- `ping` → heartbeat automático (15s)

---

### 3️⃣ vvz-core (Session Exchange com JWT ES256)

**Por quê:** Login UBL ID em `voulezvous.tv` emitindo cookie first-party com segurança.

**Como:**
1. Apontar `UPSTREAM_CORE` do Edge para o host real do Core (Caddy/LAB)
2. No `vvz-core.rs`, validar o token ES256 recebido no `/api/session/exchange` contra o JWKS do UBL
3. Emitir `Set-Cookie: sid=...; Secure; HttpOnly; SameSite=Lax`

**Proof of Done:**
```bash
# Com token válido
curl -s -X POST https://voulezvous.tv/api/session/exchange \
  -H 'content-type: application/json' \
  -d '{"token":"<jwt_ubl>"}' -i | grep -i set-cookie

curl -s https://voulezvous.tv/whoami
```

---

### 4️⃣ Admin Mínimo (Health + Policy Promote)

**Por quê:** Operação segura sem SSH: promover política, checar saúde.

**Rotas:**
- `GET /admin/health`
- `POST /admin/policy/promote?tenant=&stage=next`

**Gate:** Access (AUD_VVZ_ADMIN) + bit `P_Is_Admin_Path`

**Proof of Done:**
```bash
# Sem Access → 401/403
curl -sI https://admin.voulezvous.tv/admin/health | head -n1

# Com Cf-Access-Jwt-Assertion → 200
curl -sI https://admin.voulezvous.tv/admin/health \
  -H "Cf-Access-Jwt-Assertion: <token>" | head -n1
```

---

### 5️⃣ Observabilidade (Worker → OTLP Collector)

**Por quê:** Ver erro/latência por tenant antes de abrir Party.

**Como:**
- Emitir `trace_id/tenant` do Worker para o Collector (`otel-collector/config.yaml` já existe)
- Publicar dashboard `00-executive` com latência/p95 por rota/tenant

**Proof of Done:** Painel com séries `tenant="voulezvous"` atualizando em tempo real.

---

### 6️⃣ (P1) Cloudflare Stream / LL-HLS Packager / Recording

**Por quê:** Habilita Stage público com baixa latência e playback confiável.

**Como:**
- Secrets `STREAM_ACCOUNT_ID` / `STREAM_API_TOKEN`
- Rotas `/media/stream-live/*`, snapshot/refresh

**Proof of Done:** `ffmpeg -re ...` → playback m3u8 toca no `hls-player.html`

---

## 📋 Checklist Rápido

- [ ] **1. Media Primitives:** `bash scripts/deploy-media-primitives.sh`
- [ ] **2. DNS RTC:** Adicionar `rtc.voulezvous.tv` (A record, proxied)
- [ ] **3. RTC Worker:** `bash scripts/deploy-rtc.sh`
- [ ] **4. Validar RTC:** `curl -s https://rtc.voulezvous.tv/healthz | jq`
- [ ] **5. vvz-core JWT:** Implementar validação ES256
- [ ] **6. Admin routes:** Implementar `/admin/health` e `/admin/policy/promote`
- [ ] **7. Observabilidade:** Integrar Worker → OTLP Collector
- [ ] **8. Stream:** Configurar Cloudflare Stream (P1)

---

**Última atualização:** 2026-01-04
