//! Storage abstraction for identities, WebAuthn credentials, and session binds
//! Supports D1 (Cloudflare) or Postgres

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subject {
    pub id: String, // user:{uuid} | agent:{uuid}
    pub email: Option<String>,
    pub tenant: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebAuthnCredential {
    pub id: String,
    pub subject_id: String,
    pub credential_id: Vec<u8>,
    pub public_key: Vec<u8>,
    pub counter: u32,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub sid: String,
    pub subject_id: String,
    pub fingerprint: String, // UA + IP prefix
    pub expires_at: i64,
    pub csrf_token: String,
}

#[async_trait::async_trait]
pub trait IdentityStore: Send + Sync {
    async fn get_subject_by_email(&self, email: &str) -> anyhow::Result<Option<Subject>>;
    async fn create_subject(&self, email: Option<String>, tenant: String) -> anyhow::Result<Subject>;
    async fn get_webauthn_credential(&self, credential_id: &[u8]) -> anyhow::Result<Option<WebAuthnCredential>>;
    async fn save_webauthn_credential(&self, cred: WebAuthnCredential) -> anyhow::Result<()>;
    async fn get_session(&self, sid: &str) -> anyhow::Result<Option<Session>>;
    async fn save_session(&self, session: Session) -> anyhow::Result<()>;
    async fn delete_session(&self, sid: &str) -> anyhow::Result<()>;
}

// In-memory implementation for testing
pub struct MemoryIdentityStore {
    subjects: std::sync::Arc<tokio::sync::RwLock<std::collections::HashMap<String, Subject>>>,
    credentials: std::sync::Arc<tokio::sync::RwLock<std::collections::HashMap<Vec<u8>, WebAuthnCredential>>>,
    sessions: std::sync::Arc<tokio::sync::RwLock<std::collections::HashMap<String, Session>>>,
}

impl MemoryIdentityStore {
    pub fn new() -> Self {
        Self {
            subjects: Default::default(),
            credentials: Default::default(),
            sessions: Default::default(),
        }
    }
}

#[async_trait::async_trait]
impl IdentityStore for MemoryIdentityStore {
    async fn get_subject_by_email(&self, email: &str) -> anyhow::Result<Option<Subject>> {
        let subjects = self.subjects.read().await;
        Ok(subjects.values().find(|s| s.email.as_ref() == Some(&email.to_string())).cloned())
    }

    async fn create_subject(&self, email: Option<String>, tenant: String) -> anyhow::Result<Subject> {
        let id = format!("user:{}", Uuid::new_v4());
        let subject = Subject {
            id: id.clone(),
            email,
            tenant,
            created_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_secs() as i64,
        };
        self.subjects.write().await.insert(id, subject.clone());
        Ok(subject)
    }

    async fn get_webauthn_credential(&self, credential_id: &[u8]) -> anyhow::Result<Option<WebAuthnCredential>> {
        let creds = self.credentials.read().await;
        Ok(creds.get(credential_id).cloned())
    }

    async fn save_webauthn_credential(&self, cred: WebAuthnCredential) -> anyhow::Result<()> {
        self.credentials.write().await.insert(cred.credential_id.clone(), cred);
        Ok(())
    }

    async fn get_session(&self, sid: &str) -> anyhow::Result<Option<Session>> {
        let sessions = self.sessions.read().await;
        Ok(sessions.get(sid).cloned())
    }

    async fn save_session(&self, session: Session) -> anyhow::Result<()> {
        self.sessions.write().await.insert(session.sid.clone(), session);
        Ok(())
    }

    async fn delete_session(&self, sid: &str) -> anyhow::Result<()> {
        self.sessions.write().await.remove(sid);
        Ok(())
    }
}
