# Estrutura do Projeto — Reorganizada

## Nova Estrutura (Limpa)

```
.
├── policy-engine/          # Motor único (Rust) — compila para WASM e nativo
│   ├── src/
│   │   ├── lib.rs          # Engine principal
│   │   └── wasm.rs         # Bindings WASM
│   ├── examples/
│   │   └── ubl_core_v1.yaml
│   └── Cargo.toml
│
├── policy-proxy/           # Proxy Rust (axum) — on-prem
│   ├── src/
│   │   └── main.rs
│   └── Cargo.toml
│
├── policy-worker/          # Worker Cloudflare (WASM) — edge
│   ├── src/
│   │   └── worker.mjs
│   ├── build/              # WASM builds aqui
│   └── wrangler.toml
│
├── policy-signer/          # Signer de pack.json
│   ├── src/
│   │   └── main.rs
│   └── Cargo.toml
│
├── policies/               # Políticas YAML
│   └── ubl_core_v1.yaml
│
├── scripts/                # Scripts de build/test
│   ├── build-proxy.sh
│   ├── build-worker.sh
│   └── smoke_chip_as_code.sh
│
├── docs/                   # Documentação
│   ├── ARCHITECTURE.md
│   ├── GO_LIVE_CHECKLIST.md
│   ├── QUICK_SETUP.md
│   └── ...
│
├── infra/                  # Infraestrutura
│   ├── systemd/
│   │   └── nova-policy-rs.service
│   └── terraform/
│       └── main.tf
│
├── Cargo.toml              # Workspace root
├── Makefile
└── README.md
```

## Pastas Antigas (Podem ser removidas)

- `nova_policy_rs/` → Conteúdo movido para `policy-engine/`, `policy-proxy/`, `policy-signer/`
- `nova_edge_wasm_extracted/` → Conteúdo movido para `policy-worker/`
- `tdln-core/` → Substituído por `policy-engine/`
- `proxy/` → Substituído por `policy-proxy/`
- `worker/` → Substituído por `policy-worker/`
- `policy-pack/` → Substituído por `policy-signer/`

## Workspace Rust

O `Cargo.toml` na raiz define um workspace com:
- `policy-engine`
- `policy-proxy`
- `policy-signer`

## Build

```bash
# Build completo
cargo build --release

# Build específico
cargo build --release -p policy-proxy
cargo build --release -p policy-signer
cargo build --release --target wasm32-unknown-unknown -p policy-engine
```

## Limpeza (Opcional)

Para remover pastas antigas:

```bash
rm -rf nova_policy_rs/ nova_edge_wasm_extracted/ tdln-core/ proxy/ worker/ policy-pack/
```
