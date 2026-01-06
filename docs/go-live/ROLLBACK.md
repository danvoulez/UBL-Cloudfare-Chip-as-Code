# Rollback — UBL ID + Office

**Procedimentos rápidos para reverter deploy**

---

## 🔄 Rollback de Worker

### Auth Worker
```bash
cd workers/auth-worker
wrangler deployments list
wrangler rollback --message "Rollback to previous version"
```

### Office API Worker
```bash
cd workers/office-api-worker
wrangler deployments list
wrangler rollback --message "Rollback to previous version"
```

---

## 🔑 Rollback de JWKS

### Reverter para chave anterior

1. **Editar JWKS no Core API:**
   - Remover `kid` novo
   - Manter apenas `kid` estável

2. **Ou via KV (se usar):**
   ```bash
   wrangler kv key put --binding=UBL_FLAGS jwks.json --path=jwks-old.json
   ```

3. **Aguardar cache expirar (300s)**

---

## 📦 Rollback de Vectorize

### Desabilitar
1. Comentar `[[vectorize]]` nos `wrangler.toml`
2. Redeploy:
   ```bash
   cd workers/office-api-worker
   wrangler deploy
   ```

---

## 🔐 Rollback de Secrets

### Reverter secret
```bash
# Ver secrets atuais
wrangler secret list

# Não é possível "reverter" secret diretamente
# Solução: setar valor anterior manualmente
wrangler secret put JWT_PRIVATE_JWK
# (colar valor anterior)
```

---

## 📋 Checklist de Rollback

- [ ] Identificar versão anterior (deployments list)
- [ ] Rollback worker (wrangler rollback)
- [ ] Reverter JWKS (se necessário)
- [ ] Desabilitar Vectorize (se necessário)
- [ ] Verificar health checks
- [ ] Smoke test básico

---

**Tempo estimado:** 5-10 minutos
