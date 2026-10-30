//! Import models from a locally logged-in Codex (ChatGPT plan) account.
//!
//! `codex login` stores a ChatGPT OAuth snapshot in `~/.codex/auth.json`
//! and its model list in `~/.codex/models_cache.json`. The importer reads
//! both (bounded) and registers provider `codex`. The Responses endpoint
//! is the client contract (`CodexLoginClient`), so neither file can
//! redirect where the OAuth bearer is sent; the cache's `identity` field
//! is likewise never read — the account id comes from `auth.json` only
//! (override everything with an explicit provider block and
//! `A3S_DISABLE_CODEX_ACCOUNT=1`).
//!
//! The access token is a short-lived JWT and this importer never refreshes
//! it (only `codex` itself can): an already-expired token is not imported,
//! and a token that expires mid-session fails per request until
//! `codex login` is re-run.
//!
//! Runs only when the host opts in (`import_accounts = ["codex"]` or
//! `--import-accounts codex`). Secrets are never logged.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use a3s_code_core::{ModelConfig, ProviderConfig};
use anyhow::{Context, Result};
use serde_json::Value;

use crate::cursor_account::{jwt_payload, jwt_string_claim, read_bounded, token_usable};

/// Provider name registered into [`a3s_code_core::CodeConfig`].
pub const PROVIDER_NAME: &str = "codex";

/// The protocol header carrying the ChatGPT account id.
pub const ACCOUNT_ID_HEADER: &str = "chatgpt-account-id";

/// Matches `a3s_code_core::bounded_io::MAX_AUTH_FILE_BYTES`.
const MAX_AUTH_BYTES: usize = 1024 * 1024;
/// Same bound the Cursor importer gives its model catalog.
const MAX_CACHE_BYTES: usize = 1024 * 1024;

/// Single fallback model when the cache has not been populated yet
/// (same posture as the Grok importer's placeholder).
const PLACEHOLDER_MODEL: &str = "gpt-6.1-sol";

/// Result of reading the logged-in Codex account.
#[derive(Debug, Clone)]
pub struct CodexAccountImport {
    pub provider: ProviderConfig,
    pub default_model_id: String,
    pub user_email: Option<String>,
}

/// Merge the logged-in Codex account into `config` when available.
///
/// Returns `Ok(true)` when a provider was merged. No login, an expired
/// token, or a disabled import is not an error.
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
    let prefer = prefer_codex_default();
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
        "imported logged-in Codex account models"
    );
    Ok(true)
}

