use crate::mcp::types::*;
use crate::mcp::session::*;
use serde_json::json;
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum McpErr {
    #[error("INVALID_PARAMS")]
    InvalidParams,
    #[error("FORBIDDEN")]
    Forbidden,
    #[error("RATE_LIMIT")]
    RateLimit { retry_after_ms: u64 },
    #[error("CONFLICT")]
    Conflict,
    #[error("BACKPRESSURE")]
    Backpressure { retry_after_ms: u64 },
    #[error("INTERNAL")]
    Internal,
}

pub fn err(id: Value, e: McpErr) -> JsonRpcResp {
    let (code, token, retry, remediation) = match e {
        McpErr::InvalidParams => (-32602, "INVALID_PARAMS", None, vec!["Fix params schema".into()]),
        McpErr::Forbidden => (-32003, "FORBIDDEN", None, vec!["Request proper scope".into()]),
        McpErr::RateLimit { retry_after_ms } => (-32004, "RATE_LIMIT", Some(retry_after_ms), vec!["Slow down".into(), "Retry later".into()]),
        McpErr::Conflict => (-32009, "CONFLICT", None, vec!["Use a new op_id".into()]),
        McpErr::Backpressure { retry_after_ms } => (-32097, "BACKPRESSURE", Some(retry_after_ms), vec!["Back off".into()]),
        McpErr::Internal => (-32098, "INTERNAL", None, vec!["Retry later".into()]),
    };
    JsonRpcResp {
        jsonrpc: "2.0",
        id,
        result: None,
        error: Some(JsonRpcErr {
            code,
            message: token.into(),
            data: ErrData {
                token: token.into(),
                retry_after_ms: retry,
                remediation,
            },
        }),
    }
}

fn abac_ok(meta: &McpMeta) -> bool {
    !meta.scope.tenant.is_empty()
}

pub async fn handle(req: JsonRpcReq, session: SharedSession) -> JsonRpcResp {
    let id = req.id.clone();
    let out = match req.method.as_str() {
        "ping" => Ok(json!({"ok": true})),
        "tools/list" => tools_list(req.params, session.clone()).await,
        "session.brief.get" => brief_get(session.clone()).await,
        "session.brief.set" => brief_set(req.params, session.clone()).await,
        "tool/call" => tool_call(req.params, session.clone()).await,
        _ => Err(McpErr::InvalidParams),
    };
    match out {
        Ok(v) => JsonRpcResp {
            jsonrpc: "2.0",
            id,
            result: Some(v),
            error: None,
        },
        Err(e) => err(id, e),
    }
}

async fn tools_list(params: Value, _s: SharedSession) -> Result<Value, McpErr> {
    let meta: McpMeta = serde_json::from_value(
        params.get("meta").cloned().unwrap_or(Value::Null)
    ).map_err(|_| McpErr::InvalidParams)?;
    if !abac_ok(&meta) {
        return Err(McpErr::Forbidden);
    }
    let tools = [
        "ubl@v1.append_link",
        "ubl@v1.append_event",
        "messenger@v1.send",
        "media@v1.presign",
        "media@v1.commit",
        "media@v1.get_link",
        "stream@v1.prepare",
        "stream@v1.go_live",
        "stream@v1.end",
        "stream@v1.tokens.refresh",
        "stream@v1.snapshot",
        "office@v1.log",
    ];
    Ok(json!({"tools": tools}))
}

async fn brief_get(s: SharedSession) -> Result<Value, McpErr> {
    let g = s.lock().await;
    Ok(serde_json::to_value(&g.brief).map_err(|_| McpErr::Internal)?)
}

async fn brief_set(params: Value, s: SharedSession) -> Result<Value, McpErr> {
    let meta: McpMeta = serde_json::from_value(
        params.get("meta").cloned().unwrap_or(Value::Null)
    ).map_err(|_| McpErr::InvalidParams)?;
    let mut brief: crate::mcp::session::Brief = serde_json::from_value(
        params.get("brief").cloned().unwrap_or(Value::Null)
    ).map_err(|_| McpErr::InvalidParams)?;
    if let Some(t) = &brief.tenant {
        if *t != meta.scope.tenant {
            return Err(McpErr::Forbidden);
        }
    }
    if brief.refs.len() > 100 {
        brief.refs.truncate(100);
    }
    let mut g = s.lock().await;
    g.brief = brief;
    Ok(json!({"ok": true}))
}

async fn tool_call(params: Value, s: SharedSession) -> Result<Value, McpErr> {
    let meta: McpMeta = serde_json::from_value(
        params.get("meta").cloned().unwrap_or(Value::Null)
    ).map_err(|_| McpErr::InvalidParams)?;
    let tool_str = params.get("tool").and_then(|v| v.as_str()).ok_or_else(|| McpErr::InvalidParams)?;
    let args = params.get("args").cloned().unwrap_or(Value::Null);
    if !abac_ok(&meta) {
        return Err(McpErr::Forbidden);
    }
    let key = Session::key(&meta.client_id, &meta.op_id);
    {
        if let Some(cached) = s.lock().await.idempo.get(&key).await {
            return Ok(json!({"ok": true, "cached": true, "result": cached}));
        }
    }
    
    // DRY: Dispatch to internal Media API or stub
    let res = match tool_str {
        "media@v1.presign" | "media@v1.commit" | "media@v1.get_link" |
        "stream@v1.prepare" | "stream@v1.go_live" | "stream@v1.end" |
        "stream@v1.tokens.refresh" | "stream@v1.snapshot" => {
            // TODO: Call internal Media API endpoint
            // For now: stub response
            json!({"ok": true, "tool": tool_str, "stub": true})
        }
        _ => {
            // Fallback: echo for other tools
            json!({"echo_tool": tool_str, "echo_args": args})
        }
    };
    
    {
        s.lock().await.idempo.insert(key, res.clone()).await;
    }
    Ok(json!({"ok": true, "cached": false, "result": res}))
}
