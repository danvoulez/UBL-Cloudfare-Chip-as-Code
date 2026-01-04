# Voulezvous — Kit de Integração Cloudflare

Este diretório contém a documentação e templates para o tenant **Voulezvous** (app social de vídeo).

## 📋 Documentação

- **[HOSTS_TENANTS.md](./HOSTS_TENANTS.md)** — Mapeamento canônico Host ↔ Tenant e deep links
- **[OMNI-MODES.md](./OMNI-MODES.md)** — Definições oficiais dos modos (Party, Circle, Roulette, Stage) + Mirror e Strong Presence Lock
- **[ACCESS_APPS_VVZ.md](./ACCESS_APPS_VVZ.md)** — Passos para criar o Access do admin (`admin.voulezvous.tv`) e preencher AUD/JWKS
- **[DEEPLINKS.md](./DEEPLINKS.md)** — Spec curta de deep links (room/profile/invite/Stage)

## 🚀 Quick Start

### 1. Criar Access App do Admin

Zero Trust → Access → Applications → Add an application → Self-hosted:
- **Name:** Voulezvous Admin
- **Domain:** `admin.voulezvous.tv`
- **Session:** 24h
- **Policy:** grupo `vvz-ops` (ou o que preferir)

### 2. Descobrir IDs

```bash
# Descobrir Zone ID do voulezvous.tv
bash scripts/discover-vvz-zone.sh

# Descobrir AUD/JWKS das Access Apps
bash scripts/discover-access.sh
```

### 3. Preencher Placeholders

```bash
export VVZ_ZONE_ID="<zone_id>"
export AUD_UBL="<aud_ubl>"
export AUD_VVZ="<aud_vvz>"
export JWKS_TEAM="<jwks_url>"

bash scripts/fill-placeholders.sh
```

### 4. Deploy

```bash
# Deploy do Edge Worker para Voulezvous
wrangler deploy --name vvz-edge --config policy-worker/wrangler.vvz.toml
```

### 5. Smoke Test

```bash
bash scripts/smoke_vvz.sh
```

## 📁 Arquivos do Kit

- **`policy-worker/wrangler.vvz.toml`** — Config do `vvz-edge` Worker
- **`apps/core-api/src/bin/vvz-core.rs`** — Core API para Voulezvous (session exchange, whoami)
- **`scripts/smoke_vvz.sh`** — Smoke test unificado
- **`templates/abac.vvz.policy.json`** — Esqueleto ABAC mínimo pro tenant voulezvous

## 🎯 Padrões Congelados

- **Site público:** `voulezvous.tv` → aberto (sem Access)
- **Admin:** `admin.voulezvous.tv` → protegido (com Access JWT)
- **Gating:** por host (mais simples e compatível)

## 🔗 Links Úteis

- [RUNBOOK_P0_MULTITENANT.md](../../RUNBOOK_P0_MULTITENANT.md) — Runbook completo de multitenancy
- [RUNBOOK_ACCESS_APPS.md](../../RUNBOOK_ACCESS_APPS.md) — Runbook de criação de Access Apps
- [Blueprint 17 — Multitenant](../../Blueprint%2017%20—%20Multitenant%20(Gateway%20+%20Po.md) — Especificação técnica
