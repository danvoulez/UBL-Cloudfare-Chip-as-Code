# Messenger — Próximos Passos

## ✅ Concluído

1. **Deploy do Messenger**
   - Pages deployment: `https://messenger.ubl.agency`
   - Access App configurado
   - Service Token criado

2. **Proxy Worker**
   - Deploy: `messenger-proxy`
   - Rota: `messenger.api.ubl.agency/*`
   - Secrets configurados (CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET)

3. **Configuração**
   - UPSTREAM_LLM: `https://office-llm.ubl.agency`
   - UPSTREAM_MEDIA: `https://api.ubl.agency/media`
   - UPSTREAM_JOBS: (opcional)

## 🔄 Próximos Passos

### 1. Verificar Office LLM Worker
```bash
# Verificar se office-llm.ubl.agency está acessível
curl https://office-llm.ubl.agency/healthz
```

### 2. Testar Proxy Completo
```bash
# Executar smoke test
bash scripts/smoke-messenger-complete.sh
```

### 3. Registrar no MCP Registry (Opcional)
```bash
# Registrar Messenger como servidor MCP
bash scripts/register-messenger-mcp.sh
```

### 4. Implementar Endpoints do Proxy
- `/llm/*` → Proxy para Office LLM
- `/media/*` → Proxy para Media API
- `/jobs/*` → Proxy para Jobs (opcional)

### 5. Configurar MCP WebSocket (se necessário)
- Endpoint: `wss://messenger.api.ubl.agency/mcp`
- Integração com Gateway MCP (Blueprint 01)

## 📚 Documentação

- Blueprint 07: `docs/blueprints/007-messenger-pwa--mcp-clie.md`
- Deploy Summary: `docs/deploy/MESSENGER_DEPLOY_SUMMARY.md`
- Scripts: `scripts/smoke-messenger-complete.sh`, `scripts/register-messenger-mcp.sh`

## 🎯 Status

- ✅ Deploy: 100% completo
- ⏳ Integração: Pendente (testes e validação)
- ⏳ MCP Registry: Opcional
