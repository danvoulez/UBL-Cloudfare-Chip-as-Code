use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

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
pub struct OutputDefinition(pub std::collections::BTreeMap<String, OutputAction>);

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Decision {
    pub decision: String,
    pub why: String,
    pub trigger: String,
    pub chain: Vec<String>,
}

static CHIP: OnceCell<SemanticChip> = OnceCell::new();
static mut LAST_LEN: usize = 0;

fn bit_eval(id: &str, ctx: &RequestContext) -> bool {
    match id {
        "P_Transport_Secure" => ctx.transport.tls_version >= 1.3,
        "P_Device_Identity"  => ctx.mtls.verified && (ctx.mtls.issuer == "Cloudflare Edge" || ctx.mtls.issuer == "UBL Local CA"),
        "P_User_Passkey"     => (ctx.auth.method == "access-passkey" || ctx.auth.method == "webauthn") && ctx.auth.rp_id == "app.ubl.agency",
        "P_Role_Admin"       => ctx.user.groups.iter().any(|g| g == "ubl-ops"),
        "P_Circuit_Breaker"  => ctx.system.panic_mode,
        _ => false,
    }
}

fn find_wire<'a>(chip: &'a SemanticChip, id: &str) -> Option<&'a WiringDefinition> {
    chip.wiring.iter().find(|w| w.id == id)
}

fn eval_wire_rec(chip: &SemanticChip, id: &str, ctx: &RequestContext, chain: &mut Vec<String>) -> bool {
    chain.push(id.to_string());
    let w = match find_wire(chip, id) { Some(w) => w, None => return false };
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

fn decide_internal(chip: &SemanticChip, ctx: &RequestContext) -> Decision {
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

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(len);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    unsafe { let _ = Vec::from_raw_parts(ptr, len, len); }
}

#[no_mangle]
pub extern "C" fn result_len() -> usize { unsafe { LAST_LEN } }

#[no_mangle]
pub extern "C" fn init_policy(ptr: *mut u8, len: usize) -> i32 {
    let slice = unsafe { core::slice::from_raw_parts(ptr, len) };
    let yaml = match std::str::from_utf8(slice) { Ok(s) => s, Err(_) => return -1 };
    match serde_yaml::from_str::<SemanticChip>(yaml) {
        Ok(chip) => {
            let _ = CHIP.set(chip);
            0
        },
        Err(_) => -2
    }
}

#[no_mangle]
pub extern "C" fn decide_json(ptr: *mut u8, len: usize) -> *mut u8 {
    let slice = unsafe { core::slice::from_raw_parts(ptr, len) };
    let s = match std::str::from_utf8(slice) { Ok(v) => v, Err(_) => { unsafe { LAST_LEN = 0 }; return 0 as *mut u8; } };
    let ctx: RequestContext = match serde_json::from_str(s) { Ok(v) => v, Err(_) => { unsafe { LAST_LEN = 0 }; return 0 as *mut u8; } };
    let chip = match CHIP.get() { Some(c) => c, None => { unsafe { LAST_LEN = 0 }; return 0 as *mut u8; } };
    let dec = decide_internal(chip, &ctx);
    let out = serde_json::to_string(&dec).unwrap_or("{"decision":"deny_invalid_access","why":"serde_error","trigger":"none","chain":[]}".to_string());
    let bytes = out.as_bytes();
    let out_ptr = alloc(bytes.len());
    unsafe { core::ptr::copy_nonoverlapping(bytes.as_ptr(), out_ptr, bytes.len()); }
    unsafe { LAST_LEN = bytes.len(); }
    out_ptr
}
