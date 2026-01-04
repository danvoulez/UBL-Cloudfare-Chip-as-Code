use axum::{routing::get, Router};
use tracing_subscriber::EnvFilter;
use std::net::SocketAddr;

mod mcp;
mod identity;
mod http;
mod internal;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter(EnvFilter::from_default_env()).init();
    
    // Initialize identity store (memory for now)
    let store = identity::storage::MemoryIdentityStore::new();
    
    // Initialize token manager (generate key for demo)
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;
    let mut rng = OsRng;
    let signing_key = SigningKey::generate(&mut rng);
    let token_mgr = identity::tokens::TokenManager::new(signing_key, "current".into());
    
    let app = Router::new()
        .route("/mcp", get(mcp::server::ws_upgrade))
        .merge(http::routes_auth::routes(store.clone()))
        .merge(http::routes_tokens::routes(store.clone(), token_mgr));
    
    let addr = SocketAddr::from(([127,0,0,1], 8080));
    tracing::info!("Gateway MCP + Identity listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
