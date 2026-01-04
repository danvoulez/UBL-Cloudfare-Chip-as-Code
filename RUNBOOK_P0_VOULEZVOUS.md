# Runbook P0 — Voulezvous (DNS + Tunnel + Core + Gateway)

**Objetivo:** Destravar Party/RTC hoje — deploy completo em um comando.

## Quick Start

### 1. Preparar variáveis

```bash
# Opção A: Carregar do env (recomendado)
source env

# Opção B: Exportar manualmente
export CF_API_TOKEN='<seu_token_cf>'
export CF_ACCOUNT_ID='1f43a14fe5bb62b97e7262c5b6b7c476'
export UBL_ZONE='ubl.agency'
export VVZ_ZONE='voulezvous.tv'
```

### 2. Rodar o runbook

```bash
chmod +x scripts/runbook_p0_voulezvous.sh
./scripts/runbook_p0_voulezvous.sh
```

### 3. (Opcional) Pular deploy do Gateway

```bash
NEEDS_WRANGLER=0 ./scripts/runbook_p0_voulezvous.sh
```

---

## O que o script faz (em ordem)

1. **Descobre Zone IDs**
   - Resolve `ubl.agency` e `voulezvous.tv` via Cloudflare API

2. **Cria DNS do RTC**
   - Cria (se faltar) DNS proxied para `rtc.voulezvous.tv` → `192.0.2.1`

3. **Configura Cloudflare Tunnel**
   - Cria/usa Tunnel `vvz-core`
   - Roteia `core.voulezvous.tv` para `localhost:8787`
   - Gera `~/.cloudflared/config.yml` se não existir

4. **Inicia vvz-core**
   - Se `./target/release/vvz-core` existir, inicia em background
   - Caso contrário, mostra instruções para build manual

5. **Inicia Tunnel**
   - Roda `cloudflared tunnel run vvz-core` em background

6. **Deploy Gateway (opcional)**
   - Se `NEEDS_WRANGLER=1`, faz `wrangler deploy` do `policy-worker`

7. **Smoke Tests**
   - `https://rtc.voulezvous.tv/healthz` → 200
   - `https://core.voulezvous.tv/healthz` → 200
   - `https://voulezvous.tv/_policy/status` → 200
   - Mostra trecho de `/metrics` do core

---

## Proof of Done

Após executar o script, todos estes devem retornar 200:

```bash
curl -s https://rtc.voulezvous.tv/healthz | jq   # => {"ok":true}
curl -s https://core.voulezvous.tv/healthz        # => ok
curl -s https://voulezvous.tv/_policy/status | jq  # => {"tenant":"voulezvous",...}
```

---

## Troubleshooting

### Logs

```bash
tail -f /tmp/vvz-core.log
tail -f /tmp/cloudflared.log
```

### Verificar processos

```bash
ps aux | grep vvz-core
ps aux | grep cloudflared
```

### Parar processos

```bash
kill $(cat /tmp/vvz-core.pid 2>/dev/null) 2>/dev/null || true
kill $(cat /tmp/cloudflared.pid 2>/dev/null) 2>/dev/null || true
```

### Rebuild vvz-core

```bash
cd "$(git rev-parse --show-toplevel)"
cargo build --release --bin vvz-core
```

---

## Dependências

- `curl` — HTTP client
- `jq` — JSON parser
- `cloudflared` — Cloudflare Tunnel CLI
- `wrangler` — Cloudflare Workers CLI (opcional, se `NEEDS_WRANGLER=1`)

---

## Variáveis de Ambiente

| Variável | Descrição | Default | Fonte |
|----------|-----------|---------|-------|
| `CF_API_TOKEN` | Cloudflare API token | - | `env` ou export |
| `CF_ACCOUNT_ID` | Cloudflare Account ID | - | `env` ou export |
| `UBL_ZONE` | Zone UBL | `ubl.agency` | `env` ou export |
| `VVZ_ZONE` | Zone Voulezvous | `voulezvous.tv` | `env` ou export |
| `VVZ_CORE_PORT` | Porta do vvz-core | `8787` | export |
| `NEEDS_WRANGLER` | Deploy Gateway? | `1` | export |

---

## Próximos Passos (após P0)

1. **Media Primitives Smoke**
   ```bash
   ./scripts/smoke_p0_final.sh
   ```

2. **Admin Routes**
   ```bash
   curl -i https://admin.voulezvous.tv/admin/health
   ```

3. **Observabilidade**
   ```bash
   curl -s https://core.voulezvous.tv/metrics | head
   ```

---

## Status Final Esperado

✅ `voulezvous.tv` servindo TV/Party com upstream `/core/**` funcionando  
✅ `rtc.voulezvous.tv` respondendo HTTP e WebSocket  
✅ `core.voulezvous.tv` exposto via Tunnel  
✅ Gateway deployado com `UPSTREAM_CORE` atualizado  
✅ Métricas básicas do Core acessíveis
