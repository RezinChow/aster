//! Seamless WorkBuddy session for the account-import lane.
//!
//! The user's login is their own action; this module never touches
//! WorkBuddy's encrypted local stores. It keeps ONE credential aster owns:
//! a plugin-lane token from copilot.tencent.com under the `workbuddy`
//! scope of `~/.a3s/auth.json`. `ensure_session` is called at TUI startup
//! when the launch opts into the workbuddy import: a live credential
//! returns silently, a stale one refreshes via the documented refresh
//! route, and only a missing/failed refresh opens the approval URL in
//! the user's browser — the single consent click that is the user's
//! login. The ACP importer and the studio derived provider read the same
//! scope, so both surfaces share one session.
//!
//! Endpoint shapes are measured (state creation live-probed 2026-10-22;
//! poll and refresh routes from the WorkBuddy 5.8.3 CLI bundle). Token
//! payload field names are not: the closed candidate sets refuse and
//! name the keys they saw instead of guessing.

use anyhow::{Context, Result, anyhow, bail};
use serde_json::Value;
use std::path::PathBuf;
use std::time::{Duration, Instant};

const STATE_URL: &str = "https://copilot.tencent.com/v2/plugin/auth/state?platform=CLI";
const TOKEN_URL: &str = "https://copilot.tencent.com/v2/plugin/auth/token?state=";
const ACCOUNT_URL: &str = "https://copilot.tencent.com/v2/plugin/login/account?state=";
const REFRESH_URL: &str = "https://copilot.tencent.com/v2/auth/token/refresh";

const POLL_INTERVAL: Duration = Duration::from_secs(3);
const POLL_DEADLINE: Duration = Duration::from_secs(300);
/// Refresh this far before expiry so sessions never lapse mid-use.
const REFRESH_MARGIN: Duration = Duration::from_secs(24 * 60 * 60);

/// Keep in sync with the ACP importer and the studio derived provider.
const AUTH_SCOPE: &str = "workbuddy";
const TOKEN_FIELDS: [&str; 3] = ["access_token", "accessToken", "token"];
const REFRESH_FIELDS: [&str; 2] = ["refresh_token", "refreshToken"];

struct Session {
    access: String,
    refresh: Option<String>,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
    user_id: Option<String>,
    email: Option<String>,
}

/// True when the launch config opts into the workbuddy account import.
/// A config that cannot be read opts out (fail closed, no error spam).
pub fn opted_in() -> bool {
    let workspace = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let Ok(launch) = a3s_code_acp::load_launch_config(workspace, None) else {
        return false;
    };
    launch
        .config
        .import_accounts
        .iter()
        .any(|import| import.as_str() == AUTH_SCOPE)
}

/// Make sure a usable workbuddy credential exists, refreshing or
/// guiding the one-click browser approval when needed. Returns the
/// access token.
pub async fn ensure_session() -> Result<String> {
    if let Some(session) = read_live_session() {
        return Ok(session.access);
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .context("building the WorkBuddy session HTTP client")?;
    if let Some(session) = try_refresh(&client).await? {
        store(&session)?;
        return Ok(session.access);
    }
    let session = device_flow(&client).await?;
    store(&session)?;
    Ok(session.access)
}

/// Live means: key present and not expiring inside the refresh margin.
fn read_live_session() -> Option<Session> {
    let store = read_store()?;
    let entry = store.get(AUTH_SCOPE)?.clone();
    let access = entry.key.trim().to_string();
    if access.is_empty() {
        return None;
    }
    if let Some(expires_at) = entry.expires_at {
        if expires_at - chrono::Duration::from_std(REFRESH_MARGIN).ok()? <= chrono::Utc::now() {
            return None;
        }
    }
    Some(Session {
        access,
        refresh: entry.refresh_token.clone().filter(|t| !t.trim().is_empty()),
        expires_at: entry.expires_at,
        user_id: (!entry.user_id.is_empty()).then_some(entry.user_id.clone()),
        email: entry.email.clone(),
    })
}

async fn try_refresh(client: &reqwest::Client) -> Result<Option<Session>> {
    let Some(stale) = read_store()
        .and_then(|store| store.get(AUTH_SCOPE).cloned())
        .filter(|entry| {
            entry
                .refresh_token
                .as_deref()
                .is_some_and(|token| !token.trim().is_empty())
        })
    else {
        return Ok(None);
    };
    let refresh_token = stale.refresh_token.clone().unwrap_or_default();
    let body: Value = match client
        .post(REFRESH_URL)
        .header("X-Refresh-Token", &refresh_token)
        .header("X-Auth-Refresh-Source", "plugin")
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response
            .json()
            .await
            .context("refresh response is not JSON")?,
        _ => return Ok(None),
    };
    let data = body.get("data").cloned().unwrap_or(Value::Null);
    let Some(access) = pick_field(&data, &TOKEN_FIELDS) else {
        return Ok(None);
    };
    let refresh = pick_field(&data, &REFRESH_FIELDS).or(Some(refresh_token));
    let expires_at = data
        .get("expires_in")
        .and_then(Value::as_i64)
        .filter(|seconds| *seconds > 0)
        .map(|seconds| chrono::Utc::now() + chrono::Duration::seconds(seconds));
    Ok(Some(Session {
        access,
        refresh,
        expires_at,
        user_id: (!stale.user_id.is_empty()).then_some(stale.user_id.clone()),
        email: stale.email.clone(),
    }))
}

