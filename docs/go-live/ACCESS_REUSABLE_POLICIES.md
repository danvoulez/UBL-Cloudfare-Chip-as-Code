# Access Reusable Policies — Setup Automatizado

**Data:** 2026-01-05  
**Status:** 🟢 Pronto para uso

---

## 🎯 Objetivo

Criar **Reusable Policies** no Cloudflare Zero Trust e anexá-las aos apps `id.ubl.agency` e `office-llm.ubl.agency` de forma centralizada e scriptável.

---

## 📋 O que o Script Faz

1. **Descobre Account ID** (do `env` ou automaticamente)
2. **Resolve Access Groups** (Admins, Partners) por nome
3. **Cria/Valida Service Token** para S2S (opcional)
4. **Cria Reusable Policies**:
   - `Allow UBL Staff` (email domain: `ubl.agency`)
   - `Allow Partners` (grupo Partners)
   - `Allow Any Service Token` (qualquer service token válido)
   - `Allow Admins` (grupo `ubl-ops`)
   - `Default Deny` (negação padrão)
5. **Cria/Atualiza Apps** e anexa policies:
   - `UBL Identity` (`id.ubl.agency`) → Admins + Staff + Deny
   - `Office LLM Router` (`office-llm.ubl.agency`) → Service Tokens + Staff + Deny
6. **Proof-of-Done**: Lista todas as reusable policies e apps configurados

---

## 🚀 Uso

### Pré-requisitos

1. **API Token** com permissões:
   - `Access: Apps & Policies: Edit`
   - `Account: Read`

2. **Exportar token:**
   ```bash
   export CF_API_TOKEN="seu-token-aqui"
   ```

### Executar

```bash
cd "/Users/ubl-ops/Chip as Code at Cloudflare"
bash scripts/setup-access-reusable-policies.sh
```

---

## 🔧 Configuração

O script usa valores do `env` quando disponível:

```bash
# Do env
CLOUDFLARE_ACCOUNT_ID=1f43a14fe5bb62b97e7262c5b6b7c476

# Configuráveis no script
APP_ID_HOST="id.ubl.agency"
APP_LLM_HOST="office-llm.ubl.agency"
STAFF_EMAIL_DOMAIN="ubl.agency"
ADMINS_GROUP_NAME="ubl-ops"
```

---

## 📊 Output Esperado

```
0) Usando ACCOUNT_ID do env
ACCOUNT_ID=1f43a14fe5bb62b97e7262c5b6b7c476

1) Buscando Access Groups
ADMINS_GROUP_ID=abc123...
PARTNER_GROUP_ID=<não encontrado>

2) Criando/Validando Access Service Token (S2S)
✅ Service Token criado:
SERVICE_TOKEN_ID=xyz789...
SERVICE_TOKEN_CLIENT_ID=client_abc...
SERVICE_TOKEN_CLIENT_SECRET=secret_xyz...

3) Criando reusable policies
✅ Policies criadas/recuperadas:
 - Allow UBL Staff = pol_123...
 - Allow Partners = pol_456...
 - Allow Any Service Token = pol_789...
 - Allow Admins = pol_abc...
 - Default Deny = pol_def...

4) Criando/atualizando apps e anexando reusable policies
✅ Apps configurados:
 - UBL Identity = app_123... (id.ubl.agency)
 - Office LLM Router = app_456... (office-llm.ubl.agency)

5) Proof-of-Done
- Reusable Policies:
pol_123...  Allow UBL Staff  decision=allow
pol_456...  Allow Partners  decision=allow
...

- Apps (nome → policies):
UBL Identity  id.ubl.agency  policies=pol_abc...,pol_123...,pol_def...
Office LLM Router  office-llm.ubl.agency  policies=pol_789...,pol_123...,pol_def...
```

---

## 🔐 Service Token (S2S)

O script cria um Service Token chamado `office-internal-s2s` para uso em:
- Bots/cron jobs
- Edge-to-edge communication
- Internal API calls

**⚠️ IMPORTANTE:** O `CLIENT_SECRET` é mostrado apenas uma vez. Salve-o:

```bash
export SERVICE_TOKEN_CLIENT_SECRET="secret_xyz..."
```

**Uso:**
```bash
curl -H "CF-Access-Client-Id: $SERVICE_TOKEN_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $SERVICE_TOKEN_CLIENT_SECRET" \
     https://office-llm.ubl.agency/healthz
```

---

## 🔄 Idempotência

O script é **idempotente**:
- ✅ Policies existentes são **recuperadas** (não duplicadas)
- ✅ Apps existentes são **atualizados** (não recriados)
- ✅ Service Tokens existentes são **reutilizados**

Pode executar múltiplas vezes sem problemas.

---

## 📝 Integração com Go-Live

Adicionar ao `go-live-execute.sh`:

```bash
# Após deploy dos workers
echo ">> Configurando Access Reusable Policies..."
export CF_API_TOKEN="${CLOUDFLARE_API_TOKEN}"
bash scripts/setup-access-reusable-policies.sh
```

---

## ✅ Proof-of-Done

Após executar, verificar:

1. **Policies reutilizáveis criadas:**
   ```bash
   curl -H "Authorization: Bearer $CF_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/policies" \
        | jq '.result[] | select(.reusable == true)'
   ```

2. **Apps com policies anexadas:**
   ```bash
   curl -H "Authorization: Bearer $CF_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/apps" \
        | jq '.result[] | {name, domain, policies: [.policies[]?.id]}'
   ```

3. **Testar acesso:**
   ```bash
   # Deve retornar 200 (se autenticado) ou 302 (redirect para login)
   curl -I https://id.ubl.agency/healthz
   curl -I https://office-llm.ubl.agency/healthz
   ```

---

## 🔗 Referências

- [Cloudflare Access Policies API](https://developers.cloudflare.com/api/operations/zero-trust-access-policies-list-access-policies)
- [Reusable Policies](https://developers.cloudflare.com/cloudflare-one/policies/access/policy-management/#reusable-policies)
- [Service Tokens](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/)

---

**Status:** 🟢 **Pronto para uso**
