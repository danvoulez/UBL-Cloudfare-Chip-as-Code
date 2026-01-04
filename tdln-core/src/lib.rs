//! TDLN Core — Motor de decisão unificado (WASM + nativo)
//! Fonte única de verdade para políticas UBL Flagship

#[cfg(target_arch = "wasm32")]
mod wasm;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Bit de política TDLN
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum PolicyBit {
    /// Usuário tem passkey válida
    PUserPasskey = 0x01,
    /// Usuário é admin (grupo ubl-ops)
    PRoleAdmin = 0x02,
    /// Circuit breaker ativo (break-glass)
    PCircuitBreaker = 0x04,
}

/// Contexto de decisão
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionContext {
    pub user_email: Option<String>,
    pub user_groups: Vec<String>,
    pub path: String,
    pub method: String,
    pub has_passkey: bool,
    pub break_glass_active: bool,
    pub break_glass_until: Option<u64>, // Unix timestamp
}

/// Resultado da decisão
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Decision {
    pub allow: bool,
    pub reason: String,
    pub bits: u8,
    pub eval_ms: f64,
}

/// Motor de decisão TDLN
pub struct TdlnEngine {
    policy_bits: HashMap<String, u8>,
}

impl TdlnEngine {
    pub fn new() -> Self {
        let mut policy_bits = HashMap::new();
        
        // Mapeia paths para bits de política
        policy_bits.insert("/admin/*".to_string(), PolicyBit::PRoleAdmin as u8);
        policy_bits.insert("/api/*".to_string(), PolicyBit::PUserPasskey as u8);
        
        Self { policy_bits }
    }

    /// Avalia decisão baseada no contexto
    pub fn evaluate(&self, ctx: &DecisionContext) -> Decision {
        let start = std::time::Instant::now();
        
        let mut bits: u8 = 0;
        let mut allow = false;
        let mut reason = String::new();

        // Break-glass tem precedência absoluta
        if ctx.break_glass_active {
            if let Some(until) = ctx.break_glass_until {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                
                if now < until {
                    bits |= PolicyBit::PCircuitBreaker as u8;
                    allow = true;
                    reason = format!("break-glass active until {}", until);
                } else {
                    reason = "break-glass expired".to_string();
                }
            } else {
                bits |= PolicyBit::PCircuitBreaker as u8;
                allow = true;
                reason = "break-glass active (no TTL)".to_string();
            }
        } else {
            // Lógica normal de decisão
            if ctx.path.starts_with("/admin/") {
                // Admin requer grupo ubl-ops OU break-glass
                if ctx.user_groups.contains(&"ubl-ops".to_string()) {
                    bits |= PolicyBit::PRoleAdmin as u8;
                    allow = true;
                    reason = "admin group membership".to_string();
                } else {
                    allow = false;
                    reason = "admin path requires ubl-ops group".to_string();
                }
            } else if ctx.path.starts_with("/api/") {
                // API requer passkey OU break-glass
                if ctx.has_passkey {
                    bits |= PolicyBit::PUserPasskey as u8;
                    allow = true;
                    reason = "valid passkey".to_string();
                } else {
                    allow = false;
                    reason = "api path requires passkey".to_string();
                }
            } else {
                // Paths públicos permitidos
                allow = true;
                reason = "public path".to_string();
            }
        }

        let eval_ms = start.elapsed().as_secs_f64() * 1000.0;

        Decision {
            allow,
            reason,
            bits,
            eval_ms,
        }
    }

    /// Valida assinatura do pack.json
    pub fn verify_pack_signature(
        pack_hash: &str,
        signature: &str,
        public_key: &[u8],
    ) -> Result<bool, String> {
        use ed25519_dalek::{Signature, VerifyingKey};
        use base64::{engine::general_purpose, Engine as _};

        let sig_bytes = general_purpose::STANDARD
            .decode(signature)
            .map_err(|e| format!("invalid signature base64: {}", e))?;

        let sig = Signature::from_bytes(&sig_bytes.try_into().map_err(|_| "invalid signature length")?);
        let pubkey = VerifyingKey::from_bytes(public_key.try_into().map_err(|_| "invalid public key length")?);

        let hash_bytes = pack_hash.as_bytes();
        pubkey.verify_strict(hash_bytes, &sig)
            .map(|_| true)
            .map_err(|e| format!("signature verification failed: {}", e))
    }

    /// Calcula BLAKE3 hash de um YAML
    pub fn compute_blake3_hash(yaml_content: &str) -> String {
        use blake3;
        let hash = blake3::hash(yaml_content.as_bytes());
        hex::encode(hash.as_bytes())
    }
}

impl Default for TdlnEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_admin_deny_without_group() {
        let engine = TdlnEngine::new();
        let ctx = DecisionContext {
            user_email: Some("user@example.com".to_string()),
            user_groups: vec![],
            path: "/admin/users".to_string(),
            method: "GET".to_string(),
            has_passkey: false,
            break_glass_active: false,
            break_glass_until: None,
        };
        let decision = engine.evaluate(&ctx);
        assert!(!decision.allow);
        assert!(decision.reason.contains("ubl-ops"));
    }

    #[test]
    fn test_admin_allow_with_group() {
        let engine = TdlnEngine::new();
        let ctx = DecisionContext {
            user_email: Some("admin@example.com".to_string()),
            user_groups: vec!["ubl-ops".to_string()],
            path: "/admin/users".to_string(),
            method: "GET".to_string(),
            has_passkey: false,
            break_glass_active: false,
            break_glass_until: None,
        };
        let decision = engine.evaluate(&ctx);
        assert!(decision.allow);
        assert_eq!(decision.bits & PolicyBit::PRoleAdmin as u8, PolicyBit::PRoleAdmin as u8);
    }

    #[test]
    fn test_break_glass_override() {
        let engine = TdlnEngine::new();
        let ctx = DecisionContext {
            user_email: Some("user@example.com".to_string()),
            user_groups: vec![],
            path: "/admin/users".to_string(),
            method: "GET".to_string(),
            has_passkey: false,
            break_glass_active: true,
            break_glass_until: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() + 120),
        };
        let decision = engine.evaluate(&ctx);
        assert!(decision.allow);
        assert_eq!(decision.bits & PolicyBit::PCircuitBreaker as u8, PolicyBit::PCircuitBreaker as u8);
    }
}
