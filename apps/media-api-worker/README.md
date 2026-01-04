# Media API Worker — Blueprint 10 + 13

**100% Cloudflare:** R2, KV, D1, Queues, Stream (Blueprint 13)

## 📋 Endpoints

### Blueprint 10 (Upload/VOD)
- `POST /internal/media/presign` — R2 presign upload
- `POST /internal/media/commit` — Commit upload (verify sha256)
- `GET /internal/media/link/:id` — Get playback link
- `POST /internal/stream/prepare` — Prepare stream session
- `POST /internal/stream/go_live` — Go live
- `POST /internal/stream/end` — End stream

### Blueprint 13 (Stage + RTC)
- `POST /media/stream-live/inputs` — Create Live Input (RTMPS/SRT + HLS/DASH)
- `POST /media/tokens/stream` — Issue signed playback URL
- `POST /rtc/rooms` — Create/resolve RTC room (WebRTC)

---

## 🚀 Setup

### 1. Create Cloudflare Resources

```bash
# R2 bucket
wrangler r2 bucket create ubl-media

# KV namespace
wrangler kv namespace create KV_MEDIA

# D1 database
wrangler d1 create ubl-media

# Apply schema
wrangler d1 execute ubl-media --file=schema.sql
```

### 2. Configure Secrets (Blueprint 13)

```bash
# Cloudflare Stream API (optional, for real Stream integration)
wrangler secret put STREAM_API_TOKEN
wrangler secret put STREAM_ACCOUNT_ID
```

### 3. Update wrangler.toml

- Replace `REPLACE_WITH_KV_ID` with actual KV namespace ID
- Replace `REPLACE_WITH_D1_ID` with actual D1 database ID
- Configure `RTC_WS_URL` and `TURN_SERVERS` if needed

### 4. Deploy

```bash
wrangler deploy
```

---

## 📝 Examples

### Stage (Live + VOD)

**1. Create Live Input:**
```bash
curl -X POST https://api.ubl.agency/media/stream-live/inputs \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "stage:dan",
    "record": true,
    "dvr": true,
    "latency": "low"
  }'
```

**2. Publish with ffmpeg:**
```bash
./examples/ffmpeg-publish.sh li_01JABC... li_01JABC..._KEY
```

**3. Get signed playback URL:**
```bash
curl -X POST https://api.ubl.agency/media/tokens/stream \
  -H "Content-Type: application/json" \
  -d '{
    "input_id": "li_01JABC...",
    "format": "hls",
    "ttl_sec": 300,
    "aud": "viewer"
  }'
```

**4. Player (HTML):**
See `examples/hls-player.html` — includes swap without reload.

### RTC/WebRTC (Party/Circle/Roulette)

**1. Create Room:**
```bash
curl -X POST https://api.ubl.agency/rtc/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "room_kind": "circle",
    "room_id": "room_01KXYZ",
    "max_participants": 8
  }'
```

**2. Join (Browser):**
See `examples/rtc-join.js` — includes hand-over logic.

---

## 🔧 Configuration

### Environment Variables

- `STREAM_API_TOKEN` (secret) — Cloudflare Stream API token
- `STREAM_ACCOUNT_ID` (secret) — Cloudflare Account ID
- `RTC_WS_URL` (var) — WebSocket URL for RTC signaling
- `TURN_SERVERS` (var) — JSON array of TURN servers

### Defaults

- `RTC_WS_URL`: `wss://rtc.api.ubl.agency/rooms`
- `TURN_SERVERS`: `[{"urls":["stun:stun.l.google.com:19302"]}]`

---

## 📚 References

- **Blueprint 10** — Media & Video (Upload • Live • Playback)
- **Blueprint 13** — Streaming/Broadcast Plan (OMNI + UBL)
- **Cloudflare Stream API**: https://developers.cloudflare.com/stream/

---

## ✅ Proof of Done

- [ ] Create Live Input → get `input_id`
- [ ] Publish with ffmpeg → stream appears in player
- [ ] Get signed URL → player loads HLS
- [ ] Create RTC room → get `ws_url` and `ice_servers`
- [ ] Join room (browser) → WebRTC connection established
- [ ] Swap stream (player) → no reload, seamless transition
