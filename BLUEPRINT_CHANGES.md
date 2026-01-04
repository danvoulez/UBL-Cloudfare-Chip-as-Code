# Mudanças Incorporadas dos Blueprints

**Data:** 2026-01-03

## ✅ Blueprint 01 — Edge Gateway (Worker)

### Implementado:

1. **Roteamento por prefixo** (`policy-worker/src/worker.mjs`)
   - `/core/*`, `/admin/*`, `/files/*` → `UPSTREAM_CORE`
   - `/webhooks/*` → `UPSTREAM_WEBHOOKS`
   - Fallback para `UPSTREAM_CORE` se não houver match

2. **KV keys com shadow promotion** (`policy-worker/src/worker.mjs`)
   - Carrega `policy_yaml_active` / `policy_pack_active` primeiro
   - Fallback para `policy_yaml` / `policy_pack` (compatibilidade)
   - Suporta modelo shadow → promote do Blueprint

3. **Variáveis de ambiente** (`policy-worker/wrangler.toml`)
   - `UPSTREAM_CORE` (vars)
   - `UPSTREAM_WEBHOOKS` (vars)
   - Mantém `UPSTREAM_HOST` como fallback

### Blueprint atualizado:
- Comandos `wrangler kv key put` corrigidos (usando `--binding=UBL_FLAGS`)
- Documentação de shadow → promote adicionada

---

## ✅ Blueprint 02 — Policy-Proxy (LAB 256)

### Implementado:

1. **Roteamento por prefixo** (`policy-proxy/src/main.rs`)
   - `/core/*`, `/admin/*`, `/files/*` → `UPSTREAM_CORE`
   - `/webhooks/*` → `UPSTREAM_WEBHOOKS`
   - Fallback para `UPSTREAM_CORE` se não houver match

2. **Shadow promotion no reload** (`policy-proxy/src/main.rs`)
   - `POST /_reload?stage=next` → carrega `pack.next.json` e `yaml.next.yaml`
   - `POST /_reload` (sem stage) → carrega `pack.json` e `yaml.yaml`
   - Resposta inclui `{"ok":true,"reloaded":true,"stage":"active|next"}`

3. **Variáveis de ambiente** (`policy-proxy/src/main.rs`)
   - `UPSTREAM_CORE` (substitui `UPSTREAM`)
   - `UPSTREAM_WEBHOOKS` (novo)
   - Mantém compatibilidade com variáveis antigas

### Blueprint atualizado:
- Env vars corrigidas (`POLICY_PUBKEY_PEM_B64`, `POLICY_YAML`, `POLICY_PACK`)
- Service name atualizado (`nova-policy-rs.service`)
- Paths corrigidos (`/var/log/ubl/nova-ledger.ndjson`)

---

## 📋 Resumo das Mudanças

### Código:
- ✅ `policy-worker/src/worker.mjs` — roteamento + KV keys + upstreams
- ✅ `policy-proxy/src/main.rs` — roteamento + shadow promotion + upstreams
- ✅ `policy-worker/wrangler.toml` — vars `UPSTREAM_CORE`, `UPSTREAM_WEBHOOKS`

### Documentação:
- ✅ `Blueprint 01 — Edge Gateway (Worker + Ch.md` — comandos wrangler atualizados
- ✅ `Blueprint 02 — Policy-Proxy (LAB 256).md` — env vars e service atualizados

---

## 🧪 Como Testar

### Worker (Blueprint 01):
```bash
# 1. Publicar política em shadow
wrangler kv key put --binding=UBL_FLAGS policy_yaml_next --path=policies/ubl_core_v3.yaml
wrangler kv key put --binding=UBL_FLAGS policy_pack_next --path=policies/pack.json

# 2. Promover para active
wrangler kv key put --binding=UBL_FLAGS policy_yaml_active --path=policies/ubl_core_v3.yaml
wrangler kv key put --binding=UBL_FLAGS policy_pack_active --path=policies/pack.json

# 3. Testar warmup
curl -s https://api.ubl.agency/warmup | jq

# 4. Testar roteamento
curl -s https://api.ubl.agency/core/whoami  # → UPSTREAM_CORE
curl -s https://api.ubl.agency/webhooks/acme  # → UPSTREAM_WEBHOOKS
```

### Proxy (Blueprint 02):
```bash
# 1. Testar shadow promotion
curl -s -X POST 'http://127.0.0.1:9456/_reload?stage=next'
# Esperado: {"ok":true,"reloaded":true,"stage":"next"}

# 2. Promover para active
sudo cp /etc/ubl/nova/policy/pack.next.json /etc/ubl/nova/policy/pack.json
curl -s -X POST 'http://127.0.0.1:9456/_reload'
# Esperado: {"ok":true,"reloaded":true,"stage":"active"}

# 3. Testar roteamento
curl -s http://127.0.0.1:9456/core/whoami  # → UPSTREAM_CORE
curl -s http://127.0.0.1:9456/webhooks/acme  # → UPSTREAM_WEBHOOKS
```

---

## 🔄 Próximos Passos (Opcional)

1. **Rate-limit buckets** (Blueprint 01):
   - Implementar KV keys `rate:{sub}:{route}` com TTL
   - Adicionar verificação no Worker antes do policy evaluation

2. **Webhook verification** (Blueprint 01):
   - Implementar KV keys `webhook:partner:<name>:key:<id>`
   - Adicionar verificação HMAC-SHA256/Ed25519 no Worker

3. **Métricas com labels** (Blueprint 02):
   - Adicionar labels `{route=..., user=...}` nas métricas Prometheus
   - Expor `upstream_latency_ms{route=...}`
