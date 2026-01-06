# Comparação: Kit Recebido vs Implementação Atual

**Data:** 2026-01-05

---

## 📦 Kit Recebido (`ubl-id-cloudflare-kit`)

### Funcionalidades:
- ✅ **Device Flow simplificado** (QR code para TV)
  - `POST /device/start` → gera `device_code` + `user_code`
  - `POST /device/approve` → aprovação manual (exige `subject` por enquanto)
  - `POST /device/poll` → troca `device_code` por tokens
  - `GET /activate?code=XXXXXX` → página de ativação
- ✅ **JWKS público**: `/.well-known/jwks.json`
- ✅ **JWT ES256**: assinatura via `JWT_PRIVATE_JWK` (secret)
- ✅ **KV para device codes**: `DEVICE_KV`
- ✅ **Scripts de deploy**:
  - `patch-office-for-ubl-agency.sh` → padroniza env/wrangler.toml para `.ubl.agency`
  - `deploy-ubl-id.sh` → cria KV, pede JWKs, deploya worker

### Características:
- **Foco:** Device Flow para TV (voulezvous.tv)
- **Aprovação:** Manual (subject direto, sem Passkey ainda)
- **Simplicidade:** Worker único, sem D1, sem WebAuthn

---

## 🏗️ Implementação Atual (P0)

### Funcionalidades:
- ✅ **WebAuthn/Passkey completo**
  - `POST /auth/passkey/register/start` → options
  - `POST /auth/passkey/register/finish` → cria user + passkey + session
  - `POST /auth/passkey/login/start` → options
  - `POST /auth/passkey/login/finish` → valida + cria session
- ✅ **Session Management**
  - `GET /session` → estado da sessão
  - `POST /session/logout` → invalida session
- ✅ **Device Flow** (similar ao kit)
  - `POST /device/start` → gera device_code + user_code
  - `POST /device/poll` → polling de aprovação
- ✅ **Tokens ES256**
  - `POST /tokens/mint` → emite access_token + refresh_token
  - `POST /tokens/refresh` → rotação de refresh tokens
  - `POST /tokens/revoke` → revoga por jti ou session_id
- ✅ **JWKS**: `GET /auth/jwks.json` (Core API)
- ✅ **D1**: users, passkeys, sessions, refresh_tokens, jwt_revocations, abac_policies, device_codes
- ✅ **ABAC**: avaliação de políticas antes de mint

### Características:
- **Foco:** Sistema completo de identidade (WebAuthn + Tokens + ABAC)
- **Aprovação:** Via Passkey (futuro) ou Access token
- **Completude:** D1, ABAC, refresh tokens, revogação

---

## 🔄 Diferenças Principais

| Aspecto | Kit Recebido | Implementação Atual |
|---------|--------------|---------------------|
| **WebAuthn** | ❌ Não tem | ✅ Completo |
| **Session** | ❌ Não tem | ✅ GET /session, POST /session/logout |
| **Tokens** | ❌ Apenas device flow | ✅ mint/refresh/revoke completos |
| **ABAC** | ❌ Não tem | ✅ Avaliação de políticas |
| **Storage** | KV apenas | D1 + KV |
| **Device Approve** | Manual (subject) | Via session/Passkey (futuro) |
| **JWKS Path** | `/.well-known/jwks.json` | `/auth/jwks.json` |
| **Scripts** | ✅ patch + deploy | ❌ Não tem |

---

## ✅ O que o Kit Adiciona (Extras)

### 1. **Scripts de Deploy Automatizados**
- ✅ `patch-office-for-ubl-agency.sh` → padroniza env/wrangler.toml
- ✅ `deploy-ubl-id.sh` → cria KV, pede secrets, deploya

**Ação:** Integrar esses scripts no projeto principal

### 2. **JWKS Path Padrão**
- ✅ `/.well-known/jwks.json` (padrão OIDC/OAuth2)
- ❌ Atual: `/auth/jwks.json`

**Ação:** Adicionar rota `/.well-known/jwks.json` no Core API (alias)

### 3. **Página de Ativação**
- ✅ `GET /activate?code=XXXXXX` → página HTML simples para scan/código
- ❌ Atual: não tem

**Ação:** Adicionar no auth-worker

### 4. **Device Approve Simplificado**
- ✅ Aprovação direta com `subject` (provisório até Passkey)
- ❌ Atual: requer session/Passkey

**Ação:** Adicionar endpoint `/device/approve` no auth-worker (compatibilidade)

---

## 🎯 Recomendações

### Opção A: Integrar Kit no Projeto Atual (Recomendado)

1. **Adicionar scripts:**
   ```bash
   cp -r apps/office/ubl-id-cloudflare-kit/scripts/* scripts/
   ```

2. **Adicionar rota JWKS padrão:**
   - No Core API: `GET /.well-known/jwks.json` → redireciona para `/auth/jwks.json`

3. **Adicionar página de ativação:**
   - No auth-worker: `GET /activate?code=XXXXXX` → HTML simples

4. **Adicionar device/approve:**
   - No auth-worker: `POST /device/approve` → aceita `subject` direto (compatibilidade)

5. **Executar patch:**
   ```bash
   bash scripts/patch-office-for-ubl-agency.sh
   ```

### Opção B: Usar Kit Separado (Não Recomendado)

- Mantém dois sistemas de identidade
- Duplicação de lógica
- Confusão de endpoints

---

## 📋 Checklist de Integração

- [ ] Copiar scripts do kit para `scripts/`
- [ ] Adicionar `GET /.well-known/jwks.json` no Core API
- [ ] Adicionar `GET /activate?code=XXXXXX` no auth-worker
- [ ] Adicionar `POST /device/approve` no auth-worker (compatibilidade)
- [ ] Executar `patch-office-for-ubl-agency.sh`
- [ ] Testar device flow completo
- [ ] Atualizar documentação

---

## 🔑 JWKs Fornecidos

O kit vem com par ES256 pronto:

**kid:** `fOYJEW760OAfkL3nHzYGP4zaB9qpuuX4AR6jQpFz9FI`

**Ação:** Usar este par ou gerar novo (se já temos um do Blueprint 06)

---

**Conclusão:** O kit adiciona scripts úteis e algumas convenções (JWKS path, página de ativação). A implementação atual é mais completa (WebAuthn, ABAC, D1). **Recomendação:** integrar os scripts e endpoints extras do kit na implementação atual.
