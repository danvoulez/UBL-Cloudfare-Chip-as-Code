# UBL Flagship — Chip-as-Code

Fonte única de verdade, assinaturas, verificação em 2 camadas e trilho de auditoria fechado.

## Estrutura

```
.
├── policy-engine/          # Motor único (Rust) — compila para WASM e nativo
├── policy-proxy/           # Proxy Rust (axum) — on-prem
├── policy-worker/          # Worker Cloudflare (WASM) — edge
├── policy-signer/          # Signer de pack.json (Ed25519 + BLAKE3)
├── policies/               # Políticas YAML
├── scripts/                # Scripts de build/test
├── docs/                   # Documentação
└── infra/                  # Infraestrutura (terraform, systemd)
```

## Quick Start

### 1. Build

```bash
# Build completo (workspace)
cargo build --release

# Build específico
cargo build --release -p policy-proxy
cargo build --release -p policy-signer
cargo build --release --target wasm32-unknown-unknown -p policy-engine
```

### 2. Gerar pack.json

```bash
cargo build --release -p policy-signer
./target/release/policy-signer \
  --id ubl_access_chip_v1 --version 1 \
  --yaml policies/ubl_core_v1.yaml \
  --privkey_pem /etc/ubl/nova/keys/policy_signing_private.pem \
  --out policies/pack.json
```

### 3. Deploy Proxy

```bash
sudo install -D -m 0755 target/release/policy-proxy /opt/ubl/nova/bin/nova-policy-rs
sudo cp infra/systemd/nova-policy-rs.service /etc/systemd/system/
# Editar service com POLICY_PUBKEY_PEM_B64
sudo systemctl enable --now nova-policy-rs
```

### 4. Deploy Worker

```bash
cd policy-worker
# Build WASM
cd ../policy-engine
cargo build --release --target wasm32-unknown-unknown
mkdir -p ../policy-worker/build
cp target/wasm32-unknown-unknown/release/policy_engine.wasm ../policy-worker/build/

# Configurar wrangler.toml e deploy
cd ../policy-worker
wrangler kv:key put --binding=UBL_FLAGS --key=policy_pack --path=../policies/pack.json
wrangler kv:key put --binding=UBL_FLAGS --key=policy_yaml --path=../policies/ubl_core_v1.yaml
wrangler deploy
```

### 5. Smoke Test

```bash
EDGE_HOST=https://api.ubl.agency \
PROXY_URL=http://127.0.0.1:9456 \
ADMIN_PATH=/admin/deploy \
bash scripts/smoke_chip_as_code.sh
```

## Documentação

- `NEXT_STEPS.md` — **🚀 Próximos passos (roadmap completo)**
- `docs/QUICK_SETUP.md` — Setup rápido passo a passo
- `docs/GO_LIVE_CHECKLIST.md` — Checklist de cutover
- `docs/ARCHITECTURE.md` — Arquitetura detalhada
- `policies/ubl_core_v1.yaml` — Política safe-default
- `SECURITY.md` — Segurança e gestão de secrets
- `env.example` — Template de variáveis de ambiente
- `CLEANUP.md` — Limpeza de pastas antigas

## Não-negociáveis

- ✅ Fonte única de verdade: motor único (Rust) → build nativo (proxy) e WASM (edge)
- ✅ Política assinada: pack.json (BLAKE3 + Ed25519) obrigatório
- ✅ Zero-Trust duplo: Access (Edge) e Chip (Edge+Proxy) — fail-closed determinístico
- ✅ Ledger imutável: NDJSON com hash/attest
