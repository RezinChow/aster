//! Honest-refusal contracts for the unwired usage/analytics export surfaces
//! (`specs/005-os-convergence-execution` US-7): a named 501 beats a fake
//! empty 200.

use super::*;

use axum::body::Body;
use axum::http::Request;
use tower::ServiceExt;

async fn call(
    app: &Router,
    method: &str,
    uri: &str,
    key: Option<&str>,
    body: &str,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json");
    if let Some(key) = key {
        builder = builder.header("authorization", format!("Bearer {key}"));
    }
    let response = app
        .clone()
        .oneshot(builder.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), 1_000_000)
        .await
        .unwrap();
    let value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, value)
}

fn temp_state() -> (std::path::PathBuf, AppState) {
    let dir = std::env::temp_dir().join(format!("runtime-export-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    (dir.clone(), AppState::new(dir))
}

#[tokio::test]
async fn usage_batch_refuses_with_named_reason_until_wired() {
    let (dir, state) = temp_state();
    let app = router(state);
    let key = crate::auth::DEV_CAPABILITY_KEY;

    // Unauthenticated callers get 401, not the capability answer.
    let (status, _) = call(&app, "POST", "/v1/api/usage/batch", None, "{}").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // Authenticated callers get a named refusal, never an empty batch that
    // reads as "nothing to export".
    let (status, body) = call(
        &app,
        "POST",
        "/v1/api/usage/batch",
        Some(key),
        r#"{"cursor":0}"#,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_IMPLEMENTED);
    assert_eq!(body["error_code"], "usage_export.not_wired");
    assert!(body["message"].as_str().unwrap_or("").contains("not wired"));

    let _ = std::fs::remove_dir_all(dir);
}

#[tokio::test]
async fn analytics_refuses_with_named_reason_until_wired() {
    let (dir, state) = temp_state();
    let app = router(state);
    let key = crate::auth::DEV_CAPABILITY_KEY;

    let (status, _) = call(&app, "GET", "/v1/api/analytics", None, "").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, body) = call(&app, "GET", "/v1/api/analytics", Some(key), "").await;
    assert_eq!(status, StatusCode::NOT_IMPLEMENTED);
    assert_eq!(body["error_code"], "analytics.not_wired");
    assert!(body["message"].as_str().unwrap_or("").contains("not wired"));

    let _ = std::fs::remove_dir_all(dir);
}

#[tokio::test]
async fn usage_view_carries_real_records_and_no_lifecycle_advertisement() {
    let (dir, state) = temp_state();
    let app = router(state);
    let key = crate::auth::DEV_CAPABILITY_KEY;

    let (status, body) = call(&app, "GET", "/v1/api/usage", Some(key), "").await;
    assert_eq!(status, StatusCode::OK);
    let data = &body["data"];
    assert!(data["items"].is_array());
    assert!(data["spend_usd"].is_number());
    // The lifecycle export is unwired, so the view must not advertise its
    // schema or a zero event count as if it were live.
    assert!(data.get("lifecycle_events").is_none());
    assert!(data.get("lifecycle_schema").is_none());
    assert!(data.get("batch_schema").is_none());

    let _ = std::fs::remove_dir_all(dir);
}
