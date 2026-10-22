//! Import models from a WorkBuddy account logged in through aster itself.
//!
//! `login-workbuddy` runs the copilot.tencent.com plugin device flow and
//! stores the credential under the `workbuddy` scope of `~/.a3s/auth.json`
//! (or `~/.workbuddy/auth.json` when that directory exists). The WorkBuddy
//! desktop app's own token store is `$wbEncrypted` and is never read.
//!
//! Models register as provider `workbuddy` against
//! `https://copilot.tencent.com/v2` (OpenAI chat-completions with native
//! tools). The model catalog is the static seed measured from the WorkBuddy
//! 5.8.3 CLI product manifest; nothing on disk can redirect the endpoint
//! the bearer token is sent to (override it with an explicit provider block
//! and `A3S_DISABLE_WORKBUDDY_ACCOUNT=1`).
//!
//! Runs only when the host opts in (`import_accounts = ["workbuddy"]` or
//! `--import-accounts workbuddy`). Secrets are never logged.

use std::collections::HashMap;
use std::path::PathBuf;

use a3s_code_core::{ModelConfig, ModelModalities, ProviderConfig};
use anyhow::{Context, Result};
use serde_json::Value;

/// Provider name registered into [`a3s_code_core::CodeConfig`].
pub const PROVIDER_NAME: &str = "workbuddy";

const DEFAULT_BASE_URL: &str = "https://copilot.tencent.com/v2";
const AUTH_SCOPE: &str = "workbuddy";

/// The static chat-model seed: (id, display name, context, output ceiling).
/// Measured from the WorkBuddy 5.8.3 CLI product manifest (chat models with
/// declared token ceilings; completion-only and internal entries excluded).
const MODELS: &[(&str, &str, u32, u32)] = &[
    ("auto", "Auto", 168_000, 32_000),
    ("default", "Default", 200_000, 24_000),
    ("deepseek-v4-pro", "Deepseek-V4-Pro", 1_000_000, 128_000),
    ("deepseek-v4-flash", "Deepseek-V4-Flash", 1_000_000, 50_000),
    (
        "deepseek-v4.1-flash",
        "Deepseek-V4.1-Flash",
        1_000_000,
        128_000,
    ),
    ("glm-5.3", "GLM-5.3", 1_000_000, 64_000),
    ("glm-5.3-flash", "GLM-5.3-Flash", 1_000_000, 131_072),
    ("glm-5.3-flashx", "GLM-5.3-FlashX", 1_000_000, 131_072),
    ("glm-5.2", "GLM-5.2", 1_000_000, 64_000),
    ("glm-5.1", "GLM-5.1", 200_000, 48_000),
    ("kimi-k3-2", "Kimi-K3", 1_000_000, 32_000),
    ("kimi-k2.8-preview", "Kimi-K2.8-Preview", 1_000_000, 64_000),
    ("kimi-k2.7", "Kimi-K2.7-Code", 256_000, 32_000),
    ("kimi-k2.6", "Kimi-K2.6", 256_000, 32_000),
    ("kimi-k2.5", "Kimi-K2.5", 256_000, 32_000),
    ("minimax-m3-pay", "MiniMax-M3", 512_000, 128_000),
    ("minimax-m2.7", "MiniMax-M2.7", 200_000, 48_000),
    ("hy3-preview", "Hy3 preview", 192_000, 64_000),
    ("hy4-preview", "Hy4 preview", 1_000_000, 64_000),
];

/// Result of reading the logged-in WorkBuddy account.
#[derive(Debug, Clone)]
pub struct WorkbuddyAccountImport {
    pub provider: ProviderConfig,
    pub default_model_id: String,
    pub user_email: Option<String>,
}

/// Merge the logged-in WorkBuddy account into `config` when available.
///
/// Returns `Ok(true)` when a provider was merged. Missing auth / disabled
/// import is not an error.
pub fn merge_into_config(config: &mut a3s_code_core::CodeConfig) -> Result<bool> {
    if disabled_by_env() {
        return Ok(false);
    }
    let Some(import) = load_logged_in_account()? else {
        return Ok(false);
    };

    config
        .providers
        .retain(|provider| provider.name != PROVIDER_NAME);
    config.providers.push(import.provider.clone());

    let qualified = format!("{PROVIDER_NAME}/{}", import.default_model_id);
    let prefer = prefer_workbuddy_default();
    let needs_default = config
        .default_model
        .as_deref()
        .map(|value| value.trim().is_empty())
        .unwrap_or(true);
    if prefer || needs_default {
        config.default_model = Some(qualified.clone());
    }

    tracing::info!(
        models = import.provider.models.len(),
        default_model = %qualified,
        email = import.user_email.as_deref().unwrap_or("-"),
        "imported logged-in WorkBuddy account models"
    );
    Ok(true)
}

