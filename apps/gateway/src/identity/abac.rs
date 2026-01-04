//! ABAC (Attribute-Based Access Control) evaluation
//! Order: deny explicit > allow specific > allow generic > deny default

use serde::{Deserialize, Serialize};
use crate::identity::TokenScope;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbacContext {
    pub tenant: String,
    pub roles: Vec<String>,
    pub session_type: String,
    pub requested_scope: TokenScope,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AbacDecision {
    Deny { reason: String },
    Allow { reduced_scope: TokenScope },
}

pub fn evaluate_abac(ctx: &AbacContext) -> AbacDecision {
    // 1. Deny explicit
    if ctx.requested_scope.tenant != ctx.tenant {
        return AbacDecision::Deny {
            reason: "tenant mismatch".into(),
        };
    }

    // 2. Allow specific (admin paths)
    if ctx.roles.contains(&"admin".to_string()) {
        // Admin can request any scope within tenant
        return AbacDecision::Allow {
            reduced_scope: ctx.requested_scope.clone(),
        };
    }

    // 3. Allow generic (reduce scope to safe defaults)
    let mut reduced = ctx.requested_scope.clone();
    
    // Never allow tools="*" in production
    if let Some(ref tools) = reduced.tools {
        if tools.iter().any(|t| t == "*") {
            reduced.tools = Some(vec![]); // Empty = deny all tools
        }
    }

    // 4. Deny default (if scope too broad)
    if reduced.tools.is_none() || reduced.tools.as_ref().unwrap().is_empty() {
        return AbacDecision::Deny {
            reason: "no tools authorized".into(),
        };
    }

    AbacDecision::Allow { reduced_scope: reduced }
}
