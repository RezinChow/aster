//! Streamable HTTP Transport for MCP
//!
//! Implements the MCP 2025-03-26 Streamable HTTP transport spec.
//!
//! ## Protocol
//!
//! All communication goes through a single HTTP endpoint:
//!
//! - **Requests**: POST JSON-RPC with `Accept: application/json, text/event-stream`
//!   - Server may respond with `Content-Type: application/json` (single response)
//!   - Server may respond with `Content-Type: text/event-stream` (streaming response)
//! - **Notifications (outbound)**: POST JSON-RPC notification (no response body expected)
//! - **Notifications (inbound)**: GET `{url}` with `Accept: text/event-stream` for server-push
//! - **Session**: Server may return `Mcp-Session-Id` header; client echoes it on subsequent requests
//!
//! ## Compatibility
//!
//! Falls back gracefully: if the server returns plain JSON, it is used directly.
//! If the server returns SSE, the first `data:` event containing a JSON-RPC response is used.

use super::notifications::{NotificationReceiver, NotificationSender};
use super::McpTransport;
use crate::llm::http::build_reqwest_client;
use crate::mcp::protocol::{JsonRpcNotification, JsonRpcRequest, JsonRpcResponse, McpNotification};
use crate::sse::{take_sse_events_scanned, SseEventScan, Utf8StreamDecoder};
use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};

const DEFAULT_TIMEOUT_SECS: u64 = 60;
const SSE_RECONNECT_BASE_MS: u64 = 500;
const SSE_RECONNECT_MAX_MS: u64 = 30_000;
const MAX_SSE_FRAME_BYTES: usize = 8 * 1024 * 1024;
const MAX_JSON_RESPONSE_BYTES: usize = 16 * 1024 * 1024;
const MAX_ERROR_BODY_BYTES: usize = 4 * 1024;

/// Streamable HTTP transport (MCP 2025-03-26)
pub struct StreamableHttpTransport {
    /// MCP endpoint URL
    url: String,
    client: Client,
    /// Optional session ID returned by server
    session_id: RwLock<Option<String>>,
    connected: Arc<AtomicBool>,
    notification_rx: NotificationReceiver,
    sse_abort: Mutex<Option<tokio::task::AbortHandle>>,
}

impl StreamableHttpTransport {
    /// Connect to a Streamable HTTP MCP server.
    pub async fn connect(url: impl Into<String>, headers: HashMap<String, String>) -> Result<Self> {
        Self::connect_with_timeout(url, headers, DEFAULT_TIMEOUT_SECS).await
    }

    pub async fn connect_with_timeout(
        url: impl Into<String>,
        headers: HashMap<String, String>,
        timeout_secs: u64,
    ) -> Result<Self> {
        let url = url.into().trim_end_matches('/').to_string();

        let mut header_map = reqwest::header::HeaderMap::new();
        header_map.insert(
            reqwest::header::CONTENT_TYPE,
            "application/json".parse().unwrap(),
        );
        for (k, v) in &headers {
            if let (Ok(name), Ok(mut val)) = (
                reqwest::header::HeaderName::from_bytes(k.as_bytes()),
                reqwest::header::HeaderValue::from_str(v),
            ) {
                val.set_sensitive(true);
                header_map.insert(name, val);
            }
        }

        let client = build_reqwest_client(
            Some(Duration::from_secs(timeout_secs)),
            Some(header_map.clone()),
        )
        .context("Failed to build HTTP client")?;
        // Long-lived GET SSE streams must not share the per-RPC total timeout.
        let sse_client = build_reqwest_client(None, Some(header_map))
            .context("Failed to build SSE HTTP client")?;

        let (notification_tx, notification_rx) = NotificationReceiver::channel(256);
        let connected = Arc::new(AtomicBool::new(true));

        // Spawn SSE listener for server-initiated notifications (GET endpoint)
        let sse_url = url.clone();
        let sse_connected = Arc::clone(&connected);
        let sse_handle = tokio::spawn(async move {
            Self::sse_listener(sse_client, sse_url, notification_tx, sse_connected).await;
        });

        Ok(Self {
            url,
            client,
            session_id: RwLock::new(None),
            connected,
            notification_rx,
            sse_abort: Mutex::new(Some(sse_handle.abort_handle())),
        })
    }

