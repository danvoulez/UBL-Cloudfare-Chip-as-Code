# Cloudflare Access — Voulezvous

Crie **duas** apps:
1) UBL Flagship (api.ubl.agency) — já pode existir
2) Voulezvous Admin (admin.voulezvous.tv)

Zero Trust → Access → Applications → Add an application → Self-hosted

## Voulezvous Admin
- Name: Voulezvous Admin
- Domain: admin.voulezvous.tv
- Session: 24h
- Policy: Allow group `vvz-ops` (ajuste conforme sua org)

Depois:
```bash
bash scripts/discover-access.sh
export AUD_UBL="..." AUD_VVZ="..." JWKS_TEAM="..."
bash scripts/fill-placeholders.sh
```

Atualize `policy-worker/wrangler.vvz.toml` com:
- `<VVZ_ZONE_ID>`
- `<AUD_UBL>` e `<AUD_VVZ>`
- `<JWKS_TEAM>` (mesmo endpoint JWKS para todos os tenants do time)
