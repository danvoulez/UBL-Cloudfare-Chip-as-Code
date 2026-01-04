//! Token routes: /tokens/mint, /tokens/refresh, /tokens/revoke

use axum::{extract::State, http::StatusCode, response::Json, routing::post, Router};
use serde_json::json;
use crate::identity::{TokenManager, MintRequest, MintResponse, TokenScope, AbacContext, evaluate_abac, AbacDecision, IdentityStore};
use crate::identity::access::map_groups_to_roles;
use crate::identity::access::extract_access_identity;
use crate::mcp::router::McpErr;

#[derive(Clone)]
pub struct AppState<S: IdentityStore> {
    pub store: S,
    pub token_mgr: TokenManager,
}

pub fn routes<S: IdentityStore + Clone + Send + Sync + 'static>(
    store: S,
    token_mgr: TokenManager,
) -> Router<AppState<S>> {
    Router::new()
        .route("/tokens/mint", post(mint_token))
        .route("/tokens/refresh", post(refresh_token))
        .route("/tokens/revoke", post(revoke_token))
        .with_state(AppState {
            store,
            token_mgr,
        })
}

async fn mint_token<S: IdentityStore>(
    State(state): State<AppState<S>>,
    headers: axum::http::HeaderMap,
    Json(req): Json<MintRequest>,
) -> Result<Json<MintResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Validate client_id
    if req.client_id.is_empty() || req.client_id.len() > 64 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"token": "INVALID_PARAMS", "remediation": ["client_id required, max 64 chars"]})),
        ));
    }

    // Extract identity from Access headers
    let access_identity = extract_access_identity(&headers)
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({"token": "UNAUTHORIZED", "remediation": ["Cloudflare Access required"]})),
            )
        })?;

    // Map groups to roles
    let roles = map_groups_to_roles(&access_identity.groups);

    // Evaluate ABAC
    let abac_ctx = AbacContext {
        tenant: "ubl".to_string(), // TODO: from session/subject
        roles: roles.clone(),
        session_type: req.session_type.clone(),
        requested_scope: req.scope.clone(),
    };

    let abac_decision = evaluate_abac(&abac_ctx);
    let scope = match abac_decision {
        AbacDecision::Deny { reason } => {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({"token": "FORBIDDEN_SCOPE", "remediation": [reason]})),
            ));
        }
        AbacDecision::Allow { reduced_scope } => reduced_scope,
    };

    // Mint token (TTL based on session_type)
    let ttl_sec = match req.session_type.as_str() {
        "work" => 900,      // 15 min
        "assist" => 600,    // 10 min
        "deliberate" => 1200, // 20 min
        "research" => 1800, // 30 min
        _ => 900,
    };

    let response = state.token_mgr.mint(
        access_identity.sub,
        scope,
        req.client_id,
        Some(roles),
        ttl_sec,
    ).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"token": "INTERNAL", "remediation": ["Retry later"]})),
        )
    })?;

    Ok(Json(response))
}

async fn refresh_token<S: IdentityStore>(
    State(_state): State<AppState<S>>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<MintResponse>, (StatusCode, Json<serde_json::Value>)> {
    // TODO: Implement refresh token validation and mint new token
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({"token": "NOT_IMPLEMENTED", "remediation": ["Refresh not yet implemented"]})),
    ))
}

async fn revoke_token<S: IdentityStore>(
    State(_state): State<AppState<S>>,
    Json(req): Json<serde_json::Value>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    // TODO: Extract jti from token, call revoke
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({"token": "NOT_IMPLEMENTED", "remediation": ["Revoke not yet implemented"]})),
    ))
}
