use axum::{routing::{get, post}, Router, extract::State, response::{IntoResponse, Response}, http::{StatusCode, HeaderMap}, Json};
use axum::http::{header};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use uuid::Uuid;

#[derive(Clone)]
#[allow(dead_code)]
struct AppState {
    ubl_jwks_url: String,
    cookie_domain: String,
}

#[derive(Deserialize)]
struct ExchangeIn {
    // Token curto emitido pelo UBL ID (ex: ES256). Em produção: validar via JWKS.
    token: String,
}

#[derive(Serialize)]
struct ExchangeOut {
    ok: bool,
    session_id: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let state = AppState {
        ubl_jwks_url: std::env::var("UBL_JWKS_URL").unwrap_or_else(|_| "https://api.ubl.agency/auth/jwks.json".into()),
        cookie_domain: std::env::var("VVZ_COOKIE_DOMAIN").unwrap_or_else(|_| "voulezvous.tv".into()),
    };
    let app = Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .route("/whoami", get(whoami))
        .route("/api/session/exchange", post(exchange))
        .route("/metrics", get(metrics))
        .with_state(Arc::new(state));

    let port = std::env::var("PORT").unwrap_or_else(|_| "8787".to_string()).parse().unwrap_or(8787);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("vvz-core listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn whoami(headers: HeaderMap) -> impl IntoResponse {
    // Stub: em produção, extrair user do cookie `sid` + storage
    let sid = headers.get(header::COOKIE).and_then(|v| v.to_str().ok()).unwrap_or("");
    let body = serde_json::json!({
        "ok": true,
        "cookie": sid
    });
    (StatusCode::OK, Json(body))
}

async fn exchange(State(state): State<Arc<AppState>>, Json(input): Json<ExchangeIn>) -> Response {
    // ⚠️ Simplificado: aqui deveríamos validar `input.token` via JWKS ES256 do UBL.
    // Exemplo real:
    // 1) buscar JWKS: state.ubl_jwks_url
    // 2) escolher a chave pelo kid
    // 3) validar assinatura/issuer/audience
    // 4) extrair subject (user_id/device_id)
    // Por ora, aceitamos o formato não-vazio para fins de smoke.
    if input.token.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "missing token").into_response();
    }

    let session_id = Uuid::new_v4().to_string();
    // TODO: persistir session_id -> user/device (D1/Redis)

    // Set-Cookie first-party: sid=...; HttpOnly; Secure; SameSite=Lax; Domain=voulezvous.tv; Path=/; Max-Age=86400
    let cookie = format!(
        "sid={}; HttpOnly; Secure; SameSite=Lax; Domain={}; Path=/; Max-Age=86400",
        session_id, state.cookie_domain
    );
    let mut headers = HeaderMap::new();
    headers.insert(header::SET_COOKIE, cookie.parse().unwrap());

    let body = serde_json::to_string(&ExchangeOut{ ok: true, session_id }).unwrap();
    (StatusCode::OK, headers, body).into_response()
}

async fn metrics() -> impl IntoResponse {
    // Stub: em produção, expor métricas Prometheus reais
    let body = "# HELP http_requests_total Total number of HTTP requests\n\
                # TYPE http_requests_total counter\n\
                http_requests_total 0\n\
                # HELP http_request_duration_seconds Request duration in seconds\n\
                # TYPE http_request_duration_seconds histogram\n\
                http_request_duration_seconds_bucket{le=\"0.005\"} 0\n\
                http_request_duration_seconds_bucket{le=\"0.01\"} 0\n\
                http_request_duration_seconds_bucket{le=\"0.025\"} 0\n\
                http_request_duration_seconds_bucket{le=\"0.05\"} 0\n\
                http_request_duration_seconds_bucket{le=\"0.1\"} 0\n\
                http_request_duration_seconds_bucket{le=\"+Inf\"} 0\n\
                http_request_duration_seconds_sum 0\n\
                http_request_duration_seconds_count 0\n";
    (StatusCode::OK, [("Content-Type", "text/plain; version=0.0.4")], body)
}
