# Status Atual: Autenticação & Identidade (UBL ID)

**Data:** 2026-01-05  
**Última atualização:** 2026-01-05

---

## 🎯 Resumo Executivo

**Status Geral:** 🟡 **40% completo** (Blueprint 06)

**O que funciona:**
- ✅ JWT ES256 (ECDSA P-256) — mint/verify implementado
- ✅ JWKS endpoint (`/auth/jwks.json`) no Core API
- ✅ Verificação ES256 no Worker Edge (`jwks.mjs`)
- ✅ Cloudflare Access integration (validação de JWT no Worker)
- ✅ Estrutura de tokens com escopo fechado

**O que está pendente:**
- ❌ WebAuthn/Passkey (estrutura pronta, não implementado)
- ❌ Session management (`/session`, cookies `sid`)
- ❌ Token refresh/revoke (placeholders)
- ❌ ABAC evaluation (estrutura pronta, não implementado)
- ❌ Identity storage (D1/Postgres para credenciais)

---

## 📋 Componentes Implementados

### 1. **JWT ES256 (ECDSA P-256)** ✅

**Localização:** `apps/gateway/src/identity/tokens.rs`

**Funcionalidades:**
- ✅ `TokenManager` com ES256 (ECDSA P-256)
- ✅ `mint()` — emissão de tokens com escopo fechado
- ✅ `verify()` — validação de assinatura e claims
- ✅ JWKS support (`load_jwks_from_kv`, `save_jwks_to_kv`)
- ✅ Rotação blue/green (estrutura pronta)

**Claims padrão:**
```rust
{
  iss: "https://api.ubl.agency",
  sub: "user:{uuid}" | "agent:{uuid}",
  aud: "ubl-gateway",
  iat, exp,
  kid: "jwt-v1",
  scope: { tenant, entity?, room?, tools?, session_type },
  client_id: "ide:vscode" | "agent:buildbot" | "ui:web",
  role?: ["admin", "moderator"],
  jti: "{uuid}"
}
```

**TTL:** ≤15 minutos (padrão)

---

### 2. **JWKS Endpoint** ✅

**Localização:** `apps/core-api/src/auth/jwks.rs`

**Endpoint:** `GET /auth/jwks.json`

**Funcionalidades:**
- ✅ Serve chaves públicas ES256 em formato JWK
- ✅ ETag baseado em BLAKE3 hash
- ✅ Cache-Control: `public, max-age=300`
- ✅ Lê chave pública de `/etc/ubl/keys/jwt_es256_pub.pem`

**Formato JWKS:**
```json
{
  "keys": [{
    "kty": "EC",
    "crv": "P-256",
    "alg": "ES256",
    "use": "sig",
    "kid": "jwt-v1",
    "x": "...",
    "y": "..."
  }]
}
```

---

### 3. **Worker Edge Verification** ✅

**Localização:** `workers/policy-worker/src/jwks.mjs`

**Funcionalidades:**
- ✅ `getJWKS()` — cache de JWKS do Core API (TTL 300s)
- ✅ `verifyES256()` — verificação de assinatura ES256 usando WebCrypto
- ✅ `authCheckHandler()` — endpoint `/auth_check` para smoke tests

**Integração:**
- Worker valida `Cf-Access-Jwt-Assertion` (Cloudflare Access)
- Worker pode validar tokens UBL ES256 (estrutura pronta)

---

### 4. **Gateway Routes** 🟡

**Localização:** `apps/gateway/src/http/routes_tokens.rs`

**Endpoints:**
- ✅ `POST /tokens/mint` — **stub funcional** (validação básica, ABAC placeholder)
- ⚠️ `POST /tokens/refresh` — **placeholder** (não implementado)
- ⚠️ `POST /tokens/revoke` — **placeholder** (não implementado)

**Status:**
- Estrutura pronta, mas `mint` precisa de:
  - Validação JWT real (atualmente aceita qualquer token)
  - ABAC evaluation real (atualmente placeholder)
  - Identity storage lookup (atualmente stub)

