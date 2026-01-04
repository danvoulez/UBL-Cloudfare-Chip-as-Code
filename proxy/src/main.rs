//! UBL Policy Proxy — Rust (axum) com tdln-core nativo

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use prometheus::{Encoder, TextEncoder, Registry};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tdln_core::{DecisionContext, TdlnEngine};

#[derive(Clone)]
struct AppState {
    engine: Arc<TdlnEngine>,
    break_glass: Arc<RwLock<BreakGlassState>>,
    ledger: Arc<RwLock<Vec<LedgerEntry>>>,
    metrics: Arc<Registry>,
    public_key: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BreakGlassState {
    active: bool,
    reason: String,
    until: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LedgerEntry {
    timestamp: u64,
    user_email: Option<String>,
    path: String,
    method: String,
    decision: bool,
    reason: String,
    eval_ms: f64,
    bits: u8,
}

#[derive(Debug, Deserialize)]
struct BreakGlassRequest {
    active: bool,
    reason: String,
    ttl_seconds: Option<u64>,
}

#[derive(Debug, Serialize)]
struct DecisionResponse {
    allow: bool,
    reason: String,
    bits: u8,
    eval_ms: f64,
}

// Métricas Prometheus
lazy_static::lazy_static! {
    static ref DECISION_COUNTER: prometheus::IntCounterVec = prometheus::register_int_counter_vec!(
        "policy_decisions_total",
        "Total policy decisions",
        &["decision"]
    ).unwrap();
    
    static ref EVAL_HISTOGRAM: prometheus::HistogramVec = prometheus::register_histogram_vec!(
        "policy_eval_seconds",
        "Policy evaluation time",
        &["path"]
    ).unwrap();
    
    static ref BREAKGLASS_GAUGE: prometheus::IntGauge = prometheus::register_int_gauge!(
        "breakglass_active",
        "Break-glass active state"
    ).unwrap();
}

async fn handle_request(
    State(state): State<AppState>,
    headers: HeaderMap,
    method: axum::http::Method,
    path: String,
) -> Result<Json<DecisionResponse>, StatusCode> {
    // Verificar política assinada (em produção: ler do R2/KV)
    // Por ora, assumir válida
    
    // Obter break-glass state
    let bg = state.break_glass.read().await;
    let bg_active = bg.active && bg.until.map_or(true, |until| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() < until
    });
    
    // Extrair user info do header (em produção: verificar JWT)
    let user_email = headers.get("x-user-email")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());
    let user_groups: Vec<String> = headers
        .get("x-user-groups")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.split(',').map(|g| g.to_string()).collect())
        .unwrap_or_default();
    
    // Avaliar decisão
    let ctx = DecisionContext {
        user_email,
        user_groups,
        path: path.clone(),
        method: method.to_string(),
        has_passkey: false, // TODO: verificar passkey
        break_glass_active: bg_active,
        break_glass_until: bg.until,
    };
    
    let decision = state.engine.evaluate(&ctx);
    
    // Registrar métricas
    DECISION_COUNTER
        .with_label_values(&[if decision.allow { "allow" } else { "deny" }])
        .inc();
    EVAL_HISTOGRAM
        .with_label_values(&[&path])
        .observe(decision.eval_ms / 1000.0);
    
    // Gravar no ledger
    let entry = LedgerEntry {
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        user_email: ctx.user_email,
        path: ctx.path,
        method: ctx.method,
        decision: decision.allow,
        reason: decision.reason.clone(),
        eval_ms: decision.eval_ms,
        bits: decision.bits,
    };
    
    {
        let mut ledger = state.ledger.write().await;
        ledger.push(entry);
        
        // Rotação: manter últimas 1000 entradas
        if ledger.len() > 1000 {
            ledger.drain(..ledger.len() - 1000);
        }
    }
    
    Ok(Json(DecisionResponse {
        allow: decision.allow,
        reason: decision.reason,
        bits: decision.bits,
        eval_ms: decision.eval_ms,
    }))
}

async fn handle_breakglass(
    State(state): State<AppState>,
    Json(req): Json<BreakGlassRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut bg = state.break_glass.write().await;
    
    bg.active = req.active;
    bg.reason = req.reason;
    bg.until = req.active.then(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() + req.ttl_seconds.unwrap_or(120)
    });
    
    BREAKGLASS_GAUGE.set(if bg.active { 1 } else { 0 });
    
    Ok(Json(serde_json::json!({ "success": true })))
}

async fn handle_breakglass_get(
    State(state): State<AppState>,
) -> Json<BreakGlassState> {
    Json(state.break_glass.read().await.clone())
}

async fn handle_metrics(State(state): State<AppState>) -> String {
    let encoder = TextEncoder::new();
    let metric_families = state.metrics.gather();
    encoder.encode_to_string(&metric_families).unwrap()
}

async fn handle_ledger(State(state): State<AppState>) -> Json<Vec<LedgerEntry>> {
    Json(state.ledger.read().await.clone())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    
    // Inicializar engine
    let engine = Arc::new(TdlnEngine::new());
    
    // Estado break-glass
    let break_glass = Arc::new(RwLock::new(BreakGlassState {
        active: false,
        reason: String::new(),
        until: None,
    }));
    
    // Ledger local
    let ledger = Arc::new(RwLock::new(Vec::<LedgerEntry>::new()));
    
    // Métricas
    let registry = Arc::new(Registry::new());
    registry.register(Box::new(DECISION_COUNTER.clone()))?;
    registry.register(Box::new(EVAL_HISTOGRAM.clone()))?;
    registry.register(Box::new(BREAKGLASS_GAUGE.clone()))?;
    
    // Public key (em produção: ler de env/secret)
    let public_key = std::env::var("PUBLIC_KEY")
        .unwrap_or_default()
        .as_bytes()
        .to_vec();
    
    let state = AppState {
        engine,
        break_glass,
        ledger,
        metrics: registry,
        public_key,
    };
    
    // Router
    let app = Router::new()
        .route("/evaluate/*path", axum::routing::MethodRouter::new()
            .get(handle_request)
            .post(handle_request)
            .put(handle_request)
            .delete(handle_request))
        .route("/breakglass", post(handle_breakglass).get(handle_breakglass_get))
        .route("/metrics", get(handle_metrics))
        .route("/ledger", get(handle_ledger))
        .with_state(state);
    
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    tracing::info!("🚀 Proxy listening on :8080");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}
