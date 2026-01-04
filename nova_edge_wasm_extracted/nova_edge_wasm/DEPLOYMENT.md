# Deployment Guide — Edge WASM Worker

## Checklist de Deploy

### 1. Build WASM

```bash
cd policy-engine-wasm
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
mkdir -p ../worker/build
cp target/wasm32-unknown-unknown/release/policy_engine_wasm.wasm ../worker/build/policy_engine.wasm
```

### 2. Gerar pack.json

```bash
cd pack-signer
cargo build --release
./target/release/pack-signer \
  -y /etc/ubl/nova/policy/ubl_core_v1.yaml \
  -k ../../policy-pack/keys/private.pem \
  -o pack.json \
  --id "ubl-core-v1" \
  --version "1.0"
```

**Copiar a chave pública (base64) mostrada pelo signer.**

### 3. Configurar wrangler.toml

Editar `worker/wrangler.toml`:

```toml
[vars]
ACCESS_AUD = "seu-access-aud"
ACCESS_JWKS = "https://seu-team.cloudflareaccess.com/cdn-cgi/access/certs"
POLICY_PUBKEY_B64 = "chave-publica-base64-aqui"

[[kv_namespaces]]
binding = "UBL_FLAGS"
id = "seu-kv-namespace-id"
```

### 4. Carregar política na KV

```bash
cd worker
wrangler kv:key put --binding=UBL_FLAGS --key=policy_pack --path=../pack-signer/pack.json
wrangler kv:key put --binding=UBL_FLAGS --key=policy_yaml --path=/etc/ubl/nova/policy/ubl_core_v1.yaml
```

### 5. Deploy

```bash
wrangler deploy
```

### 6. Warmup

```bash
curl https://nova.api.ubl.agency/warmup
# Esperado: {"ok":true,"error":null}
```

## Verificação

### Health Check

```bash
curl https://nova.api.ubl.agency/health
# Esperado: {"warmup":true,"error":null,"engine_ready":true}
```

### Teste de Decisão

```bash
# Sem grupo admin (deve negar)
curl -H "Cf-Access-Jwt-Assertion: <token-sem-grupo>" \
     https://nova.api.ubl.agency/admin/deploy
# Esperado: 403

# Com grupo ubl-ops (deve permitir)
curl -H "Cf-Access-Jwt-Assertion: <token-com-ubl-ops>" \
     https://nova.api.ubl.agency/admin/deploy
# Esperado: 200
```

## Troubleshooting

**Warmup retorna erro:**
- Verificar se `policy_pack` e `policy_yaml` estão na KV
- Verificar se `POLICY_PUBKEY_B64` está correto
- Verificar logs do Worker no dashboard Cloudflare

**WASM não inicializa:**
- Verificar se `policy_engine.wasm` está em `worker/build/`
- Verificar se YAML é válido (sintaxe YAML)
- Verificar logs do Worker

**Decisões diferentes do proxy:**
- Verificar se YAML é o mesmo (mesmo BLAKE3)
- Verificar se contexto é o mesmo (groups, panic)
- Verificar versão do WASM vs proxy

**403 em todas as requests:**
- Verificar se Access token está presente
- Verificar se grupos estão sendo extraídos corretamente
- Verificar se warmup foi feito com sucesso

## Monitoramento

- **Warmup status**: `/health`
- **Worker logs**: Dashboard Cloudflare → Workers → Logs
- **Métricas**: Dashboard Cloudflare → Analytics

## Rollback

Se necessário voltar para versão anterior:

```bash
wrangler rollback
```

Ou fazer deploy de versão específica:

```bash
wrangler deploy --version <version-id>
```