fn disabled_by_env() -> bool {
    matches!(
        std::env::var("A3S_DISABLE_CODEX_ACCOUNT")
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn prefer_codex_default() -> bool {
    matches!(
        std::env::var("A3S_PREFER_CODEX")
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "1" | "true" | "yes" | "on"
    )
}

/// Read the logged-in Codex account from this machine, when present.
pub fn load_logged_in_account() -> Result<Option<CodexAccountImport>> {
    let Some(home) = resolve_codex_home() else {
        return Ok(None);
    };
    load_from_home(&home)
}

fn resolve_codex_home() -> Option<PathBuf> {
    if let Some(explicit) = std::env::var_os("A3S_CODEX_HOME") {
        if !explicit.is_empty() {
            return Some(PathBuf::from(explicit));
        }
    }
    // `CODEX_HOME` is the codex CLI's own relocation variable.
    if let Some(home) = std::env::var_os("CODEX_HOME") {
        if !home.is_empty() {
            return Some(PathBuf::from(home));
        }
    }
    crate::config::user_home().map(|home| home.join(".codex"))
}

fn load_from_home(home: &Path) -> Result<Option<CodexAccountImport>> {
    let auth_path = home.join("auth.json");
    if !auth_path.is_file() {
        return Ok(None);
    }
    let Some(raw) = read_bounded(&auth_path, MAX_AUTH_BYTES)? else {
        tracing::warn!("Codex auth file exceeded the read bound; skipping import");
        return Ok(None);
    };
    let auth: Value = serde_json::from_str(&raw).context("Codex auth.json is not valid JSON")?;

    // Same extraction contract as `CodexLoginClient::from_auth_file`.
    let access_token = auth
        .pointer("/tokens/access_token")
        .or_else(|| auth.get("access_token"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|token| !token.is_empty());
    let Some(access_token) = access_token else {
        return Ok(None);
    };
    if !token_usable(access_token) {
        tracing::warn!("Codex access token is expired; re-run `codex login` to refresh it");
        return Ok(None);
    }

    let id_token = auth
        .pointer("/tokens/id_token")
        .and_then(Value::as_str)
        .filter(|token| !token.is_empty());
    let account_id = auth
        .pointer("/tokens/account_id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            id_token.and_then(|token| {
                jwt_payload(token)?
                    .pointer("/https:~1~1api.openai.com~1auth/chatgpt_account_id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
        });
    let Some(account_id) = account_id else {
        tracing::warn!("Codex auth has no ChatGPT account id; skipping import");
        return Ok(None);
    };
    let user_email = id_token.and_then(|token| jwt_string_claim(token, "email"));

    let cache_path = home.join("models_cache.json");
    let cache = if cache_path.is_file() {
        match read_bounded(&cache_path, MAX_CACHE_BYTES)? {
            Some(raw) => {
                serde_json::from_str(&raw).context("Codex models_cache.json is not valid JSON")?
            }
            None => {
                tracing::warn!("Codex models cache exceeded the read bound; using placeholder");
                Value::Null
            }
        }
    } else {
        Value::Null
    };

    let config_default = read_config_default_model(home);
    Ok(Some(provider_from_parts(
        access_token,
        &account_id,
        user_email.as_deref(),
        &cache,
        config_default.as_deref(),
    )?))
}

/// The codex CLI's `~/.codex/config.toml` sets its default with a
/// top-level `model = "…"` line; scan only before the first section.
fn read_config_default_model(home: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(home.join("config.toml")).ok()?;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            return None;
        }
        if let Some(rest) = trimmed.strip_prefix("model") {
            let rest = rest.trim_start();
            if let Some(rest) = rest.strip_prefix('=') {
                let value = rest.trim().trim_matches('"').trim_matches('\'').trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
    }
    None
}

/// Build a provider from the auth snapshot and optional models cache.
fn provider_from_parts(
    access_token: &str,
    account_id: &str,
    user_email: Option<&str>,
    cache: &Value,
    config_default: Option<&str>,
) -> Result<CodexAccountImport> {
    let mut models = models_from_cache(cache);
    if models.is_empty() {
        // Fall back to a single placeholder so the account is still
        // selectable when the cache has not been populated yet.
        let id = config_default.unwrap_or(PLACEHOLDER_MODEL);
        models.push(model_config(id, id, 0));
    }

    // The cache order is the CLI's own recommended order; trust it ahead
    // of guessing a "newest" name by regex.
    let default_model_id = config_default
        .filter(|id| models.iter().any(|model| model.id == *id))
        .map(str::to_string)
        .unwrap_or_else(|| models[0].id.clone());

    // Only the account id rides the headers: the access token travels as
    // `api_key`, and the endpoint is the client contract, never disk state.
    let mut headers = HashMap::new();
    headers.insert(ACCOUNT_ID_HEADER.to_string(), account_id.to_string());

    let provider = ProviderConfig {
        name: PROVIDER_NAME.to_string(),
        api_key: Some(access_token.to_string()),
        base_url: None,
        headers,
        session_id_header: None,
        models,
    };

    Ok(CodexAccountImport {
        provider,
        default_model_id,
        user_email: user_email.map(str::to_string),
    })
}

fn models_from_cache(cache: &Value) -> Vec<ModelConfig> {
    let Some(entries) = cache.get("models").and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut models = Vec::new();
    for entry in entries {
        let Some(id) = entry
            .get("slug")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|slug| !slug.is_empty())
        else {
            continue;
        };
        if entry.get("visibility").and_then(Value::as_str) == Some("hide") {
            continue;
        }
        if entry.get("supported_in_api").and_then(Value::as_bool) == Some(false) {
            continue;
        }
        let name = entry
            .get("display_name")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .unwrap_or(id);
        let context_window = entry
            .get("context_window")
            .and_then(Value::as_u64)
            .map(|window| window.min(u32::MAX as u64) as u32)
            .unwrap_or(0);
        models.push(model_config(id, name, context_window));
    }
    models
}

fn model_config(id: &str, name: &str, context_window: u32) -> ModelConfig {
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
        // The Responses reasoning models ignore sampling temperature.
        temperature: false,
        release_date: None,
        modalities: Default::default(),
        cost: Default::default(),
        limit: a3s_code_core::ModelLimit {
            context: context_window,
            output: 0,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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

    /// `{"email":"user@example.test","exp":…}` payloads, base64url-encoded
    /// once so the tests carry no encoder of their own.
    const FUTURE_JWT: &str =
        "eyJhbGciOiJub25lIn0.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS50ZXN0IiwiZXhwIjo0MTAyNDQ0ODAwfQ.sig";
    const EXPIRED_JWT: &str =
        "eyJhbGciOiJub25lIn0.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS50ZXN0IiwiZXhwIjo5NDY2ODQ4MDB9.sig";

    fn write_login(home: &Path, access_token: &str) {
        std::fs::create_dir_all(home).unwrap();
        std::fs::write(
            home.join("auth.json"),
            json!({
                "auth_mode": "chatgpt",
                "OPENAI_API_KEY": null,
                "tokens": {
                    "id_token": FUTURE_JWT,
                    "access_token": access_token,
                    "refresh_token": "refresh-secret",
                    "account_id": "acc-1"
                },
                "last_refresh": "2026-10-20T00:00:00Z"
            })
            .to_string(),
        )
        .unwrap();
    }

    fn write_cache(home: &Path) {
        std::fs::write(
            home.join("models_cache.json"),
            json!({
                "client_version": "0.163.0",
                // Disk identity is never read by the importer.
                "identity": {"account": "someone-else"},
                "models": [
                    {
                        "slug": "gpt-6.1-sol",
                        "display_name": "GPT-6.1-Sol",
                        "context_window": 500000,
                        "visibility": "list",
                        "supported_in_api": true
                    },
                    {
                        "slug": "hidden-one",
                        "display_name": "Hidden",
                        "context_window": 272000,
                        "visibility": "hide",
                        "supported_in_api": true
                    },
                    {
                        "slug": "gpt-6-luna",
                        "display_name": "GPT-6-Luna",
                        "context_window": 272000,
                        "visibility": "list",
                        "supported_in_api": true
                    },
                    {
                        "slug": "not-in-api",
                        "display_name": "Not In API",
                        "context_window": 272000,
                        "visibility": "list",
                        "supported_in_api": false
                    }
                ]
            })
            .to_string(),
        )
        .unwrap();
    }

    #[test]
    fn a_live_login_imports_cached_models_with_a_fixed_identity() {
        let temp = tempfile::tempdir().unwrap();
        let home = temp.path().join("codex-home");
        write_login(&home, FUTURE_JWT);
        write_cache(&home);

        let import = load_from_home(&home).unwrap().unwrap();
        assert_eq!(import.provider.name, PROVIDER_NAME);
        assert_eq!(import.provider.api_key.as_deref(), Some(FUTURE_JWT));
        assert_eq!(import.provider.base_url, None);
        assert_eq!(
            import
                .provider
                .headers
                .get(ACCOUNT_ID_HEADER)
                .map(String::as_str),
            Some("acc-1")
        );
        assert_eq!(import.user_email.as_deref(), Some("user@example.test"));

        let ids: Vec<&str> = import
            .provider
            .models
            .iter()
            .map(|model| model.id.as_str())
            .collect();
        assert_eq!(ids, vec!["gpt-6.1-sol", "gpt-6-luna"]);
        let sol = &import.provider.models[0];
        assert_eq!(sol.name, "GPT-6.1-Sol");
        assert_eq!(sol.limit.context, 500_000);
        // Cache order is the CLI's recommended order; the first listed
        // model becomes the default.
        assert_eq!(import.default_model_id, "gpt-6.1-sol");
    }

    #[test]
    fn an_expired_access_token_is_not_imported() {
        let temp = tempfile::tempdir().unwrap();
        let home = temp.path().join("codex-home");
        write_login(&home, EXPIRED_JWT);
        assert!(load_from_home(&home).unwrap().is_none());
    }

    #[test]
    fn a_missing_token_or_account_id_is_not_an_error() {
        let temp = tempfile::tempdir().unwrap();
        let home = temp.path().join("codex-home");
        std::fs::create_dir_all(&home).unwrap();

        // No auth file at all.
        assert!(load_from_home(&home).unwrap().is_none());

        // Logged out (auth_mode retained, tokens cleared).
        std::fs::write(
            home.join("auth.json"),
            json!({"auth_mode": "chatgpt", "OPENAI_API_KEY": null, "tokens": {}}).to_string(),
        )
        .unwrap();
        assert!(load_from_home(&home).unwrap().is_none());

        // Token present but no account id anywhere.
        std::fs::write(
            home.join("auth.json"),
            json!({"tokens": {"access_token": FUTURE_JWT}}).to_string(),
        )
        .unwrap();
        assert!(load_from_home(&home).unwrap().is_none());
    }

    #[test]
    fn a_missing_cache_falls_back_to_the_configured_or_placeholder_model() {
        let temp = tempfile::tempdir().unwrap();
        let home = temp.path().join("codex-home");
        write_login(&home, FUTURE_JWT);

        let import = load_from_home(&home).unwrap().unwrap();
        assert_eq!(import.provider.models.len(), 1);
        assert_eq!(import.default_model_id, PLACEHOLDER_MODEL);

        std::fs::write(
            home.join("config.toml"),
            "model = \"gpt-6-astra\"\n[model_providers]\n",
        )
        .unwrap();
        let import = load_from_home(&home).unwrap().unwrap();
        assert_eq!(import.default_model_id, "gpt-6-astra");
    }

    #[test]
    fn a_trusted_acl_opt_in_imports_the_account_through_the_launch_loader() {
        let _lock = ENV_TEST.lock().unwrap_or_else(|poison| poison.into_inner());
        let temp = tempfile::tempdir().unwrap();
        let home = temp.path().join("codex-home");
        write_login(&home, FUTURE_JWT);
        write_cache(&home);
        let workspace = temp.path().join("workspace");
        std::fs::create_dir(&workspace).unwrap();
        let config = temp.path().join("codex.acl");
        std::fs::write(&config, "import_accounts = [\"codex\"]\n").unwrap();

        let (launch, _) = {
            let _home = EnvVar::set("A3S_CODEX_HOME", Some(home.into_os_string()));
            let _off = EnvVar::set("A3S_DISABLE_CODEX_ACCOUNT", None);
            crate::load_launch_config_with_imports(
                workspace,
                Some(config),
                &[a3s_code_core::config::AccountImport::Codex],
            )
            .expect("launch config with the codex import")
        };

        let provider = launch
            .config
            .providers
            .iter()
            .find(|provider| provider.name == PROVIDER_NAME)
            .expect("codex provider merged");
        assert_eq!(provider.models.len(), 2);
        assert_eq!(
            launch.config.default_model.as_deref(),
            Some("codex/gpt-6.1-sol")
        );
    }

    #[test]
    fn merge_replaces_a_stale_codex_provider_and_respects_the_disable_env() {
        let _lock = ENV_TEST.lock().unwrap_or_else(|poison| poison.into_inner());
        let temp = tempfile::tempdir().unwrap();
        let home = temp.path().join("codex-home");
        write_login(&home, FUTURE_JWT);
        write_cache(&home);

        let mut config = a3s_code_core::CodeConfig::default();
        config.default_model = Some("mock/m".to_string());
        config.providers.push(ProviderConfig {
            name: PROVIDER_NAME.to_string(),
            api_key: None,
            base_url: None,
            headers: HashMap::new(),
            session_id_header: None,
            models: Vec::new(),
        });
        {
            let _home = EnvVar::set("A3S_CODEX_HOME", Some(home.clone().into_os_string()));
            let _off = EnvVar::set("A3S_DISABLE_CODEX_ACCOUNT", None);
            assert!(merge_into_config(&mut config).unwrap());
        }
        assert_eq!(config.providers.len(), 1);
        assert_eq!(config.providers[0].models.len(), 2);
        // No default unless preferred or empty: an existing choice stands.
        assert_eq!(config.default_model.as_deref(), Some("mock/m"));

        let mut config = a3s_code_core::CodeConfig::default();
        {
            let _home = EnvVar::set("A3S_CODEX_HOME", Some(home.into_os_string()));
            let _off = EnvVar::set("A3S_DISABLE_CODEX_ACCOUNT", Some("1".into()));
            assert!(!merge_into_config(&mut config).unwrap());
        }
        assert!(config.providers.is_empty());
    }
}

#[cfg(test)]
mod live_account_smoke {
    use super::*;

    #[test]
    fn loads_local_codex_account_when_present() {
        if disabled_by_env() {
            return;
        }
        let Ok(Some(import)) = load_logged_in_account() else {
            return;
        };
        assert_eq!(import.provider.name, PROVIDER_NAME);
        assert!(!import.provider.models.is_empty());
        assert!(import.provider.api_key.is_some());
        assert!(import.provider.base_url.is_none());
        eprintln!(
            "codex smoke: models={} default={} email={}",
            import.provider.models.len(),
            import.default_model_id,
            import.user_email.as_deref().unwrap_or("-")
        );
    }
}