    /// Build request headers including session ID if present.
    async fn request_headers(&self) -> reqwest::header::HeaderMap {
        let mut map = reqwest::header::HeaderMap::new();
        map.insert(
            "Accept",
            "application/json, text/event-stream".parse().unwrap(),
        );
        if let Some(ref sid) = *self.session_id.read().await {
            if let Ok(val) = reqwest::header::HeaderValue::from_str(sid) {
                map.insert("Mcp-Session-Id", val);
            }
        }
        map
    }

    /// Extract and store session ID from response headers.
    async fn capture_session_id(&self, headers: &reqwest::header::HeaderMap) {
        if let Some(val) = headers.get("Mcp-Session-Id") {
            if let Ok(s) = val.to_str() {
                let mut sid = self.session_id.write().await;
                *sid = Some(s.to_string());
            }
        }
    }

    async fn read_bounded_bytes(
        mut response: reqwest::Response,
        limit: usize,
    ) -> Result<(Vec<u8>, bool)> {
        let mut body = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(reqwest::Error::without_url)
            .context("Failed to read Streamable HTTP response body")?
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

    /// Parse a JSON-RPC response from either plain JSON or SSE stream body.
    async fn parse_response(response: reqwest::Response) -> Result<JsonRpcResponse> {
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        if content_type.contains("text/event-stream") {
            // Read SSE stream and return first JSON-RPC response event
            Self::parse_sse_response(response).await
        } else {
            // Plain JSON response (bounded)
            let (bytes, truncated) =
                Self::read_bounded_bytes(response, MAX_JSON_RESPONSE_BYTES).await?;
            if truncated {
                return Err(anyhow!(
                    "JSON-RPC response exceeded the {MAX_JSON_RESPONSE_BYTES} byte limit"
                ));
            }
            serde_json::from_slice::<JsonRpcResponse>(&bytes)
                .context("Failed to parse JSON-RPC response")
        }
    }

    /// The first JSON-RPC response among complete SSE events in `buffer`.
    #[cfg(test)]
    fn response_from_sse_events(buffer: &mut String, eof: bool) -> Option<JsonRpcResponse> {
        for event_text in crate::sse::take_sse_events(buffer, eof) {
            if let Some(response) = Self::extract_json_rpc_response(&event_text) {
                return Some(response);
            }
        }
        None
    }

    /// Read an SSE stream and return the first JSON-RPC response found.
    async fn parse_sse_response(response: reqwest::Response) -> Result<JsonRpcResponse> {
        use futures::StreamExt;

        let mut stream = response.bytes_stream();
        let mut decoder = Utf8StreamDecoder::default();
        let mut scan = SseEventScan::default();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let bytes = chunk
                .map_err(reqwest::Error::without_url)
                .context("SSE stream error")?;
            if buffer
                .len()
                .saturating_add(decoder.pending_bytes())
                .saturating_add(bytes.len())
                > MAX_SSE_FRAME_BYTES
            {
                return Err(anyhow!("Streamable HTTP SSE frame exceeded size limit"));
            }
            decoder
                .push_to(&bytes, &mut buffer)
                .context("Invalid Streamable HTTP SSE UTF-8")?;

            for event_text in take_sse_events_scanned(&mut buffer, &mut scan, false) {
                if let Some(response) = Self::extract_json_rpc_response(&event_text) {
                    return Ok(response);
                }
            }
        }

        decoder
            .finish()
            .context("Incomplete Streamable HTTP SSE UTF-8")?;
        for event_text in take_sse_events_scanned(&mut buffer, &mut scan, true) {
            if let Some(response) = Self::extract_json_rpc_response(&event_text) {
                return Ok(response);
            }
        }

        Err(anyhow!("SSE stream ended without a JSON-RPC response"))
    }

