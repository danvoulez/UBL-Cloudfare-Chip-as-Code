use std::{sync::Arc, time::Duration};
use moka::future::Cache;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Brief {
    pub tenant: Option<String>,
    pub entity: Option<String>,
    pub room: Option<String>,
    pub stage: Option<String>,
    pub goal: Option<String>,
    #[serde(default)]
    pub refs: Vec<String>,
}

pub struct Session {
    pub id: String,
    pub brief: Brief,
    pub idempo: Cache<String, serde_json::Value>,
}

impl Session {
    pub fn new(id: String) -> Self {
        Self {
            id,
            brief: Brief::default(),
            idempo: Cache::builder()
                .time_to_live(Duration::from_secs(600))
                .max_capacity(50_000)
                .build(),
        }
    }

    pub fn key(c: &str, o: &str) -> String {
        format!("{c}:{o}")
    }
}

pub type SharedSession = Arc<Mutex<Session>>;
