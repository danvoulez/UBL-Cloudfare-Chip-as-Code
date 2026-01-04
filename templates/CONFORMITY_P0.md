# Matriz de Conformidade P0 — Blueprint 16

**Gate de aceite para apps** — Todos os itens devem estar ✅ antes de promover para `prod`.

---

## 📊 Matriz

| Item | Descrição | Como validar | Status |
|------|-----------|--------------|--------|
| **MCP-only** | Toda operação via `/mcp` | `tests/contract.http` WS ok | ☐ |
| **Meta obrigatória** | `version`, `client_id`, `op_id`, `correlation_id`, `session_type`, `mode`, `scope` | `tools/list` sem meta → `INVALID_PARAMS` | ☐ |
| **ABAC** | `deny explícito > allow específico > allow genérico > deny default` | `abac.policy.json` + `tools/list` filtrado | ☐ |
| **Rate/Quota** | Token-bucket por `session_type` | Forçar cadência → `BACKPRESSURE` | ☐ |
| **Idempotência** | Mesmo `(client_id, op_id)` → mesmo resultado | Repetir `append_link` com mesmo `op_id` | ☐ |
| **ErrorToken** | Códigos `-320xx` com `token`/`remediation`/`retry_after_ms` | Induzir `RATE_LIMIT` | ☐ |
| **Server-blind** | Logs sem PII (campos fixos) | `wrangler tail` / `policy-proxy` logs | ☐ |
| **Trilhas (opt-in)** | `office.tool_call` sem args sensíveis | Habilitar opt-in e inspecionar JSON Atomic | ☐ |
| **SLO p99** | `tool/call < 300ms` (edge) | 100 chamadas → p99 | ☐ |

---

## ✅ DoD P0

**Todos os itens marcados ✅ + `smoke.sh` e `contract.http` PASS.**

---

## 🔍 Validação Detalhada

### 1. MCP-only
```bash
# Deve conectar via WebSocket
websocat wss://api.ubl.agency/mcp
# Enviar: {"jsonrpc":"2.0","id":"1","method":"ping"}
# Esperado: {"jsonrpc":"2.0","id":"1","result":{"ok":true}}
```

### 2. Meta obrigatória
```bash
# Sem meta → INVALID_PARAMS
echo '{"jsonrpc":"2.0","id":"1","method":"tool/call","params":{"tool":"ubl@v1.append_link"}}' | \
  websocat wss://api.ubl.agency/mcp
# Esperado: {"error":{"code":-32602,"message":"INVALID_PARAMS",...}}
```

### 3. ABAC
```bash
# tools/list deve retornar apenas tools permitidas por abac.policy.json
# Teste com tenant diferente → deve filtrar
```

### 4. Rate/Quota
```bash
# Enviar 100+ requests em < 1 min
# Esperado: BACKPRESSURE com retry_after_ms
```

### 5. Idempotência
```bash
# Enviar mesmo tool/call com mesmo (client_id, op_id) duas vezes
# Esperado: segunda resposta com cached:true
```

### 6. ErrorToken
```bash
# Induzir RATE_LIMIT
# Esperado: {"error":{"code":-32004,"message":"RATE_LIMIT","data":{"token":"RATE_LIMIT","retry_after_ms":1000,...}}}
```

### 7. Server-blind
```bash
# Verificar logs
wrangler tail
# Não deve conter: email, prompt, payload completo, senhas
# Deve conter: session_id, correlation_id, tool, ok, err(token), latency_ms, cost.calls, ts
```

### 8. Trilhas (opt-in)
```bash
# Habilitar trilhas JSON Atomic
# Verificar que office.tool_call contém apenas args_min (sem payload sensível)
```

### 9. SLO p99
```bash
# Rodar 100 tool/call e medir latência
# p99 deve ser < 300ms
```

---

## 📝 Checklist de Publicação

- [ ] Preencher `<APP_ID>` em todos os templates
- [ ] Ajustar `abac.policy.json` (tenant/entity)
- [ ] Configurar `KV_NAMESPACE_ID`, `POLICY_PRIVKEY_PEM`
- [ ] Rodar `./scripts/publish.sh <APP_ID>`
- [ ] Rodar `./scripts/smoke.sh <APP_ID>` → PASS
- [ ] Rodar `tests/contract.http` → PASS
- [ ] Verificar logs (server-blind)
- [ ] Medir p99 (< 300ms)
- [ ] Marcar todos os itens da matriz ✅
- [ ] Promover: `/_reload?stage=prod`

---

## 🚨 Rollback

Se algo falhar após promover:

```bash
# Reverter para versão anterior
curl -XPOST 'https://api.ubl.agency/_reload?stage=prev'
```

---

**Última atualização:** 2026-01-04  
**Versão:** 1.0  
**Blueprint:** 16 — Constituição & Anexos
