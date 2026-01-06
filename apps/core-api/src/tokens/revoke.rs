//! POST /tokens/revoke
//! Revogar token por jti ou session_id

use axum::{extract::State, http::StatusCode, response::Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use crate::tokens::mint::AppState;

#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    pub jti: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RevokeResponse {
    pub ok: bool,
}

pub async fn revoke_token(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RevokeRequest>,
) -> Result<Json<RevokeResponse>, (StatusCode, Json<serde_json::Value>)> {
    let url = format!("{}/internal/revoke", state.auth_worker_url);
    let body = json!({
        "jti": req.jti,
        "session_id": req.session_id,
    });

    let resp = reqwest::Client::new()
        .post(&url)
        .header("X-Internal-Auth", &state.internal_auth_secret)
        .json(&body)
        .send()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "revoke_failed"}))))?;

    if resp.status().is_success() {
        Ok(Json(RevokeResponse { ok: true }))
    } else {
        Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "revoke_failed"}))))
    }
}
