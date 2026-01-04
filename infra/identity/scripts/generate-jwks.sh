#!/bin/bash
# Generate JWKS (JSON Web Key Set) from ES256 public keys
# Supports blue/green rotation (current + next)
# Blueprint 06 — Identity & Access (ES256)

set -euo pipefail

KEY_DIR="${1:-/etc/ubl/keys}"
CURRENT_KID="${2:-jwt-v1}"
NEXT_KID="${3:-}"

CURRENT_PUB="${KEY_DIR}/jwt_es256_${CURRENT_KID}_pub.pem"

if [[ ! -f "${CURRENT_PUB}" ]]; then
    echo "ERROR: Public key not found: ${CURRENT_PUB}" >&2
    echo "Generate it first with: ./generate-es256-keypair.sh ${KEY_DIR} ${CURRENT_KID}" >&2
    exit 1
fi

echo "Generating JWKS..."
echo "  Current key: ${CURRENT_KID}"

# Extract x, y coordinates from P-256 public key
# P-256 public key format: 0x04 || x (32 bytes) || y (32 bytes)
extract_coords() {
    local pub_pem="$1"
    # Convert PEM to DER, then extract uncompressed point
    local der=$(openssl ec -pubin -in "${pub_pem}" -outform DER 2>/dev/null)
    # Parse ASN.1 to get the point (simplified - assumes standard format)
    # In production, use proper ASN.1 parser or jose-toolkit
    echo "${der}" | tail -c +27 | head -c 64 | xxd -p -c 32
}

COORDS=$(extract_coords "${CURRENT_PUB}")
X_HEX=$(echo "${COORDS}" | head -c 64)
Y_HEX=$(echo "${COORDS}" | tail -c +65)

X_B64=$(echo "${X_HEX}" | xxd -r -p | base64 | tr -d '=' | tr '/+' '_-')
Y_B64=$(echo "${Y_HEX}" | xxd -r -p | base64 | tr -d '=' | tr '/+' '_-')

# Build JWKS
JWKS=$(cat <<EOF
{
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "alg": "ES256",
      "use": "sig",
      "kid": "${CURRENT_KID}",
      "x": "${X_B64}",
      "y": "${Y_B64}"
    }
EOF
)

# Add next key if provided
if [[ -n "${NEXT_KID}" ]]; then
    NEXT_PUB="${KEY_DIR}/jwt_es256_${NEXT_KID}_pub.pem"
    if [[ -f "${NEXT_PUB}" ]]; then
        echo "  Next key:    ${NEXT_KID}"
        COORDS_NEXT=$(extract_coords "${NEXT_PUB}")
        X_HEX_NEXT=$(echo "${COORDS_NEXT}" | head -c 64)
        Y_HEX_NEXT=$(echo "${COORDS_NEXT}" | tail -c +65)
        X_B64_NEXT=$(echo "${X_HEX_NEXT}" | xxd -r -p | base64 | tr -d '=' | tr '/+' '_-')
        Y_B64_NEXT=$(echo "${Y_HEX_NEXT}" | xxd -r -p | base64 | tr -d '=' | tr '/+' '_-')
        
        JWKS="${JWKS},
    {
      \"kty\": \"EC\",
      \"crv\": \"P-256\",
      \"alg\": \"ES256\",
      \"use\": \"sig\",
      \"kid\": \"${NEXT_KID}\",
      \"x\": \"${X_B64_NEXT}\",
      \"y\": \"${Y_B64_NEXT}\"
    }"
    fi
fi

JWKS="${JWKS}
  ]
}"

# Output JWKS (pretty-printed)
echo "${JWKS}" | jq '.' 2>/dev/null || echo "${JWKS}"

echo ""
echo "✅ JWKS generated!"
echo ""
echo "Next steps:"
echo "  1. Save to static file: echo '...' > static/auth/jwks.json"
echo "  2. Or publish to KV: wrangler kv key put --binding=IDENTITY jwks.json --value='...'"
echo "  3. Or serve dynamically from Core API endpoint /auth/jwks.json"
