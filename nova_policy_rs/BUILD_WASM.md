# Build WASM do policy-engine para Worker

## Pré-requisitos

```bash
# Instalar wasm32-wasi target
rustup target add wasm32-wasi

# Instalar wasm-bindgen-cli (para bindings JS)
cargo install wasm-bindgen-cli
```

## Build WASM

```bash
cd nova_policy_rs/policy-engine
cargo build --target wasm32-wasi --release
```

O arquivo será gerado em:
```
target/wasm32-wasi/release/policy_engine.wasm
```

## Usar no Worker

1. Copiar o WASM para o Worker:
```bash
cp target/wasm32-wasi/release/policy_engine.wasm ../../worker/dist/
```

2. No Worker TypeScript, usar `@cloudflare/workers-types` e WebAssembly API:

```typescript
// Carregar WASM
const wasmModule = await WebAssembly.instantiateStreaming(
  fetch(new URL('./policy_engine.wasm', import.meta.url))
);

// Chamar decide()
const ctx = {
  transport: { tls_version: 1.3 },
  mtls: { verified: true, issuer: "Cloudflare Edge" },
  auth: { method: "access-passkey", rp_id: "app.ubl.agency" },
  user: { groups: ["ubl-ops"] },
  system: { panic_mode: false },
  who: "user@example.com",
  did: "GET /admin/deploy",
  req_id: "abc123"
};

const decision = wasmModule.instance.exports.decide(JSON.stringify(ctx));
```

## Nota

O build WASM atual usa `wasm-bindgen` para bindings JS. Para uso direto no Worker, pode ser necessário ajustar os bindings ou usar a API WebAssembly diretamente.
