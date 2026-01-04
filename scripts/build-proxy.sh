#!/bin/bash
# Build script para nova-policy-rs

set -e

echo "🔨 Building nova-policy-rs..."

# Verificar Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust não encontrado. Instale com: curl https://sh.rustup.rs -sSf | sh"
    exit 1
fi

# Build release
echo "📦 Building policy-engine..."
cargo build --release -p policy-engine

echo "📦 Building policy-proxy..."
cargo build --release -p policy-proxy

echo "✅ Build completo!"
echo ""
echo "Binário: target/release/policy-proxy"
echo ""
echo "Para instalar:"
echo "  sudo install -D -m 0755 target/release/policy-proxy /opt/ubl/nova/bin/nova-policy-rs"
echo ""
echo "Para build WASM:"
echo "  cd policy-engine && cargo build --target wasm32-wasi --release"
