use super::*;
use crate::config::StaticObjectS3Config;
use crate::static_object::port::{sha256_hex, ReadOnlyObjectPort};
use crate::static_object::{
    DeploymentObjectAuthority, StaticBundleManifest, StaticObjectEntry,
    STATIC_BUNDLE_MANIFEST_SCHEMA,
};
use std::collections::BTreeMap;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

fn config(endpoint: &str) -> StaticObjectAuthorityConfig {
    StaticObjectAuthorityConfig {
        s3: StaticObjectS3Config {
            endpoint: endpoint.into(),
            region: "us-east-1".into(),
            bucket: "web".into(),
            prefix: "cloud/web-bundles".into(),
            access_key_id_env: "WEB_TEST_ACCESS_KEY".into(),
            secret_access_key_env: "WEB_TEST_SECRET_KEY".into(),
            session_token_env: None,
            ca_file: None,
            allow_http: endpoint.starts_with("http:"),
            virtual_hosted_style: false,
            request_timeout_ms: 1_000,
            connect_timeout_ms: 500,
        },
    }
}

fn credentials(_name: &str) -> Option<String> {
    // These are protocol fixture strings, never an external account.
    Some("local-fixture-only".into())
}

#[test]
fn deployment_static_s3_refuses_missing_or_invalid_credentials_without_disclosure() {
    let config = config("https://objects.invalid");
    let error = build_with_credentials(&config, |_| None)
        .err()
        .unwrap()
        .to_string();
    assert!(error.contains("missing or invalid"));
    let sensitive = "private-fixture-line\n";
    let error = build_with_credentials(&config, |_| Some(sensitive.into()))
        .err()
        .unwrap()
        .to_string();
    assert!(!error.contains(sensitive));
    assert!(error.contains("missing or invalid"));
}

#[test]
fn deployment_static_s3_refuses_unknown_endpoints_namespaces_and_timeout_escape() {
    for endpoint in [
        "http://remote.invalid",
        "https://key:secret@objects.invalid",
        "https://objects.invalid/?token=secret",
        "https://objects.invalid/path",
        "ftp://localhost",
    ] {
        assert!(config(endpoint).validate().is_err(), "accepted {endpoint}");
    }
    let mut invalid = config("https://objects.invalid");
    invalid.s3.prefix = "cloud/../foreign".into();
    assert!(invalid.validate().is_err());
    invalid.s3.prefix = "cloud/web-bundles".into();
    invalid.s3.request_timeout_ms = 60_001;
    assert!(invalid.validate().is_err());
    invalid.s3.request_timeout_ms = 1_000;
    invalid.s3.access_key_id_env = "literal key value".into();
    assert!(invalid.validate().is_err());
}

#[test]
fn deployment_static_s3_private_ca_is_bounded_and_never_echoes_file_contents() {
    let directory = tempfile::tempdir().unwrap();
    let ca = directory.path().join("ca.pem");
    let sensitive = "invalid-certificate-fixture";
    std::fs::write(&ca, sensitive).unwrap();
    let mut config = config("https://objects.invalid");
    config.s3.ca_file = Some(ca);
    let error = build_with_credentials(&config, credentials)
        .err()
        .unwrap()
        .to_string();
    assert!(error.contains("CA bundle"));
    assert!(!error.contains(sensitive));
}

async fn request(socket: &mut tokio::net::TcpStream) -> String {
    let mut header = Vec::new();
    while !header.ends_with(b"\r\n\r\n") {
        let mut byte = [0];
        socket.read_exact(&mut byte).await.unwrap();
        header.push(byte[0]);
        assert!(header.len() < 16 * 1024);
    }
    String::from_utf8(header).unwrap()
}

