# Gateway MCP v1

WebSocket JSON-RPC server para MCP (Model Context Protocol).

## Estrutura

```
apps/gateway/
  src/
    main.rs          # Bootstrap + rota /mcp
    mcp/
      mod.rs         # Módulo MCP
      types.rs        # JSON-RPC + ErrorToken
      session.rs      # Brief + idempotência
      router.rs       # Handlers (ping, tools/list, etc)
      server.rs       # WebSocket upgrade + loop
```

## Métodos Suportados

- `ping` - Health check
- `tools/list` - Lista tools disponíveis
- `session.brief.get` - Obtém brief da sessão
- `session.brief.set` - Define brief da sessão
- `tool/call` - Chama tool (stub/eco por enquanto)

## Idempotência

Operações são idempotentes por `{client_id, op_id}` com cache TTL de 10 minutos (600s).

## ErrorToken Padronizado

Erros seguem formato JSON-RPC 2.0 com `ErrorToken`:
- `INVALID_PARAMS` (-32602)
- `FORBIDDEN` (-32003)
- `RATE_LIMIT` (-32004)
- `CONFLICT` (-32009)
- `BACKPRESSURE` (-32097)
- `INTERNAL` (-32098)

## Como Rodar

```bash
cd apps/gateway
RUST_LOG=info cargo run
```

Servidor escuta em `127.0.0.1:8080/mcp`.

## Teste Rápido

Com `websocat`:

```bash
# Ping
websocat -n1 ws://127.0.0.1:8080/mcp <<< '{"jsonrpc":"2.0","id":1,"method":"ping"}'

# Tools list
websocat -n1 ws://127.0.0.1:8080/mcp <<< '{
 "jsonrpc":"2.0","id":"t1","method":"tools/list",
 "params":{"meta":{"client_id":"ide:vscode","op_id":"01H","session_type":"work","mode":"commitment","scope":{"tenant":"ubl"}}}
}'

# Brief set
websocat -n1 ws://127.0.0.1:8080/mcp <<< '{
 "jsonrpc":"2.0","id":"t2","method":"session.brief.set",
 "params":{"meta":{"client_id":"ide:vscode","op_id":"01I","session_type":"assist","mode":"deliberation","scope":{"tenant":"ubl"}},
           "brief":{"tenant":"ubl","room":"room-123","stage":"triage","goal":"Revisar","refs":["01A"]}}
}'

# Tool call
websocat -n1 ws://127.0.0.1:8080/mcp <<< '{
 "jsonrpc":"2.0","id":"t3","method":"tool/call",
 "params":{"meta":{"client_id":"ide:vscode","op_id":"01J","session_type":"work","mode":"commitment","scope":{"tenant":"ubl"}},
           "tool":"ubl@v1.append_link","args":{"entity_id":"cust_42","type":"invoice.created","json":{"x":1}}}
}'
```

## Proof of Done

- ✅ Todos os 4 comandos acima respondem com sucesso
- ✅ Repetir `tool/call` com mesmo `{client_id, op_id}` retorna `cached:true`
- ✅ Alterar `brief.tenant ≠ meta.scope.tenant` em `brief.set` retorna erro `FORBIDDEN`
