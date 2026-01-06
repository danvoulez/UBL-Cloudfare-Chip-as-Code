# UBL ID — P0 Implementation Status

**Data:** 2026-01-05  
**Domínio raiz:** `ubl.agency`  
**IdP:** `https://id.ubl.agency`

---

## ✅ Entregáveis Criados

### 1. Schema D1 ✅

**Arquivo:** `schemas/auth_p0.sql`

**Tabelas:**
- ✅ `users` — registro lógico
- ✅ `passkeys` — credenciais WebAuthn
- ✅ `sessions` — cookie `sid`
- ✅ `refresh_tokens` — tokens rotativos
- ✅ `jwt_revocations` — revogação por `jti`
- ✅ `abac_policies` — políticas ABAC (JSON)
- ✅ `device_codes` — device flow (voulezvous.tv)

**Índices:** Todos criados

**ABAC Default:** Policy inserida automaticamente

---

### 2. Auth Worker ✅

**Localização:** `workers/auth-worker/`

**Estrutura:**
- ✅ `wrangler.toml` — configuração (domínio `id.ubl.agency`)
- ✅ `package.json` — dependências (`@simplewebauthn/server`)
- ✅ `tsconfig.json` — TypeScript config
- ✅ `src/worker.ts` — implementação completa

**Endpoints implementados:**
- ✅ `POST /auth/passkey/register/start` — gera options
- ✅ `POST /auth/passkey/register/finish` — cria user + passkey + session
- ✅ `POST /auth/passkey/login/start` — gera options
- ✅ `POST /auth/passkey/login/finish` — valida + cria session
- ✅ `GET /session` — estado da sessão
- ✅ `POST /session/logout` — invalida session
- ✅ `POST /device/start` — device flow (QR code)
- ✅ `POST /device/poll` — polling de aprovação

**Features:**
- ✅ Challenge em KV (TTL 5 min)
- ✅ Cookie `sid` (HttpOnly, Secure, SameSite=Lax, `.ubl.agency`)
- ✅ Session TTL 12h (configurável)
- ✅ Device flow para domínios externos

---

### 3. Core API — Tokens ✅ (estrutura)

**Localização:** `apps/core-api/src/tokens/`

**Módulos criados:**
- ✅ `mod.rs` — exports
- ✅ `abac.rs` — avaliação ABAC (simplificada)
- ✅ `mint.rs` — `POST /tokens/mint` (estrutura)
- ✅ `refresh.rs` — `POST /tokens/refresh` (placeholder)
- ✅ `revoke.rs` — `POST /tokens/revoke` (placeholder)

**Status:**
- 🟡 Estrutura pronta, precisa:
  - Integração com D1 (validação de session)
  - Integração com TokenManager (mint ES256)
  - Validação de Access token
  - Criação de refresh tokens (hash + D1)

---

### 4. Smoke Tests ✅

**Arquivo:** `scripts/smoke-auth.sh`

**Testes:**
- ✅ Register start
- ✅ Login start
- ✅ Session (sem cookie)
- ✅ Device flow (start + poll)
- ✅ Tokens mint (sem sid)
- ✅ Tokens refresh
- ✅ Tokens revoke
- ✅ JWKS

---

## ⚠️ Pendências (P0)

### 1. Integração Core API ↔ Auth Worker

**Necessário:**
- [ ] HTTP client para consultar auth-worker (validação de session)
- [ ] Ou acesso direto ao D1 compartilhado

**Opções:**
- **A)** Auth Worker expõe `GET /internal/sessions/:sid` (protegido por Access)
- **B)** Core API acessa D1 diretamente (mesmo database_id)

**Recomendação:** Opção B (mais simples, mesmo D1)

---

### 2. TokenManager no Core API

**Necessário:**
- [ ] Reutilizar `TokenManager` do Gateway ou criar novo
- [ ] Carregar chave ES256 de Secrets/env
- [ ] Integrar com `mint.rs`

