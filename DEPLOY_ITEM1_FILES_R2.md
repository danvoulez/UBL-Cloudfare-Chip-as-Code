# Item 1 — Files/R2 "real" (presign + CORS) — P0

**Por quê:** Habilita upload/download fora do pipeline de streaming.

---

## Pré-requisitos

### 1. Variáveis de ambiente

Adicione ao arquivo `env`:

```bash
# IDs já conhecidos
export CLOUDFLARE_ACCOUNT_ID="1f43a14fe5bb62b97e7262c5b6b7c476"
export R2_BUCKET="ubl-media"

# Credenciais R2 (geradas no Dashboard > R2 > "Manage R2 API Tokens")
export R2_ACCESS_KEY_ID="PASTE_YOUR_R2_ACCESS_KEY_ID"
export R2_SECRET_ACCESS_KEY="PASTE_YOUR_R2_SECRET_ACCESS_KEY"

# Endpoints
export MEDIA_API_BASE="https://api.ubl.agency"
```

### 2. Gerar credenciais R2

1. Acesse: https://dash.cloudflare.com/1f43a14fe5bb62b97e7262c5b6b7c476/r2/api-tokens
2. Crie um token com permissões de leitura/escrita no bucket `ubl-media`
3. Copie `Access Key ID` e `Secret Access Key`

### 3. Instalar AWS CLI (se necessário)

```bash
# macOS
brew install awscli

# Linux
sudo apt-get install awscli  # ou equivalente
```

---

## Deploy

### Opção 1: Script automático (recomendado)

```bash
# Carrega variáveis do env e executa
./scripts/setup-r2-cors.sh
```

### Opção 2: Manual

```bash
# 1. Definir variáveis
export CLOUDFLARE_ACCOUNT_ID="1f43a14fe5bb62b97e7262c5b6b7c476"
export R2_BUCKET="ubl-media"
export R2_ACCESS_KEY_ID="seu_access_key_id"
export R2_SECRET_ACCESS_KEY="seu_secret_access_key"
export VVZ_PUBLIC_ORIGINS='["https://voulezvous.tv","https://www.voulezvous.tv"]'
export VVZ_ADMIN_ORIGINS='["https://admin.voulezvous.tv"]'

# 2. Habilitar CORS
./scripts/enable-r2-cors.sh

# 3. Verificar
aws --profile r2 --endpoint-url=https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com \
  s3api get-bucket-cors --bucket $R2_BUCKET | jq
```

---

## Smoke Test

### Executar smoke completo

```bash
export MEDIA_API_BASE="https://api.ubl.agency"
./scripts/smoke_files_r2.sh
```

### O que o smoke test faz

1. **PRESIGN**: Solicita URL de upload assinada
2. **UPLOAD**: Faz upload do arquivo via PUT presigned
3. **COMMIT**: Confirma upload e valida SHA256
4. **LINK**: Obtém URL assinada para download
5. **DOWNLOAD**: Baixa arquivo e valida integridade (SHA256)

### Saída esperada

```
>> 1) PRESIGN
   - media_id: abc123...
   - upload_url: https://...
>> 2) UPLOAD (PUT presigned)
   - upload OK (HTTP 200)
>> 3) COMMIT
   - commit OK
>> 4) LINK (signed GET)
>> 5) DOWNLOAD e validação
✅ Smoke Files/R2 OK
   media_id: abc123...
   sha256:   abc123...
   bytes:    65536
```

---

## Reverter CORS

Se precisar remover CORS:

```bash
export CLOUDFLARE_ACCOUNT_ID="1f43a14fe5bb62b97e7262c5b6b7c476"
export R2_BUCKET="ubl-media"
export R2_ACCESS_KEY_ID="seu_access_key_id"
export R2_SECRET_ACCESS_KEY="seu_secret_access_key"

./scripts/disable-r2-cors.sh
```

---

## Dashboard Grafana

### Importar dashboard

1. Acesse Grafana: http://localhost:3000
2. Dashboards → Import
3. Upload: `observability-starter-kit/grafana/dashboards/35-media.json`
4. Selecione datasource Prometheus → Import

### Ajustar variáveis (se necessário)

Se seus nomes de métricas/labels forem diferentes:

- `metric_http_bucket`: Nome da métrica de histograma (ex.: `http_server_duration_seconds_bucket`)
- `metric_http_total`: Nome da métrica de contador (ex.: `http_server_requests_total`)
- `label_service`: Label do serviço (ex.: `job` em vez de `service`)
- `label_route`: Label da rota (ex.: `path` em vez de `route`)
- `tenant_label`: Label do tenant (se não existir, selecione "All")

---

## Proof of Done

✅ **CORS configurado:**
- `get-bucket-cors` retorna duas regras:
  - GET/HEAD para origens públicas (`voulezvous.tv`, `www.voulezvous.tv`)
  - PUT/POST para admin (`admin.voulezvous.tv`)

✅ **Smoke test passa:**
- Presign retorna URL de upload válida
- Upload conclui (HTTP 200/204)
- Commit valida SHA256
- Link retorna URL assinada
- Download valida integridade (SHA256 bate)

✅ **Dashboard Grafana:**
- Painel "Success rate" mostra valor > 0 (em carga)
- Painel "Latency P50/P95" exibe séries para `/internal/media/presign`
- Painel "Latency P95 por rota" lista presign, commit, link

✅ **D1 (opcional):**
- Tabela `media` no D1 `ubl-media` tem registro do `media_id` criado

---

## Troubleshooting

### Erro: "missing R2_ACCESS_KEY_ID"

Adicione as credenciais ao arquivo `env` ou exporte antes de executar:

```bash
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
```

### Erro: "NoSuchBucket"

Verifique se o bucket `ubl-media` existe:

```bash
wrangler r2 bucket list | grep ubl-media
```

### Erro no upload (HTTP 403)

Verifique se o CORS está configurado corretamente:

```bash
aws --profile r2 --endpoint-url=https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com \
  s3api get-bucket-cors --bucket ubl-media | jq
```

### Smoke test falha no commit

Verifique se o Media API Worker está deployado e acessível:

```bash
curl -s https://api.ubl.agency/internal/media/presign \
  -H 'content-type: application/json' \
  -d '{"mime":"application/octet-stream","bytes":1024}' | jq
```

---

## Scripts disponíveis

- `scripts/enable-r2-cors.sh` — Habilita CORS no bucket R2
- `scripts/disable-r2-cors.sh` — Remove CORS do bucket R2
- `scripts/smoke_files_r2.sh` — Smoke test completo (presign → upload → commit → link)
- `scripts/setup-r2-cors.sh` — Setup completo (carrega env e executa)

---

## Próximos passos

Após validar o Item 1:

1. **Item 2**: Billing quota-do (DO + D1 + PLANS_KV)
2. **Item 3**: Admin endpoints operacionais
3. **Item 4**: RTC "2 clientes" (sala estável)
