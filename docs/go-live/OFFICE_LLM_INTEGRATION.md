# Office-LLM — Integração Completa

**Data:** 2026-01-05  
**Status:** ✅ Integrado

---

## 📦 Estrutura Integrada

```
workers/office-llm/
  ├── src/index.ts          # Worker principal
  ├── policies/
  │   └── default.policy.yaml  # Roteamento adult|default
  ├── wrangler.toml         # Config Cloudflare
  └── package.json

infra/pm2/
  └── ecosystem.local-llm.cjs  # PM2 para LLMs locais

scripts/
  └── deploy-office-llm.sh     # Deploy automatizado
```

---

## 🎯 Funcionalidades

### 1. Roteamento por Política

**Header:** `X-Content-Policy: adult|default`

**Lógica:**
- **`default`**: Prefer premium (OpenAI/Anthropic) → fallback LAB
- **`adult`**: Somente LAB (lab_adult, lab_default)

**Policy YAML:**
```yaml
version: 1
logic:
  default:
    prefer: [openai, anthropic, lab_default]
  adult:
    prefer: [lab_adult, lab_default]

providers:
  openai:
    kind: openai
    url: https://api.openai.com/v1/chat/completions
    model: gpt-4o-mini
  anthropic:
    kind: anthropic
    url: https://api.anthropic.com/v1/messages
    model: claude-3-5-sonnet-latest
  lab_default:
    kind: ollama
    url: ${LAB_DEFAULT_BASE}
    model: llama3:8b-instruct
  lab_adult:
    kind: ollama
    url: ${LAB_ADULT_BASE}
    model: llama3:8b-instruct
```

---

### 2. Endpoints

**Base:** `https://office-llm.ubl.agency`

- `GET /healthz` → `{ ok: true, service: "office-llm" }`
- `GET /policy` → retorna policy atual
- `POST /llm/generate` → gera resposta

**Request (POST /llm/generate):**
```json
{
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "max_tokens": 200,
  "temperature": 0.2
}
```

**Headers:**
- `X-Content-Policy: adult|default` (obrigatório)
- `Authorization: Bearer <app-token>` (opcional, para auditoria)

**Response:**
```json
{
  "ok": true,
  "provider": "openai",
  "model_used": "gpt-4o-mini",
  "output": {
    "role": "assistant",
    "content": "..."
  }
}
```

---

### 3. Providers Suportados

#### Premium (OpenAI/Anthropic)
- Requer API keys (secrets)
- Usado apenas em modo `default`
- Fallback para LAB se keys ausentes

#### Local (Ollama)
- LAB 256: `http://lab-256:11434` (default)
- LAB 512: `http://lab-512:11434` (adult)
- Sempre disponível (se PM2 rodando)

---

## 🚀 Deploy

### 1. Configurar Secrets (Opcional)

```bash
cd workers/office-llm
wrangler secret put OPENAI_API_KEY      # opcional
wrangler secret put ANTHROPIC_API_KEY   # opcional
```

### 2. Configurar LAB URLs

Editar `wrangler.toml`:
```toml
[vars]
LAB_DEFAULT_BASE = "http://lab-256:11434"  # ou via Tunnel
LAB_ADULT_BASE   = "http://lab-512:11434"  # ou via Tunnel
ALLOW_PREMIUM_DEFAULT = "true"
```

### 3. Deploy

```bash
bash scripts/deploy-office-llm.sh
```

Ou manualmente:
```bash
cd workers/office-llm
npm install
wrangler deploy
```

---

## 🧪 Smoke Tests

```bash
# Health
curl -s https://office-llm.ubl.agency/healthz | jq .

# Policy
curl -s https://office-llm.ubl.agency/policy | jq .

# Generate (default)
curl -s -X POST https://office-llm.ubl.agency/llm/generate \
  -H "content-type: application/json" \
  -H "X-Content-Policy: default" \
  -d '{"messages":[{"role":"user","content":"Diga oi em 5 palavras."}],"max_tokens":64}' | jq .

# Generate (adult)
curl -s -X POST https://office-llm.ubl.agency/llm/generate \
  -H "content-type: application/json" \
  -H "X-Content-Policy: adult" \
  -d '{"messages":[{"role":"user","content":"Diga oi em 5 palavras."}],"max_tokens":64}' | jq .
```

**Ou usar script:**
```bash
./scripts/smoke-office-llm.sh
```

---

## 🔗 Integração com Office API

### Chamada do Office para LLM

**No Office API Worker:**
```typescript
const LLM_BASE = env.LLM_GATEWAY_BASE || "https://office-llm.ubl.agency";
const policy = req.tags?.adult ? "adult" : "default";

const llmResp = await fetch(`${LLM_BASE}/llm/generate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Content-Policy": policy,
    "Authorization": `Bearer ${appToken}`, // Token UBL ID
  },
  body: JSON.stringify({
    messages: [...],
    max_tokens: 400,
    temperature: 0.2,
  }),
});
```

---

## 📋 PM2 para LLMs Locais

**Arquivo:** `infra/pm2/ecosystem.local-llm.cjs`

**Uso:**
```bash
pm2 start infra/pm2/ecosystem.local-llm.cjs
pm2 list
```

**Configuração:**
- `ollama-serve`: Servidor Ollama (porta 11434)
- `ollama-pull-llama3`: Pull do modelo (uma vez)

**Ajustar para:**
- LAB 256: porta 11434 (default)
- LAB 512: porta 11435 (adult) ou outro host

---

## 🔐 Segurança

### Validação de Token (Futuro)

**Atual:** Token é logado mas não validado

**Futuro:**
```typescript
// Validar token via JWKS
const jwks = await fetch("https://id.ubl.agency/.well-known/jwks.json");
// Verificar assinatura ES256
// Extrair claims (sub, scope, etc.)
```

### Auditoria

- Logar `provider`, `model_used`, `policy_mode`
- Incluir `sub` do token (se presente)
- Emitir evento JSON✯Atomic: `llm.generate.completed`

---

## 📊 Variáveis de Ambiente

### Worker (`wrangler.toml`)

```toml
[vars]
LAB_DEFAULT_BASE = "http://lab-256:11434"
LAB_ADULT_BASE   = "http://lab-512:11434"
ALLOW_PREMIUM_DEFAULT = "true"  # "false" = sempre LAB
```

### Secrets

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

---

## ✅ Proof-of-Done

- [ ] Health: `GET /healthz` → `{ ok: true }`
- [ ] Policy: `GET /policy` → retorna YAML parseado
- [ ] Generate default: usa premium ou LAB
- [ ] Generate adult: usa somente LAB
- [ ] Fallback: se premium falhar, usa LAB
- [ ] Token: (opcional) valida Bearer token

---

## 🔄 Rollback

```bash
cd workers/office-llm
wrangler deployments list
wrangler rollback
```

---

**Status:** 🟢 **Pronto para deploy**