---

### 5. **Core API Voulezvous** 🟡

**Localização:** `apps/core-api/src/bin/vvz-core.rs`

**Endpoints:**
- ✅ `GET /healthz` — health check
- 🟡 `GET /whoami` — **stub** (lê cookie, não valida sessão)
- 🟡 `POST /api/session/exchange` — **stub** (aceita token, não valida JWT)

**Status:**
- Estrutura pronta, mas precisa:
  - Validação JWT ES256 real (via JWKS)
  - Session storage (D1/Redis)
  - Cookie `sid` management real

---

## ❌ Componentes Pendentes

### 1. **WebAuthn/Passkey** ❌

**Localização:** `apps/gateway/src/identity/webauthn.rs` (placeholder)

**Pendente:**
- ❌ `GET /auth/passkey/register` — WebAuthn registration options
- ❌ `POST /auth/passkey/finish` — Finalizar registro e criar sessão
- ❌ `POST /auth/logout` — Limpar sessão
- ❌ D1/Postgres para armazenar credenciais WebAuthn

**Status:** Estrutura pronta, não implementado

---

### 2. **Session Management** ❌

**Pendente:**
- ❌ `GET /session` — Retornar perfil do usuário + escopos disponíveis
- ❌ Cookie `sid` management (HttpOnly, Secure, SameSite=Lax)
- ❌ Session storage (D1/Redis)
- ❌ Session expiration/TTL
- ❌ CSRF token management

**Status:** Não iniciado

---

### 3. **ABAC Evaluation** ❌

**Localização:** `apps/gateway/src/identity/abac.rs` (placeholder)

**Pendente:**
- ❌ Avaliação de políticas ABAC antes de `mint`
- ❌ Mapeamento de grupos Access → roles
- ❌ Validação de escopo solicitado vs. escopo permitido
- ❌ Ordem rígida: deny explícito > allow específico > allow genérico > deny default

**Status:** Estrutura pronta, não implementado

---

### 4. **Identity Storage** ❌

**Localização:** `apps/gateway/src/identity/storage.rs` (placeholder)

**Pendente:**
- ❌ D1/Postgres schema para:
  - Credenciais WebAuthn
  - Vínculos de identidade (Access → UBL ID)
  - Sessions
  - Revocation list (`jti` → TTL = exp)

**Status:** Estrutura pronta, não implementado

---

### 5. **Token Refresh/Revoke** ❌

**Pendente:**
- ❌ `POST /tokens/refresh` — Emitir novo token se refresh válido
- ❌ `POST /tokens/revoke` — Revogar token (inserir `jti` em Revocation List)
- ❌ Revocation List em KV (`revoked_jti:{jti}` → TTL = exp)

**Status:** Placeholders, não implementado

---

### 6. **Internal Verification** ❌

**Pendente:**
- ❌ `POST /internal/tokens/verify` — Axum extractor para validação interna
- ❌ Integração no Core API/Office para verificar tokens

**Status:** Não iniciado

---

## 🔐 Cloudflare Access Integration

**Status:** ✅ **Funcional**

**Worker Edge:**
- ✅ Valida `Cf-Access-Jwt-Assertion` com `ACCESS_JWKS` e `ACCESS_AUD`
- ✅ Extrai identidade (email, sub, groups)
- ✅ Mapeia grupos → roles (estrutura pronta)

**Configuração:**
- ✅ Access Apps criados (UBL Flagship, Voulezvous Admin)
- ✅ Grupos: `ubl-ops`, `ubl-ops-breakglass`
- ✅ Políticas: Admin paths protegidos

**Pendente:**
- ⚠️ Integração completa no Gateway (estrutura pronta em `apps/gateway/src/identity/access.rs`)

---

## 📊 Fluxos Atuais

### Fluxo 1: Cloudflare Access (Funcional) ✅

