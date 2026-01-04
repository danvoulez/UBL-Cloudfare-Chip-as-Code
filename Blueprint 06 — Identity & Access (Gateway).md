# Blueprint 06 — Identity & Access (Gateway)

**Versão:** v1.0 • **Data:** 2026-01-03 • **Status:** P0 Canônico

**Escopo:** autenticação de pessoas (Passkey/WebAuthn + Cloudflare Access), emissão de tokens curtos escopados para agentes/IDEs, sessões web seguras, rotação de chaves e revogação — tudo MCP-first, server-blind e governado por política (Chip-as-Code).

---

## 0) Invariantes (não negociáveis)

- **MUST** Passkey/WebAuthn p/ humanos (no Gateway).
- **MUST** Verificação Cloudflare Access (AUD/JWKS) quando header estiver presente; mapeia grupos/roles.
- **MUST** Emissão de JWT ES256 (ECDSA P-256) de curta duração (≤15 min) para agents/IDE e para UI (quando necessário).
- **MUST** Escopo fechado no token: `{tenant, entity?, room?, tools?}` + `session_type`.
- **MUST** Cookies: `sid` HttpOnly, Secure, SameSite=Lax, sem conteúdo sensível.
- **MUST** Server-blind logging (campos fixos, sem plaintext).
- **MUST** Idempotência/ABAC aplicadas no Gateway antes de despachar.
- **SHOULD** Rotação de chaves via JWKS (`kid` atual + próximo) com blue/green.
- **MAY** Refresh tokens de longa duração apenas p/ agentes (não para browsers).

---

## 1) Modelo de Identidade

### 1.1 Tipos de sujeito

- **Human**: autentica via Passkey/WebAuthn (fallback: CF Access). Recebe cookie `sid` + pode pedir token curto via `/tokens/mint`.
- **Agent/IDE**: autentica com token curto emitido pelo Gateway, escopado e com TTL (≤15 min); opcional refresh (≤7 dias).
- **Service** (intra-plataforma): usa mTLS/secret e troca por token interno (mesmos claims, TTL curto).

### 1.2 Escopo fechado (claim scope)

```json
{
  "tenant": "ubl",
  "entity": "cust_42",
  "room": "room-abc",         // opcional
  "tools": ["ubl@v1.*"],      // wildcard permitido
  "session_type": "work"      // work|assist|deliberate|research
}
```

### 1.3 Claims mínimas do JWT (ES256)

- `iss`: `https://api.ubl.agency`
- `sub`: `user:{uuid}` | `agent:{uuid}`
- `aud`: `ubl-gateway`
- `iat`, `exp`
- `kid`: `<key id atual>` (ex: `jwt-v1`, `jwt-v2`)
- `scope`: `{...}` (JSON compactado/ordenado)
- `client_id`: `ide:vscode` | `agent:buildbot` | `ui:web`
- `role?`: `["admin","moderator"]`   // opcional (derivado de Access/ABAC)
- **Algoritmo**: ES256 (ECDSA P-256) — padrão permanente

---

## 2) Fluxos (alto nível)

### 2.1 Humano (browser) — Passkey

1. `GET /auth/passkey/register` → options (WebAuthn)
2. `POST /auth/passkey/finish` → cria credencial → set `sid` cookie
3. `GET /session` → retorna perfil mínimo + escopos disponíveis
4. (opcional) `POST /tokens/mint` → JWT curto p/ MCP/IDE local

### 2.2 Humano (browser) — Cloudflare Access (quando cabe)

- Worker valida `Cf-Access-Jwt-Assertion` com `ACCESS_JWKS` e `ACCESS_AUD`.
- Extrai identidade (email, sub, groups) → cria/sincroniza sujeito → set `sid`.
- Roles derivadas passam a constar no token curto emitido pelo Gateway.

### 2.3 Agent/IDE — Token curto (MCP-first)

1. `POST /tokens/mint` com `sid` (ou mutual secret p/ serviço) + scope solicitado
2. Gateway aplica ABAC + quotas → emite JWT EdDSA (≤15 min)
3. Agent chama `/mcp` (tools/calls) com `Authorization: Bearer …`

### 2.4 Refresh/Revogação (apenas agentes)

- `POST /tokens/refresh` → novo JWT curto se refresh válido e não revogado.
- `POST /tokens/revoke` (ou admin) → insere `jti` em Revocation List (KV) com TTL = exp restante.

