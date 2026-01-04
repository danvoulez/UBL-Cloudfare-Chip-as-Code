//! Internal token verification extractor for Axum

use axum::{async_trait, extract::FromRequestParts, http::request::Parts, RequestPartsExt};
use axum_extra::extract::CookieJar;
use crate::identity::{TokenManager, TokenClaims};

pub struct VerifiedToken(pub TokenClaims);

#[async_trait]
impl<S> FromRequestParts<S> for VerifiedToken
where
    S: Send + Sync,
{
    type Rejection = (axum::http::StatusCode, axum::response::Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Extract token from Authorization header
        let auth_header = parts.headers.get("Authorization")
            .and_then(|h| h.to_str().ok())
            .ok_or_else(|| {
                (
                    axum::http::StatusCode::UNAUTHORIZED,
                    axum::response::Json(serde_json::json!({
                        "token": "UNAUTHORIZED",
                        "remediation": ["Bearer token required"]
                    })),
                )
            })?;

        let token = auth_header.strip_prefix("Bearer ")
            .ok_or_else(|| {
                (
                    axum::http::StatusCode::UNAUTHORIZED,
                    axum::response::Json(serde_json::json!({
                        "token": "UNAUTHORIZED",
                        "remediation": ["Invalid Authorization format"]
                    })),
                )
            })?;

        // TODO: Get TokenManager from state and verify
        // For now: placeholder
        Err((
            axum::http::StatusCode::NOT_IMPLEMENTED,
            axum::response::Json(serde_json::json!({
                "token": "NOT_IMPLEMENTED",
                "remediation": ["Token verification not yet implemented"]
            })),
        ))
    }
}
