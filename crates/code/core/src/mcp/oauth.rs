//! MCP OAuth Token Exchange
//!
//! Implements the OAuth 2.0 Client Credentials flow for machine-to-machine
//! authentication with MCP servers that require bearer tokens.

use crate::llm::http::build_reqwest_client;
use anyhow::{anyhow, Context, Result};
use std::time::Duration;

const OAUTH_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_OAUTH_RESPONSE_BYTES: usize = 1024 * 1024;
const MAX_OAUTH_ERROR_BODY_BYTES: usize = 4 * 1024;

/// Token response from an OAuth token endpoint.
#[derive(serde::Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    #[allow(dead_code)]
    pub token_type: String,
    #[allow(dead_code)]
    pub expires_in: Option<u64>,
    #[allow(dead_code)]
    pub refresh_token: Option<String>,
}

impl std::fmt::Debug for TokenResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TokenResponse")
            .field("access_token", &"[REDACTED]")
            .field("token_type", &self.token_type)
            .field("expires_in", &self.expires_in)
            .field(
                "refresh_token",
                &self.refresh_token.as_ref().map(|_| "[REDACTED]"),
            )
            .finish()
    }
}

async fn read_bounded_body(
    mut response: reqwest::Response,
    limit: usize,
) -> Result<(Vec<u8>, bool)> {
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(reqwest::Error::without_url)
        .context("Failed to read OAuth HTTP response body")?
    {
        if body.len().saturating_add(chunk.len()) > limit {
            let remaining = limit.saturating_sub(body.len());
            body.extend_from_slice(&chunk[..remaining]);
            return Ok((body, true));
        }
        body.extend_from_slice(&chunk);
    }
    Ok((body, false))
}

/// Exchange client credentials for an access token (OAuth 2.0 Client Credentials flow).
///
/// Sends a `POST` to `token_url` with:
/// ```text
/// grant_type=client_credentials&client_id=...&client_secret=...&scope=...
/// ```
///
/// Returns the raw `access_token` string on success.
pub async fn exchange_client_credentials(
    token_url: &str,
    client_id: &str,
    client_secret: &str,
    scopes: &[String],
) -> Result<String> {
    let safe_url = crate::config::redact_url_for_debug(token_url);
    let client = build_reqwest_client(Some(OAUTH_TIMEOUT), None)
        .context("Failed to build HTTP client for OAuth token exchange")?;

    // Build application/x-www-form-urlencoded body
    let scope_str = scopes.join(" ");
    let params = [
        ("grant_type", "client_credentials"),
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("scope", &scope_str),
    ];

    let response = client
        .post(token_url)
        .form(&params)
        .send()
        .await
        .map_err(reqwest::Error::without_url)
        .with_context(|| format!("OAuth token request to {safe_url} failed"))?;

    if !response.status().is_success() {
        let status = response.status();
        let (bytes, truncated) = read_bounded_body(response, MAX_OAUTH_ERROR_BODY_BYTES)
            .await
            .unwrap_or_default();
        let body = String::from_utf8_lossy(&bytes);
        let suffix = if truncated { " [truncated]" } else { "" };
        return Err(anyhow!(
            "OAuth token exchange failed at {safe_url} (HTTP {status}): {body}{suffix}"
        ));
    }

    let (bytes, truncated) = read_bounded_body(response, MAX_OAUTH_RESPONSE_BYTES).await?;
    if truncated {
        return Err(anyhow!(
            "OAuth token response from {safe_url} exceeded {MAX_OAUTH_RESPONSE_BYTES} byte limit"
        ));
    }
    let token_resp: TokenResponse =
        serde_json::from_slice(&bytes).context("Failed to parse OAuth token response")?;

    Ok(token_resp.access_token)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_response_deserialize() {
        let json = r#"{
            "access_token": "eyJhbGciOiJSUzI1NiJ9...",
            "token_type": "Bearer",
            "expires_in": 3600
        }"#;
        let resp: TokenResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.access_token, "eyJhbGciOiJSUzI1NiJ9...");
        assert_eq!(resp.token_type, "Bearer");
        assert_eq!(resp.expires_in, Some(3600));
        assert!(resp.refresh_token.is_none());
    }

    #[test]
    fn test_token_response_with_refresh_token() {
        let json = r#"{
            "access_token": "access123",
            "token_type": "Bearer",
            "expires_in": 7200,
            "refresh_token": "refresh456"
        }"#;
        let resp: TokenResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.access_token, "access123");
        assert_eq!(resp.refresh_token, Some("refresh456".to_string()));
        let rendered = format!("{resp:?}");
        assert!(!rendered.contains("access123"), "{rendered}");
        assert!(!rendered.contains("refresh456"), "{rendered}");
        assert!(rendered.contains("[REDACTED]"), "{rendered}");
    }

    #[tokio::test]
    async fn test_exchange_client_credentials_invalid_url() {
        // Should fail gracefully — not panic
        let result = exchange_client_credentials(
            "http://127.0.0.1:1/token",
            "client_id",
            "client_secret",
            &[],
        )
        .await;
        assert!(result.is_err());
    }
}
