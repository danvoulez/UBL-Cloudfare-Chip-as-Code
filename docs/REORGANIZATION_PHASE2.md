# Reorganização Fase 2 — Root e Nomes

## Problemas Identificados

### Pastas com nomes "feios" ou pouco descritivos:
- `policy-engine/` → `crates/policy-engine/` (padrão Rust workspace)
- `policy-proxy/` → `crates/policy-proxy/`
- `policy-signer/` → `crates/policy-signer/`
- `policy-keygen/` → `crates/policy-keygen/`
- `policy-worker/` → `workers/policy-worker/` ou `apps/policy-worker/`
- `rtc-worker/` → `workers/rtc-worker/` ou `apps/rtc-worker/`
- `observability-starter-kit/` → `infra/observability/` (já existe infra/)
- `vvz-cloudflare-kit/` → `apps/vvz-cloudflare-kit/` (já existe apps/)

### Arquivos no root que podem ser movidos:
- `Makefile` → OK (fica no root)
- `Cargo.toml` → OK (workspace root)
- `Cargo.lock` → OK (workspace root)
- `README.md` → OK (fica no root)
- `STRUCTURE.md` → `docs/structure.md`
- `env.example` → OK (fica no root)
- `.gitignore` → OK (fica no root)

## Estrutura Proposta

```
.
├── apps/                    # Aplicações (já existe)
│   ├── core-api/
│   ├── gateway/
│   ├── media-api-worker/
│   ├── webhooks-worker/
│   ├── quota-do/
│   └── vvz-cloudflare-kit/  # Movido aqui
│
├── workers/                 # Workers Cloudflare (novo)
│   ├── policy-worker/       # Movido de policy-worker/
│   └── rtc-worker/          # Movido de rtc-worker/
│
├── crates/                  # Crates Rust (novo - padrão workspace)
│   ├── policy-engine/
│   ├── policy-proxy/
│   ├── policy-signer/
│   └── policy-keygen/
│
├── docs/                    # Documentação (já existe)
├── scripts/                 # Scripts (já existe)
├── infra/                   # Infraestrutura (já existe)
│   └── observability/       # Movido de observability-starter-kit/
├── policies/                # Políticas YAML (já existe)
├── schemas/                 # Schemas (já existe)
├── templates/               # Templates (já existe)
├── archive/                 # Código legado (já existe)
│
├── Cargo.toml              # Workspace root
├── Makefile                # Build automation
├── README.md               # Documentação principal
├── env.example             # Template de variáveis
└── .gitignore             # Git ignore rules
```

## Movimentações

### 1. Criar estrutura `crates/` e `workers/`
```bash
mkdir -p crates workers
```

### 2. Mover crates Rust
- `policy-engine/` → `crates/policy-engine/`
- `policy-proxy/` → `crates/policy-proxy/`
- `policy-signer/` → `crates/policy-signer/`
- `policy-keygen/` → `crates/policy-keygen/`

### 3. Mover workers
- `policy-worker/` → `workers/policy-worker/`
- `rtc-worker/` → `workers/rtc-worker/`

### 4. Consolidar infra
- `observability-starter-kit/` → `infra/observability/`
- Mover conteúdo de `observability-starter-kit/` para `infra/observability/`

### 5. Mover kits
- `vvz-cloudflare-kit/` → `apps/vvz-cloudflare-kit/`

### 6. Mover docs
- `STRUCTURE.md` → `docs/structure.md`

## Atualizar Referências

### Cargo.toml
Atualizar paths dos membros do workspace:
```toml
[workspace]
members = [
    "crates/policy-engine",
    "crates/policy-proxy",
    "crates/policy-signer",
    "crates/policy-keygen",
    "apps/core-api",
    "apps/gateway",
]
```

### Scripts
Atualizar paths nos scripts que referenciam:
- `policy-worker/` → `workers/policy-worker/`
- `rtc-worker/` → `workers/rtc-worker/`
- `policy-engine/` → `crates/policy-engine/`
- `policy-proxy/` → `crates/policy-proxy/`

### Makefile
Atualizar paths no Makefile se houver referências.

## Benefícios

1. **Padrão Rust**: `crates/` é convenção comum em workspaces Rust
2. **Separação clara**: Workers separados de apps Rust
3. **Infra consolidada**: Tudo de infra em `infra/`
4. **Root limpo**: Apenas arquivos essenciais no root
5. **Nomes descritivos**: Pastas com nomes claros e consistentes
