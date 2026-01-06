# Importar DNS no Cloudflare

## 1. Criar Zone no Cloudflare

```bash
# Via API
curl -X POST "https://api.cloudflare.com/client/v4/zones"   -H "Authorization: Bearer $CF_API_TOKEN"   -H "Content-Type: application/json"   --data '{"name":"logline.world","account":{"id":"$CLOUDFLARE_ACCOUNT_ID"}}'
```

Ou via Dashboard: https://dash.cloudflare.com → Add a Site

## 2. Importar Registros

### Opção A: Via Dashboard
1. Acesse: https://dash.cloudflare.com → Selecione a zone
2. DNS → Records → Import
3. Cole o conteúdo de `cloudflare-import.json`

### Opção B: Via API (script)

```bash
# Carregar registros
RECORDS=$(cat cloudflare-import.json)

# Importar (ajuste ZONE_ID)
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/import"   -H "Authorization: Bearer $CF_API_TOKEN"   -H "Content-Type: application/json"   --data "$RECORDS"
```

## 3. Atualizar Nameservers

Após criar a zone no Cloudflare, você receberá nameservers como:
- `ns1.cloudflare.com`
- `ns2.cloudflare.com`

### Atualizar no Route 53 (registrar)

1. Acesse o registrar do domínio (não Route 53)
2. Atualize os nameservers para os fornecidos pelo Cloudflare

### Ou via AWS CLI (se Route 53 for o registrar)

```bash
# Listar nameservers atuais
aws route53 get-hosted-zone --id Z07663683D1GYH916RTKR

# Atualizar no registrar (fora do escopo deste script)
```

## 4. Verificar

```bash
# Verificar DNS propagation
dig logline.world NS +short

# Verificar registros
dig logline.world A +short
```

## 5. Desativar Route 53 (após verificar)

Após confirmar que tudo está funcionando no Cloudflare:

```bash
# ⚠️ CUIDADO: Isso deleta a hosted zone
# aws route53 delete-hosted-zone --id Z07663683D1GYH916RTKR
```

**⚠️ IMPORTANTE:** Só delete a hosted zone após confirmar que o DNS está funcionando no Cloudflare!
