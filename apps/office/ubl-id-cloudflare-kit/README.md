# UBL ID — Cloudflare Kit (QR/Device Flow + JWT + JWKS)

This kit sets up an IdP at **id.ubl.agency** with:
- ES256 JWT minting (private/public JWK via secrets)
- `/.well-known/jwks.json` (JWKS)
- Device/QR flow: `/device/start`, `/device/approve`, `/device/poll`
- CORS for `*.ubl.agency`
- KV for device codes
- Domain patch script for your existing Office stack (uses `.ubl.agency` cookies/issuer)

## Quickstart

```bash
# 1) unzip and enter
unzip ubl-id-cloudflare-kit.zip -d ./ && cd "ubl-id-cloudflare-kit"

# 2) patch your env and workers to ubl.agency
bash scripts/patch-office-for-ubl-agency.sh

# 3) deploy IdP (creates KV, prompts for JWK secrets)
bash scripts/deploy-ubl-id.sh
```

After deploy:
- IdP base: `https://id.ubl.agency`
- JWKS: `https://id.ubl.agency/.well-known/jwks.json`
- Device endpoints: `/device/start`, `/device/approve`, `/device/poll`
