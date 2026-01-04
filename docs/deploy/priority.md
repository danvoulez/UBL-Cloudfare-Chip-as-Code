# Deploy Priority — O que ainda falta

**Ordem sugerida (pragmática):**

1. **Observabilidade mínima** (P0) — Collector + Grafana
2. **Webhooks Worker** (P1) — HMAC + DLQ
3. **Billing quota-do** (P1) — DO + D1 + PLANS_KV
4. **Files/R2 real** (P1) — CORS + presign validado
5. **Admin endpoints** (P1) — Validação Access
6. **RTC smoke 2 clientes** (P1) — Rodar script

---

## 1. Observabilidade mínima (P0)

**Por quê:** Ver saúde do gateway/RTC/Core em tempo real.

**Deploy:**
```bash
./scripts/deploy-observability.sh
```

**Proof of Done:**
- `curl -s https://core.voulezvous.tv/metrics | head -n 5` retorna métricas
- Acesso ao Grafana (dashboards importados) mostra séries do Core/Proxy
- Alertas básicos ativos (Prometheus alerts.yml carregado)

**Acesso:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

---

## 2. Webhooks Worker (P1)

**Por quê:** Integrar parceiros com segurança e rastreabilidade.

**Deploy:**
```bash
./scripts/deploy-webhooks.sh
```

**Proof of Done:**
- `curl -s -X POST https://api.ubl.agency/webhooks/github -H 'X-Signature: ...' -d '{}'` → `{"ok":true}` (quando assinado certo)
- Registro de tentativa inválida vai para `r2://ubl-dlq/webhooks/github/...`

**Recursos criados:**
- KV: `WEBHOOK_SECRETS`
- R2: `ubl-dlq`
- Worker: `webhooks-worker`

---

## 3. Billing quota-do (P1)

**Por quê:** Limites por tenant e trilha de uso (mesmo que simples).

**Deploy:**
```bash
./scripts/deploy-billing.sh
```

**Proof of Done:**
- `curl -s https://api.ubl.agency/admin/quota/ping` → `{"ok":true}`
- `usage_daily` populando linhas no D1 após chamadas de teste

**Recursos criados:**
- D1: `BILLING_DB`
- KV: `PLANS_KV`
- DO: `QuotaDO`
- Worker: `quota-do`

---

## 4. Files/R2 real (P1)

**Por quê:** Habilitar upload/download de arquivos fora do fluxo de mídia.

**Deploy:**
```bash
# Validar chaves existentes
wrangler kv namespace list | grep KV_MEDIA
wrangler d1 list | grep ubl-media

# Garantir CORS do bucket R2 para voulezvous.tv e admin.voulezvous.tv
# (Configurar via Cloudflare Dashboard ou API)
```

**Proof of Done:**
- `POST https://api.ubl.agency/internal/media/presign` retorna URL de upload
- Upload conclui e `GET /internal/media/link/:id` entrega URL assinada válida

---

## 5. Admin endpoints (P1)

**Por quê:** Operações sem entrar no servidor.

**Deploy:** O gateway já tem `GET /admin/health` e `POST /admin/policy/promote`. Só validar Access.

**Validação:**
```bash
# Sem login deve redirecionar
curl -I https://admin.voulezvous.tv/admin/health
# → 302/401

# Após login via Access, 200 OK
```

**Proof of Done:**
- `curl -I https://admin.voulezvous.tv/admin/health` → redireciona p/ login (sem sessão)
- Após login via Access, 200 OK

---

## 6. RTC smoke 2 clientes (P1)

**Por quê:** Validar sala estável ponta-a-ponta.

**Deploy:** Já feito (worker RTC). Só rodar smoke:

```bash
./scripts/smoke_rtc.sh
```

**Proof of Done:**
- `ack` em ambos
- Broadcast de `presence.update`
- Signal roteado
- Mediana RTT < 150ms

---

## Scripts Disponíveis

- `./scripts/deploy-observability.sh` — Observabilidade completa
- `./scripts/deploy-webhooks.sh` — Webhooks Worker
- `./scripts/deploy-billing.sh` — Billing Quota-DO
- `./scripts/smoke_rtc.sh` — Smoke test RTC
- `./scripts/test_rtc_manual.sh` — Comandos para teste manual RTC

---

## Ordem de Execução Recomendada

```bash
# 1. Observabilidade (P0)
./scripts/deploy-observability.sh

# 2. Webhooks (P1)
./scripts/deploy-webhooks.sh

# 3. Billing (P1)
./scripts/deploy-billing.sh

# 4. Validar Files/R2 (P1)
# (Manual - verificar CORS e presign)

# 5. Validar Admin (P1)
curl -I https://admin.voulezvous.tv/admin/health

# 6. Smoke RTC (P1)
./scripts/smoke_rtc.sh
```

---

## Tempo Estimado

- **Observabilidade:** ~5 minutos
- **Webhooks:** ~3 minutos
- **Billing:** ~3 minutos
- **Files/R2:** ~2 minutos (validação)
- **Admin:** ~1 minuto (validação)
- **RTC Smoke:** ~5 minutos (teste manual)

**Total: ~19 minutos**
