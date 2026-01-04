# UBL Edge — WASM Policy Engine + Worker (permanente)

## Estrutura

- `policy-engine-wasm/` → Motor WASM (bits+wires, mesmo do proxy)
- `worker/` → Cloudflare Worker com WASM
- `pack-signer/` → Signer de pack.json (Ed25519 + BLAKE3)

## Build do WASM

```bash
cd policy-engine-wasm
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
mkdir -p ../worker/build
cp target/wasm32-unknown-unknown/release/policy_engine_wasm.wasm ../worker/build/policy_engine.wasm
```

## Gerar pack.json assinado

### 1. Gerar chaves (se necessário)

```bash
# Usar o pack-builder do policy-pack ou gerar manualmente
cd ../policy-pack
cargo build --release
./target/release/pack-builder --generate-key
```

### 2. Assinar pack

```bash
cd ../nova_edge_wasm/pack-signer
cargo build --release
./target/release/pack-signer \
  -y /etc/ubl/nova/policy/ubl_core_v1.yaml \
  -k ../../policy-pack/keys/private.pem \
  -o pack.json \
  --id "ubl-core-v1" \
  --version "1.0"
```

O signer mostrará a chave pública em base64 para copiar no `wrangler.toml`.

## Worker (Cloudflare)

### 1. Configurar wrangler.toml

Edite `worker/wrangler.toml`:
- `ACCESS_AUD`: Audience do Cloudflare Access
- `ACCESS_JWKS`: URL do JWKS do Access
- `POLICY_PUBKEY_B64`: Base64 do PEM público (mostrado pelo signer)
- `kv_namespaces.id`: ID do namespace KV `UBL_FLAGS`

### 2. Carregar política na KV

```bash
cd worker
wrangler kv:key put --binding=UBL_FLAGS --key=policy_pack --path=../pack-signer/pack.json
wrangler kv:key put --binding=UBL_FLAGS --key=policy_yaml --path=/etc/ubl/nova/policy/ubl_core_v1.yaml
```

### 3. Deploy

```bash
wrangler deploy
```

### 4. Warmup (pré-carregar política)

Após deploy, chamar o warmup para pré-carregar e validar:

```bash
curl https://nova.api.ubl.agency/warmup
# Esperado: {"ok":true,"error":null}
```

Ou usar health check:

```bash
curl https://nova.api.ubl.agency/health
# Esperado: {"warmup":true,"error":null,"engine_ready":true}
```

## Endpoints

- `/*` → Avaliação de política (WASM)
- `/warmup` ou `/_warmup` → Pré-carrega e valida política
- `/health` → Status do warmup e engine

## Observação de Segurança

- No edge, verificamos **assinatura do pack** (Ed25519). A checagem de BLAKE3 do YAML é **enforçada no proxy Rust**, garantindo coerência extremo‑a‑extremo.

## Proof of Done (Edge)

✅ Política inválida/sem pack assinado → **503** no edge  
✅ Três casos (hacker/admin/break-glass) resultam **nas mesmas decisões** que o proxy Rust  
✅ p95 de decisão no edge "baixo" (WASM), sem CPU alta  
✅ Worker **não** contém if/else de negócio; toda decisão vem do `.wasm` (Chip-as-Code)  
✅ Warmup pré-carrega política na inicialização (primeira request ou chamada explícita)

## Fluxo

1. **Warmup** (opcional, mas recomendado): `/warmup` carrega pack, valida assinatura, inicializa WASM
2. **Request**: Worker verifica se warmup foi feito (se não, faz agora)
3. **Decisão**: WASM `decide_json()` avalia contexto (Access headers, groups, panic)
4. **Action**: Deny → 403; Allow → forward para upstream

## Troubleshooting

**Warmup falha:**
- Verificar se `policy_pack` e `policy_yaml` estão na KV
- Verificar se `POLICY_PUBKEY_B64` está correto
- Verificar logs do Worker

**WASM não inicializa:**
- Verificar se `policy_engine.wasm` está em `worker/build/`
- Verificar se YAML é válido
- Verificar logs do Worker

**Decisões diferentes do proxy:**
- Verificar se YAML é o mesmo
- Verificar se contexto (groups, panic) é o mesmo
- Verificar versão do WASM vs proxy
