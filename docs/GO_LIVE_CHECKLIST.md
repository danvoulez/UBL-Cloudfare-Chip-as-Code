# GO LIVE — Checklist Final

## ✅ Ajustes Realizados

### 1. Worker `/warmup` retorna `blake3`
- ✅ Worker agora retorna `{ok: true, error: null, blake3: "..."}` no warmup
- ✅ Smoke test ajustado para extrair e mostrar blake3

### 2. Policy Signer no `nova_policy_rs`
- ✅ Criado `policy-signer` no workspace `nova_policy_rs`
- ✅ Aceita `--privkey_pem` (compatível com comando do cutover)
- ✅ Aceita `--id` e `--version` (obrigatórios conforme cutover)
- ✅ Mostra chave pública em base64 para copiar

### 3. Pack Signer no `nova_edge_wasm`
- ✅ Ajustado para aceitar `--privkey_pem` além de `-k/--key`
- ✅ Aceita `--out` além de `-o/--output`

### 4. Smoke Test
- ✅ Ajustado para extrair blake3 do warmup corretamente
- ✅ Tratamento de erro melhorado

## 🚀 Comandos do Cutover (Resumo)

### 1. Assinar Política

```bash
cd /tmp/nova_policy_rs
cargo build --release -p policy-signer

./target/release/policy-signer \
  --id ubl_access_chip_v1 --version 1 \
  --yaml /etc/ubl/nova/policy/ubl_core_v1.yaml \
  --privkey_pem /etc/ubl/nova/keys/policy_signing_private.pem \
  --out /etc/ubl/nova/policy/pack.json
```

**Copiar a chave pública (base64) mostrada.**

### 2. Proxy Rust

```bash
cd /tmp/nova_policy_rs
cargo build --release
sudo install -D -m 0755 target/release/policy-proxy /opt/ubl/nova/bin/nova-policy-rs

PUB_BASE64="$(base64 -w0 /etc/ubl/nova/keys/policy_signing_public.pem)"
sudo sed -i "s|POLICY_PUBKEY_PEM_B64=__FILL_ME__|POLICY_PUBKEY_PEM_B64=${PUB_BASE64}|" deploy/nova-policy-rs.service

sudo cp deploy/nova-policy-rs.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nova-policy-rs

curl -s http://127.0.0.1:9456/_reload
```

### 3. Worker WASM

```bash
cd /tmp/nova_edge_wasm/policy-engine-wasm
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
mkdir -p ../worker/build
cp target/wasm32-unknown-unknown/release/policy_engine_wasm.wasm ../worker/build/policy_engine.wasm

cd ../worker
# Editar wrangler.toml: ACCESS_AUD, ACCESS_JWKS, POLICY_PUBKEY_B64, KV id

wrangler kv:key put --binding=UBL_FLAGS --key=policy_pack --path=/etc/ubl/nova/policy/pack.json
wrangler kv:key put --binding=UBL_FLAGS --key=policy_yaml --path=/etc/ubl/nova/policy/ubl_core_v1.yaml

wrangler deploy

curl -s https://api.ubl.agency/warmup | jq
```

### 4. Caddy

Ajustar reverse_proxy de `127.0.0.1:9454` → `127.0.0.1:9456`

### 5. Smoke Test

```bash
EDGE_HOST=https://api.ubl.agency \
PROXY_URL=http://127.0.0.1:9456 \
ADMIN_PATH=/admin/deploy \
bash smoke_chip_as_code.sh
```

## ✅ Proof of Done

- [x] `/_reload` OK (assinatura Ed25519 válida + BLAKE3 bate com YAML)
- [x] `/warmup` retorna `{ok: true, blake3: "..."}`
- [x] Mesmas decisões em edge (WASM) e proxy (Rust)
- [x] `policy_allow_total`/`policy_deny_total` > 0 em `/metrics`
- [x] Ledger NDJSON com linhas contendo `hash` (BLAKE3)
- [x] Smoke test passa completamente

## 🔧 Troubleshooting Rápido

**`/_reload` falha:**
- Verificar `pack.json` e chave pública no service

**`/warmup` 503:**
- Verificar KV keys (`policy_pack` e `policy_yaml`)
- Verificar `POLICY_PUBKEY_B64` no wrangler.toml

**Decisões diferentes:**
- Verificar se YAML é o mesmo (mesmo BLAKE3)
- Verificar contexto (groups, panic)

**Smoke test falha:**
- Verificar logs do proxy: `journalctl -u nova-policy-rs -f`
- Verificar logs do Worker no dashboard Cloudflare
