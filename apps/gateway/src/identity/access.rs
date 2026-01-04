//! Cloudflare Access integration: JWT validation (AUD/JWKS) + role mapping

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessIdentity {
    pub sub: String,
    pub email: String,
    pub groups: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessClaims {
    pub sub: String,
    pub email: String,
    #[serde(default)]
    pub groups: Vec<String>,
    pub aud: String,
    pub iat: i64,
    pub exp: i64,
}

pub fn extract_access_identity(headers: &axum::http::HeaderMap) -> Option<AccessIdentity> {
    let email = headers.get("Cf-Access-Authenticated-User-Email")?.to_str().ok()?;
    let groups_hdr = headers.get("Cf-Access-Groups")?.to_str().ok()?;
    let groups: Vec<String> = groups_hdr.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    
    // Extract sub from JWT if available (simplified)
    let sub = format!("user:{}", uuid::Uuid::new_v4()); // In production, extract from JWT
    
    Some(AccessIdentity {
        sub,
        email: email.to_string(),
        groups,
    })
}

pub fn map_groups_to_roles(groups: &[String]) -> Vec<String> {
    let mut roles = Vec::new();
    for group in groups {
        match group.as_str() {
            "ubl-ops" | "admin" => roles.push("admin".into()),
            "moderator" => roles.push("moderator".into()),
            _ => {}
        }
    }
    roles
}

// Validate Access JWT (simplified - in production use proper JWT library)
pub async fn validate_access_jwt(jwt: &str, jwks_url: &str, aud: &str) -> anyhow::Result<AccessClaims> {
    // In production: fetch JWKS, verify signature, validate claims
    // For now: placeholder
    anyhow::bail!("Access JWT validation not yet implemented - use Worker for validation")
}