---

## 3) Endpoints (contratos mínimos)

Prefixo Gateway público: `https://api.ubl.agency`

### 3.1 WebAuthn (browser)

- `GET /auth/passkey/register` → `{ publicKey: {...} }`
- `POST /auth/passkey/finish` → `201` + `sid` cookie
- `POST /auth/logout` → limpa `sid`

### 3.2 Sessão

- `GET /session` → `200 { sub, tenant_default, roles[], affordances[] }`

### 3.3 Tokens

- `POST /tokens/mint`
  - In: `{ scope, session_type, client_id }`
  - Out: `{ token, exp, kid }`
- `POST /tokens/refresh` (agentes)
- `POST /tokens/revoke` (admin/owner)

### 3.4 Introspecção (interna)

- `POST /internal/tokens/verify` → usado pelo Core API/Office; valida assinatura/exp/escopo.

**Nota:** Todos retornos de erro seguem JSON-RPC ErrorToken (vocabulário fechado), mesmo em REST: body inclui `{ token, remediation[], retry_after_ms? }`.

---

## 4) Integração Cloudflare Access

- Env vars: `ACCESS_AUD`, `ACCESS_JWKS` (já padronizados no Worker).
- Worker valida o JWT de Access → injeta `X-Access-Identity` (sub, email, groups) no cabeçalho para o Core API.
- Gateway mapeia groups → roles (ex.: `Access:admin` → `role=admin`).
- Política v3 (já criada) reforça:
  - `W_Admin_Path_And_Role` (rota `/admin/**` exige `role=admin` + Access verificado)
  - `W_Public_Warmup` (rota pública controlada)

---

## 5) Armazenamento & Chaves

- **D1** (ou Postgres) p/ sujeitos/credenciais WebAuthn e binds de identidade.
- **KV** p/:
  - `jwks.json` (JWKS dinâmico com `kid: jwt-v1` ativo + `kid: jwt-v2` next)
  - `signing_kid_current` / `signing_kid_next`
  - `revoked_jti:{jti}` → TTL = exp

**Rotação (blue/green):**
1. Gerar nova chave P-256 (`jwt-v2`)
2. Publicar `jwks.json` com ambas as chaves (`jwt-v1` active, `jwt-v2` next)
3. Começar a assinar com `jwt-v2`
4. Manter `jwt-v1` no JWKS por ≥ 30 dias (ou > TTL máximo possível)
5. Remover `jwt-v1` quando não houver mais tráfego legado

---

## 6) ABAC & Políticas (ponte com o Engine)

- ABAC executado **ANTES** do mint e **ANTES** do tool/call.
- Ordem rígida: deny explícito > allow específico > allow genérico > deny default.
- Tokens carregam apenas escopo aprovado (nunca mais que o pedido).
- O Engine (v3) já suporta bits: `context.rate.ok`, `context.webhook.verified`, `context.legacy_jwt.*`.

**Mapeamentos canônicos:**
- `role=admin` → permite `/admin/**` (com `P_Is_Admin_Path`).
- `session_type` guia quotas (tabela do Office).

---

## 7) Segurança

- **Cookies**: `sid` HttpOnly, Secure, SameSite=Lax, TTL curto (≤12h).
- **CSRF**: rotas mutáveis em browser exigem header `X-CSRF-Token` (emitido em `/session`); MCP usa Bearer, não precisa.
- **Replay**: `jti` único por JWT; revogação em KV.
- **Fixation**: renovar `sid` pós-login; atar `sid` a fingerprint leve (UA, prefixo IP /24).
- **Scopes**: nunca aceitar `tools="*"` em produção; sempre reduzir a conjuntos explícitos/wildcards por namespace.
- **Logs** (server-blind, lista fechada):
  - `sub`, `client_id`, `ok`, `err_token`, `latency_ms`, `ts`.

---

## 8) SLOs

- Login (WebAuthn) p99 < 500 ms
- `/tokens/mint` p99 < 120 ms
- Verify (intra) p99 < 50 ms
- Erro 5xx < 0,2%; clock-skew tolerado ±60s.

---

## 9) OpenAPI (trecho mínimo)

