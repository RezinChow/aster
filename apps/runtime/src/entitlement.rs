//! Entitlement ∩ Grants projection — local allowlist until Cloud compile.

pub const ENTITLED_API_SKUS: &[&str] = &[];

pub const ENTITLED_TOOL_SKUS: &[&str] = &[];

pub const ENTITLED_MODEL_IDS: &[&str] = &[];

pub fn is_entitled_api(sku: &str) -> bool {
    ENTITLED_API_SKUS.contains(&sku)
}

pub fn is_entitled_model(id: &str) -> bool {
    ENTITLED_MODEL_IDS.contains(&id)
}

pub fn spend_cap_usd() -> f64 {
    std::env::var("A3S_FUNCTION_SPEND_CAP_USD")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(50.0)
}
