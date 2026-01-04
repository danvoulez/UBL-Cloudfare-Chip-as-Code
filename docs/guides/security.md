# Segurança — Secrets e Tokens

## ⚠️ IMPORTANTE

O arquivo `env` contém **secrets reais** e está no `.gitignore` para não ser commitado.

## Rotação de Token

## ⚠️ Credenciais Expostas

**Se o token do Cloudflare (`CLOUDFLARE_API_TOKEN`) foi exposto:**

1. **Rotacionar imediatamente:**
   - Acesse: https://dash.cloudflare.com/profile/api-tokens
   - Revogue o token exposto
   - Crie um novo token com permissões mínimas necessárias

2. **Verificar histórico do git:**
   ```bash
   git log --all --full-history -- env
   ```
   Se o arquivo `env` foi commitado em algum momento, ele está no histórico do git mesmo que tenha sido removido depois.

3. **Limpar histórico (se necessário):**
   - Use `git filter-branch` ou `git filter-repo` para remover o arquivo do histórico
   - Ou considere criar um novo repositório se o histórico não for crítico

**Se o token foi exposto:**

1. **Revogar imediatamente** no dashboard Cloudflare:
   - https://dash.cloudflare.com/profile/api-tokens
   - Revogar o token exposto

2. **Gerar novo token** com permissões mínimas necessárias

3. **Atualizar** o arquivo `env` local com o novo token

## Arquivos Protegidos

- `env` — Contém secrets reais (não commitado)
- `.env` — Variáveis de ambiente (não commitado)
- `.env.local` — Overrides locais (não commitado)

## Template

Use `env.example` como template para criar seu próprio `env`:

```bash
cp env.example env
# Editar env com seus valores reais
chmod 600 env  # Proteger permissões
```

## Uso

Para carregar variáveis do arquivo `env`:

```bash
# Bash
set -a; source env; set +a

# Ou exportar manualmente
export CLOUDFLARE_API_TOKEN="..."
```

## Checklist de Segurança

- [x] `env` adicionado ao `.gitignore`
- [x] `env.example` criado (sem secrets)
- [ ] Token Cloudflare rotacionado (se foi exposto)
- [ ] Secrets não commitados no git
- [ ] Permissões do arquivo `env`: `chmod 600 env`

## Variáveis Disponíveis

- `ORG_NAME` — Nome da organização
- `ROOT_DOMAIN` — Domínio raiz
- `SUBDOMAIN_*` — Subdomínios
- `*_BASE` — URLs base
- `CLOUDFLARE_*` — Credenciais Cloudflare
