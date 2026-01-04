# Soak Plan (24h) — Verificação Final

## 6 Checks Rápidos

### 1. Warmup & Assinatura

```bash
curl -s https://api.ubl.agency/warmup | jq
# Esperado: { "ok": true, "blake3": "..." }

curl -s http://127.0.0.1:9456/_reload
# Esperado: {"ok":true,"reloaded":true}
```

### 2. Admin Travado por Rota e Grupo

```bash
# Sem grupo ubl-ops → 403
curl -I https://api.ubl.agency/admin/deploy
# Esperado: HTTP/2 403

# Com grupo ubl-ops → 200
# (requer Access token com grupo ubl-ops)
curl -I -H "Cf-Access-Jwt-Assertion: <token>" https://api.ubl.agency/admin/deploy
# Esperado: HTTP/2 200
```

### 3. Break-Glass Funcional (Proxy)

```bash
# Ativar break-glass
curl -s -XPOST http://127.0.0.1:9456/__breakglass \
  -H 'content-type: application/json' \
  -d '{"ttl_sec":120,"reason":"ops-override"}'
# Esperado: {"ok":true,"until":...,"reason":"ops-override"}

# Testar admin path (deve permitir)
curl -I https://api.ubl.agency/admin/deploy
# Esperado: HTTP/2 200

# Limpar break-glass
curl -s -XPOST http://127.0.0.1:9456/__breakglass/clear
# Esperado: {"ok":true}
```

### 4. Observabilidade

```bash
# Métricas do proxy
curl -s http://127.0.0.1:9456/metrics | sed -n '1,40p'
# Verificar: policy_allow_total, policy_deny_total, policy_eval_count > 0

# Ledger (últimas 5 linhas)
sudo tail -n 5 /var/log/ubl/nova-ledger.ndjson
# Esperado: linhas NDJSON com hash blake3, decision, why, trigger
```

### 5. Restart Resiliente

```bash
# Reiniciar proxy
sudo systemctl restart nova-policy-rs

# Aguardar 2s
sleep 2

# Verificar reload
curl -s http://127.0.0.1:9456/_reload
# Esperado: {"ok":true,"reloaded":true}
```

### 6. Carga Leve (Estabilidade)

```bash
# 2 min a 50 conexões — só rota "read-only"
hey -z 2m -c 50 https://api.ubl.agency/healthz

# Verificar métricas após carga
curl -s http://127.0.0.1:9456/metrics | grep policy_
# Verificar: policy_eval_count aumentou, sem erros
```

## Hardening Final

### ✅ Aplicado

1. **Imutabilidade de política**: Pack.json version 2 assinado, apenas aceita nova assinatura
2. **KV lockdown**: Usar token Wrangler só-KV para UBL_FLAGS (sem permissões extras)
3. **Logs e retenção**: Logrotate diário + sync R2 (ver `infra/ledger/`)
4. **Access**: `/admin/**` requer ubl-ops via chip + Access; `/warmup` público
5. **Rollback simples**: `wrangler rollback` (edge) e apontar Caddy de volta

### 📦 Pacotes Disponíveis

1. **Worker com /panic/on|off**: `/tmp/nova_edge_wasm_with_panic.tar.gz`
   - Endpoints gated por grupo `ubl-ops`
   - TTL automático (auto-clear)
   - Espelha break-glass do proxy

2. **Ledger Hardening Kit**: `/tmp/ledger_hardening_kit.tar.gz`
   - Logrotate diário (14 dias, compress)
   - Sync diário para R2
   - Timer systemd

## Próximos Upgrades (Opcional)

- **Botão de pânico no Edge**: ✅ Implementado (`/panic/on|off`)
- **Pipeline blue/green de política**: KV `policy_yaml_next` → `/_reload` → troca atômica
- **Alertas**: Notificar se `/_reload` falhar, `policy_deny_total` subir em X%, ou `/warmup` retornar 503
- **Rotação de chaves**: Lembrete a cada 90 dias