```
Browser → Cloudflare Access → Worker Edge
  ├─ Valida Cf-Access-Jwt-Assertion
  ├─ Extrai groups → roles
  └─ Aplica política (Chip-as-Code)
```

**Status:** ✅ Funcional

---

### Fluxo 2: Token Mint (Parcial) 🟡

```
Agent/IDE → POST /tokens/mint
  ├─ Validação básica (stub)
  ├─ ABAC placeholder
  ├─ Emite JWT ES256 (funcional)
  └─ Retorna token
```

**Status:** 🟡 Estrutura pronta, precisa validação real

---

### Fluxo 3: Session Exchange (Parcial) 🟡

```
Browser → POST /api/session/exchange
  ├─ Recebe token UBL (stub)
  ├─ Validação JWT placeholder
  ├─ Cria sessão (stub)
  └─ Emite cookie sid (funcional)
```

**Status:** 🟡 Estrutura pronta, precisa validação JWT real

---

## 🎯 Próximos Passos (P0)

### 1. **Completar Token Mint** (P0)
- [ ] Implementar validação JWT ES256 real (via JWKS)
- [ ] Implementar ABAC evaluation
- [ ] Integrar Identity storage lookup

### 2. **Completar Session Exchange** (P0)
- [ ] Validação JWT ES256 real no `vvz-core.rs`
- [ ] Session storage (D1)
- [ ] Cookie `sid` management real

### 3. **WebAuthn/Passkey** (P0)
- [ ] Implementar `GET /auth/passkey/register`
- [ ] Implementar `POST /auth/passkey/finish`
- [ ] D1 schema para credenciais WebAuthn

### 4. **Session Management** (P0)
- [ ] `GET /session` endpoint
- [ ] Session storage (D1/Redis)
- [ ] CSRF token management

### 5. **Token Refresh/Revoke** (P1)
- [ ] `POST /tokens/refresh`
- [ ] `POST /tokens/revoke`
- [ ] Revocation List (KV)

---

## 📝 Notas Técnicas

### Algoritmo JWT
- **Padrão:** ES256 (ECDSA P-256) — **permanente**
- **Motivo:** Compatibilidade ampla (JOSE/JWT, OIDC, WebCrypto, HSM/KMS, FIPS, Passkey/WebAuthn)
- **Rotação:** Blue/green com `kid` (current/next)

### TTLs
- **JWT curto:** ≤15 minutos
- **Refresh token:** ≤7 dias (apenas agentes)
- **Cookie `sid`:** ≤12 horas
- **JWKS cache:** 300 segundos

### Segurança
- ✅ Server-blind logging (lista fechada de campos)
- ✅ CSRF tokens (estrutura pronta)
- ✅ Replay protection (`jti` único)
- ✅ Scope reduction (token nunca carrega mais que política autoriza)

---

## 🔗 Referências

- **Blueprint 06:** `docs/blueprints/006-identity--access-gateway.md`
- **Status Blueprints:** `docs/status/blueprint-status.md`
- **JWKS Rotation:** `infra/identity/ROTATION.md`
- **Identity README:** `infra/identity/README.md`

---

## ✅ Proof-of-Done

### Smoke Tests Atuais:
```bash
# JWKS endpoint
curl https://core.api.ubl.agency/auth/jwks.json | jq

# Token mint (stub)
curl -X POST https://api.ubl.agency/tokens/mint \
  -H "Content-Type: application/json" \
  -d '{"scope":{"tenant":"ubl","session_type":"work"},"client_id":"test","session_type":"work"}'

# Session exchange (stub)
curl -X POST https://core.voulezvous.tv/api/session/exchange \
  -H "Content-Type: application/json" \
  -d '{"token":"test"}'
```

### Pendente:
- [ ] Validação JWT real em todos os endpoints
- [ ] WebAuthn flow completo
- [ ] Session management completo
- [ ] ABAC evaluation real

---

**Última atualização:** 2026-01-05