    /// Extract a JSON-RPC response from an SSE event block.
    fn extract_json_rpc_response(event_text: &str) -> Option<JsonRpcResponse> {
        let mut data = String::new();
        for line in event_text.lines() {
            if let Some(value) = crate::sse::data_field_value(line) {
                if !data.is_empty() {
                    data.push('\n');
                }
                data.push_str(value);
            }
        }
        if data.is_empty() {
            return None;
        }
        serde_json::from_str::<JsonRpcResponse>(&data).ok()
    }

    /// Extract an MCP notification from an SSE event block.
    fn extract_notification(event_text: &str) -> Option<McpNotification> {
        let mut data = String::new();
        for line in event_text.lines() {
            if let Some(value) = crate::sse::data_field_value(line) {
                if !data.is_empty() {
                    data.push('\n');
                }
                data.push_str(value);
            }
        }
        if data.is_empty() {
            return None;
        }
        serde_json::from_str::<crate::mcp::protocol::JsonRpcNotification>(&data)
            .ok()
            .map(|n| McpNotification::from_json_rpc(&n))
    }

    /// SSE listener for server-initiated notifications (GET endpoint).
    async fn sse_listener(
        client: Client,
        url: String,
        tx: NotificationSender,
        connected: Arc<AtomicBool>,
    ) {
        let mut delay = SSE_RECONNECT_BASE_MS;

        loop {
            if !connected.load(Ordering::SeqCst) {
                break;
            }

            let result = client
                .get(&url)
                .header("Accept", "text/event-stream")
                .send()
                .await;

            match result {
                Ok(resp) if resp.status().is_success() => {
                    delay = SSE_RECONNECT_BASE_MS;
                    use futures::StreamExt;
                    let mut stream = resp.bytes_stream();
                    let mut decoder = Utf8StreamDecoder::default();
                    let mut scan = SseEventScan::default();
                    let mut buffer = String::new();
                    let mut stream_aborted = false;

                    while let Some(chunk) = stream.next().await {
                        if !connected.load(Ordering::SeqCst) {
                            return;
                        }
                        match chunk {
                            Ok(bytes) => {
                                if buffer
                                    .len()
                                    .saturating_add(decoder.pending_bytes())
                                    .saturating_add(bytes.len())
                                    > MAX_SSE_FRAME_BYTES
                                {
                                    tracing::warn!(
                                        "Streamable HTTP SSE frame exceeded size limit; reconnecting"
                                    );
                                    stream_aborted = true;
                                    break;
                                }
                                if let Err(error) = decoder.push_to(&bytes, &mut buffer) {
                                    tracing::warn!(%error, "Streamable HTTP SSE invalid UTF-8");
                                    stream_aborted = true;
                                    break;
                                }
                                for event in take_sse_events_scanned(&mut buffer, &mut scan, false)
                                {
                                    if let Some(n) = Self::extract_notification(&event) {
                                        tx.send(n).await;
                                    }
                                }
                            }
                            Err(e) => {
                                let e = e.without_url();
                                tracing::warn!(error = %e, "Streamable HTTP SSE stream error");
                                stream_aborted = true;
                                break;
                            }
                        }
                    }
                    if !stream_aborted && decoder.finish().is_ok() {
                        for event in take_sse_events_scanned(&mut buffer, &mut scan, true) {
                            if let Some(notification) = Self::extract_notification(&event) {
                                tx.send(notification).await;
                            }
                        }
                    }
                }
                Ok(resp) => {
                    // Server doesn't support GET SSE — that's fine, notifications come inline
                    tracing::debug!(
                        status = %resp.status(),
                        "Streamable HTTP GET SSE not supported by server (status {}), skipping",
                        resp.status()
                    );
                    return;
                }
                Err(e) => {
                    let e = e.without_url();
                    tracing::debug!(error = %e, "Streamable HTTP SSE GET failed");
                }
            }

            if !connected.load(Ordering::SeqCst) {
                break;
            }

            tokio::time::sleep(Duration::from_millis(delay)).await;
            delay = (delay * 2).min(SSE_RECONNECT_MAX_MS);
        }
    }
}

