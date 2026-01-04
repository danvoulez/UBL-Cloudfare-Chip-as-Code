//! Blueprint 15 — JSON✯Atomic Canonicalizer (Rust)
//! Ensures deterministic order: id, ts, kind, scope, actor, refs, data, meta, sig

use serde::{Deserialize, Serialize};
use serde_json::{Value, Map};

// Canonicalize: ensures deterministic order (id, ts, kind, scope, actor, refs, data, meta, sig)
pub fn canonicalize(value: &Value) -> Value {
    fn inner(v: &Value) -> Value {
        match v {
            Value::Object(m) => {
                let order = ["id", "ts", "kind", "scope", "actor", "refs", "data", "meta", "sig"];
                let mut out = Map::new();
                // Add ordered keys first
                for k in order {
                    if let Some(val) = m.get(k) {
                        out.insert(k.to_string(), inner(val));
                    }
                }
                // Add rest in sorted order
                let mut rest: Vec<_> = m.keys()
                    .filter(|k| !order.contains(&k.as_str()))
                    .cloned()
                    .collect();
                rest.sort_unstable();
                for k in rest {
                    if let Some(val) = m.get(&k) {
                        out.insert(k, inner(val));
                    }
                }
                Value::Object(out)
            }
            Value::Array(a) => Value::Array(a.iter().map(inner).collect()),
            _ => v.clone()
        }
    }
    inner(value)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Atomic {
    pub id: String,
    pub ts: String, // ISO-8601
    pub kind: String,
    pub scope: Scope,
    pub actor: String, // Can be string or object, simplified for now
    pub refs: Vec<String>, // Array of strings
    pub data: Value, // JSON object
    pub meta: Value, // JSON object
    pub sig: Option<Signature>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Scope {
    pub tenant: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub container: Option<String>,
}


#[derive(Debug, Serialize, Deserialize)]
pub struct Signature {
    pub value: String, // base64 Ed25519
    pub kid: String,
    pub alg: String, // "Ed25519"
}

impl Atomic {
    /// Canonicalize: serialize in deterministic order
    pub fn to_canonical_bytes(&self) -> anyhow::Result<Vec<u8>> {
        let json = serde_json::to_value(self)?;
        let canon = canonicalize(&json);
        Ok(serde_json::to_vec(&canon)?)
    }
    
    /// Generate BLAKE3 hash of canonical bytes
    pub fn hash(&self) -> anyhow::Result<String> {
        let bytes = self.to_canonical_bytes()?;
        let hash = blake3::hash(&bytes);
        Ok(hex::encode(hash.as_bytes()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_canonical_order() {
        let json = serde_json::json!({
            "id": "01JABC",
            "ts": "2026-01-03T14:22:01.123Z",
            "kind": "media.upload.presigned",
            "scope": { "tenant": "ubl" },
            "actor": "system",
            "refs": [],
            "data": {},
            "meta": {},
            "sig": null
        });
        
        let canon = canonicalize(&json);
        let bytes = serde_json::to_vec(&canon).unwrap();
        let parsed: Value = serde_json::from_slice(&bytes).unwrap();
        
        // Check order: id comes first
        let keys: Vec<&str> = parsed.as_object().unwrap().keys().collect();
        assert_eq!(keys[0], "id");
        assert_eq!(keys[1], "ts");
        assert_eq!(keys[2], "kind");
    }
}
