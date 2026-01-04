# Deployment Guide — nova-policy-rs

## Resumo

Proxy Rust/Axum permanente com:
- ✅ Motor único (`policy-engine`) — bits+wires, determinístico
- ✅ Assinatura obrigatória (Ed25519 + BLAKE3)
- ✅ Break-glass com TTL
- ✅ Métricas Prometheus
- ✅ Ledger imutável (NDJSON com hash)

## Quick Deploy

```bash
# 1. Build
./build.sh

# 2. Setup
./setup.sh

# 3. Configurar service (editar POLICY_PUBKEY_PEM_B64)
sudo cp deploy/nova-policy-rs.service /etc/systemd/system/

# 4. Instalar binário
sudo install -D -m 0755 target/release/policy-proxy /opt/ubl/nova/bin/nova-policy-rs

# 5. Iniciar
sudo systemctl daemon-reload
sudo systemctl enable --now nova-policy-rs
```

## Verificação

```bash
# Status
sudo systemctl status nova-policy-rs

# Logs
sudo journalctl -u nova-policy-rs -f

# Métricas
curl http://127.0.0.1:9456/metrics

# Ledger
tail -f /var/log/ubl/nova-ledger.ndjson
```

## Portas

- **Proxy Rust**: `127.0.0.1:9456`
- **Upstream**: `127.0.0.1:9453` (configurável via `UPSTREAM` env)

## Variáveis de Ambiente

- `UPSTREAM`: URL do upstream (default: `http://127.0.0.1:9453`)
- `POLICY_PUBKEY_PEM_B64`: Base64 do PEM público (Ed25519) — **obrigatório**
- `POLICY_YAML`: Caminho do YAML (default: `/etc/ubl/nova/policy/ubl_core_v1.yaml`)
- `POLICY_PACK`: Caminho do pack.json (default: `/etc/ubl/nova/policy/pack.json`)

## Arquivos Esperados

- `/etc/ubl/nova/policy/ubl_core_v1.yaml` — Policy YAML
- `/etc/ubl/nova/policy/pack.json` — Pack assinado (BLAKE3 + Ed25519)
- `/var/log/ubl/nova-ledger.ndjson` — Ledger (criado automaticamente)

## Troubleshooting

**Service não inicia:**
```bash
sudo journalctl -u nova-policy-rs -n 50
```

**Erro de assinatura:**
- Verificar `POLICY_PUBKEY_PEM_B64` está correto
- Verificar `pack.json` foi gerado com a chave correta
- Verificar BLAKE3 do YAML bate com pack.json

**Ledger não escreve:**
- Verificar permissões: `sudo chown -R ubl-ops:ubl-ops /var/log/ubl`
- Verificar espaço em disco

**Métricas zeradas:**
- Fazer algumas requisições para gerar métricas
- Verificar se proxy está recebendo tráfego
