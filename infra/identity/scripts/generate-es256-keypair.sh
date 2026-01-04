#!/bin/bash
# Generate ES256 (ECDSA P-256) key pair for JWT signing
# Blueprint 06 — Identity & Access (ES256)

set -euo pipefail

KEY_DIR="${1:-/etc/ubl/keys}"
KID="${2:-jwt-v1}"

mkdir -p "${KEY_DIR}"
chmod 750 "${KEY_DIR}"

PRIV_KEY="${KEY_DIR}/jwt_es256_${KID}_priv.pem"
PUB_KEY="${KEY_DIR}/jwt_es256_${KID}_pub.pem"

echo "Generating ES256 (ECDSA P-256) key pair..."
echo "  Private key: ${PRIV_KEY}"
echo "  Public key:  ${PUB_KEY}"
echo "  Key ID:      ${KID}"

# Generate private key (P-256)
openssl ecparam -name prime256v1 -genkey -noout -out "${PRIV_KEY}"

# Extract public key
openssl ec -in "${PRIV_KEY}" -pubout -out "${PUB_KEY}"

# Set permissions
chmod 600 "${PRIV_KEY}"
chmod 644 "${PUB_KEY}"

echo "✅ Key pair generated successfully!"
echo ""
echo "Next steps:"
echo "  1. Load private key in Core API (JWT_ES256_PRIV_PEM env var)"
echo "  2. Generate JWKS with: ./generate-jwks.sh ${KID}"
echo "  3. Publish JWKS to KV or static endpoint"
