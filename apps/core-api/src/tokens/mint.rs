//! POST /tokens/mint
//! Valida session (sid) ou Access token, aplica ABAC, emite JWT ES256

use axum::{extract::State, http::{HeaderMap, StatusCode}, response::Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::tokens::abac::{AbacContext, evaluate_abac, AbacPolicy};
use crate::auth::token_mgr::{TokenManager, TokenScope};

#[derive(Debug, Deserialize)]
pub struct MintRequest {
    pub resource: String,
    pub action: String,
    #[serde(default)]
    pub tags: serde_json::Value,
    #[serde(default)]
    pub scope: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct MintResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: &'static str,
}

pub async fn mint_token(
    State(state): State<std::sync::Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<MintRequest>,
) -> Result<Json<MintResponse>, (StatusCode, Json<serde_json::Value>)> {
    // 1. Extrair session (sid do cookie ou Access token)
    let (user_id, groups, session_id) = match extract_identity(&headers, &state).await {
        Ok(ident) => ident,
        Err(e) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "unauthorized", "detail": e})),
            ));
        }
    };

    // 2. Carregar ABAC policy
    let policy = match load_abac_policy(&state).await {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(error = ?e, "failed to load ABAC policy");
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "policy_load_failed"})),
            ));
        }
    };

    // 3. Avaliar ABAC
    let ctx = AbacContext {
        user_id: user_id.clone(),
        groups,
        tags: req.tags.clone(),
    };

    if !evaluate_abac(&policy, &ctx, &req.action, &req.resource) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "forbidden", "detail": "ABAC denied"})),
        );
    }

    // 4. Verificar revogação de session
    if is_session_revoked(&state, &session_id).await {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "session_revoked"})),
        ));
    }

    // 5. Emitir tokens
    let access_ttl = 900; // 15 min
    let refresh_ttl = 14 * 24 * 3600; // 14 dias

    let scope = TokenScope {
        tenant: "ubl".to_string(),
        entity: None,
        room: None,
        tools: None,
        session_type: "work".to_string(),
        extra: json!({
            "resource": req.resource,
            "action": req.action,
        }),
    };

    let access_token = match state.token_mgr.mint(
        format!("user:{}", user_id),
        scope,
        "core-api".to_string(),
        None,
        access_ttl,
    ) {
        Ok(resp) => resp.token,
        Err(e) => {
            tracing::error!(error = ?e, "failed to mint token");
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "token_mint_failed"})),
            ));
        }
    };

    // 6. Criar refresh token (rotativo)
    let refresh_token = create_refresh_token(&state, &user_id, &session_id, refresh_ttl).await?;

    Ok(Json(MintResponse {
        access_token,
        refresh_token,
        expires_in: access_ttl as i64,
        token_type: "Bearer",
    }))
}

