# Route 53 → Cloudflare — Resumo das Exportações

**Data:** 2026-01-06  
**Status:** ✅ Exportações concluídas

---

## 📋 Domínios Exportados

### 1. logline.foundation
- **Status:** ✅ Exportado
- **Registros:** 0 (apenas NS/SOA - sem registros para migrar)
- **Diretório:** `route53-export-*/cloudflare-import.json`

### 2. logline.world
- **Status:** ✅ Exportado
- **Registros:** 12 registros
- **Tipos:** A, AAAA, CNAME, TXT
- **Diretório:** `route53-export-*/cloudflare-import.json`
- **Registros principais:**
  - `api.logline.world` → A → 52.4.126.139
  - `dashboard.logline.world` → CNAME → d1n2b2uqqd0puw.cloudfront.net
  - `id.logline.world` → CNAME → logline-id.vercel.app
  - `lab512.logline.world` → A → 18.207.58.99
  - `minicontratos.logline.world` → CNAME → minicontratos-platform.vercel.app
  - E outros (ACM validations, SES, etc.)

### 3. voulezvous.ai
- **Status:** ✅ Exportado
- **Registros:** 0 (apenas NS/SOA - sem registros para migrar)
- **Diretório:** `route53-export-*/cloudflare-import.json`

---

## 🚀 Próximos Passos

### 1. Criar Zones no Cloudflare

**Via Dashboard:**
1. Acesse: https://dash.cloudflare.com
2. Add a Site
3. Digite cada domínio:
   - `logline.foundation`
   - `logline.world`
   - `voulezvous.ai`
4. Escolha plano (Free é suficiente para DNS)

**⚠️ Nota:** O API Token atual não tem permissão para criar zones via API.

### 2. Importar Registros DNS

**Para logline.world (único com registros):**

```bash
# Encontrar diretório de exportação
EXPORT_DIR=$(ls -td route53-export-* | grep "logline.world\|104204\|104149" | head -1)

# Importar
bash scripts/cloudflare-import-dns.sh logline.world "$EXPORT_DIR/cloudflare-import.json"
```

**Para outros domínios (sem registros):**
- Não há necessidade de importar (apenas NS/SOA, gerenciados pelo Cloudflare)

### 3. Atualizar Nameservers

Após criar as zones, o Cloudflare fornecerá nameservers. Atualize no registrar de cada domínio.

**Verificar nameservers:**
```bash
# Após criar zone
curl -H "Authorization: Bearer $CF_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones?name=logline.world" \
     | jq -r '.result[0].name_servers[]'
```

### 4. Verificar Propagação

```bash
# Verificar nameservers
dig logline.world NS +short
dig logline.foundation NS +short
dig voulezvous.ai NS +short

# Verificar registros
dig api.logline.world A +short
```

---

## 📁 Arquivos Gerados

Cada exportação gerou:
- `route53-records.json` - Export completo do Route 53
- `records.txt` - Lista simples de registros
- `cloudflare-import.json` - Formato Cloudflare (pronto para importar)
- `CLOUDFLARE_IMPORT.md` - Instruções detalhadas

---

## ✅ Checklist

- [x] Exportar logline.foundation
- [x] Exportar logline.world (12 registros)
- [x] Exportar voulezvous.ai
- [x] Criar zones no Cloudflare (via Global API Key)
- [x] Importar registros de logline.world
- [ ] Atualizar nameservers no registrar
- [ ] Verificar propagação DNS
- [ ] (Opcional) Deletar hosted zones no Route 53

---

**Status:** 🟢 **Zones criadas e registros importados — aguardando configuração de nameservers no registrar**

**Zone IDs criados:**
- `logline.foundation`: `c7e6575a07dc95a09153d98b7e6900fd`
- `logline.world`: `048659a1cd3594e6f7e2dcbef48f885d`
- `voulezvous.ai`: `037aade44f5121f8a078cb85b2e7fbea`

**Nameservers (configurar no registrar):**
- `amit.ns.cloudflare.com`
- `grannbo.ns.cloudflare.com`
