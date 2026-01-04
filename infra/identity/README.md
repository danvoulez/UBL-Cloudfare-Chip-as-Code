# Identity & Access — ES256 (ECDSA P-256)

**Algoritmo padrão:** ES256 (ECDSA P-256)  
**Motivo:** Compatibilidade ampla (JOSE/JWT, OIDC, WebCrypto, HSM/KMS, FIPS 140-2/3, Passkey/WebAuthn)

---

## 🔑 Geração de Chaves

### 1) Gerar par de chaves ES256

```bash
./infra/identity/scripts/generate-es256-keypair.sh [KEY_DIR] [KID]

# Exemplo:
./infra/identity/scripts/generate-es256-keypair.sh /etc/ubl/keys jwt-v1
```

**Output:**
- `jwt_es256_jwt-v1_priv.pem` (chave privada, 600)
- `jwt_es256_jwt-v1_pub.pem` (chave pública, 644)

### 2) Gerar JWKS (JSON Web Key Set)

```bash
./infra/identity/scripts/generate-jwks.sh [KEY_DIR] [CURRENT_KID] [NEXT_KID]

# Exemplo (apenas current):
./infra/identity/scripts/generate-jwks.sh /etc/ubl/keys jwt-v1

# Exemplo (blue/green com next):
./infra/identity/scripts/generate-jwks.sh /etc/ubl/keys jwt-v1 jwt-v2
```

**Output:** JWKS JSON com chave(s) P-256 em formato JOSE.

---

## 🔄 Rotação Blue/Green

### Passo 1: Gerar nova chave (next)

```bash
./infra/identity/scripts/generate-es256-keypair.sh /etc/ubl/keys jwt-v2
```

### Passo 2: Publicar JWKS com ambas as chaves

```bash
./infra/identity/scripts/generate-jwks.sh /etc/ubl/keys jwt-v1 jwt-v2 > jwks.json
```

### Passo 3: Atualizar Core API

- Carregar `jwt_es256_jwt-v2_priv.pem` como chave de assinatura
- Publicar `jwks.json` (KV ou endpoint `/auth/jwks.json`)
- Começar a assinar novos tokens com `kid: jwt-v2`

### Passo 4: Manter compatibilidade

- Manter `jwt-v1` no JWKS por ≥ 30 dias (ou > TTL máximo)
- Verificadores aceitam ambos os `kid` durante a transição

### Passo 5: Remover chave antiga

- Após período de graça, remover `jwt-v1` do JWKS
- Remover arquivo `jwt_es256_jwt-v1_priv.pem` (ou arquivar)

---

## 🔐 Mint/Verify (Referência)

### Node.js (mint) com `jose`

```typescript
import { importPKCS8, SignJWT } from 'jose';

const pk = await importPKCS8(process.env.JWT_ES256_PRIV_PEM, 'ES256');
const jwt = await new SignJWT(claims)
  .setProtectedHeader({ alg: 'ES256', kid: 'jwt-v1' })
  .setIssuer('https://api.ubl.agency')
  .setAudience('ubl-gateway')
  .setExpirationTime('30m')
  .sign(pk);
```

### Edge Worker (verify) com WebCrypto

```typescript
// Fetch JWKS
const jwks = await fetch('https://api.ubl.agency/auth/jwks.json').then(r => r.json());
const jwk = jwks.keys.find(k => k.kid === header.kid);

// Import key
const key = await crypto.subtle.importKey(
  'jwk', jwk,
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['verify']
);

// Verify signature
const [headerB64, payloadB64, sigB64] = jwt.split('.');
const signedBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
const sigBytes = base64UrlDecode(sigB64);

const ok = await crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' },
  key,
  sigBytes,
  signedBytes
);
```

### Rust (verify) com `jsonwebtoken`

```rust
use jsonwebtoken::{DecodingKey, Validation, decode, Algorithm};

let mut v = Validation::new(Algorithm::ES256);
v.set_audience(&["ubl-gateway"]);
v.set_issuer(&["https://api.ubl.agency"]);

let pub_pem = std::fs::read("/etc/ubl/keys/jwt_es256_jwt-v1_pub.pem")?;
let token = decode::<TokenClaims>(
    &jwt,
    &DecodingKey::from_ec_pem(&pub_pem)?,
    &v
)?;
```

---

## 📋 Proof of Done (DoD)

1. ✅ `/auth/jwks.json` responde com `keys[0].alg == "ES256"` e `crv == "P-256"`
2. ✅ `/tokens/mint` retorna JWT com `header.alg = "ES256"` e `header.kid = "jwt-v1"`
3. ✅ Worker aceita o token e bloqueia se `audience` errada
4. ✅ `mcp.tool/call` com token `session_type=research` nega `messenger.send` por ABAC (esperado)
5. ✅ Rotação blue/green: tokens com `kid: jwt-v1` e `kid: jwt-v2` ambos validam durante transição

---

## 🔒 Segurança

- **Chave privada:** Nunca em código, sempre via env/secret manager
- **JWKS:** Pode ser estático (arquivo) ou dinâmico (endpoint)
- **HSM/KMS:** Quando em produção dura, mover chave para KMS/HSM (P-256 suportado universalmente)
- **Compat forward:** Verificadores podem aceitar ES256 e EdDSA (verify-only), mas assinar sempre em ES256

---

## 📚 Referências

- **Blueprint 06** — Identity & Access (Gateway)
- **RFC 7519** — JSON Web Token (JWT)
- **RFC 7517** — JSON Web Key (JWK)
- **RFC 7518** — JSON Web Algorithms (JWA) — ES256