async fn device_flow(client: &reqwest::Client) -> Result<Session> {
    let body: Value = client
        .post(STATE_URL)
        .json(&serde_json::json!({}))
        .send()
        .await
        .context("reaching copilot.tencent.com")?
        .error_for_status()
        .context("the auth-state endpoint refused the request")?
        .json()
        .await
        .context("the auth-state response is not JSON")?;
    let data = body.get("data").cloned().unwrap_or(Value::Null);
    let state = data
        .get("state")
        .and_then(Value::as_str)
        .map(str::to_string);
    let auth_url = data
        .get("authUrl")
        .and_then(Value::as_str)
        .map(str::to_string);
    let (state, auth_url) = match (state, auth_url) {
        (Some(state), Some(auth_url)) if !state.is_empty() && !auth_url.is_empty() => {
            (state, auth_url)
        }
        _ => bail!("the auth-state response lacks state/authUrl"),
    };

    println!("WorkBuddy 需要一次授权（浏览器中打开，点击授权即可，之后自动续期）：");
    println!("  {auth_url}");
    let _ = std::process::Command::new("open").arg(&auth_url).status();

    let started = Instant::now();
    let access;
    let mut expires_at = None;
    loop {
        if started.elapsed() > POLL_DEADLINE {
            bail!("timed out waiting for approval; try again");
        }
        let body: Value = match client.get(format!("{TOKEN_URL}{state}")).send().await {
            Ok(response) if response.status().is_success() => match response.json().await {
                Ok(body) => body,
                Err(_) => {
                    tokio::time::sleep(POLL_INTERVAL).await;
                    continue;
                }
            },
            _ => {
                tokio::time::sleep(POLL_INTERVAL).await;
                continue;
            }
        };
        let data = body.get("data").cloned().unwrap_or(Value::Null);
        if let Some(found) = pick_field(&data, &TOKEN_FIELDS) {
            access = found;
            expires_at = data
                .get("expires_in")
                .and_then(Value::as_i64)
                .filter(|seconds| *seconds > 0)
                .map(|seconds| chrono::Utc::now() + chrono::Duration::seconds(seconds));
            break;
        }
        let keys = data
            .as_object()
            .map(|object| object.keys().cloned().collect::<Vec<_>>().join(", "))
            .unwrap_or_else(|| "not an object".to_string());
        bail!(
            "the token payload names none of {} (saw: {keys}); report this output",
            TOKEN_FIELDS.join("/")
        );
    }

    let account: Option<Value> = match client.get(format!("{ACCOUNT_URL}{state}")).send().await {
        Ok(response) if response.status().is_success() => response.json().await.ok(),
        _ => None,
    };
    let (user_id, email) = match account {
        Some(account) => (
            account
                .get("data")
                .and_then(|data| data.get("user_id").or_else(|| data.get("userId")))
                .and_then(Value::as_str)
                .map(str::to_string),
            account
                .get("data")
                .and_then(|data| data.get("email"))
                .and_then(Value::as_str)
                .map(str::to_string),
        ),
        None => (None, None),
    };

    Ok(Session {
        access,
        refresh: None,
        expires_at,
        user_id,
        email,
    })
}

fn pick_field(data: &Value, fields: &[&str]) -> Option<String> {
    fields
        .iter()
        .find_map(|field| data.get(*field).and_then(Value::as_str))
        .map(str::to_string)
        .filter(|value| !value.is_empty())
}

fn auth_file() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").map(PathBuf::from)?;
    Some(home.join(".a3s").join("auth.json"))
}

fn read_store() -> Option<a3s_code_login::model::AuthStore> {
    let path = auth_file()?;
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

/// Store through the shared login writer (0600, atomic); other scopes stay.
fn store(session: &Session) -> Result<()> {
    let path = auth_file().ok_or_else(|| anyhow!("HOME is not set"))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut map = a3s_code_login::storage::read_auth_json_or_empty_recovering_corrupt(&path)?;
    map.insert(
        AUTH_SCOPE.to_string(),
        a3s_code_login::model::GrokAuth {
            key: session.access.clone(),
            auth_mode: a3s_code_login::model::AuthMode::Oidc,
            create_time: chrono::Utc::now(),
            user_id: session.user_id.clone().unwrap_or_default(),
            email: session.email.clone(),
            expires_at: session.expires_at,
            refresh_token: session.refresh.clone(),
            ..Default::default()
        },
    );
    a3s_code_login::storage::write_auth_json(&path, &map).map_err(|error| anyhow!("{error}"))
}
