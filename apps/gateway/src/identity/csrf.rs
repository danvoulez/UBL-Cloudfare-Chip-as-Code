//! CSRF token generation and validation

use uuid::Uuid;
use base64::{engine::general_purpose, Engine as _};

pub fn generate_csrf_token() -> String {
    let bytes = Uuid::new_v4().as_bytes();
    general_purpose::STANDARD.encode(bytes)
}

pub fn validate_csrf_token(token: &str, session_csrf: &str) -> bool {
    token == session_csrf
}
