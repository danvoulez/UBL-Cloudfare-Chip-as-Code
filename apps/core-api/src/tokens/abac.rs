//! ABAC evaluation (simplified)
//! Carrega policy do D1 e avalia regras

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize, Serialize)]
pub struct AbacPolicy {
    pub version: i32,
    pub rules: Vec<AbacRule>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AbacRule {
    pub effect: String, // "allow" | "deny"
    pub when: Value,    // condições (group, tag:*, etc)
    pub action: String, // "*" | "read" | "call:provider" | etc
    pub resource: String, // "*" | "office.*" | "lab.*" | "openai.*"
}

#[derive(Debug, Clone)]
pub struct AbacContext {
    pub user_id: String,
    pub groups: Vec<String>,
    pub tags: Value,
}

pub fn evaluate_abac(
    policy: &AbacPolicy,
    ctx: &AbacContext,
    action: &str,
    resource: &str,
) -> bool {
    // Ordem: deny explícito > allow específico > allow genérico > deny default
    let mut explicit_deny = false;
    let mut explicit_allow = false;

    for rule in &policy.rules {
        // Match action/resource
        let action_match = rule.action == "*" || rule.action == action;
        let resource_match = rule.resource == "*" || resource.starts_with(&rule.resource.replace("*", ""));

        if !action_match || !resource_match {
            continue;
        }

        // Avaliar condições "when"
        let condition_ok = evaluate_when(&rule.when, ctx);

        if condition_ok {
            if rule.effect == "deny" {
                explicit_deny = true;
            } else if rule.effect == "allow" {
                explicit_allow = true;
            }
        }
    }

    // Precedência: deny explícito vence
    if explicit_deny {
        return false;
    }
    if explicit_allow {
        return true;
    }

    // Default: deny
    false
}

fn evaluate_when(when: &Value, ctx: &AbacContext) -> bool {
    if let Some(obj) = when.as_object() {
        for (key, value) in obj {
            match key.as_str() {
                "group" => {
                    if let Some(group) = value.as_str() {
                        if !ctx.groups.contains(&group.to_string()) {
                            return false;
                        }
                    }
                }
                k if k.starts_with("tag:") => {
                    let tag_key = k.strip_prefix("tag:").unwrap();
                    if let Some(tag_value) = ctx.tags.get(tag_key) {
                        if tag_value != value {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                _ => {}
            }
        }
        true
    } else {
        // when vazio = sempre true
        true
    }
}
