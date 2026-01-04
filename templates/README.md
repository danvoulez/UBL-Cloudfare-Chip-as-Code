# <APP_ID>

App declarativo (Chip-as-Code) integrando Office/UBL via MCP.

**Blueprint 16** — Constituição & Anexos

---

## 📋 Estrutura

```
<APP_ID>/
  manifest.yaml              # Manifesto do app
  wiring.yaml                # Roteamento DRY
  abac.policy.json          # Política ABAC
  mcp.manifest.json         # Contrato MCP
  tests/
    contract.http           # Testes de contrato
  scripts/
    publish.sh              # Publicar (blue/green)
    smoke.sh                # Smoke test (DoD P0)
    ws-call.mjs             # Helper WebSocket
  README.md                 # Este arquivo
```

---

## 🚀 Como usar

### 1. Preencher templates

Edite `manifest.yaml` e `abac.policy.json`:
- Substitua `<APP_ID>` pelo ID do seu app (ex: `omni.party`)
- Ajuste `tenant`/`entity` em `abac.policy.json`
- Configure `tools` e `limits` conforme necessário

### 2. Publicar

```bash
# Configurar variáveis
export KV_NAMESPACE_ID="..."
export POLICY_PRIVKEY_PEM="/etc/ubl/nova/keys/policy_signing_private.pem"

# Publicar (stage=next)
./scripts/publish.sh <APP_ID>
```

### 3. Smoke test

```bash
./scripts/smoke.sh <APP_ID>
```

### 4. Contract tests

Rode `tests/contract.http` com um cliente WebSocket (websocat, wscat, ou VSCode REST Client).

### 5. Promover

Após PASS no smoke e contract tests:

```bash
curl -XPOST 'https://api.ubl.agency/_reload?stage=prod'
```

---

## ✅ Proof of Done

- [ ] `tools/list` retorna as tools do app
- [ ] `append_link` responde com sucesso (ou erro esperado)
- [ ] Idempotência: repetir `op_id` retorna `cached:true`
- [ ] Logs sem PII (server-blind)
- [ ] p99 < 300ms no edge

---

## 📚 Referências

- **Blueprint 16** — Constituição & Anexos
- **Blueprint 01** — Edge Gateway (MCP)
- **CONSTITUTION.md** — Normas constitucionais
- **schemas/** — JSON✯Atomic schemas

---

## 🔧 Troubleshooting

### `tools/list` vazio
- Verifique `abac.policy.json` (scope/tenant)
- Confirme que `session_type` está permitido

### `FORBIDDEN` em `tool/call`
- Verifique `scope.tenant` no meta
- Confirme que a tool está em `abac.policy.json`

### WebSocket não conecta
- Verifique `MCP_WS_URL` (padrão: `wss://api.ubl.agency/mcp`)
- Confirme que o Gateway está rodando

### Smoke falha
- Verifique `EDGE_HOST` (padrão: `https://api.ubl.agency`)
- Confirme que Worker está deployado e warmup OK
