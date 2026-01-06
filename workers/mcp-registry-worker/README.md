# MCP Registry Worker — Office

Registry privado para servidores MCP do Office, mesclando o registry oficial com ferramentas internas curadas.

## Deploy

```bash
# 1. Criar KV namespace
wrangler kv namespace create REGISTRY_KV

# 2. Atualizar wrangler.toml com o ID do KV

# 3. Deploy
npm install
wrangler deploy

# 4. (Opcional) Seed inicial
wrangler kv key put --binding=REGISTRY_KV curated @curated.example.json
```

## Endpoints

- `GET /v1/servers` — Lista servidores (upstream + curated)
- `POST /v1/servers` — Adiciona servidor curado (proteger com Cloudflare Access)
- `GET /healthz` — Health check

## Proteção

Configure Cloudflare Access para proteger `POST /v1/servers` usando service tokens.
