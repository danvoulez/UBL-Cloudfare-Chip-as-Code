# UBL ID + Office — Go-Live Checklist

**Data:** 2026-01-05  
**Status:** 🟢 Pronto para produção

---

## 🚀 Variáveis Rápidas

```bash
# URLs
export AUTH=${AUTH:-https://id.ubl.agency}
export OFFICE=${OFFICE:-https://office-api-worker.dan-1f4.workers.dev}
export LLM=${LLM:-https://office-llm.ubl.agency}

# KID atual (fornecido no kit)
export KID=fOYJEW760OAfkL3nHzYGP4zaB9qpuuX4AR6jQpFz9FI
```

---

## ✅ Checklist Go-Live

### 1) Saúde & JWKS

```bash
# Health checks
curl -s $OFFICE/healthz | jq .
curl -s $AUTH/healthz | jq .
curl -s $LLM/healthz | jq .

# JWKS em caminho canônico e alias
curl -s $AUTH/.well-known/jwks.json | jq '.keys[0].kid'
curl -s $AUTH/auth/jwks.json | jq '.keys[0].kid'
```

**Esperado:**
- ✅ `kid` = `$KID`
- ✅ ETag presente
- ✅ Cache-Control: `public, max-age=300`

---

### 2) Device Flow (compatível com kit)

```bash
# Start
START=$(curl -s -X POST $AUTH/device/start \
  -H "content-type: application/json" \
  -d '{"client_id":"office"}')
echo "$START" | jq .

# Extrair códigos
CODE=$(echo "$START" | jq -r '.device_code')
VERIFY=$(echo "$START" | jq -r '.verification_uri_complete')

# Aprovar (modo compat) — substitua "dan@ubl.agency" pelo subject correto
curl -s -X POST $AUTH/device/approve \
  -H "content-type: application/json" \
  -d "{\"user_code\":\"$(echo "$START" | jq -r '.user_code')\",\"subject\":\"dan@ubl.agency\"}" | jq .

# Poll até autorizar
POLL=$(curl -s -X POST $AUTH/device/poll \
  -H "content-type: application/json" \
  -d "{\"device_code\":\"$CODE\"}")
echo "$POLL" | jq .
```

**Esperado:**
- ✅ `status=authorized` ou `ok=true` com `access_token`
- ✅ `verification_uri_complete` presente

---

### 3) Mint/Verify (ES256 real + kid)

```bash
# Mint (fluxo direto; precisa ABAC permitir o subject/escopo)
MINT=$(curl -s -X POST $AUTH/tokens/mint \
  -H "content-type: application/json" \
  -d '{"resource":"office.*","action":"read","tags":{}}')
echo "$MINT" | jq .

# Extrair token
AT=$(echo "$MINT" | jq -r '.access_token // empty')

# Opcional: introspection/verify se exposto
[ -n "$AT" ] && curl -s -X POST $AUTH/tokens/verify \
  -H "authorization: Bearer $AT" | jq .
```

**Esperado:**
- ✅ Assinatura ES256 válida contra JWKS
- ✅ `kid` no header = `$KID`
- ✅ Claims corretos (iss, sub, aud, exp)

---

### 4) Sessão (cookie) & Logout

```bash
# Criar sessão via token
curl -i -s $AUTH/session \
  -H "authorization: Bearer $AT" | sed -n '1,12p'

# Logout
curl -i -s -X POST $AUTH/session/logout \
  -H "authorization: Bearer $AT" | sed -n '1,12p'
```

**Esperado:**
- ✅ `Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Lax; Domain=.ubl.agency`
- ✅ `200 OK` no logout

---

### 5) ABAC (nega/permite)

```bash
# Tentar escopo que NÃO deve ter
curl -s -X POST $AUTH/tokens/mint \
  -H "content-type: application/json" \
  -d '{"resource":"admin:root","action":"*","tags":{}}' | jq .
```

**Esperado:**
- ✅ `403 Forbidden` quando política negar
- ✅ ErrorToken estruturado: `{"error":"forbidden","detail":"ABAC denied"}`

---

### 6) Office API Básico (inventário & anchor)

```bash
# Inventory
curl -s $OFFICE/inventory | jq .

# Esperado: { ok: true, files: [...] }
# Se vazio, inserir 1 registro para smoke (se endpoint existir):
curl -s -X POST $OFFICE/api/files/seed \
  -H "content-type: application/json" \
  -d '{"path":"docs/spec.pdf","kind":"blob","canonical":1}' | jq .
```

