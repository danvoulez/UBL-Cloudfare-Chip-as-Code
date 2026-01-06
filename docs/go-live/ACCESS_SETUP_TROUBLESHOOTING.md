# Access Reusable Policies — Troubleshooting

**Problema:** Token sem permissões para criar Access Policies

---

## ❌ Erro Comum

```
"errors": [
  {
    "code": 10000,
    "message": "Authentication error"
  }
]
```

**Causa:** O API Token não tem permissões de `Access: Apps & Policies: Edit`

---

## ✅ Solução

### 1. Criar Novo API Token

1. Acesse: https://dash.cloudflare.com/profile/api-tokens
2. Clique em **"Create Token"**
3. Use o template **"Custom token"**

### 2. Configurar Permissões

**Account → Access: Apps & Policies → Edit**
- Permite criar/atualizar reusable policies
- Permite criar/atualizar Access Apps
- Permite anexar policies aos apps

**Account → Account Settings → Read**
- Necessário para descobrir Account ID

### 3. Atualizar Token

```bash
# Opção 1: Exportar
export CLOUDFLARE_API_TOKEN='seu-novo-token'

# Opção 2: Editar env
nano env
# Adicionar/atualizar: CLOUDFLARE_API_TOKEN=seu-novo-token
```

### 4. Executar Novamente

```bash
bash scripts/setup-access-reusable-policies.sh
```

---

## 🔍 Verificar Permissões

```bash
export CF_API_TOKEN='seu-token'
curl -H "Authorization: Bearer $CF_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/user/tokens/verify" \
     | jq '.result.policies'
```

---

## 📝 Alternativa: Dashboard Manual

Se preferir configurar manualmente:

1. **Acesse Zero Trust Dashboard:**
   https://one.dash.cloudflare.com/access/policies

2. **Criar Reusable Policies:**
   - Policies → Create Policy
   - Marcar "Reusable"
   - Configurar regras (email domain, groups, etc.)

3. **Anexar aos Apps:**
   - Access → Applications
   - Selecionar app (ex: `id.ubl.agency`)
   - Policies → Add Policy → Selecionar reusable policy

---

## ✅ Proof-of-Done

Após configurar (via script ou manual):

```bash
# Verificar policies criadas
curl -H "Authorization: Bearer $CF_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/policies" \
     | jq '.result[] | select(.reusable == true)'

# Verificar apps com policies
curl -H "Authorization: Bearer $CF_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/apps" \
     | jq '.result[] | {name, domain, policies: [.policies[]?.id]}'
```

---

**Status:** ⚠️ **Aguardando token com permissões corretas**
