//! Auth routes: /auth/passkey/*, /session, /auth/logout

use axum::{extract::State, http::StatusCode, response::Json, routing::{get, post}, Router};
use serde_json::json;
use crate::identity::{IdentityStore, Session};
use crate::mcp::router::McpErr;

pub fn routes<S: IdentityStore + Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new()
        .route("/auth/passkey/register", get(passkey_register))
        .route("/auth/passkey/finish", post(passkey_finish))
        .route("/session", get(get_session))
        .route("/auth/logout", post(logout))
}

async fn passkey_register() -> Json<serde_json::Value> {
    // WebAuthn registration options
    // TODO: Implement with webauthn-rs
    Json(json!({
        "publicKey": {
            "rp": { "name": "UBL Agency", "id": "app.ubl.agency" },
            "user": { "id": "placeholder", "name": "user", "displayName": "User" },
            "challenge": "placeholder",
            "pubKeyCredParams": [{ "type": "public-key", "alg": -7 }]
        }
    }))
}

async fn passkey_finish(
    State(store): State<impl IdentityStore>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    // TODO: Implement WebAuthn finish flow
    // For now: placeholder
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({"token": "NOT_IMPLEMENTED", "remediation": ["WebAuthn finish not yet implemented"]})),
    ))
}

async fn get_session(
    State(store): State<impl IdentityStore>,
    cookies: axum::extract::TypedHeader<axum::headers::Cookie>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let sid = jar.get("sid").map(|c| c.value()).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({"token": "UNAUTHORIZED", "remediation": ["Login required"]})),
        )
    })?;

    let session = store.get_session(sid).await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"token": "INTERNAL", "remediation": ["Retry later"]})),
        )
    })?;

    let session = session.ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({"token": "UNAUTHORIZED", "remediation": ["Session expired"]})),
        )
    })?;

    // Check expiration
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;
    if now > session.expires_at {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"token": "UNAUTHORIZED", "remediation": ["Session expired"]})),
        ));
    }

    Ok(Json(json!({
        "sub": session.subject_id,
        "tenant_default": "ubl", // TODO: from subject
        "roles": [],
        "affordances": []
    })))
}

async fn logout(
    State(store): State<impl IdentityStore>,
    jar: axum_extra::extract::CookieJar,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    if let Some(sid) = jar.get("sid").map(|c| c.value()) {
        let _ = store.delete_session(sid).await;
    }
    Ok(StatusCode::NO_CONTENT)
}
