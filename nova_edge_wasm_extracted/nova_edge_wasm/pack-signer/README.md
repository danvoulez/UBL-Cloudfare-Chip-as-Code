# Pack Signer — Ed25519 + BLAKE3

Gera `pack.json` assinado a partir de YAML de política.

## Build

```bash
cargo build --release
```

## Uso

```bash
./target/release/pack-signer \
  -y /path/to/policy.yaml \
  -k /path/to/private.pem \
  -o pack.json \
  --id "pack-id" \
  --version "1.0"
```

### Parâmetros

- `-y, --yaml`: Caminho do YAML de política (obrigatório)
- `-k, --key`: Caminho da chave privada Ed25519 em PEM (obrigatório)
- `-o, --output`: Caminho de saída do pack.json (default: `pack.json`)
- `--id`: ID do pack (default: auto-gerado com timestamp)
- `--version`: Versão do pack (default: `1.0`)

## Exemplo

```bash
./target/release/pack-signer \
  -y /etc/ubl/nova/policy/ubl_core_v1.yaml \
  -k ../../policy-pack/keys/private.pem \
  -o /etc/ubl/nova/policy/pack.json \
  --id "ubl-core-v1" \
  --version "1.0"
```

## Output

O signer:
1. Calcula BLAKE3 do YAML
2. Assina com Ed25519 (mensagem: `id=...\nversion=...\nblake3=...\n`)
3. Gera `pack.json` com:
   - `id`: ID do pack
   - `version`: Versão
   - `blake3`: Hash BLAKE3 do YAML (hex)
   - `signature`: Assinatura Ed25519 (base64)
   - `created_at`: Timestamp Unix

4. Mostra a chave pública em base64 (para copiar no `wrangler.toml`)

## Formato do pack.json

```json
{
  "id": "ubl-core-v1",
  "version": "1.0",
  "blake3": "abc123...",
  "signature": "xyz789...",
  "created_at": 1234567890
}
```

## Verificação

O pack pode ser verificado com:

```bash
# No proxy Rust (verifica assinatura + BLAKE3)
curl http://127.0.0.1:9456/_reload

# No Worker (verifica assinatura)
curl https://nova.api.ubl.agency/warmup
```
