#[cfg(target_arch = "wasm32")]
mod wasm;

use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::collections::{BTreeMap};

#[derive(Debug, Deserialize, Clone)]
pub struct PolicyBitDefinition {
    pub id: String,
    pub description: Option<String>,
    pub logic: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(untagged)]
pub enum WiringStructure {
    Sequence { sequence: Vec<String> },
    Parallel { parallel: ParallelConfig },
}

#[derive(Debug, Deserialize, Clone)]
pub struct ParallelConfig {
    pub policies: Vec<String>,
    pub aggregator: String, // ANY | ALL
}

#[derive(Debug, Deserialize, Clone)]
pub struct WiringDefinition {
    pub id: String,
    pub structure: WiringStructure,
}

#[derive(Debug, Deserialize, Clone)]
pub struct OutputAction {
    pub trigger: String,
    pub action: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct OutputDefinition(pub BTreeMap<String, OutputAction>);

#[derive(Debug, Deserialize, Clone)]
pub struct SemanticChip {
    pub version: String,
    pub policies: Vec<PolicyBitDefinition>,
    pub wiring: Vec<WiringDefinition>,
    pub outputs: Vec<OutputDefinition>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct RequestContext {
    pub transport: TransportCtx,
    pub mtls: MtlsCtx,
    pub auth: AuthCtx,
    pub user: UserCtx,
    pub system: SystemCtx,
    pub who: Option<String>,
    pub did: Option<String>,
    pub req_id: Option<String>,
    #[serde(default)]
    pub req: Option<ReqCtx>,
    #[serde(default)]
    pub rate: Option<RateCtx>,
    #[serde(default)]
    pub webhook: Option<WebhookCtx>,
    #[serde(default)]
    pub legacy_jwt: Option<LegacyJwtCtx>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TransportCtx { pub tls_version: f32 }
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MtlsCtx { pub verified: bool, pub issuer: String }
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AuthCtx { pub method: String, pub rp_id: String }
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct UserCtx { pub groups: Vec<String> }
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SystemCtx { pub panic_mode: bool }

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ReqCtx {
    pub path: Option<String>,
    pub method: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct RateCtx {
    pub ok: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct WebhookCtx {
    pub verified: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct LegacyJwtCtx {
    pub valid: Option<bool>,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Decision {
    pub decision: String,
    pub why: String,
    pub trigger: String,
    pub chain: Vec<String>,
}

impl SemanticChip {
    pub fn from_yaml(y: &str) -> Result<Self> {
        let c: SemanticChip = serde_yaml::from_str(y)?;
        Ok(c)
    }

    fn find_wire(&self, id: &str) -> Option<&WiringDefinition> {
        self.wiring.iter().find(|w| w.id == id)
    }
}

fn bit_eval(id: &str, ctx: &RequestContext) -> bool {
    match id {
        "P_Transport_Secure" => ctx.transport.tls_version >= 1.3,
        "P_Device_Identity"  => ctx.mtls.verified && (ctx.mtls.issuer == "Cloudflare Edge" || ctx.mtls.issuer == "UBL Local CA"),
        "P_User_Passkey"     => (ctx.auth.method == "access-passkey" || ctx.auth.method == "webauthn") && ctx.auth.rp_id == "app.ubl.agency",
        "P_Role_Admin"       => ctx.user.groups.iter().any(|g| g == "ubl-ops"),
        "P_Circuit_Breaker"  => ctx.system.panic_mode,
        "P_Is_Admin_Path"    => {
            if let Some(ref req) = ctx.req {
                if let Some(ref path) = req.path {
                    return path.starts_with("/admin/");
                }
            }
            false
        },
        "P_Rate_Bucket_OK"   => {
            if let Some(ref rate) = ctx.rate {
                return rate.ok.unwrap_or(false);
            }
            true  // Default: permitir se não especificado
        },
        "P_Webhook_Verified" => {
            if let Some(ref webhook) = ctx.webhook {
                return webhook.verified.unwrap_or(false);
            }
            false
        },
        "P_Legacy_JWT"       => {
            if let Some(ref jwt) = ctx.legacy_jwt {
                if !jwt.valid.unwrap_or(false) {
                    return false;
                }
                if let Some(expires) = jwt.expires_at {
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs() as i64;
                    return now < expires;
                }
                return false;
            }
            false
        },
        _ => false,
    }
}

fn eval_wire_rec(chip: &SemanticChip, id: &str, ctx: &RequestContext, chain: &mut Vec<String>) -> bool {
    chain.push(id.to_string());
    let w = match chip.find_wire(id) { Some(w) => w, None => return false };
    match &w.structure {
        WiringStructure::Sequence { sequence } => {
            for x in sequence {
                if x.starts_with("W_") {
                    if !eval_wire_rec(chip, x, ctx, chain) { return false; }
                } else if !bit_eval(x, ctx) {
                    return false;
                }
            }
            true
        }
        WiringStructure::Parallel { parallel } => {
            let vals: Vec<bool> = parallel.policies.iter().map(|p| bit_eval(p, ctx)).collect();
            match parallel.aggregator.as_str() {
                "ANY" => vals.iter().any(|v| *v),
                "ALL" => vals.iter().all(|v| *v),
                _ => false,
            }
        }
    }
}

pub fn decide(chip: &SemanticChip, ctx: &RequestContext) -> Decision {
    for out in &chip.outputs {
        for (name, act) in &out.0 {
            let mut chain = vec![];
            let fired = if act.trigger.starts_with("NOT(") {
                let inner = act.trigger.trim_start_matches("NOT(").trim_end_matches(")");
                !eval_wire_rec(chip, inner, ctx, &mut chain)
            } else {
                eval_wire_rec(chip, &act.trigger, ctx, &mut chain)
            };
            if fired {
                return Decision{ decision: name.clone(), why: act.action.clone(), trigger: act.trigger.clone(), chain };
            }
        }
    }
    Decision{ decision:"deny_invalid_access".into(), why:"default_deny".into(), trigger:"none".into(), chain: vec![] }
}
