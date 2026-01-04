use axum::{routing::get, Router};
use tracing_subscriber::EnvFilter;
use std::net::SocketAddr;

mod http;
mod auth;
mod atomic;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter(EnvFilter::from_default_env()).init();
    
    let app = Router::new()
        .merge(auth::router());
    
    let addr = SocketAddr::from(([127,0,0,1], 9458));
    tracing::info!("Core API listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
