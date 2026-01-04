# Próximos Passos — Roadmap

## 🎯 Fase 1: Validação Local (Imediato)

### 1.1 Validar Build

```bash
# Build completo do workspace
cargo build --release

# Verificar componentes individuais
cargo build --release -p policy-proxy
cargo build --release -p policy-signer
cargo build --release --target wasm32-unknown-unknown -p policy-engine
```

**Objetivo:** Garantir que tudo compila sem erros.

### 1.2 Testar Signer

```bash
# Gerar chaves de teste (se necessário)
openssl genpkey -algorithm Ed25519 -out /tmp/test_private.pem
openssl pkey -in /tmp/test_private.pem -pubout -out /tmp/test_public.pem

# Testar signer
cargo build --release -p policy-signer
./target/release/policy-signer \
  --id test_v1 --version 1 \
  --yaml policies/ubl_core_v1.yaml \
  --privkey_pem /tmp/test_private.pem \
  --out /tmp/test_pack.json

# Verificar output
cat /tmp/test_pack.json | jq
```

**Objetivo:** Validar que o signer gera pack.json correto.

### 1.3 Validar WASM Build

```bash
# Build WASM
cargo build --release --target wasm32-unknown-unknown -p policy-engine

# Verificar arquivo gerado
ls -lh target/wasm32-unknown-unknown/release/policy_engine.wasm
```

**Objetivo:** Garantir que WASM compila corretamente.

---

## 🔐 Fase 2: Preparação para Deploy (Pré-Produção)

### 2.1 Gerar Chaves de Produção

```bash
# Criar diretório seguro
sudo install -d -m 750 /etc/ubl/nova/keys
sudo install -d -m 750 /etc/ubl/nova/policy

# Gerar par de chaves Ed25519
sudo openssl genpkey -algorithm Ed25519 -out /etc/ubl/nova/keys/policy_signing_private.pem
sudo openssl pkey -in /etc/ubl/nova/keys/policy_signing_private.pem -pubout -out /etc/ubl/nova/keys/policy_signing_public.pem

# Ajustar permissões
sudo chmod 600 /etc/ubl/nova/keys/policy_signing_private.pem
sudo chmod 644 /etc/ubl/nova/keys/policy_signing_public.pem
sudo chown -R ubl-ops:ubl-ops /etc/ubl/nova
```

**Objetivo:** Chaves seguras para produção.

### 2.2 Copiar Política e Assinar

```bash
# Copiar política
sudo cp policies/ubl_core_v1.yaml /etc/ubl/nova/policy/

# Assinar política
cargo build --release -p policy-signer
sudo ./target/release/policy-signer \
  --id ubl_access_chip_v1 --version 1 \
  --yaml /etc/ubl/nova/policy/ubl_core_v1.yaml \
  --privkey_pem /etc/ubl/nova/keys/policy_signing_private.pem \
  --out /etc/ubl/nova/policy/pack.json

# Copiar chave pública base64 (mostrada pelo signer)
# Será usada no service e wrangler.toml
```

**Objetivo:** Pack.json assinado pronto para deploy.

### 2.3 Configurar Worker

```bash
cd policy-worker

# Editar wrangler.toml:
# - ACCESS_AUD (do Cloudflare Access)
# - ACCESS_JWKS (URL do JWKS)
# - POLICY_PUBKEY_B64 (base64 do PEM público)
# - kv_namespaces.id (ID do KV namespace)

# Build WASM
cd ../policy-engine
cargo build --release --target wasm32-unknown-unknown
mkdir -p ../policy-worker/build
cp target/wasm32-unknown-unknown/release/policy_engine.wasm ../policy-worker/build/

# Carregar na KV (teste)
cd ../policy-worker
wrangler kv:key put --binding=UBL_FLAGS --key=policy_pack --path=/etc/ubl/nova/policy/pack.json
wrangler kv:key put --binding=UBL_FLAGS --key=policy_yaml --path=/etc/ubl/nova/policy/ubl_core_v1.yaml
```

**Objetivo:** Worker configurado e pronto para deploy.

---

## 🚀 Fase 3: Deploy (Produção)

### 3.1 Deploy Proxy

```bash
# Build
cargo build --release -p policy-proxy

# Instalar binário
sudo install -D -m 0755 target/release/policy-proxy /opt/ubl/nova/bin/nova-policy-rs

# Configurar service
PUB_BASE64="$(base64 -w0 /etc/ubl/nova/keys/policy_signing_public.pem)"
sudo cp infra/systemd/nova-policy-rs.service /etc/systemd/system/
sudo sed -i "s|POLICY_PUBKEY_PEM_B64=__FILL_ME__|POLICY_PUBKEY_PEM_B64=${PUB_BASE64}|" /etc/systemd/system/nova-policy-rs.service

# Iniciar serviço
sudo systemctl daemon-reload
sudo systemctl enable --now nova-policy-rs
sudo systemctl status nova-policy-rs

# Validar
curl -s http://127.0.0.1:9456/_reload
# Esperado: {"ok":true,"reloaded":true}
```