#[async_trait]
impl McpTransport for StreamableHttpTransport {
    async fn request(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        if !self.connected.load(Ordering::SeqCst) {
            return Err(anyhow!("Transport not connected"));
        }

        let extra_headers = self.request_headers().await;
        let body = serde_json::to_string(&request)?;

        let safe_url = crate::config::redact_url_for_debug(&self.url);
        let response = self
            .client
            .post(&self.url)
            .headers(extra_headers)
            .body(body)
            .send()
            .await
            .map_err(reqwest::Error::without_url)
            .with_context(|| format!("Streamable HTTP POST to {safe_url} failed"))?;

        if !response.status().is_success() {
            let status = response.status();
            let (bytes, truncated) = Self::read_bounded_bytes(response, MAX_ERROR_BODY_BYTES)
                .await
                .unwrap_or_default();
            let body = String::from_utf8_lossy(&bytes);
            let suffix = if truncated { " [truncated]" } else { "" };
            return Err(anyhow!("MCP server returned HTTP {status}: {body}{suffix}"));
        }

        self.capture_session_id(response.headers()).await;
        Self::parse_response(response).await
    }

    async fn notify(&self, notification: JsonRpcNotification) -> Result<()> {
        if !self.connected.load(Ordering::SeqCst) {
            return Err(anyhow!("Transport not connected"));
        }

        let extra_headers = self.request_headers().await;
        let body = serde_json::to_string(&notification)?;

        let safe_url = crate::config::redact_url_for_debug(&self.url);
        let response = self
            .client
            .post(&self.url)
            .headers(extra_headers)
            .body(body)
            .send()
            .await
            .map_err(reqwest::Error::without_url)
            .with_context(|| format!("Streamable HTTP notification to {safe_url} failed"))?;

        if !response.status().is_success() {
            tracing::warn!(
                status = %response.status(),
                "Streamable HTTP notification returned non-success status"
            );
        }

        Ok(())
    }

    fn notifications(&self) -> mpsc::Receiver<McpNotification> {
        self.notification_rx.take()
    }

    fn tool_list_changes(&self) -> Option<tokio::sync::watch::Receiver<()>> {
        Some(self.notification_rx.tool_list_changes())
    }

    async fn close(&self) -> Result<()> {
        self.connected.store(false, Ordering::SeqCst);

        // Send DELETE to terminate session if we have a session ID
        if let Some(ref sid) = *self.session_id.read().await {
            let mut headers = reqwest::header::HeaderMap::new();
            if let Ok(val) = reqwest::header::HeaderValue::from_str(sid) {
                headers.insert("Mcp-Session-Id", val);
            }
            let _ = self.client.delete(&self.url).headers(headers).send().await;
        }

        let mut abort = self
            .sse_abort
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(handle) = abort.take() {
            handle.abort();
        }

        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }
}

impl Drop for StreamableHttpTransport {
    fn drop(&mut self) {
        self.connected.store(false, Ordering::Release);
        if let Some(handle) = self
            .sse_abort
            .get_mut()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take()
        {
            handle.abort();
        }
    }
}

impl std::fmt::Debug for StreamableHttpTransport {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StreamableHttpTransport")
            .field("url", &crate::config::redact_url_for_debug(&self.url))
            .field("connected", &self.connected.load(Ordering::Relaxed))
            .finish()
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crlf_sse_frame_is_a_tools_list_response() {
        let mut buffer = "event: message\r\ndata: {\"jsonrpc\":\"2.0\",\"id\":7,\"result\":{\"tools\":[{\"name\":\"lookup\",\"inputSchema\":{\"type\":\"object\"}}]}}\r\n\r\n".to_string();
        let response = StreamableHttpTransport::response_from_sse_events(&mut buffer, false)
            .expect("CRLF tools/list frame");
        assert!(buffer.is_empty());
        assert_eq!(response.id, Some(7));
        let tools = response
            .result
            .as_ref()
            .and_then(|result| result.get("tools"))
            .and_then(|tools| tools.as_array())
            .expect("tools array");
        assert_eq!(tools[0]["name"], "lookup");
    }

    #[test]
    fn test_extract_json_rpc_response_valid() {
        let event = r#"data: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}"#;
        let result = StreamableHttpTransport::extract_json_rpc_response(event);
        assert!(result.is_some());
        assert_eq!(result.unwrap().id, Some(1));
    }

