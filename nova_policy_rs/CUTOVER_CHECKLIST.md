# Checklist de Cutover — Python → Rust

## Pré-requisitos

- [ ] Rust instalado no LAB 256
- [ ] Chaves Ed25519 geradas (public.pem e private.pem)
- [ ] Policy YAML criado (`ubl_core_v1.yaml`)
- [ ] `pack.json` gerado e assinado

## Passo 1: Instalar Rust

```bash
curl https://sh.rustup.rs -sSf | sh -s -- -y
source $HOME/.cargo/env
```

## Passo 2: Desempacotar e Compilar

```bash
tar -xzf ~/Downloads/nova_policy_rs.tar.gz -C /tmp
cd /tmp/nova_policy_rs
./build.sh
# ou: cargo build --release
sudo install -D -m 0755 target/release/policy-proxy /opt/ubl/nova/bin/nova-policy-rs
```

## Passo 3: Setup

```bash
./setup.sh
```

## Passo 4: Configurar Service

1. Obter base64 do PEM público:
```bash
cat keys/public.pem | base64 -w 0
```

2. Editar `deploy/nova-policy-rs.service` e colar o base64 em `POLICY_PUBKEY_PEM_B64`

3. Copiar service:
```bash
sudo cp deploy/nova-policy-rs.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nova-policy-rs
sudo systemctl status nova-policy-rs
```

## Passo 5: Apontar Caddy

Editar configuração do Caddy e mudar de `127.0.0.1:9454` (Python) para `127.0.0.1:9456` (Rust).

Reload no Caddy.

## Passo 6: Prova de Corte (PoD)

### 6.1 Reload da política
```bash
curl -s http://127.0.0.1:9456/_reload
```
**Esperado:** `{"ok":true,"reloaded":true}`

### 6.2 Negar acesso sem grupo admin
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://nova.api.ubl.agency/admin/deploy
```
**Esperado:** `403`

### 6.3 Ligar break-glass 120s
```bash
curl -s -XPOST http://127.0.0.1:9456/__breakglass \
  -d '{"ttl_sec":120,"reason":"ops-override"}' \
  -H 'content-type: application/json'
```
**Esperado:** `{"ok":true,"until":<timestamp>,"reason":"ops-override"}`

### 6.4 Verificar acesso com break-glass
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://nova.api.ubl.agency/admin/deploy
```
**Esperado:** `200`

### 6.5 Desligar break-glass
```bash
curl -s -XPOST http://127.0.0.1:9456/__breakglass/clear
```
**Esperado:** `{"ok":true}`

### 6.6 Verificar métricas
```bash
curl -s http://127.0.0.1:9456/metrics | head -20
```
**Esperado:** 
- `policy_allow_total` > 0
- `policy_deny_total` > 0
- `policy_eval_ms_*` presente
- `panic_active` 0 ou 1

### 6.7 Verificar ledger
```bash
tail -f /var/log/ubl/nova-ledger.ndjson
```
**Esperado:** Linhas JSON com campo `"hash"` (BLAKE3)

## ✅ Passa = Done quando:

- [x] `_reload` OK (pack assinado + hash confere)
- [x] `/admin/deploy` dá **403** sem grupo e **200** com break-glass
- [x] `/metrics` mostra `policy_allow_total`/`policy_deny_total` > 0
- [x] Ledger em `/var/log/ubl/nova-ledger.ndjson` recebendo linhas com `hash`

## Rollback (se necessário)

1. Parar serviço Rust:
```bash
sudo systemctl stop nova-policy-rs
```

2. Reverter Caddy para `127.0.0.1:9454` (Python)

3. Reiniciar serviço Python (se necessário)

4. Reload Caddy

**Tempo de rollback:** < 5 minutos
