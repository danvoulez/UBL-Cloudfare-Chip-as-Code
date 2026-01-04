//! JWKS endpoint: GET /auth/jwks.json
//! Serves ES256 (ECDSA P-256) public keys in JWK format
//! Core API is the source of truth; Edge/Worker caches

use axum::{routing::get, Router, response::Response};
use p256::PublicKey;
use p256::pkcs8::DecodePublicKey;
use p256::elliptic_curve::sec1::ToEncodedPoint;
use serde::Serialize;
use base64::{engine::general_purpose, Engine as _};

#[derive(Serialize)]
struct Jwk {
    kty: &'static str,
    crv: &'static str,
    alg: &'static str,
    #[serde(rename = "use")]
    use_: &'static str,
    kid: String,
    x: String,
    y: String,
}

#[derive(Serialize)]
struct Jwks {
    keys: Vec<Jwk>,
}

fn b64url(bytes: &[u8]) -> String {
    general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

async fn jwks_handler() -> Response {
    // Load public key from disk
    let key_path = std::env::var("JWT_ES256_PUB_PATH")
        .unwrap_or_else(|_| "/etc/ubl/keys/jwt_es256_pub.pem".to_string());
    
    let pem = match std::fs::read_to_string(&key_path) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(path = %key_path, error = ?e, "failed to read public key");
            return Response::builder()
                .status(500)
                .header("Content-Type", "application/json")
                .body(axum::body::Full::from(
                    serde_json::json!({"error": "jwks_unavailable"}).to_string()
                ))
                .unwrap();
        }
    };

    let pk = match PublicKey::from_public_key_pem(&pem) {
        Ok(k) => k,
        Err(e) => {
            tracing::error!(error = ?e, "failed to parse public key");
            return Response::builder()
                .status(500)
                .header("Content-Type", "application/json")
                .body(axum::body::Full::from(
                    serde_json::json!({"error": "jwks_invalid"}).to_string()
                ))
                .unwrap();
        }
    };

    // Extract x, y coordinates from uncompressed point
    let pt = pk.to_encoded_point(false); // uncompressed
    let (x, y) = match (pt.x(), pt.y()) {
        (Some(x), Some(y)) => (x.as_slice(), y.as_slice()),
        _ => {
            tracing::error!("missing coordinates in public key");
            return Response::builder()
                .status(500)
                .header("Content-Type", "application/json")
                .body(axum::body::Full::from(
                    serde_json::json!({"error": "jwks_invalid_coords"}).to_string()
                ))
                .unwrap();
        }
    };

    // Get kid from env or default
    let kid = std::env::var("JWT_KID").unwrap_or_else(|_| "jwt-v1".to_string());

    let jwks = Jwks {
        keys: vec![Jwk {
            kty: "EC",
            crv: "P-256",
            alg: "ES256",
            use_: "sig",
            kid,
            x: b64url(x),
            y: b64url(y),
        }],
    };

    let body = match serde_json::to_vec(&jwks) {
        Ok(b) => b,
        Err(e) => {
            tracing::error!(error = ?e, "failed to serialize JWKS");
            return Response::builder()
                .status(500)
                .header("Content-Type", "application/json")
                .body(axum::body::Full::from(
                    serde_json::json!({"error": "jwks_serialize_failed"}).to_string()
                ))
                .unwrap();
        }
    };

    // Generate ETag from body hash
    let etag = format!("W/\"{:x}\"", blake3::hash(&body));

    Response::builder()
        .header("Content-Type", "application/json")
        .header("Cache-Control", "public, max-age=300")
        .header("ETag", etag)
        .body(axum::body::Full::from(body))
        .unwrap()
}

pub fn router() -> Router {
    Router::new().route("/auth/jwks.json", get(jwks_handler))
}
