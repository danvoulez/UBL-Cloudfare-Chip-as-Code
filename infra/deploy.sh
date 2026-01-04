#!/bin/bash
# Deploy script para UBL Flagship

set -e

echo "🚀 Deploying UBL Flagship..."

# 1. Build tdln-core (WASM + nativo)
echo "📦 Building tdln-core..."
cd tdln-core
cargo build --target wasm32-wasi --release
cargo build --release
cd ..

# 2. Build policy pack
echo "📦 Building policy pack..."
cd policy-pack
cargo build --release
# Gerar pack.json (assumindo chave já existe)
./target/release/pack-builder -y policy.yaml -o pack.json
cd ..

# 3. Deploy Worker
echo "📦 Deploying Worker..."
cd worker
npm install
npm run build
npm run deploy
cd ..

# 4. Build Proxy (Rust)
echo "📦 Building Proxy..."
cd proxy
cargo build --release
echo "✅ Proxy binary: target/release/ubl-policy-proxy"
cd ..

echo "✅ Deploy complete!"
