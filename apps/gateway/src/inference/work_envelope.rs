//! Work Connect ApiEnvelope for managed inference JSON responses.
//!
//! Shape matches `packages/function/src/envelope.ts` and
//! `apps/web/docs/console/API-ENVELOPE.md` / WORK-CONNECT.md:
//! numeric `code` + stable string `error_code` taxonomy.

use bytes::Bytes;
use chrono::Utc;
use http::header::CONTENT_TYPE;
use http::{HeaderValue, Response, StatusCode};
use serde_json::{json, Value};
use uuid::Uuid;

use super::identity::REQUEST_ID_HEADER;

/// Build a successful Work Connect envelope (`data` = business payload).
pub(crate) fn ok_envelope(data: Value, request_id: Uuid) -> Value {
    json!({
        "success": true,
        "code": 0,
        "message": "OK",
        "data": data,
        "request_id": request_id,
        "timestamp": Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    })
}

/// Build a failed Work Connect envelope (`data` = null).
pub(crate) fn err_envelope(
    request_id: Uuid,
    http_status: StatusCode,
    message: &str,
    error_code: &str,
) -> (StatusCode, Value) {
    let code = match http_status.as_u16() {
        401 => 40100,
        403 => 40300,
        404 => 40400,
        429 => 42900,
        400 | 415 | 413 => 40000,
        502 | 503 => 50300,
        _ if (500..600).contains(&http_status.as_u16()) => 50000,
        _ => 40000,
    };
    (
        http_status,
        json!({
            "success": false,
            "code": code,
            "message": message,
            "data": Value::Null,
            "request_id": request_id,
            "timestamp": Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            "error_code": error_code,
        }),
    )
}

/// Serialize an envelope into an HTTP JSON response with `x-request-id`.
pub(crate) fn envelope_response(
    status: StatusCode,
    body: Value,
    request_id: Uuid,
) -> Response<Bytes> {
    let bytes = Bytes::from(serde_json::to_vec(&body).unwrap_or_else(|_| {
        br#"{"success":false,"code":50000,"message":"envelope serialize failed","data":null}"#
            .to_vec()
    }));
    let mut response = Response::new(bytes);
    *response.status_mut() = status;
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    if let Ok(value) = HeaderValue::from_str(&request_id.to_string()) {
        response.headers_mut().insert(REQUEST_ID_HEADER, value);
    }
    response
}

/// Failed envelope response tagged for native-wire re-rendering.
pub(crate) fn error_envelope_response(
    request_id: Uuid,
    http_status: StatusCode,
    message: &'static str,
    error_code: &'static str,
) -> Response<Bytes> {
    let (status, body) = err_envelope(request_id, http_status, message, error_code);
    let mut response = envelope_response(status, body, request_id);
    response
        .extensions_mut()
        .insert(super::native_wire::EnvelopeError {
            status,
            message,
            error_code,
        });
    response
}

/// Wrap a complete upstream JSON body in a Work Connect success envelope.
///
/// Returns `None` when the bytes are not a JSON value (leave the body unchanged).
pub(crate) fn wrap_json_success_body(bytes: &Bytes, request_id: Uuid) -> Option<Bytes> {
    let value = serde_json::from_slice::<Value>(bytes).ok()?;
    // Already enveloped (e.g. upstream Function) — do not double-wrap.
    if value.get("success").is_some()
        && value.get("request_id").is_some()
        && value.get("data").is_some()
    {
        return None;
    }
    let body = ok_envelope(value, request_id);
    serde_json::to_vec(&body).ok().map(Bytes::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn err_envelope_carries_work_connect_error_code() {
        let id = Uuid::nil();
        let (status, body) = err_envelope(
            id,
            StatusCode::UNAUTHORIZED,
            "Invalid authentication credentials.",
            "auth.invalid_key",
        );
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(body["success"], false);
        assert_eq!(body["code"], 40100);
        assert_eq!(body["data"], Value::Null);
        assert_eq!(body["error_code"], "auth.invalid_key");
        assert_eq!(body["request_id"], id.to_string());
    }

    #[test]
    fn ok_envelope_puts_payload_in_data() {
        let id = Uuid::new_v4();
        let body = ok_envelope(json!({"object": "list", "data": []}), id);
        assert_eq!(body["success"], true);
        assert_eq!(body["code"], 0);
        assert_eq!(body["data"]["object"], "list");
    }

    #[test]
    fn wrap_json_success_body_nests_openai_payload() {
        let id = Uuid::new_v4();
        let raw = Bytes::from_static(br#"{"id":"chatcmpl-1","object":"chat.completion"}"#);
        let wrapped = wrap_json_success_body(&raw, id).expect("wrap");
        let body: Value = serde_json::from_slice(&wrapped).unwrap();
        assert_eq!(body["success"], true);
        assert_eq!(body["data"]["object"], "chat.completion");
        assert_eq!(body["request_id"], id.to_string());
    }

    #[test]
    fn wrap_json_success_body_skips_existing_envelope() {
        let id = Uuid::new_v4();
        let already =
            Bytes::from(serde_json::to_vec(&ok_envelope(json!({"ok": true}), id)).unwrap());
        assert!(wrap_json_success_body(&already, id).is_none());
    }
}