**Arquivo:** `apps/core-api/src/auth/token_mgr.rs` (criar)

---

### 3. Validação de Access Token

**Necessário:**
- [ ] Extrair `Cf-Access-Jwt-Assertion`
- [ ] Validar com JWKS do Access
- [ ] Mapear groups → roles

**Localização:** `apps/core-api/src/tokens/mint.rs` (função `extract_identity`)

---

### 4. Refresh Tokens (completo)

**Necessário:**
- [ ] Gerar token (UUID)
- [ ] Hash com HMAC-SHA256
- [ ] Salvar em D1 (`refresh_tokens`)
- [ ] Rotação (marcar `used_at`, emitir novo)

**Localização:** `apps/core-api/src/tokens/refresh.rs`

---

### 5. Revoke (completo)

**Necessário:**
- [ ] Se `jti`: inserir em `jwt_revocations`
- [ ] Se `session_id`: deletar session + refresh tokens
- [ ] Cache em KV (hot) + D1 (backing)

**Localização:** `apps/core-api/src/tokens/revoke.rs`

---

### 6. ABAC Policy Loading

**Necessário:**
- [ ] Carregar de D1 (`abac_policies` onde `id='default'`)
- [ ] Cache em KV (TTL 60s)
- [ ] Fallback para policy hardcoded

**Localização:** `apps/core-api/src/tokens/mint.rs` (função `load_abac_policy`)

---

### 7. Rotas no Core API

**Necessário:**
- [ ] Adicionar rotas em `apps/core-api/src/main.rs`:
  ```rust
  .route("/tokens/mint", post(tokens::mint_token))
  .route("/tokens/refresh", post(tokens::refresh_token))
  .route("/tokens/revoke", post(tokens::revoke_token))
  ```

---

### 8. Configuração Cloudflare

**Necessário:**
- [ ] Criar D1 database `UBL_DB`
- [ ] Criar KV namespace `PASSKEY_CHALLENGE`
- [ ] Aplicar schema: `wrangler d1 execute UBL_DB --remote --file=schemas/auth_p0.sql`
- [ ] Descobrir Zone ID de `ubl.agency`
- [ ] Deploy auth-worker: `wrangler deploy`

---

## 📋 Checklist de Deploy

### Fase 1: Infraestrutura
- [ ] Criar D1 database `UBL_DB`
- [ ] Criar KV namespace `PASSKEY_CHALLENGE`
- [ ] Aplicar schema SQL
- [ ] Descobrir Zone ID de `ubl.agency`
- [ ] Configurar DNS: `id.ubl.agency` → Worker

### Fase 2: Auth Worker
- [ ] Preencher `wrangler.toml` (database_id, kv_id, zone_id)
- [ ] `npm install` no `workers/auth-worker`
- [ ] Deploy: `wrangler deploy`
- [ ] Smoke test: `scripts/smoke-auth.sh`

### Fase 3: Core API
- [ ] Integrar TokenManager
- [ ] Completar `mint.rs` (D1 + ABAC)
- [ ] Completar `refresh.rs`
- [ ] Completar `revoke.rs`
- [ ] Adicionar rotas em `main.rs`
- [ ] Deploy Core API

### Fase 4: Integração
- [ ] Testar WebAuthn completo (browser)
- [ ] Testar mint com sid válido
- [ ] Testar refresh/revoke
- [ ] Testar device flow (voulezvous.tv)

---

## 🎯 Próximos Passos Imediatos

1. **Completar Core API:**
   - Criar `apps/core-api/src/auth/token_mgr.rs` (reutilizar do Gateway)
   - Integrar D1 client em `mint.rs`
   - Completar `load_abac_policy` e `validate_session`

2. **Configurar Cloudflare:**
   - Criar recursos (D1, KV)
   - Aplicar schema
   - Deploy auth-worker

3. **Testes:**
   - WebAuthn no browser
   - Smoke tests completos

---

**Status geral:** 🟡 **60% completo** — Estrutura pronta, falta integração e deploy
