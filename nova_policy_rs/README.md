# nova-policy-rs (permanent)

Proxy de política Rust/Axum com motor único (TDLN-style), assinatura Ed25519+BLAKE3, e ledger imutável.

## Estrutura

- `policy-engine/` → Motor único de decisão (bits+wires), determinístico, compilável para WASM
- `policy-proxy/` → Axum reverse proxy com verificação de pack.json, break-glass, métricas
- `deploy/` → Systemd service e scripts

## Build

```bash
# Build completo
./build.sh

# Ou manualmente
cargo build --release

# Build WASM (para Worker)
cd policy-engine
cargo build --target wasm32-wasi --release
```

## Instalação

### 1. Instalar Rust (se necessário)

```bash
curl https://sh.rustup.rs -sSf | sh -s -- -y
source $HOME/.cargo/env
```

### 2. Compilar

```bash
cd nova_policy_rs
cargo build --release
sudo install -D -m 0755 target/release/policy-proxy /opt/ubl/nova/bin/nova-policy-rs
```

### 3. Configurar Service

1. Editar `deploy/nova-policy-rs.service` e colocar o **base64 do PEM público** em `POLICY_PUBKEY_PEM_B64`:

```bash
# Gerar chave (se necessário)
cd ../policy-pack
cargo build --release
./target/release/pack-builder --generate-key

# Obter base64 do PEM público
cat keys/public.pem | base64 -w 0
```

2. Copiar service:

```bash
sudo cp deploy/nova-policy-rs.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nova-policy-rs
sudo systemctl status nova-policy-rs
```

### 4. Apontar Caddy

Onde hoje encaminha para `127.0.0.1:9454` (Python), mude para `127.0.0.1:9456` (Rust).

Reload no Caddy.

## Endpoints

- `/*path` → Forward com avaliação de política
- `/_reload` → Recarrega política (verifica assinatura + BLAKE3)
- `/__breakglass` → Ativa break-glass (POST com `{"ttl_sec": 120, "reason": "ops-override"}`)
- `/__breakglass/clear` → Desativa break-glass
- `/metrics` → Métricas Prometheus

## Prova de Corte (PoD)

```bash
# 1. Reload da política (verifica assinatura + BLAKE3)
curl -s http://127.0.0.1:9456/_reload
# Esperado: {"ok":true,"reloaded":true}

# 2. Negar acesso sem grupo admin (espera 403)
curl -s -o /dev/null -w "%{http_code}\n" https://nova.api.ubl.agency/admin/deploy
# Esperado: 403

# 3. Ligar break-glass 120s
curl -s -XPOST http://127.0.0.1:9456/__breakglass \
  -d '{"ttl_sec":120,"reason":"ops-override"}' \
  -H 'content-type: application/json'
# Esperado: {"ok":true,"until":<timestamp>,"reason":"ops-override"}

# 4. Agora deve permitir (200)
curl -s -o /dev/null -w "%{http_code}\n" https://nova.api.ubl.agency/admin/deploy
# Esperado: 200

# 5. Desligar break-glass
curl -s -XPOST http://127.0.0.1:9456/__breakglass/clear
# Esperado: {"ok":true}

# 6. Métricas
curl -s http://127.0.0.1:9456/metrics | head -20
# Esperado: policy_allow_total, policy_deny_total, policy_eval_ms_*, panic_active

# 7. Verificar ledger
tail -f /var/log/ubl/nova-ledger.ndjson
# Esperado: linhas JSON com campo "hash" (BLAKE3)
```

## Passa = Done quando:

✅ `_reload` OK (pack assinado + hash confere)  
✅ `/admin/deploy` dá **403** sem grupo e **200** com break-glass  
✅ `/metrics` mostra `policy_allow_total`/`policy_deny_total` > 0  
✅ Ledger em `/var/log/ubl/nova-ledger.ndjson` recebendo linhas com `hash`

## Arquitetura

- **Fonte única de verdade**: `policy-engine::decide()` — toda decisão passa por aqui (bits+wires)
- **Assinatura obrigatória**: YAML deve ter BLAKE3 que bate com `pack.json` assinado (Ed25519)
- **Compatível com edge**: `policy-engine` compila para WASM (`wasm32-wasi`) para Worker

## Próximo passo

Build WASM do `policy-engine` e patch do Worker para usar o mesmo motor no edge (um binário lógico, dois hosts).