#[tokio::test]
async fn deployment_static_s3_signed_read_uses_cloud_keys_and_never_writes() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let server = tokio::spawn(async move {
        let mut methods = Vec::new();
        for _ in 0..2 {
            let (mut socket, _) = listener.accept().await.unwrap();
            let header = request(&mut socket).await;
            assert!(header
                .to_ascii_lowercase()
                .contains("authorization: aws4-hmac-sha256"));
            assert!(header
                .lines()
                .next()
                .unwrap()
                .contains("/web/cloud/web-bundles/org/release/objects/index.html"));
            let method = header.split_ascii_whitespace().next().unwrap().to_owned();
            assert!(matches!(method.as_str(), "HEAD" | "GET"));
            let head = method == "HEAD";
            methods.push(method);
            socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\nLast-Modified: Thu, 01 Oct 2026 00:00:00 GMT\r\nETag: \"fixture\"\r\nConnection: close\r\n\r\n").await.unwrap();
            if !head {
                socket.write_all(b"hello").await.unwrap();
            }
        }
        methods
    });
    let options = config(&endpoint);
    let client = build_with_credentials(&options, credentials).unwrap();
    let digest = sha256_hex(b"hello");
    let manifest = StaticBundleManifest {
        schema: STATIC_BUNDLE_MANIFEST_SCHEMA.into(),
        release_digest: sha256_hex(b"release"),
        entry_document: "index.html".into(),
        base_path: "/".into(),
        spa_fallback: None,
        provenance_digest: None,
        entries: BTreeMap::from([(
            "index.html".into(),
            StaticObjectEntry {
                digest: digest.clone(),
                size: 5,
                media_type: "text/html".into(),
                content_encoding: None,
            },
        )]),
    };
    let port = DeploymentObjectAuthority::new(
        client,
        &options.s3.prefix,
        "org/release",
        &manifest,
        Duration::from_secs(1),
    )
    .unwrap();
    assert_eq!(port.head(&digest).await.unwrap().size, 5);
    assert_eq!(port.get(&digest).await.unwrap().body.as_ref(), b"hello");
    assert_eq!(server.await.unwrap(), ["HEAD", "GET"]);
}

#[tokio::test]
async fn deployment_static_s3_does_not_follow_signed_request_redirects() {
    let origin = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let destination = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("http://{}", origin.local_addr().unwrap());
    let redirect = format!("http://{}/leak", destination.local_addr().unwrap());
    let server = tokio::spawn(async move {
        let (mut socket, _) = origin.accept().await.unwrap();
        let _ = request(&mut socket).await;
        let response = format!("HTTP/1.1 307 Temporary Redirect\r\nLocation: {redirect}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        socket.write_all(response.as_bytes()).await.unwrap();
    });
    let client = build_with_credentials(&config(&endpoint), credentials).unwrap();
    assert!(client
        .get(&object_store::path::Path::from("cloud/object"))
        .await
        .is_err());
    server.await.unwrap();
    assert!(
        tokio::time::timeout(Duration::from_millis(100), destination.accept())
            .await
            .is_err()
    );
}

#[tokio::test]
async fn deployment_static_s3_read_deadline_covers_the_entire_provider_wait() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let _ = request(&mut socket).await;
        std::future::pending::<()>().await;
    });
    let options = config(&endpoint);
    let client = build_with_credentials(&options, credentials).unwrap();
    let digest = sha256_hex(b"hello");
    let manifest = StaticBundleManifest {
        schema: STATIC_BUNDLE_MANIFEST_SCHEMA.into(),
        release_digest: sha256_hex(b"release"),
        entry_document: "index.html".into(),
        base_path: "/".into(),
        spa_fallback: None,
        provenance_digest: None,
        entries: BTreeMap::from([(
            "index.html".into(),
            StaticObjectEntry {
                digest: digest.clone(),
                size: 5,
                media_type: "text/html".into(),
                content_encoding: None,
            },
        )]),
    };
    let port = DeploymentObjectAuthority::new(
        client,
        &options.s3.prefix,
        "org/release",
        &manifest,
        Duration::from_millis(30),
    )
    .unwrap();
    let error = port.get(&digest).await.unwrap_err().to_string();
    assert!(error.contains("timed out"), "unexpected error: {error}");
    server.abort();
    let _ = server.await;
}
