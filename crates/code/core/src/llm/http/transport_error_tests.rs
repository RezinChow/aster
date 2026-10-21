use super::*;
use std::io::ErrorKind;
use tokio::io::AsyncReadExt;

#[derive(Debug, thiserror::Error)]
#[error("opaque request failure")]
struct Wrapped(#[source] std::io::Error);

#[test]
fn localized_io_failures_retain_the_existing_hard_failure_policy() {
    for kind in [
        ErrorKind::ConnectionReset,
        ErrorKind::ConnectionRefused,
        ErrorKind::NetworkUnreachable,
        ErrorKind::HostUnreachable,
    ] {
        let source = Wrapped(std::io::Error::new(kind, "本地化的操作系统错误"));
        let error = anyhow::Error::new(HttpClientError::transport(
            "HTTP request",
            render_error_chain(&source),
        ));
        assert!(!is_retryable_http_failure(&error), "{kind:?}: {error}");
    }
}

#[test]
fn typed_transient_io_failures_remain_retryable() {
    for kind in [ErrorKind::TimedOut, ErrorKind::UnexpectedEof] {
        let source = Wrapped(std::io::Error::new(kind, "本地化的操作系统错误"));
        let error = anyhow::Error::new(HttpClientError::transport(
            "HTTP request",
            render_error_chain(&source),
        ));
        assert!(is_retryable_http_failure(&error), "{kind:?}: {error}");
    }
}

#[tokio::test]
async fn actual_loopback_reset_does_not_enter_provider_backoff() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("loopback listener");
    let address = listener.local_addr().expect("loopback address");
    let peer = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.expect("accept request");
        let mut first = [0_u8; 1];
        stream
            .read_exact(&mut first)
            .await
            .expect("request started");
        #[allow(deprecated)]
        stream
            .set_linger(Some(Duration::ZERO))
            .expect("reset on close");
    });
    let client = ReqwestHttpClient {
        client: reqwest::Client::builder()
            .no_proxy()
            .build()
            .expect("local client"),
        request_timeout: Some(Duration::from_secs(2)),
    };
    let error = client
        .post(
            &format!("http://{address}/v1/chat/completions"),
            Vec::new(),
            &serde_json::json!({"model": "synthetic"}),
            CancellationToken::new(),
        )
        .await
        .err()
        .expect("peer must reset the request");
    peer.await.expect("peer completed");
    assert!(!is_retryable_http_failure(&error), "{error:#}");
    assert!(error.to_string().contains("connection reset"), "{error:#}");
}
