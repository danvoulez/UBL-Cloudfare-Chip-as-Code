//! WASM bindings para tdln-core

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;
use crate::{DecisionContext, TdlnEngine};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct WasmTdlnEngine {
    engine: TdlnEngine,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl WasmTdlnEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            engine: TdlnEngine::new(),
        }
    }

    #[wasm_bindgen]
    pub fn evaluate(&self, ctx_json: &str) -> String {
        let ctx: DecisionContext = serde_json::from_str(ctx_json)
            .unwrap_or_else(|_| DecisionContext {
                user_email: None,
                user_groups: vec![],
                path: "/".to_string(),
                method: "GET".to_string(),
                has_passkey: false,
                break_glass_active: false,
                break_glass_until: None,
            });
        
        let decision = self.engine.evaluate(&ctx);
        serde_json::to_string(&decision).unwrap_or_else(|_| "{}".to_string())
    }
}
