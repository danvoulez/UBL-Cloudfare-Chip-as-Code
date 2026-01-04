# Blueprint 13 — Streaming/Broadcast — Implementação

**Data:** 2026-01-03

## ✅ Endpoints Implementados

### Stage (Live + VOD)

1. **POST /media/stream-live/inputs**
   - Cria Live Input (Cloudflare Stream ou stub)
   - Retorna `input_id`, `ingest` (rtmps_url, rtmps_key, srt_url)`, `playback` (hls_path, dash_path)
   - Suporta `record`, `dvr`, `latency` (ultra_low/low)

2. **POST /media/tokens/stream**
   - Emite Signed URL para playback HLS/DASH
   - Suporta `ttl_sec`, `aud`, `claims` (tenant, user)
   - Retorna URL com token JWT-like

### RTC/WebRTC (Party/Circle/Roulette)

3. **POST /rtc/rooms**
   - Cria/resolve sala WebRTC
   - Retorna `ws_url`, `ice_servers`, `auth.token`
   - Suporta `room_kind` (party/circle/roulette), `max_participants`, `record`

---

## 📄 Exemplos Criados

### HTTP Contracts
- `examples/stream-stage.http` — Stage endpoints
- `examples/rtc-rooms.http` — RTC endpoints

### Player (sem reload)
- `examples/hls-player.html` — Player HLS com `swapStream()` sem reload
- Inclui função `window.swapStream(newInputId)` para troca suave

### WebRTC Join
- `examples/rtc-join.js` — Join room com hand-over
- Inclui função `handoverRoom()` para trocar de sala sem interromper vídeo

### ffmpeg Scripts
- `examples/ffmpeg-publish.sh` — Scripts para RTMPS e SRT

---

## 🔧 Configuração

### Secrets (opcional, para Cloudflare Stream real):
```bash
wrangler secret put STREAM_API_TOKEN
wrangler secret put STREAM_ACCOUNT_ID
```

### Vars (wrangler.toml):
```toml
RTC_WS_URL = "wss://rtc.api.ubl.agency/rooms"
TURN_SERVERS = "[{\"urls\":[\"stun:stun.l.google.com:19302\"]}]"
```

---

## 📋 Uso Rápido

### 1. Criar Live Input
```bash
curl -X POST https://api.ubl.agency/media/stream-live/inputs \
  -H "Content-Type: application/json" \
  -d '{"channel_id":"stage:dan","record":true,"dvr":true,"latency":"low"}'
```

### 2. Publicar (ffmpeg)
```bash
./examples/ffmpeg-publish.sh li_01JABC... li_01JABC..._KEY
```

### 3. Player (HTML)
Abrir `examples/hls-player.html` no browser e inserir `input_id`.

### 4. Criar Sala RTC
```bash
curl -X POST https://api.ubl.agency/rtc/rooms \
  -H "Content-Type: application/json" \
  -d '{"room_kind":"circle","room_id":"room_01KXYZ","max_participants":8}'
```

---

## 🎯 Próximos Passos

1. **Integração Cloudflare Stream real:**
   - Configurar `STREAM_API_TOKEN` e `STREAM_ACCOUNT_ID`
   - Testar criação de Live Input via Stream API

2. **WebSocket Signaling:**
   - Implementar servidor WebSocket para RTC (`ws_url`)
   - Handshake SDP (offer/answer) e ICE candidates

3. **Signed URLs reais:**
   - Implementar JWT ES256 para tokens de playback
   - Validar tokens no player/CDN

---

## 📚 Referências

- **Worker:** `apps/media-api-worker/src/worker.ts`
- **README:** `apps/media-api-worker/README.md`
- **Exemplos:** `apps/media-api-worker/examples/`