    #[test]
    fn test_extract_json_rpc_response_data_no_space() {
        let event = r#"data:{"jsonrpc":"2.0","id":1,"result":{"ok":true}}"#;
        let result = StreamableHttpTransport::extract_json_rpc_response(event);
        assert!(result.is_some());
        assert_eq!(result.unwrap().id, Some(1));
    }

    #[test]
    fn test_extract_json_rpc_response_empty() {
        let result = StreamableHttpTransport::extract_json_rpc_response("");
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_json_rpc_response_no_data_prefix() {
        let event = r#"event: message"#;
        let result = StreamableHttpTransport::extract_json_rpc_response(event);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_json_rpc_response_invalid_json() {
        let event = "data: not-json";
        let result = StreamableHttpTransport::extract_json_rpc_response(event);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_notification_valid() {
        let event = r#"data: {"jsonrpc":"2.0","method":"notifications/tools/list_changed"}"#;
        let result = StreamableHttpTransport::extract_notification(event);
        assert!(result.is_some());
        match result.unwrap() {
            McpNotification::ToolsListChanged => {}
            _ => panic!("Expected ToolsListChanged"),
        }
    }

    #[test]
    fn test_extract_notification_data_no_space() {
        let event = r#"data:{"jsonrpc":"2.0","method":"notifications/tools/list_changed"}"#;
        let result = StreamableHttpTransport::extract_notification(event);
        assert!(result.is_some());
        match result.unwrap() {
            McpNotification::ToolsListChanged => {}
            _ => panic!("Expected ToolsListChanged"),
        }
    }

    #[test]
    fn test_extract_notification_empty() {
        let result = StreamableHttpTransport::extract_notification("");
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_connect_and_close() {
        let transport = StreamableHttpTransport::connect("http://127.0.0.1:1", HashMap::new())
            .await
            .unwrap();
        assert!(transport.is_connected());
        transport.close().await.unwrap();
        assert!(!transport.is_connected());
    }

    #[tokio::test]
    async fn test_request_after_close_returns_error() {
        let transport = StreamableHttpTransport::connect("http://127.0.0.1:1", HashMap::new())
            .await
            .unwrap();
        transport.close().await.unwrap();
        let req = JsonRpcRequest::new(1, "test", None);
        let result = transport.request(req).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not connected"));
    }

    #[tokio::test]
    async fn test_notify_after_close_returns_error() {
        let transport = StreamableHttpTransport::connect("http://127.0.0.1:1", HashMap::new())
            .await
            .unwrap();
        transport.close().await.unwrap();
        let notif = JsonRpcNotification::new("test", None);
        let result = transport.notify(notif).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not connected"));
    }

    #[tokio::test]
    async fn test_double_close() {
        let transport = StreamableHttpTransport::connect("http://127.0.0.1:1", HashMap::new())
            .await
            .unwrap();
        transport.close().await.unwrap();
        transport.close().await.unwrap(); // must not panic
    }

    #[tokio::test]
    async fn test_custom_timeout() {
        let transport =
            StreamableHttpTransport::connect_with_timeout("http://127.0.0.1:1", HashMap::new(), 5)
                .await
                .unwrap();
        assert!(transport.is_connected());
        transport.close().await.unwrap();
    }

    #[tokio::test]
    async fn test_with_auth_header() {
        let mut headers = HashMap::new();
        headers.insert("Authorization".to_string(), "Bearer token".to_string());
        let transport = StreamableHttpTransport::connect("http://127.0.0.1:1", headers)
            .await
            .unwrap();
        assert!(transport.is_connected());
        transport.close().await.unwrap();
    }

    #[tokio::test]
    async fn test_debug_format() {
        let transport = StreamableHttpTransport::connect(
            "http://user:CANARY_PASS@127.0.0.1:1/mcp?token=CANARY_QUERY",
            HashMap::new(),
        )
        .await
        .unwrap();
        let s = format!("{:?}", transport);
        assert!(s.contains("StreamableHttpTransport"));
        assert!(!s.contains("CANARY_PASS"), "{s}");
        assert!(!s.contains("CANARY_QUERY"), "{s}");
        transport.close().await.unwrap();
    }
}
