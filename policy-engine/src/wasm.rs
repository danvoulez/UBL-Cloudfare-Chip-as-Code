//! WASM bindings para policy-engine

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;
use crate::{SemanticChip, RequestContext, decide};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct WasmPolicyEngine {
    chip: SemanticChip,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl WasmPolicyEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(yaml_content: &str) -> Result<WasmPolicyEngine, JsValue> {
        let chip = SemanticChip::from_yaml(yaml_content)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse YAML: {}", e)))?;
        Ok(Self { chip })
    }

    #[wasm_bindgen]
    pub fn decide(&self, ctx_json: &str) -> Result<String, JsValue> {
        let ctx: RequestContext = serde_json::from_str(ctx_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse context: {}", e)))?;
        
        let decision = decide(&self.chip, &ctx);
        serde_json::to_string(&decision)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize decision: {}", e)))
    }
}