async fn extract_identity(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<(String, Vec<String>, String), String> {
    // Tentar cookie sid primeiro
    if let Some(cookie) = headers.get("Cookie") {
        if let Ok(cookie_str) = cookie.to_str() {
            if let Some(sid) = extract_sid(cookie_str) {
                if let Ok((user_id, session_id)) = validate_session(state, &sid).await {
                    // Buscar grupos do session (via auth-worker)
                    let groups = get_user_groups(state, &user_id).await.unwrap_or_default();
                    return Ok((user_id, groups, session_id));
                }
            }
        }
    }

    // Tentar Access token
    if let Some(access_hdr) = headers.get("Cf-Access-Jwt-Assertion") {
        if let Ok(token_str) = access_hdr.to_str() {
            // Validar Access token (simplificado - em produção usar JWKS do Access)
            // Por enquanto, extrair grupos do header
            let groups = extract_access_groups(headers);
            // Criar user_id temporário ou buscar de Access claims
            let user_id = "access-user".to_string(); // TODO: extrair de Access token
            return Ok((user_id, groups, "access-session".to_string()));
        }
    }

    Err("no valid identity found".to_string())
}

async fn get_user_groups(state: &AppState, user_id: &str) -> Result<Vec<String>, String> {
    // Consultar auth-worker para grupos do user
    // Por enquanto, retornar vazio (grupos vêm de Access ou D1)
    Ok(vec![])
}

fn extract_access_groups(headers: &HeaderMap) -> Vec<String> {
    // Extrair grupos do header CF-Access-Groups
    if let Some(groups_hdr) = headers.get("CF-Access-Groups") {
        if let Ok(groups_str) = groups_hdr.to_str() {
            return groups_str.split(',').map(|s| s.trim().to_string()).collect();
        }
    }
    vec![]
}

fn extract_sid(cookie: &str) -> Option<String> {
    cookie
        .split(';')
        .find_map(|part| {
            let part = part.trim();
            if part.starts_with("sid=") {
                Some(part[4..].to_string())
            } else {
                None
            }
        })
}

async fn validate_session(
    state: &AppState,
    sid: &str,
) -> Result<(String, String), String> {
    // Consultar auth-worker via HTTP
    let url = format!("{}/internal/sessions/{}", state.auth_worker_url, sid);
    let resp = reqwest::Client::new()
        .get(&url)
        .header("X-Internal-Auth", &state.internal_auth_secret)
        .send()
        .await
        .map_err(|e| format!("http error: {}", e))?;

    if !resp.status().is_success() {
        return Err("session not found or expired".to_string());
    }

    let session: serde_json::Value = resp.json().await
        .map_err(|e| format!("json error: {}", e))?;

    let user_id = session["user_id"]
        .as_str()
        .ok_or("missing user_id")?
        .to_string();

    Ok((user_id, sid.to_string()))
}

async fn load_abac_policy(state: &AppState) -> Result<AbacPolicy, String> {
    // Carregar de auth-worker (que consulta D1)
    let url = format!("{}/internal/abac/default", state.auth_worker_url);
    let resp = reqwest::Client::new()
        .get(&url)
        .header("X-Internal-Auth", &state.internal_auth_secret)
        .send()
        .await
        .map_err(|e| format!("http error: {}", e))?;

    if resp.status().is_success() {
        let policy: AbacPolicy = resp.json().await
            .map_err(|e| format!("json error: {}", e))?;
        return Ok(policy);
    }

    // Fallback: policy default hardcoded
    Ok(AbacPolicy {
        version: 1,
        rules: vec![
            serde_json::from_value(json!({
                "effect": "allow",
                "when": {"group": "ubl-ops"},
                "action": "*",
                "resource": "*"
            }))
            .unwrap(),
            serde_json::from_value(json!({
                "effect": "deny",
                "when": {"tag:adult": true},
                "action": "call:provider",
                "resource": "openai.*"
            }))
            .unwrap(),
            serde_json::from_value(json!({
                "effect": "allow",
                "when": {"tag:adult": true},
                "action": "call:provider",
                "resource": "lab.*"
            }))
            .unwrap(),
            serde_json::from_value(json!({
                "effect": "allow",
                "when": {},
                "action": "read",
                "resource": "office.*"
            }))
            .unwrap(),
        ],
    })
}

async fn is_session_revoked(state: &AppState, session_id: &str) -> bool {
    // Consultar auth-worker
    let url = format!("{}/internal/sessions/{}/revoked", state.auth_worker_url, session_id);
    let resp = reqwest::Client::new()
        .get(&url)
        .header("X-Internal-Auth", &state.internal_auth_secret)
        .send()
        .await;

    match resp {
        Ok(r) => r.status().is_success(),
        Err(_) => false, // Se erro, assume não revogado (fail-open para disponibilidade)
    }
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
    
    // Hash do token
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(state.refresh_secret.as_bytes())
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "hmac_init_failed"}))))?;
    mac.update(token.as_bytes());
    let hash = hex::encode(mac.finalize().into_bytes());

    // Salvar via auth-worker
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

#[derive(Clone)]
pub struct AppState {
    pub token_mgr: TokenManager,
    pub auth_worker_url: String,
    pub internal_auth_secret: String,
    pub refresh_secret: String,
}