```yaml
openapi: 3.0.3
info: { title: Identity & Access API, version: 1.0 }
paths:
  /tokens/mint:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [scope, session_type, client_id]
              properties:
                scope: { type: object }
                session_type: { type: string, enum: [work, assist, deliberate, research] }
                client_id: { type: string, maxLength: 64 }
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties: { token: {type: string}, exp: {type: integer}, kid: {type: string} }
        "4XX":
          description: error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorToken'
components:
  schemas:
    ErrorToken:
      type: object
      required: [token, remediation]
      properties:
        token: { type: string, enum: [INVALID_PARAMS, UNAUTHORIZED, FORBIDDEN_SCOPE, RATE_LIMIT, BACKPRESSURE, IDEMPOTENCY_CONFLICT, INTERNAL] }
        remediation: { type: array, items: { type: string, maxLength: 120 }, maxItems: 3 }
        retry_after_ms: { type: integer }
```

---

## 10) Esqueleto de implementação (onde cai no código)

```
apps/gateway/
  src/identity/
    webauthn.rs         # flows register/finish (Passkey)
    access.rs           # validação Cf-Access (AUD/JWKS)
    tokens.rs           # mint/verify/refresh/revoke (Ed25519, JWKS KV)
    csrf.rs             # emissão/validação X-CSRF-Token
    abac.rs             # avaliação de políticas
    storage.rs          # D1/Postgres p/ credenciais e vínculos
  src/http/
    routes_auth.rs      # /auth/*, /session
    routes_tokens.rs    # /tokens/*
  src/internal/
    verify.rs           # /internal/tokens/verify (Axum extractor)
```

**Linguagens/libs:**
- Worker (Edge): TypeScript (verificação Access e headers).
- Core API (Axum/Rust): `jsonwebtoken` (EdDSA), `webauthn-rs`, `ulid`, `time`, `axum`.

---

## 11) Testes & DoD

### 11.1 Smoke (automático)

- ✅ WebAuthn flow cria `sid` (cookie com atributos corretos)
- ✅ `/tokens/mint` sem `client_id` → `INVALID_PARAMS` (ErrorToken)
- ✅ `/tokens/mint` com scope maior que ABAC → `FORBIDDEN_SCOPE`
- ✅ Token assinado com `kid` atual valida em `/internal/tokens/verify`
- ✅ Revogação: `revoke(jti)` → verify falha

### 11.2 Rate/Quota (cross com Office)

- `session_type=research` recebe bucket maior que `work`; exceder → `BACKPRESSURE` com `retry_after_ms`

### 11.3 DoD (Definition of Done)

- p99 em conformidade (login/mint/verify)
- JWKS current/next publicados; rotação testada sem downtime
- Logs server-blind sem plaintext
- Matriz de ABAC cobre: admin paths, tool wildcards, escopos por tenant

---

## 12) ADRs (decisões travadas)

- **ADR-IA-001** — Passkey-first; Access é complemento corporativo.
- **ADR-IA-002** — ES256 (ECDSA P-256) para JWT (compatibilidade ampla, HSM/KMS, FIPS, interoperabilidade Passkey/WebAuthn); rotação blue/green.
- **ADR-IA-003** — Tokens curtos (≤15 min) + refresh somente p/ agentes.
- **ADR-IA-004** — ABAC antes de escopo: token nunca carrega mais do que política autoriza.
- **ADR-IA-005** — Server-blind: logs com lista fechada de campos.

---

## 13) P0 Entregáveis (checklist de 1 tela)

- `/auth/passkey/*` funcional com cookie `sid` correto
- `/tokens/mint|refresh|revoke` (JWT EdDSA, `kid` em header, `jwks_current` em KV)
- `/internal/tokens/verify` (Axum extractor)
- Integração Access no Worker (AUD/JWKS) + mapeamento de roles
- ABAC aplicado no mint e no tool/call
- Rotação current/next validada em staging
- Revocation List em KV por `jti`
- SLOs e métricas (login/mint/verify) + logs server-blind
- Testes de ErrorToken em todos erros 4xx/5xx

**Proof of Done:**
- Rodar suíte `identity-compliance.http` e obter 100% PASS/NA.
- Demonstrar rotação de chave sem derrubar verify/mint.
- Capturas de logs sem conteúdo sensível.

---

## 14) Próximo passo sugerido

Se estiver ok, eu preparo o esqueleto compilável (Rust + Worker) com:
- `tokens.rs` (Ed25519, JWKS em KV, mint/verify)
- rotas passkey, tokens, session
- fixtures de ABAC e um teste de rotação blue/green.
