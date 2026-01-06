# 📁 Estrutura do Office

## 📍 Localização Principal

```
apps/office/
```

## 📦 Estrutura de Diretórios

```
apps/office/
├── workers/                    # 👷 Workers Cloudflare
│   ├── office-api-worker/      # API principal (rotas /api/*)
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point + export DO
│   │   │   ├── bindings.ts     # Tipos TypeScript
│   │   │   ├── http/           # Rotas HTTP
│   │   │   ├── core/           # Core (tenant, cors, vectorize, ai)
│   │   │   ├── domain/         # Lógica de domínio
│   │   │   └── do/             # Durable Objects
│   │   └── wrangler.toml       # Config Cloudflare
│   │
│   ├── office-indexer-worker/   # Indexação + embeddings (cron)
│   │   ├── src/
│   │   │   ├── index.ts        # Scheduled tasks
│   │   │   └── jobs/          # Jobs de indexação
│   │   └── wrangler.toml
│   │
│   └── office-dreamer-worker/  # Dreaming Cycle (cron)
│       ├── src/index.ts
│       └── wrangler.toml
│
├── schemas/                     # 📊 Schemas e SQL
│   ├── d1/
│   │   └── schema.sql          # Schema base D1
│   ├── json/                    # JSON Schemas
│   └── examples/                # Exemplos
│
├── scripts/                     # 🔧 Scripts utilitários
│   ├── deploy-office.sh
│   ├── d1-apply-schema.sh
│   ├── seed-demo.sh
│   ├── setup-r2-cors.sh
│   └── smoke-office.sh
│
├── config/                      # ⚙️ Configurações
│   ├── constitution.example.md
│   ├── cors/
│   └── lenses/
│
├── docs/                        # 📚 Documentação
│   ├── ARCHITECTURE.md
│   ├── EVIDENCE_MODE.md
│   ├── LENSES.md
│   └── ...
│
├── examples/                     # 💡 Exemplos
│   ├── requests/                # HTTP contracts
│   └── tenants/                 # Seed data
│
├── mcp/                         # 🔌 MCP tools
│   └── tools/
│
└── observability/               # 📈 Métricas
    └── grafana/
```

## 🎯 Arquivos Principais

### Workers
- **`workers/office-api-worker/src/index.ts`** — Entry point principal
- **`workers/office-api-worker/src/do/OfficeSessionDO.ts`** — Durable Object
- **`workers/office-api-worker/wrangler.toml`** — Config Cloudflare

### Schemas
- **`schemas/d1/schema.sql`** — Schema base do D1
- **`schemas/json/*.schema.json`** — JSON Schemas

### Scripts
- **`scripts/deploy-office.sh`** — Deploy manual
- **`scripts/smoke-office.sh`** — Smoke tests

### Config
- **`config/constitution.example.md`** — Constituição do Office
- **`config/lenses/*.lens.json`** — Lens presets

## 🔗 Script de Deploy

O script principal de deploy está em:
```
scripts/deploy-office-complete.sh
```

Ele usa a variável:
```bash
OFFICE_DIR="${PROJECT_ROOT}/apps/office"
```

## 📋 Checklist de Deploy

Ver: `DEPLOY_CHECKLIST.md` e `DEPLOY_QUICK.md`
