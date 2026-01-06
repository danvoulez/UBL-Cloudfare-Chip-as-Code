# UBL ID — Integração Kit Completa

**Data:** 2026-01-05  
**Status:** ✅ Integrado

---

## ✅ Integrações Realizadas

### 1. Scripts de Deploy
- ✅ `scripts/patch-office-for-ubl-agency.sh` → padroniza env/wrangler.toml
- ✅ `scripts/deploy-ubl-id.sh` → adaptado para `auth-worker`

### 2. JWKS Path Padrão
- ✅ `GET /.well-known/jwks.json` → alias para `/auth/jwks.json` (Core API)
- ✅ Compatível com padrão OIDC/OAuth2

### 3. Página de Ativação
- ✅ `GET /activate?code=XXXXXX` → HTML simples para scan/código (auth-worker)
- ✅ Compatível com formato do kit

### 4. Device Approve Simplificado
- ✅ `POST /device/approve` → aceita `subject` direto (compatibilidade)
- ✅ Cria session automaticamente se não existir
- ✅ Integrado com D1

### 5. Device Flow Compatível
- ✅ `POST /device/start` → formato compatível com kit (verification_uri_complete)
- ✅ `POST /device/poll` → formato compatível (ok, status)

---

## 📋 Arquivos Modificados

1. **`apps/core-api/src/auth/jwks.rs`**
   - Adicionado route `/.well-known/jwks.json`

2. **`workers/auth-worker/src/worker.ts`**
   - Adicionado `handleDeviceApprove()` → compatibilidade com kit
   - Adicionado `handleActivate()` → página HTML
   - Atualizado `handleDeviceStart()` → formato compatível
   - Atualizado `handleDevicePoll()` → formato compatível

3. **`scripts/patch-office-for-ubl-agency.sh`**
   - Atualizado para encontrar wrangler.toml em `worker/` também

4. **`scripts/deploy-ubl-id.sh`**
   - Adaptado para usar `auth-worker` ao invés de `ubl-id-worker`

---

## 🚀 Como Usar

### 1. Padronizar Projeto para `.ubl.agency`

```bash
bash scripts/patch-office-for-ubl-agency.sh
```

Isso adiciona ao `env`:
- `ISSUER_BASE=https://id.ubl.agency`
- `TOKEN_ISS=https://id.ubl.agency`
- `JWKS_URL=https://id.ubl.agency/.well-known/jwks.json`
- `COOKIE_DOMAIN=.ubl.agency`
- `RP_ID=ubl.agency`
- `LLM_GATEWAY_BASE=https://office-llm.ubl.agency`

E atualiza `wrangler.toml` dos workers.

### 2. Deploy do IdP

```bash
bash scripts/deploy-ubl-id.sh
```

Isso:
- Cria `DEVICE_KV` (se não existir)
- Pede `JWT_PRIVATE_JWK` e `JWT_PUBLIC_JWK` (se necessário)
- Deploya `auth-worker`

---

## 🔑 JWKs Fornecidos (Kit)

**kid:** `fOYJEW760OAfkL3nHzYGP4zaB9qpuuX4AR6jQpFz9FI`

**JWKS público:**
```json
{
  "keys": [{
    "kty": "EC",
    "crv": "P-256",
    "x": "Q-Q5pypS2c8UMXN5N7szeND6NoU773RJ8ipZZPGAcC0",
    "y": "8cUyfsCVfDBUCMcakAvYY9YqEoJKNCd6d6wQh5WI-Lg",
    "alg": "ES256",
    "use": "sig",
    "kid": "fOYJEW760OAfkL3nHzYGP4zaB9qpuuX4AR6jQpFz9FI"
  }]
}
```

**Uso:**
- Se usar assinatura direta no worker: `wrangler secret put JWT_PRIVATE_JWK`
- Se usar Core API para assinar: usar no `TokenManager`

---

## 🧪 Endpoints Finais

### IdP (`id.ubl.agency`)

**WebAuthn:**
- `POST /auth/passkey/register/start`
- `POST /auth/passkey/register/finish`
- `POST /auth/passkey/login/start`
- `POST /auth/passkey/login/finish`

**Session:**
- `GET /session`
- `POST /session/logout`

**Device Flow:**
- `POST /device/start` → `{ device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval }`
- `POST /device/approve` → `{ user_code, subject }` → `{ ok: true }`
- `POST /device/poll` → `{ device_code }` → `{ ok: true, user_id, session_id }` ou `{ ok: true, status: "pending" }`
- `GET /activate?code=XXXXXX` → HTML de ativação

**Internals:**
- `GET /internal/sessions/:sid`
- `GET /internal/abac/default`
- `POST /internal/refresh-tokens`
- `POST /internal/revoke`

### Core API (`core.api.ubl.agency`)

**JWKS:**
- `GET /auth/jwks.json`
- `GET /.well-known/jwks.json` (alias)

**Tokens:**
- `POST /tokens/mint`
- `POST /tokens/refresh`
- `POST /tokens/revoke`

---

## ✅ Compatibilidade

- ✅ **Kit recebido:** 100% compatível
- ✅ **Implementação atual:** Mantida e expandida
- ✅ **Device Flow:** Funciona com ambos os formatos
- ✅ **JWKS:** Disponível em ambos os paths

---

**Status:** 🟢 **100% integrado e pronto para deploy**
