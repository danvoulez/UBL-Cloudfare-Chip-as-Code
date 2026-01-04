# Git Setup — Push para GitHub

## Status Atual

✅ Repositório local inicializado
✅ Commit inicial criado (192 arquivos)
✅ Remote configurado: `origin -> https://github.com/danvoulez/UBL-Cloudfare-Chip-as-Code.git`
✅ Branch: `main`
✅ `.gitignore` configurado (env e secrets ignorados)

## Fazer Push

### Opção 1: GitHub CLI (Recomendado)

```bash
# Instalar GitHub CLI (se não tiver)
brew install gh  # macOS
# ou
# https://cli.github.com/

# Autenticar
gh auth login

# Fazer push
git push -u origin main
```

### Opção 2: Personal Access Token

1. Criar token no GitHub:
   - https://github.com/settings/tokens
   - Generate new token (classic)
   - Permissões: `repo` (acesso completo a repositórios)

2. Fazer push com token:

```bash
git push https://<SEU_TOKEN>@github.com/danvoulez/UBL-Cloudfare-Chip-as-Code.git main
```

Ou configurar credencial helper:

```bash
git config --global credential.helper osxkeychain  # macOS
# ou
git config --global credential.helper store       # Linux

# Depois fazer push normal (vai pedir token uma vez)
git push -u origin main
```

### Opção 3: SSH Key

1. Gerar SSH key (se não tiver):

```bash
ssh-keygen -t ed25519 -C "dan@danvoulez.com"
```

2. Adicionar ao GitHub:
   - https://github.com/settings/keys
   - New SSH key
   - Copiar conteúdo de `~/.ssh/id_ed25519.pub`

3. Mudar remote para SSH:

```bash
git remote set-url origin git@github.com:danvoulez/UBL-Cloudfare-Chip-as-Code.git
git push -u origin main
```

## Verificar

Após push bem-sucedido:

```bash
# Verificar remotes
git remote -v

# Verificar branch
git branch -vv

# Verificar último commit
git log --oneline -1
```

## Importante

- ✅ `env` está no `.gitignore` (não será commitado)
- ✅ Secrets e keys estão ignorados
- ✅ `node_modules/` e `target/` estão ignorados
- ⚠️  **NÃO** configurar GitHub Actions ou automações por enquanto

## Próximos Passos

Após push bem-sucedido:

1. Verificar no GitHub: https://github.com/danvoulez/UBL-Cloudfare-Chip-as-Code
2. Revisar arquivos commitados
3. Considerar adicionar README mais detalhado
4. (Opcional) Criar tags para releases
