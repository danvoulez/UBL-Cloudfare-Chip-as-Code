# policy-keygen (standalone)
Generate Ed25519 (PKCS#8 PEM) key pair for policy signing (Chip-as-Code).

## Build
```bash
cd policy-keygen
cargo build --release
```

## Usage
```bash
# generate and print the public PEM in base64 (for proxy/worker vars)
sudo ./target/release/policy-keygen --print-pub-b64

# custom name/dir and overwrite existing files
sudo ./target/release/policy-keygen \
  --out-dir /etc/ubl/nova/keys \
  --name policy_signing \
  --overwrite \
  --print-pub-b64
```

## Outputs
- Private: /etc/ubl/nova/keys/policy_signing_private.pem  (PKCS#8 PEM)
- Public : /etc/ubl/nova/keys/policy_signing_public.pem   (SPKI PEM)
- Stdout : base64(public PEM) when `--print_pub_b64` is used.
