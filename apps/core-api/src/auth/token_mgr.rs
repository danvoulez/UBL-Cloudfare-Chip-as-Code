//! TokenManager para Core API (reutiliza lógica do Gateway)
//! ES256 (ECDSA P-256) JWT mint/verify

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use jsonwebtoken::{encode, decode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use p256::ecdsa::SigningKey;
use p256::pkcs8::{DecodePrivateKey, EncodePrivateKey, LineEnding};
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
    pub session_type: String,
    #[serde(flatten)]
    pub extra: Value, // resource, action, etc
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClaims {
    pub iss: String,  // https://id.ubl.agency
    pub sub: String,  // user:{uuid}
    pub aud: String, // ubl-gateway
    pub iat: i64,
    pub exp: i64,
    pub kid: String,
    #[serde(flatten)]
    pub scope: TokenScope,
    pub client_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<Vec<String>>,
    pub jti: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MintResponse {
    pub token: String,
    pub exp: i64,
    pub kid: String,
}

pub struct TokenManager {
    signing_key: SigningKey,
    kid: String,
    issuer: String,
}

impl TokenManager {
    pub fn new(signing_key: SigningKey, kid: String, issuer: String) -> Self {
        Self {
            signing_key,
            kid,
            issuer,
        }
    }

    pub fn from_pem(pem_bytes: &[u8], kid: String, issuer: String) -> anyhow::Result<Self> {
        let signing_key = SigningKey::from_pkcs8_pem(std::str::from_utf8(pem_bytes)?)?;
        Ok(Self {
            signing_key,
            kid,
            issuer,
        })
    }

    pub fn mint(
        &self,
        sub: String,
        scope: TokenScope,
        client_id: String,
        role: Option<Vec<String>>,
        ttl_sec: u64,
    ) -> anyhow::Result<MintResponse> {
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?;
        let exp_secs = now.as_secs() + ttl_sec;
        let jti = Uuid::new_v4().to_string();

        let claims = TokenClaims {
            iss: self.issuer.clone(),
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

        let mut header = Header::new(Algorithm::ES256);
        header.kid = Some(self.kid.clone());

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
        let pub_pem = self.signing_key.verifying_key().to_public_key_pem(LineEnding::LF)?;
        let key = DecodingKey::from_ec_pem(pub_pem.as_bytes())?;

        let mut validation = Validation::new(Algorithm::ES256);
        validation.set_audience(&["ubl-gateway"]);
        validation.set_issuer(&[&self.issuer]);

        let data = decode::<TokenClaims>(token, &key, &validation)?;
        let claims = data.claims;

        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64;
        if claims.exp < now {
            anyhow::bail!("token expired");
        }

        Ok(claims)
    }
}
