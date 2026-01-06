# Zero Trust Bootstrap — Script Completo

**Data:** 2026-01-05  
**Status:** 🟢 Pronto para uso

---

## 🎯 Objetivo

Script consolidado que fecha todas as lacunas do setup de Access:
- ✅ Cria/ajusta Access Groups (Admins/Partners)
- ✅ Cria Service Token para S2S
- ✅ Recria reusable policies com Groups (se disponíveis)
- ✅ Reanexa policies nos apps com ordem correta (allow → deny)
- ✅ Proof-of-Done completo
- ✅ Provas de funcionamento com curl

---

## 🚀 Uso

```bash
export CF_API_TOKEN='seu-token'  # ou configure no env como CLOUDFLARE_API_TOKEN
bash scripts/zt-bootstrap.sh
```

---

## 📋 O que o Script Faz

### 1. Access Groups

Cria grupos `Admins` e `Partners` baseados em email domain:
- **Admins**: `@ubl.agency`
- **Partners**: `@ubl.agency` (ajustável)

**Idempotente:** Reutiliza grupos existentes.

### 2. Service Token (S2S)

Cria token `office-internal-s2s` para comunicação service-to-service:
- Duração: 1 ano (8760h)
- Headers: `CF-Access-Client-Id` + `CF-Access-Client-Secret`

**⚠️ IMPORTANTE:** O `CLIENT_SECRET` só é mostrado na criação. Salve-o imediatamente.

### 3. Reusable Policies

Recria policies com Groups (se disponíveis):
- `Allow UBL Staff` (email domain)
- `Allow Partners` (grupo Partners)
- `Allow Any Service Token` (qualquer service token)
- `Allow Admins` (grupo Admins)
- `Default Deny` (negação padrão)

### 4. Reanexar Policies

Reanexa policies nos apps com **ordem correta**:
- **UBL Identity** (`id.ubl.agency`): Admins → Staff → Deny
- **Office LLM Router** (`office-llm.ubl.agency`): Service Tokens → Staff → Deny

### 5. Proof-of-Done

Lista:
- Todas as reusable policies criadas
- Apps com policies anexadas

### 6. Provas de Funcionamento

**6.1) Sem credencial:**
```bash
curl -i https://office-llm.ubl.agency/healthz
# Esperado: HTTP 403 ou 302 (bloqueado)
```

**6.2) Com Service Token:**
```bash
curl -s https://office-llm.ubl.agency/healthz \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
# Esperado: {"ok":true,"service":"office-llm"}
```

---

## 🔧 Configuração

O script usa valores do `env` quando disponível:

```bash
# Do env
CLOUDFLARE_ACCOUNT_ID=1f43a14fe5bb62b97e7262c5b6b7c476
CLOUDFLARE_API_TOKEN=eCSYRvcMrC2L9gX9TFoDfcMA4BseMCvLesOxwt3K

# Configuráveis no script
EMAIL_DOMAIN="ubl.agency"
ADMINS_GROUP_NAME="Admins"
PARTNERS_GROUP_NAME="Partners"
ST_NAME="office-internal-s2s"
```

---

## 📊 Output Esperado

```
1) Criando/ajustando Access Groups
✅ Admins Group:   abc123...
✅ Partners Group: def456...

2) Criando/validando Access Service Token (S2S)
✅ Service Token criado:
SERVICE_TOKEN_ID=xyz789...
CF_ACCESS_CLIENT_ID=client_abc...
CF_ACCESS_CLIENT_SECRET=secret_xyz...

3) Verificando/criando reusable policies com Groups
✅ Policies:
 - Allow UBL Staff = pol_123...
 - Allow Partners = pol_456...
 - Allow Any Service Token = pol_789...
 - Allow Admins = pol_abc...
 - Default Deny = pol_def...

4) Reanexando policies nos apps
✅ UBL Identity → OK
✅ Office LLM Router → OK

5) Proof-of-Done
- Reusable Policies:
pol_123...  Allow UBL Staff  decision=allow
...

6) Provas de funcionamento
6.1) Sem credencial: ✅ Bloqueado corretamente (HTTP 302)
6.2) Com Service Token: ✅ Acesso permitido
```

---

## 🔐 Service Token (S2S)

### Salvar no env

```bash
export CF_ACCESS_CLIENT_ID='client_abc...'
export CF_ACCESS_CLIENT_SECRET='secret_xyz...'
```

### Uso em Requisições

```bash
curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     https://office-llm.ubl.agency/healthz
```

### No Office-LLM Worker

```typescript
// Para chamadas internas
const headers = {
  'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
  'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
};
```

---

## ⚠️ Observações

### Groups Retornando `null`

Se Groups retornam `null`, pode ser:
- Token sem permissões para criar Groups
- Groups já existem mas com nome diferente
- API retornando erro silencioso

**Solução:** Verificar manualmente no Dashboard:
https://one.dash.cloudflare.com/access/groups

### Service Token Retornando `null`

Se Service Token retorna `null`:
- Token sem permissões para criar Service Tokens
- Limitação da API

**Solução:** Criar manualmente no Dashboard:
https://one.dash.cloudflare.com/access/service-tokens

---

## ✅ Checklist Final

- [ ] Groups criados (Admins/Partners)
- [ ] Service Token criado e secret salvo
- [ ] Reusable policies criadas (5/5)
- [ ] Apps configurados com policies anexadas
- [ ] Ordem correta (allow → deny)
- [ ] Bloqueio sem credencial funcionando (403/302)
- [ ] Acesso com Service Token funcionando (200)

---

## 🔗 Referências

- [Access Groups API](https://developers.cloudflare.com/api/operations/zero-trust-access-groups-list-access-groups)
- [Service Tokens API](https://developers.cloudflare.com/api/operations/zero-trust-access-service-tokens-list-access-service-tokens)
- [Reusable Policies](https://developers.cloudflare.com/cloudflare-one/policies/access/policy-management/#reusable-policies)

---

**Status:** 🟢 **Pronto para uso**
