# Arquitetura UBL Flagship — Chip-as-Code

## Visão Geral

Sistema de política unificado com fonte única de verdade (TDLN Rust), assinaturas criptográficas, verificação em 2 camadas e trilho de auditoria imutável.

## Componentes

### 1. tdln-core (Rust)

Motor de decisão unificado compilado para:
- **WASM** (`wasm32-wasi`) → Worker Cloudflare
- **Nativo** → Proxy Rust

**Bits de Política:**
- `P_User_Passkey` (0x01): Usuário tem passkey válida
- `P_Role_Admin` (0x02): Usuário pertence ao grupo ubl-ops
- `P_Circuit_Breaker` (0x04): Break-glass ativo

### 2. Worker Cloudflare (`ubl-flagship-edge`)

**Stack:**
- TDLN WASM (motor de decisão)
- JWKS cache (validação Access sem rede síncrona)
- Durable Object (break-glass state global)
- KV (policy_pack assinado)
- Queues (eventos → R2)
- R2 (ledger imutável)

**Endpoints:**
- `/*` → Avaliação de política
- `/breakglass` → Gerenciamento break-glass (protegido por Access)

### 3. Proxy Rust (`ubl-policy-proxy`)

**Stack:**
- axum (HTTP server)
- tdln-core nativo
- Ledger local (últimas 1000 decisões)
- Prometheus metrics (`/metrics`)
- Break-glass state (sync com Worker via API)

**Endpoints:**
- `/evaluate/*path` → Avaliação de política
- `/breakglass` → Gerenciamento break-glass
- `/metrics` → Métricas Prometheus
- `/ledger` → Ledger local (debug)

### 4. policy-pack

Pipeline de assinatura:
1. YAML → BLAKE3 hash
2. Hash → Ed25519 assinatura
3. Pack → `pack.json` (hash + signature + public_key)

**Validação:**
- Worker: lê `policy_pack` do KV, verifica assinatura
- Proxy: confere BLAKE3 do YAML = pack.hash

## Fluxo de Decisão

```
Request → Worker (Edge)
  ├─ Verifica policy_pack assinado (KV)
  ├─ Lê break-glass state (Durable Object)
  ├─ Valida Access token (JWKS cache)
  ├─ Avalia com TDLN WASM
  ├─ Publica evento (Queue)
  └─ Retorna allow/deny

Request → Proxy (On-prem)
  ├─ Verifica policy_pack (R2/local)
  ├─ Lê break-glass state (API Worker ou local)
  ├─ Extrai user info (headers)
  ├─ Avalia com TDLN nativo
  ├─ Grava no ledger local
  └─ Retorna allow/deny
```

## Break-Glass

**Ativação:**
- Endpoint `/breakglass` (POST) protegido por Access grupo `ubl-ops-breakglass`
- Durable Object mantém estado global
- TTL opcional (segundos)

**Precedência:**
- Break-glass ativo → permite qualquer path (independente de grupo/passkey)
- TTL expirado → volta à política normal

## Ledger & Auditoria

**R2 (`nova` bucket):**
- `events/{hour}.ndjson` → Eventos agregados por hora
- `live/{timestamp}.ndjson` → Eventos em tempo real (opcional)
- `logpush/{date}/*.log` → Logs Cloudflare (HTTP/Access/WAF)

**Ledger Local (Proxy):**
- Últimas 1000 decisões em memória
- Rotação automática
- Endpoint `/ledger` para debug

## Observabilidade

**Métricas Prometheus (`/metrics`):**
- `policy_decisions_total{decision="allow|deny"}`
- `policy_eval_seconds{path="..."}`
- `breakglass_active`

**Logpush Cloudflare → R2:**
- HTTP logs
- Access logs
- WAF logs
- Retenção: 180 dias

## Segurança

**Assinatura de Política:**
- BLAKE3 hash do YAML
- Ed25519 assinatura do hash
- Public key pinada no Worker e Proxy
- Drift detection: YAML alterado sem novo pack → 503

**Zero-Trust:**
- Access (Edge) → validação JWT
- Chip (Edge+Proxy) → avaliação TDLN
- Fail-closed determinístico

**Secrets:**
- Ed25519 keys: geradas offline, public key em env vars
- R2 credentials: service tokens mínimos
- Nenhum segredo em código

## Deploy

```bash
# 1. Build tdln-core
cd tdln-core
cargo build --target wasm32-wasi --release  # WASM
cargo build --release                        # Nativo

# 2. Build policy pack
cd policy-pack
cargo build --release
./target/release/pack-builder --generate-key
./target/release/pack-builder -y policy.yaml -k keys/private.pem -o pack.json

# 3. Deploy Worker
cd worker
npm install
npm run build
npm run deploy

# 4. Build Proxy
cd proxy
cargo build --release
# Instalar systemd service
sudo cp ../infra/systemd/ubl-policy-proxy.service /etc/systemd/system/
sudo systemctl enable ubl-policy-proxy
sudo systemctl start ubl-policy-proxy
```

## Proof of Done

✅ Edge e proxy retornam as mesmas decisões (3 cenários: hacker/admin/break-glass)  
✅ R2 contém `live/`, `hourly/`, `events/` e `logpush/` com contagens consistentes  
✅ Política alterada sem assinatura → 503; com assinatura nova → 200 sem redeploy  
✅ p95 < 2ms no edge (eval WASM), CPU do mini baixa e estável  
✅ Falha de um nó (LAB) → LB mantém 200; break-glass liga/desliga com rastro completo
