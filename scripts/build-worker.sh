#!/bin/bash
# Build script completo para nova_edge_wasm

set -e

echo "🔨 Building nova_edge_wasm..."

# 1. Build WASM
echo "📦 Building policy-engine WASM..."
cd policy-engine-wasm
rustup target add wasm32-unknown-unknown 2>/dev/null || true
cargo build --release --target wasm32-unknown-unknown
mkdir -p ../worker/build
cp target/wasm32-unknown-unknown/release/policy_engine_wasm.wasm ../worker/build/policy_engine.wasm
echo "✅ WASM built: worker/build/policy_engine.wasm"
cd ..

# 2. Build pack-signer
echo "📦 Building pack-signer..."
cd pack-signer
cargo build --release
echo "✅ Pack signer built: target/release/pack-signer"
cd ..

echo ""
echo "✅ Build completo!"
echo ""
echo "Próximos passos:"
echo "  1. Gerar pack.json:"
echo "     cd pack-signer"
echo "     ./target/release/pack-signer -y <yaml> -k <key> -o pack.json"
echo ""
echo "  2. Configurar wrangler.toml (ACCESS_AUD, ACCESS_JWKS, POLICY_PUBKEY_B64, KV id)"
echo ""
echo "  3. Carregar na KV:"
echo "     cd worker"
echo "     wrangler kv:key put --binding=UBL_FLAGS --key=policy_pack --path=../pack-signer/pack.json"
echo "     wrangler kv:key put --binding=UBL_FLAGS --key=policy_yaml --path=<yaml>"
echo ""
echo "  4. Deploy:"
echo "     wrangler deploy"
echo ""
echo "  5. Warmup:"
echo "     curl https://api.ubl.agency/warmup"
