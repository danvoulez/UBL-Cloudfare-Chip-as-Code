# 🔐 Criar Access Apps via API — Requisitos de Permissões

## ⚠️ Permissões Necessárias

Para criar Access Apps via API, o token precisa ter:

**Permissão obrigatória:**
- `Zero Trust → Access → Write` (ou `access:write`)

## 🔧 Como Criar Token com Permissões Corretas

### Opção 1: Template "Edit Cloudflare Zero Trust"

1. Acesse: https://dash.cloudflare.com/profile/api-tokens
2. Clique em **"Create Token"**
3. Selecione **"Edit Cloudflare Zero Trust"** template
4. Configure:
   - **Account Resources:** Selecione sua conta
   - **Zone Resources:** (opcional, se precisar)
5. Clique em **"Continue to summary"** → **"Create Token"**
6. **Copie o token** (só aparece uma vez!)
7. Atualize no arquivo `env`:
   ```bash
   CLOUDFLARE_API_TOKEN="seu-novo-token-aqui"
   ```

### Opção 2: Custom Token

1. Acesse: https://dash.cloudflare.com/profile/api-tokens
2. Clique em **"Create Token"** → **"Get started"** (custom)
3. Configure:
   - **Token name:** `UBL Access Apps Creator`
   - **Permissions:**
     - **Account** → **Zero Trust** → **Access** → **Edit**
   - **Account Resources:** Selecione sua conta
4. Clique em **"Continue to summary"** → **"Create Token"**
5. **Copie o token** e atualize no `env`

## 🚀 Após Atualizar o Token

```bash
# Atualizar env
nano env  # ou seu editor preferido
# Atualizar CLOUDFLARE_API_TOKEN

# Executar script
bash scripts/create-access-apps.sh
```

## 📝 Alternativa: Criar Manualmente

Se preferir criar manualmente no dashboard:

1. Acesse: https://dash.cloudflare.com → **Zero Trust** → **Access** → **Applications**
2. Clique em **"Add an application"** → **Self-hosted**
3. Configure as apps conforme `RUNBOOK_P0_MULTITENANT.md`
4. Depois execute: `bash scripts/discover-access.sh`
