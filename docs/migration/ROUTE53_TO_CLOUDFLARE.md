# Route 53 → Cloudflare — Migração de DNS

**Data:** 2026-01-05  
**Status:** 🟢 Pronto para uso

---

## 🎯 Objetivo

Migrar domínio do AWS Route 53 para Cloudflare DNS, incluindo:
- Exportação de registros DNS
- Conversão para formato Cloudflare
- Importação no Cloudflare
- Atualização de nameservers

---

## 📋 Pré-requisitos

1. **AWS CLI configurado:**
   ```bash
   aws configure --profile default
   # Ou usar variável: export AWS_PROFILE=seu-profile
   ```

2. **Cloudflare API Token:**
   ```bash
   export CF_API_TOKEN='seu-token'
   # Ou configurar no env como CLOUDFLARE_API_TOKEN
   ```

3. **Ferramentas:**
   ```bash
   brew install awscli jq
   ```

---

## 🚀 Processo Completo

### 1. Exportar DNS do Route 53

```bash
bash scripts/route53-to-cloudflare.sh example.com
```

**O que faz:**
- Descobre Hosted Zone ID no Route 53
- Exporta todos os registros DNS
- Converte para formato Cloudflare (JSON)
- Gera instruções de importação

**Output:**
```
route53-export-YYYYMMDD-HHMMSS/
  ├── route53-records.json      # Export completo
  ├── records.txt               # Lista simples
  ├── cloudflare-import.json    # Formato Cloudflare
  └── CLOUDFLARE_IMPORT.md      # Instruções
```

### 2. Criar Zone no Cloudflare

**Opção A: Via Dashboard**
1. Acesse: https://dash.cloudflare.com
2. Add a Site → Digite o domínio
3. Escolha plano (Free é suficiente para DNS)

**Opção B: Via API**
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"name":"example.com"}'
```

### 3. Importar Registros DNS

**Opção A: Via Script**
```bash
bash scripts/cloudflare-import-dns.sh example.com route53-export-*/cloudflare-import.json
```

**Opção B: Via Dashboard**
1. DNS → Records → Import
2. Cole o conteúdo de `cloudflare-import.json`

**Opção C: Via API (manual)**
```bash
# Importar um registro por vez
jq -c '.[]' cloudflare-import.json | while read record; do
  curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$record"
done
```

### 4. Atualizar Nameservers

Após criar a zone, o Cloudflare fornece nameservers como:
- `ns1.cloudflare.com`
- `ns2.cloudflare.com`

**No Registrar do Domínio:**
1. Acesse o registrar (não Route 53, mas quem registrou o domínio)
2. Vá em DNS/Nameservers
3. Atualize para os nameservers do Cloudflare

**Verificar nameservers:**
```bash
# Via script
bash scripts/cloudflare-import-dns.sh example.com cloudflare-import.json

# Ou via API
curl -H "Authorization: Bearer $CF_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones?name=example.com" \
     | jq -r '.result[0].name_servers[]'
```

### 5. Verificar Propagação

```bash
# Verificar nameservers
dig example.com NS +short

# Verificar registros
dig example.com A +short
dig www.example.com A +short

# Verificar MX
dig example.com MX +short
```

**Aguardar:** Propagação pode levar de minutos a 48 horas.

### 6. Desativar Route 53 (Opcional)

⚠️ **SÓ APÓS CONFIRMAR QUE TUDO ESTÁ FUNCIONANDO NO CLOUDFLARE**

```bash
# Listar hosted zones
aws route53 list-hosted-zones --profile default

# Deletar hosted zone (CUIDADO!)
# aws route53 delete-hosted-zone --id /hostedzone/XXXXXXXXXXXXX --profile default
```

---

## 📊 Tipos de Registros Suportados

O script suporta:
- ✅ A / AAAA
- ✅ CNAME
- ✅ MX
- ✅ TXT
- ✅ SRV
- ✅ CAA
- ⚠️ NS (ignorado - usa nameservers do Cloudflare)
- ⚠️ SOA (ignorado - gerenciado pelo Cloudflare)

---

## 🔧 Troubleshooting

### Zone não encontrada no Cloudflare

```bash
# Criar zone via API
curl -X POST "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"name":"example.com"}'
```

### Registros duplicados

O Cloudflare pode reclamar de registros duplicados. Verifique:

```bash
# Listar registros existentes
curl -H "Authorization: Bearer $CF_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
     | jq '.result[] | "\(.type) \(.name) → \(.content)"'
```

### TTL muito alto

Cloudflare Free plan limita TTL mínimo a 120 segundos (Auto). Registros com TTL < 120 serão ajustados automaticamente.

---

## ✅ Checklist de Migração

- [ ] Exportar DNS do Route 53
- [ ] Revisar `cloudflare-import.json`
- [ ] Criar zone no Cloudflare
- [ ] Importar registros DNS
- [ ] Verificar nameservers do Cloudflare
- [ ] Atualizar nameservers no registrar
- [ ] Aguardar propagação DNS
- [ ] Verificar registros (dig/nslookup)
- [ ] Testar serviços (HTTP, email, etc.)
- [ ] (Opcional) Deletar hosted zone no Route 53

---

## 🔗 Referências

- [Cloudflare DNS API](https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-create-dns-record)
- [Route 53 CLI](https://docs.aws.amazon.com/cli/latest/reference/route53/)
- [DNS Propagation Checker](https://www.whatsmydns.net/)

---

**Status:** 🟢 **Pronto para uso**
