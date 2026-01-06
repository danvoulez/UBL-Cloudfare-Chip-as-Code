# office-llm (Worker)

Roteador de LLMs com política simples: `default` (prefer premium) vs `adult` (somente LABs).

## Deploy rápido
```bash
cd workers/office-llm
npm i
wrangler secret put OPENAI_API_KEY      # opcional
wrangler secret put ANTHROPIC_API_KEY   # opcional
wrangler deploy
```

## Variáveis
- `LAB_DEFAULT_BASE` (default: http://lab-256:11434)
- `LAB_ADULT_BASE`   (default: http://lab-512:11434)
- `ALLOW_PREMIUM_DEFAULT` ("true"|"false") — se falso, sempre usa LAB no modo default.

## Endpoints
- `GET /healthz`
- `GET /policy`
- `POST /llm/generate` — body OpenAI-like:
```json
{
  "messages":[{"role":"user","content":"hello"}],
  "max_tokens": 200,
  "temperature": 0.2
}
```
Headers:
- `X-Content-Policy: adult|default` (default = `default`)
- `Authorization: Bearer <app-token>` (opcional – para auditoria; não é repassado aos premium)

## Smoke
```bash
BASE=https://office-llm.dan-1f4.workers.dev
curl -s $BASE/healthz | jq .
curl -s $BASE/policy  | jq .

# default (prefer premium se houver chave, senão LAB)
curl -s -X POST $BASE/llm/generate -H "content-type: application/json"   -H "X-Content-Policy: default"   -d '{"messages":[{"role":"user","content":"Diga oi em 5 palavras."}],"max_tokens":64}' | jq .

# adulto (somente LAB)
curl -s -X POST $BASE/llm/generate -H "content-type: application/json"   -H "X-Content-Policy: adult"   -d '{"messages":[{"role":"user","content":"Diga oi em 5 palavras."}],"max_tokens":64}' | jq .
```
