# Quick Setup — UBL Core Policy v1

## 1. Salvar YAML

```bash
sudo install -d -m 750 /etc/ubl/nova/policy
sudo nano /etc/ubl/nova/policy/ubl_core_v1.yaml
# Cole o conteúdo do arquivo: nova_policy_rs/policy-engine/examples/ubl_core_v1.yaml
```

## 2. Gerar Chaves (se necessário)

```bash
sudo install -d -m 750 /etc/ubl/nova/keys

# Gerar par de chaves Ed25519
openssl genpkey -algorithm Ed25519 -out /etc/ubl/nova/keys/policy_signing_private.pem
openssl pkey -in /etc/ubl/nova/keys/policy_signing_private.pem -pubout -out /etc/ubl/nova/keys/policy_signing_public.pem

# Ajustar permissões
sudo chmod 600 /etc/ubl/nova/keys/policy_signing_private.pem
sudo chmod 644 /etc/ubl/nova/keys/policy_signing_public.pem
```

## 3. Assinar e Gerar pack.json

```bash
cd /tmp/nova_policy_rs
cargo build --release -p policy-signer

./target/release/policy-signer \
  --id ubl_access_chip_v1 --version 1 \
  --yaml /etc/ubl/nova/policy/ubl_core_v1.yaml \
  --privkey_pem /etc/ubl/nova/keys/policy_signing_private.pem \
  --out /etc/ubl/nova/policy/pack.json
```

**Copiar a chave pública (base64) mostrada pelo signer.**

## 4. Configurar Proxy

```bash
# Obter base64 da chave pública
PUB_BASE64="$(base64 -w0 /etc/ubl/nova/keys/policy_signing_public.pem)"

# Editar service
sudo nano /etc/systemd/system/nova-policy-rs.service
# Colar: Environment=POLICY_PUBKEY_PEM_B64=${PUB_BASE64}

# Ou usar sed:
sudo sed -i "s|POLICY_PUBKEY_PEM_B64=__FILL_ME__|POLICY_PUBKEY_PEM_B64=${PUB_BASE64}|" /etc/systemd/system/nova-policy-rs.service

# Reiniciar
sudo systemctl daemon-reload
sudo systemctl restart nova-policy-rs

# Validar
curl -s http://127.0.0.1:9456/_reload
# Esperado: {"ok":true,"reloaded":true}
```

## 5. Configurar Worker

### 5.1 Editar wrangler.toml

```toml
[vars]
ACCESS_AUD = "seu-access-aud"
ACCESS_JWKS = "https://seu-team.cloudflareaccess.com/cdn-cgi/access/certs"
POLICY_PUBKEY_B64 = "mesma-chave-publica-base64-do-signer"

[[kv_namespaces]]
binding = "UBL_FLAGS"
id = "seu-kv-namespace-id"
```

### 5.2 Carregar na KV

```bash
cd /tmp/nova_edge_wasm/worker
wrangler kv:key put --binding=UBL_FLAGS --key=policy_pack --path=/etc/ubl/nova/policy/pack.json
wrangler kv:key put --binding=UBL_FLAGS --key=policy_yaml --path=/etc/ubl/nova/policy/ubl_core_v1.yaml
```

### 5.3 Deploy

```bash
wrangler deploy
```

### 5.4 Warmup

```bash
curl -s https://api.ubl.agency/warmup | jq
# Esperado: {"ok":true,"error":null,"blake3":"..."}
```

## 6. Smoke Test

```bash
EDGE_HOST=https://api.ubl.agency \
PROXY_URL=http://127.0.0.1:9456 \
ADMIN_PATH=/admin/deploy \
bash ~/Downloads/smoke_chip_as_code.sh
```

## Política Safe-Default

A política `ubl_core_v1.yaml` implementa:

- ✅ **Zero Trust**: TLS 1.3+ + mTLS + Passkey obrigatórios
- ✅ **Admin por Grupo**: Paths admin requerem grupo `ubl-ops`
- ✅ **Break-Glass**: Circuit breaker para emergências
- ✅ **Assinatura**: Ed25519 + BLAKE3 (imutável, verificável)

### Bits de Política

- `P_Transport_Secure`: TLS 1.3+
- `P_Device_Identity`: mTLS válido (Cloudflare Edge ou UBL Local CA)
- `P_User_Passkey`: Passkey/WebAuthn do domínio
- `P_Role_Admin`: Grupo `ubl-ops`
- `P_Circuit_Breaker`: Break-glass ativo

### Fiação

- `W_ZeroTrust_Standard`: Sequência de TLS + mTLS + Passkey
- `W_Admin_Access`: Zero Trust + Admin
- `W_Emergency_Override`: Zero Trust OU Break-glass (ANY)

### Saídas

- `allow_admin_write`: Admin pode escrever
- `allow_standard_access`: Acesso padrão (read-only)
- `deny_invalid_access`: Negação padrão

## Próximos Passos (Opcional)

Para endurecer por rota (ex.: só `/admin/**` exige admin), pode-se adicionar:

- Bit `P_Is_Admin_Path`: `context.req.path.startsWith("/admin/")`
- Wire `W_Admin_Path_Access`: `W_ZeroTrust_Standard + P_Is_Admin_Path + P_Role_Admin`

Mas o safe-default já cobre Zero Trust, Passkey, mTLS, grupo admin e break-glass — tudo assinado e verificável.
