use axum::{
    extract::ws::{Message, WebSocketUpgrade},
    response::IntoResponse,
};
use serde_json::Value;
use tracing::{info, warn};
use uuid::Uuid;

use super::router;
use super::types::*;
use super::session::*;

pub async fn ws_upgrade(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        let session = std::sync::Arc::new(tokio::sync::Mutex::new(
            Session::new(Uuid::new_v4().to_string()),
        ));
        if let Err(e) = loop_ws(socket, session).await {
            warn!(err = ?e, "mcp loop ended");
        }
    })
}

async fn loop_ws(mut sock: axum::extract::ws::WebSocket, session: SharedSession) -> anyhow::Result<()> {
    while let Some(msg) = sock.recv().await {
        if let Message::Text(t) = msg? {
            // server-blind: não logar payload
            let req: Result<JsonRpcReq, _> = serde_json::from_str(&t);
            let resp = match req {
                Ok(r) => router::handle(r, session.clone()).await,
                Err(_) => router::err(Value::Null, router::McpErr::InvalidParams),
            };
            let out = serde_json::to_string(&resp).unwrap();
            sock.send(Message::Text(out)).await?;
        }
    }
    Ok(())
}
