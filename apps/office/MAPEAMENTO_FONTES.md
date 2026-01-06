# Mapeamento de Fontes - De Onde Copiar Cada Arquivo

Este documento mapeia de qual pasta-fragmento copiar cada arquivo para a estrutura consolidada.

## ✅ Arquivos Já Copiados

### Base (office-drop1)
- ✅ `README.md`
- ✅ `DEPLOY_OFFICE.md`
- ✅ `tenants.example.json`
- ✅ `r2-layout.txt`
- ✅ `config/` (todos os arquivos)
- ✅ `schemas/` (todos os arquivos)
- ✅ `mcp/` (todos os arquivos)
- ✅ `docs/` (todos os arquivos)
- ✅ `scripts/` (todos os arquivos)
- ✅ `observability/` (todos os arquivos)
- ✅ `examples/` (todos os arquivos)

### Workers - office-api-worker

#### HTTP Routes
- ✅ `routes_health.ts` - office-drop1
- ✅ `routes_inventory.ts` - office-drop1
- ✅ `routes_admin.ts` - office-drop1
- ⏳ `routes_files.ts` - **CRIAR** (não encontrado)
- ⏳ `routes_anchors.ts` - office-drop9/routes/anchors.ts
- ⏳ `routes_lenses.ts` - office-drop6 ou office 15
- ⏳ `routes_frame.ts` - office-drop5/routes/frame.ts
- ⏳ `routes_narrative.ts` - **CRIAR** (não encontrado)
- ⏳ `routes_evidence.ts` - office 17/routes/evidence.ts (melhor)
- ⏳ `routes_handover.ts` - office-drop5/routes/handover.ts
- ⏳ `routes_versions.ts` - office 13/routes/version.ts
- ⏳ `routes_simulation.ts` - **CRIAR** (não encontrado)

#### Core
- ✅ `d1.ts` - office-drop1
- ✅ `tenant.ts` - office-drop1
- ⏳ `kv.ts` - **CRIAR**
- ⏳ `r2.ts` - **CRIAR**
- ⏳ `auth.ts` - **CRIAR**
- ⏳ `cors.ts` - **CRIAR**
- ⏳ `hash.ts` - **CRIAR**
- ⏳ `ulid.ts` - **CRIAR**
- ⏳ `errors.ts` - **CRIAR** (ErrorTokens)

#### Domain
- ⏳ `frame_builder.ts` - office-drop5/domain/frame.ts (adaptar)
- ⏳ `narrative.ts` - **CRIAR** (Narrator - crítico)
- ⏳ `lens_engine.ts` - office-drop6/domain/lens_engine.ts
- ⏳ `version_graph.ts` - office 13/domain/version_graph.ts
- ⏳ `evidence.ts` - office 15/core/evidence.ts (adaptar para domain/)
- ⏳ `sanity_check.ts` - **CRIAR** (crítico)
- ⏳ `receipts.ts` - office 11/core/receipts.ts (adaptar para domain/)
- ⏳ `simulation.ts` - **CRIAR** (Safety Net)
- ⏳ `affordances.ts` - **CRIAR**

#### DO
- ⏳ `OfficeSessionDO.ts` - office-drop1/do/OfficeSessionDO.ts ou office 12/do/OfficeSessionDO.ts

#### Metrics
- ⏳ `prometheus.ts` - **CRIAR**

### Workers - office-indexer-worker

- ⏳ `index.ts` - office-drop1 ou office-drop9
- ⏳ `jobs/index_file.ts` - **CRIAR** (adaptar de pipelines/)
- ⏳ `jobs/rebuild_versions.ts` - **CRIAR**
- ⏳ `jobs/snapshot_index.ts` - **CRIAR**
- ⏳ `extractors/text_basic.ts` - **CRIAR** (adaptar de pipelines/)
- ⏳ `extractors/pdf_stub.ts` - **CRIAR** (adaptar de pipelines/)
- ⏳ `persist/anchors.ts` - **CRIAR**
- ⏳ `persist/ops_receipts.ts` - **CRIAR**

### Workers - office-dreamer-worker

- ⏳ `index.ts` - office-drop6/workers/office-dreamer-worker/src/index.ts (melhor)

## 📋 Arquivos Faltantes (Precisam ser Criados)

### Críticos (Part I)
1. **`domain/narrative.ts`** - Narrator (Padrão 2)
   - Recebe Context Frame
   - Gera narrativa em primeira pessoa
   - Aplica Sanity Check
   - Injeta Constitution

2. **`domain/sanity_check.ts`** - Sanity Check (Padrão 4)
   - Extrai claims do handover
   - Consulta fatos objetivos
   - Compara e gera Governance Note

3. **`domain/simulation.ts`** - Safety Net (Padrão 7)
   - Implementa `affordances.simulate(action)`
   - Simula ação em sandbox
   - Retorna outcomes

### Importantes
4. **`domain/affordances.ts`** - Lista de ações possíveis
5. **`core/errors.ts`** - ErrorTokens estruturados
6. **`routes_simulation.ts`** - Endpoint de simulação
7. **`routes_files.ts`** - Endpoint de arquivos
8. **`routes_narrative.ts`** - Endpoint de narrativa
9. **`core/kv.ts`** - Wrapper KV
10. **`core/r2.ts`** - Wrapper R2
11. **`core/auth.ts`** - Autenticação
12. **`core/cors.ts`** - CORS
13. **`core/hash.ts`** - Hash utilities
14. **`core/ulid.ts`** - ULID generation
15. **`metrics/prometheus.ts`** - Métricas Prometheus

### Schemas JSON
16. **`schemas/json/error.schema.json`** - Schema de ErrorTokens
17. **`schemas/json/session.schema.json`** - Schema de Session Types

## 🎯 Prioridades

### Alta Prioridade
1. `domain/narrative.ts` - Sem isso, LLM não recebe narrativa
2. `domain/sanity_check.ts` - Previne drift narrativo
3. `domain/simulation.ts` - Safety Net para ações de risco

### Média Prioridade
4. `domain/affordances.ts`
5. `core/errors.ts`
6. `routes_simulation.ts`
7. `routes_files.ts`
8. `routes_narrative.ts`

### Baixa Prioridade
9. Core utilities (kv, r2, auth, cors, hash, ulid)
10. Metrics
11. Schemas JSON faltantes
