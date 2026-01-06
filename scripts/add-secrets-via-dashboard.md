# Adicionar Secrets ao Worker — Via Dashboard

A API de secrets do Workers **não suporta Global API Key**. Use uma das opções abaixo:

## Opção 1: Via Dashboard (Recomendado)

1. Acesse: https://dash.cloudflare.com/[account]/workers/services/messenger-proxy
2. Vá em **Settings** → **Variables**
3. Clique em **Add variable** → **Secret**
4. Adicione:
   - **Name:** `CF_ACCESS_CLIENT_ID`
   - **Value:** `7e6a8e2707cc6022d47c9b0d20c27340.access`
5. Clique em **Add variable** → **Secret** novamente
6. Adicione:
   - **Name:** `CF_ACCESS_CLIENT_SECRET`
   - **Value:** `2e01fba6e4a6be6f8853ed7f4fa820d1ed0a26886e7504a3894c99142ec3cff7`

## Opção 2: Criar API Token e usar wrangler

1. Crie API Token em: https://dash.cloudflare.com/profile/api-tokens
2. Permissões necessárias:
   - **Account** → **Workers Scripts** → **Edit**
3. Use o token:
   ```bash
   export CLOUDFLARE_API_TOKEN="seu-token-aqui"
   cd workers/messenger-proxy
   echo "7e6a8e2707cc6022d47c9b0d20c27340.access" | wrangler secret put CF_ACCESS_CLIENT_ID
   echo "2e01fba6e4a6be6f8853ed7f4fa820d1ed0a26886e7504a3894c99142ec3cff7" | wrangler secret put CF_ACCESS_CLIENT_SECRET
   ```

## Service Token (valores)

```
CF_ACCESS_CLIENT_ID=7e6a8e2707cc6022d47c9b0d20c27340.access
CF_ACCESS_CLIENT_SECRET=2e01fba6e4a6be6f8853ed7f4fa820d1ed0a26886e7504a3894c99142ec3cff7
```
