# Quick Start — Edge WASM Worker

## Setup Rápido

### 1. Build Tudo

```bash
./build.sh
```

### 2. Gerar pack.json

```bash
cd pack-signer
./target/release/pack-signer \
  -y /etc/ubl/nova/policy/ubl_core_v1.yaml \
  -k ../../policy-pack/keys/private.pem \
  -o pack.json
```

**Copiar a chave pública (base64) mostrada.**

### 3. Configurar Worker

Editar `worker/wrangler.toml`:
- `ACCESS_AUD`
- `ACCESS_JWKS`
- `POLICY_PUBKEY_B64` (do passo 2)
- `kv_namespaces.id`

### 4. Carregar KV

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
```

## Verificação

```bash
# Health
curl https://nova.api.ubl.agency/health

# Teste (deve dar 403 sem grupo admin)
curl -H "Cf-Access-Jwt-Assertion: <token>" \
     https://nova.api.ubl.agency/admin/deploy
```

## Endpoints

- `/*` → Avaliação de política
- `/warmup` → Pré-carrega política
- `/health` → Status do warmup

## Troubleshooting

**Warmup falha:**
- Verificar KV keys
- Verificar `POLICY_PUBKEY_B64`
- Verificar logs no dashboard

**WASM não carrega:**
- Verificar se `policy_engine.wasm` está em `worker/build/`
- Verificar se YAML é válido
