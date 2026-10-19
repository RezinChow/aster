#![cfg(test)]

use uuid::Uuid;

use super::service_meter::{meter, signed_in_catalog, SignedInCall};
use super::standards::{ModelStandard, ServiceClass};

fn call(standard: ModelStandard, succeeded: bool) -> SignedInCall {
    SignedInCall {
        standard,
        request_id: Uuid::from_u128(7),
        subject: "user-1".to_string(),
        supplier: "boyue".to_string(),
        succeeded,
    }
}

#[test]
fn signed_in_user_can_call_every_standard() {
    assert_eq!(signed_in_catalog().len(), ModelStandard::ALL.len());
    assert!(signed_in_catalog().contains(&ModelStandard::Api));
    assert!(signed_in_catalog().contains(&ModelStandard::Mcp));
    assert!(signed_in_catalog().contains(&ModelStandard::OpenaiChat));
}

#[test]
fn success_bills_one_call_and_failure_stays_a_statistic() {
    let request = Uuid::from_u128(9);
    let mut success = call(ModelStandard::Mcp, true);
    success.request_id = request;
    success.supplier.clear();
    let billed = meter(&success).unwrap();
    assert_eq!(billed.transaction_id, request.to_string());
    assert_eq!(billed.metric_code, "mcp");
    assert_eq!(billed.quantity, 1);
    assert_eq!(billed.supplier, "");

    let mut failed = call(ModelStandard::Api, false);
    failed.request_id = request;
    let stat = meter(&failed).unwrap();
    assert_eq!(stat.transaction_id, billed.transaction_id);
    assert_eq!(stat.metric_code, "api");
    assert_eq!(stat.quantity, 0);
}

#[test]
fn anonymous_and_address_shaped_suppliers_are_refused() {
    let mut anonymous = call(ModelStandard::Api, true);
    anonymous.subject = "  ".to_string();
    assert!(meter(&anonymous).is_err());

    let mut addressed = call(ModelStandard::Api, true);
    addressed.supplier = "https://example.test".to_string();
    assert!(meter(&addressed).is_err());
}

#[test]
fn api_and_mcp_are_their_own_classes() {
    assert_eq!(ModelStandard::Api.class(), ServiceClass::Api);
    assert_eq!(ModelStandard::Api.routes()[0].path, "/v1/service");
    assert_eq!(ModelStandard::Mcp.class(), ServiceClass::Mcp);
    assert_eq!(ModelStandard::OpenaiChat.class(), ServiceClass::Model);
    assert!(ModelStandard::Mcp.decision_questions().is_empty());
}