fn disabled_by_env() -> bool {
    matches!(
        std::env::var("A3S_DISABLE_WORKBUDDY_ACCOUNT")
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn prefer_workbuddy_default() -> bool {
    matches!(
        std::env::var("A3S_PREFER_WORKBUDDY")
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "1" | "true" | "yes" | "on"
    )
}

/// Load the logged-in WorkBuddy account, if the auth store has a live entry.
pub fn load_logged_in_account() -> Result<Option<WorkbuddyAccountImport>> {
    let Some(home) = resolve_workbuddy_home() else {
        return Ok(None);
    };
    let auth_path = home.join("auth.json");
    if !auth_path.is_file() {
        return Ok(None);
    }
    load_from_home(&home)
}

/// The store `login-workbuddy` writes; `A3S_WORKBUDDY_HOME` overrides for
/// tests. The WorkBuddy desktop app's own directories are never consulted.
fn resolve_workbuddy_home() -> Option<PathBuf> {
    if let Some(explicit) = std::env::var_os("A3S_WORKBUDDY_HOME") {
        if !explicit.is_empty() {
            return Some(PathBuf::from(explicit));
        }
    }
    let user_home = std::env::var_os("HOME").map(PathBuf::from)?;
    let a3s = user_home.join(".a3s");
    if a3s.join("auth.json").is_file() {
        return Some(a3s);
    }
    Some(a3s)
}

fn load_from_home(home: &std::path::Path) -> Result<Option<WorkbuddyAccountImport>> {
    let auth_raw = std::fs::read_to_string(home.join("auth.json"))
        .with_context(|| format!("could not read {}", home.join("auth.json").display()))?;
    let auth_store: Value =
        serde_json::from_str(&auth_raw).context("WorkBuddy auth.json is not valid JSON")?;
    let Some(entry) = auth_store.get(AUTH_SCOPE) else {
        return Ok(None);
    };
    let Some(key) = entry
        .get("key")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };
    if is_expired(entry) {
        tracing::warn!("WorkBuddy auth credential is expired; run login-workbuddy again");
        return Ok(None);
    }
    let user_id = entry
        .get("user_id")
        .and_then(Value::as_str)
        .map(str::to_string);
    let email = entry
        .get("email")
        .and_then(Value::as_str)
        .map(str::to_string);

    let mut headers = HashMap::new();
    if let Some(user_id) = user_id.as_ref() {
        headers.insert("X-User-Id".to_string(), user_id.clone());
    }
    let provider = ProviderConfig {
        name: PROVIDER_NAME.to_string(),
        api_key: Some(key.to_string()),
        base_url: Some(DEFAULT_BASE_URL.to_string()),
        headers,
        session_id_header: None,
        models: MODELS
            .iter()
            .map(|(id, name, context, output)| model_config(id, name, *context, *output))
            .collect(),
    };
    Ok(Some(WorkbuddyAccountImport {
        provider,
        // `auto` routes server-side across the catalog.
        default_model_id: "auto".to_string(),
        user_email: email,
    }))
}

fn is_expired(auth: &Value) -> bool {
    let Some(expires) = auth.get("expires_at").and_then(Value::as_str) else {
        return false;
    };
    // serde's DateTime<Utc> writes `+00:00`; normalize to `Z` so the two
    // RFC3339 spellings compare lexicographically.
    let normalized = if let Some(stripped) = expires.strip_suffix("+00:00") {
        format!("{stripped}Z")
    } else {
        expires.to_string()
    };
    let now = chrono_like_now();
    !normalized.is_empty() && normalized < now
}

/// Minimal UTC timestamp without pulling chrono into the ACP crate.
fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = secs / 86400;
    let rem = secs % 86400;
    let hours = rem / 3600;
    let minutes = (rem % 3600) / 60;
    let seconds = rem % 60;
    let (year, month, day) = civil_from_days(days as i64);
    format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}Z")
}

/// Howard Hinnant civil-from-days (proleptic Gregorian), days since 1970-01-01.
fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

