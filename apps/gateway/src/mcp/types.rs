use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct JsonRpcReq {
    pub jsonrpc: String,
    pub id: Value,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcResp {
    pub jsonrpc: &'static str,
    pub id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcErr>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcErr {
    pub code: i32,
    pub message: String,
    pub data: ErrData,
}

#[derive(Debug, Serialize)]
pub struct ErrData {
    pub token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after_ms: Option<u64>,
    pub remediation: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Scope {
    pub tenant: String,
    #[serde(default)]
    pub entity: Option<String>,
    #[serde(default)]
    pub room: Option<String>,
    #[serde(default)]
    pub container: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct McpMeta {
    pub client_id: String,
    pub op_id: String,
    pub session_type: String,
    pub mode: String,
    pub scope: Scope,
}
