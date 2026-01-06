use axum::{routing::{get, post}, Router, extract::State};
use tracing_subscriber::EnvFilter;
use std::net::SocketAddr;
use std::sync::Arc;

mod http;
mod auth;
mod atomic;
mod tokens;

use tokens::{mint::mint_token, refresh::refresh_token, revoke::revoke_token};
use tokens::mint::AppState as TokenAppState;
use auth::token_mgr::TokenManager;
use p256::ecdsa::SigningKey;
use rand_core::OsRng;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter(EnvFilter::from_default_env()).init();
    
    // Inicializar TokenManager
    let signing_key = SigningKey::random(&mut OsRng);
    let token_mgr = TokenManager::new(
        signing_key,
        "jwt-v1".to_string(),
        std::env::var("TOKEN_ISS").unwrap_or_else(|_| "https://id.ubl.agency".to_string()),
    );

    let token_state = Arc::new(TokenAppState {
        token_mgr,
        auth_worker_url: std::env::var("AUTH_WORKER_URL").unwrap_or_else(|_| "https://id.ubl.agency".to_string()),
        internal_auth_secret: std::env::var("INTERNAL_AUTH_SECRET").unwrap_or_else(|_| "change-me".to_string()),
        refresh_secret: std::env::var("REFRESH_SECRET").unwrap_or_else(|_| "change-me-refresh".to_string()),
    });
    
    let app = Router::new()
        .merge(auth::router())
        .route("/tokens/mint", post(mint_token))
        .route("/tokens/refresh", post(refresh_token))
        .route("/tokens/revoke", post(revoke_token))
        .with_state(token_state);
    
    let addr = SocketAddr::from(([127,0,0,1], 9458));
    tracing::info!("Core API listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