fn model_config(id: &str, name: &str, context: u32, output: u32) -> ModelConfig {
    ModelConfig {
        id: id.to_string(),
        name: name.to_string(),
        family: "openai".to_string(),
        api_key: None,
        base_url: None,
        headers: Default::default(),
        session_id_header: None,
        attachment: false,
        reasoning: true,
        tool_call: true,
        temperature: true,
        release_date: None,
        modalities: ModelModalities::default(),
        cost: Default::default(),
        limit: a3s_code_core::ModelLimit { context, output },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The env is process-global; env-touching tests take this lock.
    static ENV_TEST: std::sync::Mutex<()> = std::sync::Mutex::new(());

    struct EnvVar(&'static str, Option<std::ffi::OsString>);

    impl EnvVar {
        fn set(name: &'static str, value: Option<std::ffi::OsString>) -> Self {
            let previous = std::env::var_os(name);
            match &value {
                Some(value) => std::env::set_var(name, value),
                None => std::env::remove_var(name),
            }
            Self(name, previous)
        }
    }

    impl Drop for EnvVar {
        fn drop(&mut self) {
            match self.1.take() {
                Some(value) => std::env::set_var(self.0, value),
                None => std::env::remove_var(self.0),
            }
        }
    }

    fn store_with_entry(entry: Value) -> (tempfile::TempDir, PathBuf) {
        let temp = tempfile::tempdir().unwrap();
        let home = temp.path().to_path_buf();
        let mut store = serde_json::Map::new();
        store.insert(AUTH_SCOPE.to_string(), entry);
        store.insert(
            "grok".to_string(),
            serde_json::json!({"key": "other-scope-key", "expires_at": "2999-01-01T00:00:00Z"}),
        );
        std::fs::write(
            home.join("auth.json"),
            serde_json::to_vec(&Value::Object(store)).unwrap(),
        )
        .unwrap();
        (temp, home)
    }

    fn live_entry() -> Value {
        serde_json::json!({
            "key": "wb-token",
            "user_id": "u-1",
            "email": "user@example.test",
            "expires_at": "2999-01-01T00:00:00Z"
        })
    }

    #[test]
    fn a_live_entry_imports_the_static_catalog_with_a_fixed_endpoint() {
        let (_guard, home) = store_with_entry(live_entry());
        let import = load_from_home(&home).unwrap().unwrap();
        assert_eq!(import.provider.name, PROVIDER_NAME);
        assert_eq!(
            import.provider.base_url.as_deref(),
            Some("https://copilot.tencent.com/v2")
        );
        assert_eq!(import.provider.api_key.as_deref(), Some("wb-token"));
        assert_eq!(
            import.provider.headers.get("X-User-Id").map(String::as_str),
            Some("u-1")
        );
        let ids: Vec<&str> = import
            .provider
            .models
            .iter()
            .map(|model| model.id.as_str())
            .collect();
        assert!(ids.contains(&"auto"));
        assert!(ids.contains(&"glm-5.3"));
        assert!(ids.contains(&"deepseek-v4-flash"));
        assert_eq!(import.default_model_id, "auto");
    }

    #[test]
    fn an_expired_entry_is_skipped_with_no_import() {
        let (_guard, home) = store_with_entry(serde_json::json!({
            "key": "wb-token",
            "expires_at": "2000-01-01T00:00:00Z"
        }));
        assert!(load_from_home(&home).unwrap().is_none());
    }

    #[test]
    fn a_missing_scope_or_missing_key_is_not_an_error() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(
            temp.path().join("auth.json"),
            serde_json::json!({"grok": {"key": "x"}}).to_string(),
        )
        .unwrap();
        assert!(load_from_home(temp.path()).unwrap().is_none());

        let (_guard, home) =
            store_with_entry(serde_json::json!({"expires_at": "2999-01-01T00:00:00Z"}));
        assert!(load_from_home(&home).unwrap().is_none());
    }

    #[test]
    fn merge_replaces_a_stale_workbuddy_provider_and_respects_the_disable_env() {
        let _lock = ENV_TEST.lock().unwrap_or_else(|poison| poison.into_inner());
        let (_guard, home) = store_with_entry(live_entry());
        let mut config = a3s_code_core::CodeConfig::default();
        config.providers.push(ProviderConfig {
            name: PROVIDER_NAME.to_string(),
            api_key: None,
            base_url: None,
            headers: Default::default(),
            session_id_header: None,
            models: Vec::new(),
        });
        {
            let _home = EnvVar::set("A3S_WORKBUDDY_HOME", Some(home.clone().into_os_string()));
            let _off = EnvVar::set("A3S_DISABLE_WORKBUDDY_ACCOUNT", None);
            assert!(merge_into_config(&mut config).unwrap());
        }
        assert_eq!(config.providers.len(), 1);
        assert_eq!(config.providers[0].models.len(), MODELS.len());

        let mut config = a3s_code_core::CodeConfig::default();
        {
            let _home = EnvVar::set("A3S_WORKBUDDY_HOME", Some(home.into_os_string()));
            let _off = EnvVar::set("A3S_DISABLE_WORKBUDDY_ACCOUNT", Some("1".into()));
            assert!(!merge_into_config(&mut config).unwrap());
        }
        assert!(config.providers.is_empty());
    }

    #[test]
    fn the_endpoint_is_never_read_from_disk_state() {
        let (_guard, home) = store_with_entry(serde_json::json!({
            "key": "wb-token",
            "base_url": "https://evil.example/v2",
            "expires_at": "2999-01-01T00:00:00Z"
        }));
        let import = load_from_home(&home).unwrap().unwrap();
        assert_eq!(import.provider.base_url.as_deref(), Some(DEFAULT_BASE_URL));
    }
}
