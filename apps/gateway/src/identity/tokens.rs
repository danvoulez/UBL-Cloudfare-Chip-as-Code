//! Token management: JWT ES256 (ECDSA P-256) mint/verify/refresh/revoke
//! JWKS rotation (current/next) via KV
//! ES256 for broad compatibility (JOSE/JWT, OIDC, WebCrypto, HSM/KMS, FIPS, Passkey/WebAuthn)

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH, Duration};
use jsonwebtoken::{encode, decode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use p256::ecdsa::{SigningKey, VerifyingKey};
use p256::pkcs8::{DecodePrivateKey, EncodePrivateKey, EncodePublicKey, LineEnding};
use base64::{engine::general_purpose, Engine as _};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenScope {
    pub tenant: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<String>>,
    pub session_type: String, // work|assist|deliberate|research
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClaims {
    pub iss: String,  // https://api.ubl.agency
    pub sub: String,  // user:{uuid} | agent:{uuid}
    pub aud: String,  // ubl-gateway
    pub iat: i64,
    pub exp: i64,
    pub kid: String,
    #[serde(flatten)]
    pub scope: TokenScope,
    pub client_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<Vec<String>>,
    pub jti: String, // unique token ID
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MintRequest {
    pub scope: TokenScope,
    pub session_type: String,
    pub client_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MintResponse {
    pub token: String,
    pub exp: i64,
    pub kid: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

pub struct TokenManager {
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
    kid: String,
}

impl TokenManager {
    pub fn new(signing_key: SigningKey, kid: String) -> Self {
        let verifying_key = signing_key.verifying_key();
        Self {
            signing_key,
            verifying_key,
            kid,
        }
    }

    pub fn from_pem(pem_bytes: &[u8], kid: String) -> anyhow::Result<Self> {
        let signing_key = SigningKey::from_pkcs8_pem(std::str::from_utf8(pem_bytes)?)?;
        let verifying_key = signing_key.verifying_key();
        Ok(Self {
            signing_key,
            verifying_key,
            kid,
        })
    }

    pub fn generate(kid: String) -> anyhow::Result<Self> {
        use rand_core::OsRng;
        let signing_key = SigningKey::random(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        Ok(Self {
            signing_key,
            verifying_key,
            kid,
        })
    }

    pub fn mint(&self, sub: String, scope: TokenScope, client_id: String, role: Option<Vec<String>>, ttl_sec: u64) -> anyhow::Result<MintResponse> {
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?;
        let exp_secs = now.as_secs() + ttl_sec;
        let jti = Uuid::new_v4().to_string();

        let claims = TokenClaims {
            iss: "https://api.ubl.agency".into(),
            sub,
            aud: "ubl-gateway".into(),
            iat: now.as_secs() as i64,
            exp: exp_secs as i64,
            kid: self.kid.clone(),
            scope,
            client_id,
            role,
            jti,
        };

        // JWT with ES256 (ECDSA P-256)
        let mut header = Header::new(Algorithm::ES256);
        header.kid = Some(self.kid.clone());

        // Convert P-256 key to PEM for jsonwebtoken
        let priv_pem = self.signing_key.to_pkcs8_pem(LineEnding::LF)?;
        let key = EncodingKey::from_ec_pem(priv_pem.as_bytes())?;
        
        let token = encode(&header, &claims, &key)?;

        Ok(MintResponse {
            token,
            exp: exp_secs as i64,
            kid: self.kid.clone(),
        })
    }

    pub fn verify(&self, token: &str) -> anyhow::Result<TokenClaims> {
        // Convert P-256 public key to PEM for jsonwebtoken
        let pub_pem = self.verifying_key.to_public_key_pem(LineEnding::LF)?;
        let key = DecodingKey::from_ec_pem(pub_pem.as_bytes())?;
        
        let mut validation = Validation::new(Algorithm::ES256);
        validation.set_audience(&["ubl-gateway"]);
        validation.set_issuer(&["https://api.ubl.agency"]);

        let data = decode::<TokenClaims>(token, &key, &validation)?;
        let claims = data.claims;

        // Validate exp
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64;
        if claims.exp < now {
            anyhow::bail!("token expired");
        }

        Ok(claims)
    }

    pub fn verifying_key(&self) -> &VerifyingKey {
        &self.verifying_key
    }

    pub fn kid(&self) -> &str {
        &self.kid
    }
}

// JWKS management (KV-based)
pub async fn load_jwks_from_kv(kv: &dyn KvStore) -> anyhow::Result<serde_json::Value> {
    let jwks_json = kv.get("jwks.json").await?;
    Ok(serde_json::from_str(&jwks_json)?)
}

pub async fn save_jwks_to_kv(kv: &dyn KvStore, jwks: &serde_json::Value) -> anyhow::Result<()> {
    kv.put("jwks.json", &serde_json::to_string(jwks)?).await?;
    Ok(())
}

// Generate JWKS from VerifyingKey (P-256)
pub fn generate_jwk(verifying_key: &VerifyingKey, kid: &str) -> anyhow::Result<serde_json::Value> {
    // Extract x, y coordinates from P-256 public key
    let (x, y) = extract_p256_coordinates(verifying_key)?;
    
    Ok(serde_json::json!({
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "use": "sig",
        "kid": kid,
        "x": base64_url_encode_bytes(&x),
        "y": base64_url_encode_bytes(&y)
    }))
}

fn extract_p256_coordinates(verifying_key: &VerifyingKey) -> anyhow::Result<(Vec<u8>, Vec<u8>)> {
    // P-256 public key point (uncompressed format: 0x04 || x || y)
    let point = verifying_key.to_encoded_point(false);
    let bytes = point.as_bytes();
    
    if bytes.len() != 65 || bytes[0] != 0x04 {
        anyhow::bail!("invalid P-256 public key format");
    }
    
    let x = bytes[1..33].to_vec();
    let y = bytes[33..65].to_vec();
    Ok((x, y))
}

pub fn generate_jwks(current: &VerifyingKey, current_kid: &str, next: Option<(&VerifyingKey, &str)>) -> anyhow::Result<serde_json::Value> {
    let mut keys = vec![generate_jwk(current, current_kid)?];
    
    if let Some((next_key, next_kid)) = next {
        keys.push(generate_jwk(next_key, next_kid)?);
    }
    
    Ok(serde_json::json!({
        "keys": keys
    }))
}

// Revocation check
pub async fn is_revoked(kv: &dyn KvStore, jti: &str) -> anyhow::Result<bool> {
    Ok(kv.get(&format!("revoked_jti:{}", jti)).await.is_ok())
}

pub async fn revoke_token(kv: &dyn KvStore, jti: &str, exp: i64) -> anyhow::Result<()> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64;
    let ttl = (exp - now).max(0) as u64;
    kv.put_with_ttl(&format!("revoked_jti:{}", jti), "1", ttl).await?;
    Ok(())
}

fn base64_url_encode_bytes(data: &[u8]) -> String {
    general_purpose::STANDARD.encode(data)
        .replace('+', "-")
        .replace('/', "_")
        .replace('=', "")
}

// Trait for KV abstraction (can be implemented for Cloudflare KV, Redis, etc.)
#[async_trait::async_trait]
pub trait KvStore: Send + Sync {
    async fn get(&self, key: &str) -> anyhow::Result<String>;
    async fn put(&self, key: &str, value: &str) -> anyhow::Result<()>;
    async fn put_with_ttl(&self, key: &str, value: &str, ttl_sec: u64) -> anyhow::Result<()>;
}
