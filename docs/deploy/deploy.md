# Deploy — Chip-as-Code (Fase 2 + 3)

## Pré-requisitos

1. **No LAB 256 (servidor Linux):**
   - Rust instalado (`rustup`)
   - Acesso sudo
   - Caddy configurado (ou outro reverse proxy)

2. **Cloudflare:**
   - Worker deploy habilitado (`wrangler` instalado)
   - KV namespace criado
   - Access app configurada

3. **Variáveis necessárias:**
   - `ACCESS_AUD`: Audience do Cloudflare Access
   - `ACCESS_JWKS`: URL do JWKS do Cloudflare Access
   - `KV_NAMESPACE_ID`: ID do KV namespace (opcional, pode ser criado depois)

## Fase 2: Preparação no LAB 256

Executa tudo em um comando:

```bash
cd "/Users/ubl-ops/Chip as Code at Cloudflare"
bash scripts/deploy-phase2.sh
```

**O que faz:**
1. ✅ Gera chaves Ed25519 (PKCS#8 PEM)
2. ✅ Salva chave pública em base64 em `/tmp/PUB_BASE64.txt`
3. ✅ Copia política `ubl_core_v1.yaml` para `/etc/ubl/nova/policy/`
4. ✅ Assina política e gera `pack.json`
5. ✅ Build do proxy (`policy-proxy`)
6. ✅ Instala proxy em `/opt/ubl/nova/bin/nova-policy-rs`
7. ✅ Configura systemd service com chave pública
8. ✅ Ativa e inicia o service
9. ✅ Valida que o proxy está respondendo

**Saída esperada:**
```
✅✅✅ FASE 2 COMPLETA!
```

**Validar:**
```bash
curl -s http://127.0.0.1:9456/_reload | jq
# Esperado: {"ok":true,"reloaded":true}
```

## Fase 3: Deploy no Edge (Worker + WASM)

**Antes de executar, defina as variáveis:**

```bash
export ACCESS_AUD='seu-access-aud'
export ACCESS_JWKS='https://seu-team.cloudflareaccess.com/cdn-cgi/access/certs'
export POLICY_PUBKEY_B64='base64-da-chave-publica'  # ou deixe vazio para usar /tmp/PUB_BASE64.txt
export KV_NAMESPACE_ID='id-do-kv-namespace'  # opcional
```

**Executar:**

```bash
cd "/Users/ubl-ops/Chip as Code at Cloudflare"
bash scripts/deploy-phase3.sh
```

**O que faz:**
1. ✅ Build do WASM (`policy-engine` → `wasm32-unknown-unknown`)
2. ✅ Copia WASM para `policy-worker/build/policy_engine.wasm`
3. ✅ Configura `wrangler.toml` com `ACCESS_AUD`, `ACCESS_JWKS`, `POLICY_PUBKEY_B64`
4. ✅ Publica `pack.json` e `ubl_core_v1.yaml` na KV
5. ✅ Deploy do Worker
6. ✅ Valida warmup endpoint

**Validar:**
```bash
curl -s https://api.ubl.agency/warmup | jq
# Esperado: {"ok":true,"blake3":"..."}
```

## Smoke Test (End-to-End)

Após Fase 2 + 3:

```bash
bash scripts/smoke_chip_as_code.sh
```

**Esperado:**
```
✅ GO — Chip-as-Code operacional (proxy+edge)
```

## Proof of Done

### ✅ Proxy
- `curl -s http://127.0.0.1:9456/_reload` → `{"ok":true,"reloaded":true}`
- `curl -s http://127.0.0.1:9456/metrics` → métricas com `policy_eval_count`, `policy_allow_total`, `policy_deny_total` > 0

### ✅ Worker
- `curl -s https://api.ubl.agency/warmup` → `{"ok":true,"blake3":"..."}`
- Worker respondendo em `https://api.ubl.agency/*`

### ✅ Ledger
- `/var/log/ubl/nova-ledger.ndjson` recebendo linhas novas
- Formato NDJSON válido com `hash`, `attest`, `decision`

### ✅ Smoke Test
- `bash scripts/smoke_chip_as_code.sh` → `✅ GO`

## Hardening (Pós-Deploy)

### 1. Permissões das chaves
```bash
sudo chmod 600 /etc/ubl/nova/keys/policy_signing_private.pem
sudo chown root:root /etc/ubl/nova/keys/policy_signing_private.pem
```

### 2. Logrotate do ledger
```bash
sudo tee /etc/logrotate.d/ubl-nova-ledger > /dev/null <<EOF
/var/log/ubl/nova-ledger.ndjson {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 ubl-ops ubl-ops
}
EOF
```

### 3. Alerta de break-glass
Configure monitoramento para alertar quando `__breakglass` for ativado:
- Verificar `/var/log/ubl/nova-ledger.ndjson` por `"break_glass":true`
- Enviar alerta (Discord/Slack/Email)

### 4. Versionamento do pack.json
Sempre que mudar o YAML:
1. Incrementar `version` no `pack.json`
2. Re-assinar com `policy-signer`
3. Publicar nova versão na KV
4. Fazer reload do proxy: `curl -s http://127.0.0.1:9456/_reload`

## Troubleshooting

### Proxy não inicia
```bash
sudo systemctl status nova-policy-rs
sudo journalctl -u nova-policy-rs -n 50
```

### Worker não responde
```bash
wrangler tail
# Ver logs em tempo real
```

### KV não carrega política
```bash
wrangler kv:key get --binding=UBL_FLAGS --key=policy_pack
# Verificar se pack.json está na KV
```

### WASM não carrega
```bash
ls -lh policy-worker/build/policy_engine.wasm
# Verificar se arquivo existe e tem tamanho > 0
```

## Próximos Passos

Após deploy completo:
1. ✅ Configurar Caddy para apontar para `127.0.0.1:9456`
2. ✅ Testar fluxo completo (Access → Worker → Proxy → Upstream)
3. ✅ Monitorar métricas e ledger
4. ✅ Configurar alertas
