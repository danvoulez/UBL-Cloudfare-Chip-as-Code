# MCP Registry & Client — Deploy Guide

## 🎯 Visão Geral

O MCP (Model Context Protocol) é fundamental para o Office, permitindo:
- **Registry privado** de servidores MCP (oficial + curado)
- **Client CLI** com cardápio de ferramentas por sessão
- **Integração** com Office tools existentes

## 📋 Componentes

1. **MCP Registry Worker** — Cloudflare Workers + KV
2. **MCP Client** — CLI Node.js
3. **Office Tools** — Integração com tools existentes

## 🚀 Deploy do Registry Worker

### 1. Criar KV Namespace

```bash
cd workers/mcp-registry-worker
wrangler kv namespace create REGISTRY_KV
```

### 2. Atualizar wrangler.toml

Copie o ID do KV retornado e atualize `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "REGISTRY_KV"
id = "SEU_KV_ID_AQUI"
```

### 3. Instalar dependências e deploy

```bash
npm install
wrangler deploy
```

### 4. Seed inicial (opcional)

```bash
wrangler kv key put --binding=REGISTRY_KV curated @curated.example.json
```

## 🔧 Setup do Client

### 1. Instalar dependências

```bash
cd apps/office/mcp-client
npm install
```

### 2. Configurar .env

```bash
cp .env.example .env
# Editar .env com SUBREGISTRY_URL do seu registry worker
```

### 3. Executar

```bash
npm run dev
# ou
npm start
```

## 🔐 Proteção (Cloudflare Access)

Para proteger `POST /v1/servers`:

1. Criar Service Token no Cloudflare Zero Trust
2. Adicionar verificação no worker (ver `src/worker.ts` TODO)
3. Configurar regra de Access para a rota

## 📦 Integração com Office Tools

Os Office tools já estão definidos em `mcp/tools/`:
- `office.frame.build`
- `office.narrative.prepare`
- `office.evidence.get`
- `office.admin.reindex`

Para registrar no registry:

```bash
curl -X POST https://mcp-registry-office.dan-1f4.workers.dev/v1/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Office Tools",
    "description": "Office MCP server with evidence, frame, narrative, and admin tools.",
    "transports": [{"type": "streamable-http", "url": "https://office-api-worker.dan-1f4.workers.dev/mcp"}],
    "tags": ["internal", "office", "voulezvous"]
  }'
```

## ✅ Verificação

```bash
# Health check
curl https://mcp-registry-office.dan-1f4.workers.dev/healthz

# Listar servidores
curl https://mcp-registry-office.dan-1f4.workers.dev/v1/servers | jq
```

## 🎨 Office Palette

O client funciona como "Office Palette" — um cardápio interativo de ferramentas por sessão, permitindo que agentes escolham dinamicamente quais tools habilitar.
