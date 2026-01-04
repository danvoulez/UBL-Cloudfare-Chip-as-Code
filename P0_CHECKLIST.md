# P0 em 30 minutos — Checklist Executável

**Objetivo:** Deploy completo dos 4 itens P0 com validações automáticas.

---

## Execução Rápida

```bash
./scripts/deploy-p0-complete.sh
```

---

## P0.1 — Cloudflare Access (Admin)

### O que faz:
- Verifica/cria Access App para `admin.voulezvous.tv`
- Valida que admin está protegido

### Proof of Done:
```bash
curl -I https://admin.voulezvous.tv/admin/health
# → 302/403 sem login, 200 autenticado
```

### Comandos manuais (se necessário):
```bash
# Descobrir Access Apps
bash scripts/discover-access.sh

# Criar Access App
bash scripts/create-access-apps.sh
```

---

## P0.2 — Media API com Stream

### O que faz:
- Verifica secrets do Stream (`STREAM_ACCOUNT_ID`, `STREAM_API_TOKEN`)
- Valida endpoints `/media/stream-live/inputs` e `/media/tokens/stream`
- Testa presign básico

### Proof of Done:
```bash
# Criar input de stream
curl -X POST https://api.ubl.agency/media/stream-live/inputs \
  -H 'content-type: application/json' \
  -d '{"tenant":"voulezvous","title":"test"}' | jq

# Deve retornar: rtmp(s)://... e playback_id

# Obter token de playback
curl -X POST https://api.ubl.agency/media/tokens/stream \
  -H 'content-type: application/json' \
  -d '{"playback_id":"...","ttl":3600}' | jq

# Deve retornar: URL assinada HLS
```

### Comandos manuais (se necessário):
```bash
cd apps/media-api-worker
wrangler secret put STREAM_ACCOUNT_ID
wrangler secret put STREAM_API_TOKEN
wrangler deploy
```

---

## P0.3 — KV Rate-Limit e Webhooks

### O que faz:
- Cria chaves de rate-limit em KV (`rate:{sub}:{route}`)
- Cria chave de webhook exemplo (`webhook:partner:github:key:test`)
- Valida `/_policy/status`

### Proof of Done:
```bash
# Verificar policy status
curl -s https://api.ubl.agency/_policy/status?tenant=ubl | jq

# Testar rate-limit (flood leve)
for i in {1..10}; do
  curl -s https://api.ubl.agency/_policy/status >/dev/null
done

# Verificar que P_Rate_Bucket_OK=true (ou false se exceder)
```

### Comandos manuais:
```bash
# Listar chaves KV
wrangler kv key list --binding=UBL_FLAGS --namespace-id=fe402d39cc544ac399bd068f9883dddf

# Criar chave manualmente
echo "value" | wrangler kv key put "rate:user:route" \
  --namespace-id=fe402d39cc544ac399bd068f9883dddf \
  --binding=UBL_FLAGS
```

---

## P0.4 — Core API via Gateway

### O que faz:
- Valida Core direto (`https://core.voulezvous.tv/healthz`)
- Valida Gateway → Core (`https://voulezvous.tv/core/healthz`)
- Testa session exchange stub

### Proof of Done:
```bash
# Core direto
curl -s https://core.voulezvous.tv/healthz
# → ok

# Gateway → Core
curl -I https://voulezvous.tv/core/healthz
# → 200 (ou 302 se gated)

# Session exchange
curl -X POST https://core.voulezvous.tv/api/session/exchange \
  -H 'content-type: application/json' \
  -d '{"token":"test"}' -i
# → Set-Cookie: sid=...
```

---

## Validação Completa

Após executar o script, rodar smoke test:

```bash
./scripts/smoke-p0-p1.sh
```

---

## Troubleshooting

### Access App não encontrada
```bash
bash scripts/discover-access.sh
bash scripts/create-access-apps.sh
```

### Secrets do Stream não configurados
```bash
cd apps/media-api-worker
wrangler secret list
wrangler secret put STREAM_ACCOUNT_ID
wrangler secret put STREAM_API_TOKEN
```

### Core não responde
```bash
# Verificar se vvz-core está rodando
ps aux | grep vvz-core

# Verificar logs
tail -f /tmp/vvz-core.log

# Reiniciar se necessário
PORT=8787 RUST_LOG=info ./target/release/vvz-core
```

### Gateway não roteia
```bash
# Verificar wrangler.toml
cat policy-worker/wrangler.toml | grep UPSTREAM_CORE

# Redeploy
cd policy-worker && wrangler deploy
```

---

## Tempo Estimado

- **P0.1:** 2 minutos (verificação/criação Access)
- **P0.2:** 5 minutos (secrets + deploy)
- **P0.3:** 3 minutos (criação KV)
- **P0.4:** 1 minuto (validação)

**Total: ~11 minutos** (sem contar deploy do Worker)

---

## Próximos Passos (P1)

Após P0 completo:
1. RTC "room" estável (2+ clientes)
2. R2 Presign real (Files)
3. Rotas Admin operacionais
4. Observabilidade mínima
