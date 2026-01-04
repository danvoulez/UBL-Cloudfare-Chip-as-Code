# Plano de Reorganização da Codebase

## Estrutura Proposta

```
.
├── apps/                          # Aplicações (já organizado)
│   ├── core-api/
│   ├── gateway/
│   ├── media-api-worker/
│   ├── webhooks-worker/
│   ├── quota-do/
│   └── ...
│
├── docs/                          # Toda documentação
│   ├── blueprints/                # Blueprints 01-17
│   ├── deploy/                    # Documentação de deploy
│   ├── runbooks/                  # Runbooks operacionais
│   ├── status/                    # Status, checklists, progresso
│   ├── architecture/              # Arquitetura e ADRs
│   └── guides/                    # Guias e tutoriais
│
├── schemas/                       # Schemas JSON✯Atomic (consolidado)
│   ├── atomic/
│   ├── media/
│   ├── office/
│   └── examples/
│
├── scripts/                       # Scripts organizados por categoria
│   ├── deploy/                    # Scripts de deploy
│   ├── smoke/                     # Smoke tests
│   ├── setup/                     # Setup e configuração
│   ├── infra/                     # Infraestrutura
│   └── utils/                     # Utilitários
│
├── infra/                         # Infraestrutura (já organizado)
│   ├── systemd/
│   ├── terraform/
│   ├── identity/
│   ├── ledger/
│   └── observability/
│
├── policies/                      # Políticas YAML (já organizado)
├── templates/                     # Templates (já organizado)
├── observability-starter-kit/     # Observabilidade (já organizado)
│
├── archive/                       # Código antigo/legado
│   ├── nova_policy_rs/
│   ├── nova_edge_wasm_extracted/
│   ├── tdln-core/
│   ├── proxy/
│   ├── worker/
│   └── policy-pack/
│
├── Cargo.toml                     # Workspace Rust
├── Makefile
├── README.md
├── env.example
└── .gitignore
```

## Movimentações

### 1. Blueprints → `docs/blueprints/`
- `Blueprint 01 — Edge Gateway (Worker + Ch.md` → `docs/blueprints/01-edge-gateway.md`
- `Blueprint 02 — Policy-Proxy (LAB 256).md` → `docs/blueprints/02-policy-proxy.md`
- ... (todos os 17 blueprints)

### 2. Deploy Docs → `docs/deploy/`
- `DEPLOY*.md` → `docs/deploy/`
- `QUICK_DEPLOY.md` → `docs/deploy/quick-deploy.md`
- `DEPLOY_ITEM1_FILES_R2.md` → `docs/deploy/item1-files-r2.md`

### 3. Runbooks → `docs/runbooks/`
- `RUNBOOK_*.md` → `docs/runbooks/`

### 4. Status → `docs/status/`
- `STATUS*.md` → `docs/status/`
- `P0*.md` → `docs/status/`
- `P1.1_RTC.md` → `docs/status/p1.1-rtc.md`
- `BLUEPRINT_STATUS.md` → `docs/status/blueprint-status.md`
- `CLOUDFLARE_DEPLOYED.md` → `docs/status/cloudflare-deployed.md`

### 5. Outros Docs → `docs/`
- `CONSTITUTION.md` → `docs/architecture/constitution.md`
- `CLEANUP.md` → `docs/guides/cleanup.md`
- `NEXT_STEPS.md` → `docs/guides/next-steps.md`
- `SOAK_PLAN.md` → `docs/guides/soak-plan.md`
- `SECURITY.md` → `docs/guides/security.md`
- `ACCESS_APPS_SETUP.md` → `docs/guides/access-apps-setup.md`

### 6. Schemas → Consolidar
- `json-atomic-schemas-v1/` → `schemas/atomic/v1/`
- `json-atomic-schemas-media-pack/` → `schemas/media/pack/`
- `json-atomic-schemas-media-pack-v2/` → `schemas/media/pack-v2/`

### 7. Scripts → Organizar
- `scripts/deploy-*.sh` → `scripts/deploy/`
- `scripts/smoke-*.sh` → `scripts/smoke/`
- `scripts/setup-*.sh`, `scripts/enable-*.sh` → `scripts/setup/`
- `scripts/validate-*.sh` → `scripts/smoke/` (são validações)
- `scripts/discover-*.sh`, `scripts/fill-*.sh` → `scripts/utils/`
- `scripts/build-*.sh` → `scripts/deploy/`
- `scripts/runbook_*.sh` → `scripts/deploy/` (são scripts de deploy)

### 8. Pastas Antigas → `archive/`
- `nova_policy_rs/` → `archive/`
- `nova_edge_wasm_extracted/` → `archive/`
- `nova_edge_wasm.tar` → `archive/`
- `nova_policy_rs.tar` → `archive/`
- `tdln-core/` → `archive/`
- `proxy/` → `archive/`
- `worker/` → `archive/`
- `policy-pack/` → `archive/`
- `policy-keygen.tar.gz` → `archive/`

### 9. Kits/Contratos → Consolidar
- `media-video-contracts-v1-ubl-api/` → `apps/media-api-worker/contracts/`
- `billing-quota-skeleton-v1/` → `apps/quota-do/` (ou `infra/billing/`)
- `vvz-cloudflare-kit/` → `apps/core-api/vvz-kit/` (ou manter separado)
- `vvz-core-systemd-pack/` → `infra/systemd/vvz-core/`

### 10. Scripts na Raiz → Mover
- `smoke_chip_as_code.sh` → `scripts/smoke/chip-as-code.sh`

## Arquivos a Manter na Raiz

- `README.md`
- `Cargo.toml`
- `Cargo.lock`
- `Makefile`
- `env.example`
- `.gitignore`
- `STRUCTURE.md` (atualizar após reorganização)

## Ordem de Execução

1. Criar estrutura de diretórios
2. Mover blueprints
3. Mover documentação de deploy
4. Mover runbooks e status
5. Consolidar schemas
6. Organizar scripts
7. Mover pastas antigas para archive
8. Consolidar kits/contratos
9. Atualizar referências em scripts/docs
10. Limpar arquivos temporários