**Objetivo:** Proxy rodando e validando política.

### 3.2 Deploy Worker

```bash
cd policy-worker

# Deploy
wrangler deploy

# Warmup
curl -s https://api.ubl.agency/warmup | jq
# Esperado: {"ok":true,"error":null,"blake3":"..."}
```

**Objetivo:** Worker rodando no edge.

### 3.3 Ajustar Caddy

```bash
# Editar configuração do Caddy
# Mudar reverse_proxy de 127.0.0.1:9454 (Python) para 127.0.0.1:9456 (Rust)

# Reload Caddy
sudo systemctl reload caddy
```

**Objetivo:** Tráfego roteado para proxy Rust.

---

## ✅ Fase 4: Validação (Pós-Deploy)

### 4.1 Smoke Test Completo

```bash
EDGE_HOST=https://api.ubl.agency \
PROXY_URL=http://127.0.0.1:9456 \
ADMIN_PATH=/admin/deploy \
bash scripts/smoke_chip_as_code.sh
```

**Objetivo:** Validar que tudo funciona end-to-end.

### 4.2 Testes de Decisão

```bash
# 1. Negar acesso sem grupo admin
curl -s -o /dev/null -w "%{http_code}\n" https://api.ubl.agency/admin/deploy
# Esperado: 403

# 2. Ligar break-glass
curl -s -XPOST http://127.0.0.1:9456/__breakglass \
  -H 'content-type: application/json' \
  -d '{"ttl_sec":120,"reason":"ops-override"}'

# 3. Verificar acesso com break-glass
curl -s -o /dev/null -w "%{http_code}\n" https://api.ubl.agency/admin/deploy
# Esperado: 200

# 4. Desligar break-glass
curl -s -XPOST http://127.0.0.1:9456/__breakglass/clear
```

**Objetivo:** Validar lógica de decisão.

### 4.3 Verificar Métricas e Ledger

```bash
# Métricas
curl -s http://127.0.0.1:9456/metrics | grep policy_

# Ledger
sudo tail -n 5 /var/log/ubl/nova-ledger.ndjson | jq
```

**Objetivo:** Validar observabilidade.

---

## 🧹 Fase 5: Limpeza (Após Validação)

### 5.1 Remover Pastas Antigas

```bash
# APENAS após validar que tudo funciona!

rm -rf nova_policy_rs/
rm -rf nova_edge_wasm_extracted/
rm -rf tdln-core/
rm -rf proxy/
rm -rf worker/
rm -rf policy-pack/
rm -f nova_policy_rs.tar nova_edge_wasm.tar
rm -f smoke_chip_as_code.sh  # já está em scripts/
```

**Objetivo:** Estrutura limpa e organizada.

### 5.2 Atualizar Documentação

- [ ] Revisar README.md
- [ ] Atualizar referências de paths antigos
- [ ] Documentar qualquer ajuste necessário

---

## 📊 Fase 6: Monitoramento (Contínuo)

### 6.1 Métricas

- Monitorar `policy_allow_total` / `policy_deny_total`
- Verificar `policy_eval_ms_*` (p95 < 2ms)
- Acompanhar `panic_active`

### 6.2 Ledger

- Verificar que ledger está sendo escrito
- Validar que cada linha tem `hash` (BLAKE3)
- Monitorar tamanho do arquivo

### 6.3 Logs

- Worker logs no dashboard Cloudflare
- Proxy logs: `journalctl -u nova-policy-rs -f`
- Caddy logs

---

## 🎯 Prioridades

1. **URGENTE:** Fase 1 (Validação Local) — Garantir que tudo compila
2. **IMPORTANTE:** Fase 2 (Preparação) — Gerar chaves e assinar política
3. **CRÍTICO:** Fase 3 (Deploy) — Colocar em produção
4. **ESSENCIAL:** Fase 4 (Validação) — Garantir que funciona
5. **OPCIONAL:** Fase 5 (Limpeza) — Organizar estrutura
6. **CONTÍNUO:** Fase 6 (Monitoramento) — Manter saudável

---

## ⚠️ Checkpoints

Antes de avançar para próxima fase, validar:

- ✅ Build funciona sem erros
- ✅ Testes locais passam
- ✅ Documentação atualizada
- ✅ Secrets protegidos
- ✅ Rollback plan documentado