**Esperado:**
- ✅ `{ ok: true, files: [...] }`
- ✅ Schema canônico: `id`, `path`, `kind`, `canonical`, `size`, `hash`

---

### 7) Office-LLM (roteamento adult|default)

```bash
# Health
curl -s $LLM/healthz | jq .

# Policy
curl -s $LLM/policy | jq .

# Generate (default - prefer premium)
curl -s -X POST $LLM/llm/generate \
  -H "content-type: application/json" \
  -H "X-Content-Policy: default" \
  -d '{"messages":[{"role":"user","content":"Diga oi em 5 palavras."}],"max_tokens":64}' | jq .

# Generate (adult - somente LAB)
curl -s -X POST $LLM/llm/generate \
  -H "content-type: application/json" \
  -H "X-Content-Policy: adult" \
  -d '{"messages":[{"role":"user","content":"Diga oi em 5 palavras."}],"max_tokens":64}' | jq .
```

**Esperado:**
- ✅ `default`: usa premium (se keys presentes) ou LAB
- ✅ `adult`: usa somente LAB
- ✅ Response: `{ ok: true, provider: "...", output: {...} }`

---

### 8) Vectorize (opcional agora, pronto para ligar)

**Index:** `office-vectors` (768/cosine) — ✅ já criado

**Habilitar:**
1. Descomentar `[[vectorize]]` nos `wrangler.toml`
2. `wrangler deploy`

**Smoke (quando ligar):**
```bash
curl -s -X POST $OFFICE/api/anchors/search \
  -H "content-type: application/json" \
  -d '{"query":"tabelas sobre receita", "k": 5}' | jq .
```

---

### 9) Cloudflare Access (se usar na borda)

**Configuração:**
- ✅ Workers recebem `Cf-Access-Jwt-Assertion`
- ✅ Mapear groups → roles no Auth (ABAC)

**Teste:**
```bash
curl -s $OFFICE/inventory \
  -H "Cf-Access-Jwt-Assertion: $ACCESS_JWT" | jq .
```

---

### 10) Rotação de Chaves (seguro e previsível)

**Processo:**
1. Gerar novo par ES256 → adicionar ao JWKS (sem remover o antigo)
2. Começar a assinar com o novo `kid`
3. Aguardar TTL do cache de JWKS (ex.: 300s)
4. Remover o `kid` antigo do JWKS

**Script de rotação:** `infra/identity/ROTATION.md`

---

## 🧪 Script Único de Smoke

```bash
./scripts/smoke-ubl-office.sh
```

**Ou execute manualmente:**
```bash
bash scripts/smoke-ubl-office.sh
```

**Smoke Office-LLM separado:**
```bash
./scripts/smoke-office-llm.sh
```

---

## 🔄 Rollback Simples

### Worker
```bash
wrangler deploy --name <worker> --tag <previous>
```

### JWKS
- Reverter JWKS (manter só a chave estável)
- Remover `kid` novo se necessário

### Vectorize
- Comentar `[[vectorize]]` nos `wrangler.toml`
- Redeploy

---

## 📋 Onde Fica a "Decisão" do Provider?

**Por enquanto:** No `office-llm` (claro e auditável)

**Futuro:** Se fizer sentido, mover política para Gateway Central e `office-llm` vira apenas um provider registrado (e governado) pelo UBL

**✅ Integrado:** Mini-policy do office-llm (YAML + worker) — ver `workers/office-llm/`

---

## ✅ Proof-of-Done

- [ ] Health checks: Office + Auth + LLM
- [ ] JWKS: canônico e alias retornam `kid` correto
- [ ] Device Flow: start → approve → poll → access_token
- [ ] Mint: emite JWT ES256 com `kid` correto
- [ ] Session: cookie `sid` presente
- [ ] ABAC: nega escopo proibido (403)
- [ ] Office: inventory retorna `{ ok: true, files: [...] }`
- [ ] Office-LLM: roteamento `default` e `adult` funcionando
- [ ] Vectorize: (opcional) search funciona
- [ ] Access: (se usar) groups mapeados corretamente

---

**Status:** 🟢 **Pronto para Go-Live**
