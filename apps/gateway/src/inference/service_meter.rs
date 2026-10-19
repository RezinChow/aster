//! One signed-in call becomes one idempotent usage fact.
//!
//! The fact is the billing input: `transaction_id` is the request id, `metric_code`
//! is the gateway standard, and `quantity` is 1 after success. A failed call is
//! still recorded so statistics see it, with quantity 0 so it does not add to the
//! bill. This module does not talk to the billing service.

use uuid::Uuid;

use super::standards::ModelStandard;

/// A completed call from a user who already passed sign-in.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SignedInCall {
    pub standard: ModelStandard,
    pub request_id: Uuid,
    pub subject: String,
    /// Supplier slug. Empty means the platform chooses a supplier that offers the standard.
    pub supplier: String,
    pub succeeded: bool,
}

/// Stable usage fact. Repeating the same request id repeats the same transaction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct UsageFact {
    pub transaction_id: String,
    pub metric_code: &'static str,
    pub quantity: i64,
    pub subject: String,
    pub supplier: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum MeterError {
    Anonymous,
    Supplier,
}

impl std::fmt::Display for MeterError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Anonymous => formatter.write_str("a signed-in subject is required"),
            Self::Supplier => {
                formatter.write_str("supplier must be a lowercase slug without a path or address")
            }
        }
    }
}

impl std::error::Error for MeterError {}

/// Every catalog standard is available to a signed-in user. There is no second allow-list.
pub(crate) fn signed_in_catalog() -> &'static [ModelStandard] {
    &ModelStandard::ALL
}

pub(crate) fn meter(call: &SignedInCall) -> Result<UsageFact, MeterError> {
    let subject = call.subject.trim();
    if subject.is_empty() {
        return Err(MeterError::Anonymous);
    }
    let supplier = normalize_supplier(&call.supplier)?;
    Ok(UsageFact {
        transaction_id: call.request_id.to_string(),
        metric_code: call.standard.as_str(),
        quantity: i64::from(call.succeeded),
        subject: subject.to_owned(),
        supplier,
    })
}

fn normalize_supplier(value: &str) -> Result<String, MeterError> {
    let supplier = value.trim();
    if supplier.is_empty() {
        return Ok(String::new());
    }
    let mut chars = supplier.chars();
    let Some(first) = chars.next() else {
        return Ok(String::new());
    };
    if !first.is_ascii_lowercase() {
        return Err(MeterError::Supplier);
    }
    let mut length = 1_usize;
    for ch in chars {
        length += 1;
        if length > 64
            || !(ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || ch == '-')
        {
            return Err(MeterError::Supplier);
        }
    }
    Ok(supplier.to_owned())
}
