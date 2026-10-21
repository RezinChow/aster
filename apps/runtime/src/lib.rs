//! a3s-gateway-runtime — Gateway `/v1` data-plane HTTP surface.

pub mod auth;
pub mod entitlement;
pub mod envelope;
pub mod events;
pub mod http;
pub mod input_contract;
pub mod providers;
pub mod routes;
pub mod usage;
pub mod vault;

use std::sync::Arc;

use tokio::sync::RwLock;

use crate::events::EventRing;
use crate::usage::UsageStore;
use crate::vault::Vault;

/// Shared process state for the data-plane.
#[derive(Clone)]
pub struct AppState {
    pub vault: Arc<RwLock<Vault>>,
    pub usage: Arc<RwLock<UsageStore>>,
    pub events: Arc<RwLock<EventRing>>,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(data_dir: std::path::PathBuf) -> Self {
        let usage = UsageStore::open(&data_dir);
        let vault = Vault::open(&data_dir);
        Self {
            vault: Arc::new(RwLock::new(vault)),
            usage: Arc::new(RwLock::new(usage)),
            events: Arc::new(RwLock::new(EventRing::new(256))),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .user_agent("a3s-runtime/0.1")
                .build()
                .expect("reqwest client"),
        }
    }
}

pub const SCOPE_ORG: &str = "org_local";
pub const SCOPE_PROJECT: &str = "proj_local";
pub const SCOPE_ENV: &str = "env_local";

pub const SUPPLIER_VAULT_ENV_MISSING_CODE: &str = "provider.credential_missing";
pub const SUPPLIER_VAULT_ENV_MISSING_MESSAGE: &str =
    "Supplier Vault environment variable is missing.";
