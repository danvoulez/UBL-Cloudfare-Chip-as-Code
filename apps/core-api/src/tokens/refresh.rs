//! POST /tokens/refresh
//! Rotação de refresh tokens

use axum::{extract::State, http::StatusCode, response::Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use crate::tokens::mint::AppState;

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

pub async fn refresh_token(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<RefreshResponse>, (StatusCode, Json<serde_json::Value>)> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    // Hash do token recebido
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(state.refresh_secret.as_bytes())
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "hmac_init_failed"}))))?;
    mac.update(req.refresh_token.as_bytes());
    let hash = hex::encode(mac.finalize().into_bytes());

    // Validar via auth-worker
    let url = format!("{}/internal/refresh-tokens/validate", state.auth_worker_url);
    let resp = reqwest::Client::new()
        .post(&url)
        .header("X-Internal-Auth", &state.internal_auth_secret)
        .json(&json!({"token_hash": hash}))
        .send()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "validation_failed"}))))?;

    if !resp.status().is_success() {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid_refresh_token"}))));
    }

    let data: serde_json::Value = resp.json().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "json_error"}))))?;

    let user_id = data["user_id"].as_str().ok_or((StatusCode::BAD_REQUEST, Json(json!({"error": "missing_user_id"}))))?;
    let session_id = data["session_id"].as_str().ok_or((StatusCode::BAD_REQUEST, Json(json!({"error": "missing_session_id"}))))?;

    // Rotação: marcar usado e emitir novo par
    let access_ttl = 900;
    let refresh_ttl = 14 * 24 * 3600;

    let scope = crate::auth::token_mgr::TokenScope {
        tenant: "ubl".to_string(),
        entity: None,
        room: None,
        tools: None,
        session_type: "work".to_string(),
        extra: json!({}),
    };

    let access_token = state.token_mgr.mint(
        format!("user:{}", user_id),
        scope,
        "core-api".to_string(),
        None,
        access_ttl,
    ).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "mint_failed"}))))?;

    let new_refresh = create_refresh_token(state, user_id, session_id, refresh_ttl).await?;

    Ok(Json(RefreshResponse {
        access_token: access_token.token,
        refresh_token: new_refresh,
        expires_in: access_ttl as i64,
    }))
}

async fn create_refresh_token(
    state: &AppState,
    user_id: &str,
    session_id: &str,
    ttl: u64,
) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    use uuid::Uuid;
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let token = Uuid::new_v4().to_string();
    
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(state.refresh_secret.as_bytes())
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "hmac_init_failed"}))))?;
    mac.update(token.as_bytes());
    let hash = hex::encode(mac.finalize().into_bytes());

    let url = format!("{}/internal/refresh-tokens", state.auth_worker_url);
    let body = json!({
        "user_id": user_id,
        "session_id": session_id,
        "token_hash": hash,
        "expires_at": (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() + ttl) as i64,
    });

    let resp = reqwest::Client::new()
        .post(&url)
        .header("X-Internal-Auth", &state.internal_auth_secret)
        .json(&body)
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => Ok(token),
        _ => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "refresh_token_create_failed"})))),
    }
}
