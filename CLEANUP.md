# Limpeza da Estrutura

## Status

A estrutura foi reorganizada. As pastas antigas ainda existem mas podem ser removidas após validação.

## Nova Estrutura

✅ **Organizada:**
- `policy-engine/` — Motor único
- `policy-proxy/` — Proxy Rust
- `policy-worker/` — Worker Cloudflare
- `policy-signer/` — Signer de pack
- `policies/` — Políticas YAML
- `scripts/` — Scripts de build/test
- `docs/` — Documentação
- `infra/` — Infraestrutura

## Pastas Antigas (Podem ser removidas)

Após validar que tudo funciona:

```bash
# Remover pastas antigas
rm -rf nova_policy_rs/
rm -rf nova_edge_wasm_extracted/
rm -rf tdln-core/
rm -rf proxy/
rm -rf worker/
rm -rf policy-pack/
rm -f nova_policy_rs.tar nova_edge_wasm.tar
rm -f smoke_chip_as_code.sh  # movido para scripts/
```

## Validação

Antes de remover, validar:

1. ✅ Build funciona: `cargo build --release`
2. ✅ WASM compila: `cargo build --release --target wasm32-unknown-unknown -p policy-engine`
3. ✅ Signer funciona: `cargo build --release -p policy-signer`
4. ✅ Smoke test: `bash scripts/smoke_chip_as_code.sh`
