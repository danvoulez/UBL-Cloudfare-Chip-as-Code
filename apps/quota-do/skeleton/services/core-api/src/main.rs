
use axum::{routing::{get, post}, Router, extract::{Path, Query}, Json};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr};
use tracing::{info, Level};

#[derive(Serialize, Deserialize, Clone, Debug)]
struct PlanInfo {
    plan_id: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct UsageRow {
    day: String,
    meter: String,
    qty: i64,
}

#[derive(Deserialize)]
struct Range {
    from: Option<String>,
    to: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let app = Router::new()
        .route("/_ping", get(ping))
        .route("/billing/me/plan", get(me_plan))
        .route("/billing/me/usage/daily", get(me_usage_daily))
        .route("/admin/billing/tenants/:tenant_id/usage/daily", get(admin_usage_daily))
        .route("/admin/billing/tenants/:tenant_id/plan", post(admin_set_plan));

    let addr: SocketAddr = "127.0.0.1:8088".parse()?;
    info!("Core API listening on http://{}", addr);
    axum::Server::bind(&addr).serve(app.into_make_service()).await?;
    Ok(())
}

async fn ping() -> &'static str { "ok" }

async fn me_plan() -> Json<PlanInfo> {
    Json(PlanInfo { plan_id: "pro".into() })
}

async fn me_usage_daily(Query(_q): Query<Range>) -> Json<Vec<UsageRow>> {
    Json(vec![])
}

async fn admin_usage_daily(Path(_tenant_id): Path<String>, Query(_q): Query<Range>) -> Json<Vec<UsageRow>> {
    Json(vec![UsageRow { day: "20260104".into(), meter: "tool_call".into(), qty: 42 }])
}

#[derive(Deserialize)]
struct SetPlanReq { plan_id: String }

async fn admin_set_plan(Path(tenant_id): Path<String>, Json(req): Json<SetPlanReq>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "ok": true,
        "tenant": tenant_id,
        "plan_id": req.plan_id
    }))
}
