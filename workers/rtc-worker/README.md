# RTC Signaling Worker — RoomDO

WebSocket signaling para Party/Circle com Durable Object RoomDO.

## Endpoints

- `wss://rtc.voulezvous.tv/rooms?id=<roomId>` — WebSocket signaling
- `GET /healthz` — Health check

## Eventos

- `hello` → `ack` (handshake)
- `presence.update` → fan-out (contagem online)
- `signal` → pass-through (SDP/ICE para WebRTC)
- `ping` → heartbeat automático (15s)

## Deploy

```bash
wrangler deploy --name vvz-rtc --config wrangler.toml
```

## Proof of Done

```bash
# Health
curl -s https://rtc.voulezvous.tv/healthz | jq

# WebSocket (usando websocat)
websocat -v "wss://rtc.voulezvous.tv/rooms?id=smoke"
# Envie: {"type":"hello"}
# Deve responder: {"type":"ack","ok":true}
```

## DNS

Adicione no Cloudflare DNS:
- Name: `rtc`
- Type: A
- IPv4: `192.0.2.1` (dummy)
- Proxy: Proxied (☁️)
