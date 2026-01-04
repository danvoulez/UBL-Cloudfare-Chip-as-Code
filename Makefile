.PHONY: build build-proxy build-worker build-signer build-wasm test clean

# Build tudo
build: build-proxy build-signer build-wasm

# Build proxy
build-proxy:
	cargo build --release -p policy-proxy

# Build signer
build-signer:
	cargo build --release -p policy-signer

# Build WASM
build-wasm:
	cargo build --release --target wasm32-unknown-unknown -p policy-engine
	mkdir -p policy-worker/build
	cp target/wasm32-unknown-unknown/release/policy_engine.wasm policy-worker/build/

# Build Worker completo
build-worker: build-wasm
	@echo "✅ WASM built: policy-worker/build/policy_engine.wasm"

# Testes
test:
	cargo test

# Limpar builds
clean:
	cargo clean
	rm -rf policy-worker/build

# Gerar pack.json
pack:
	cargo build --release -p policy-signer
	./target/release/policy-signer \
		--id ubl_access_chip_v1 --version 1 \
		--yaml policies/ubl_core_v1.yaml \
		--privkey_pem /etc/ubl/nova/keys/policy_signing_private.pem \
		--out policies/pack.json
