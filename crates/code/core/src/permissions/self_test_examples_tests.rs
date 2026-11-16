//! Hermetic coverage for permission-rule `match` / `not_match` self-tests (P0-1).

use super::*;
use serde_json::json;

const EXAMPLE_POLICY: &str = include_str!("fixtures/policy_self_test.example.json");
const BAD_NOT_MATCH_POLICY: &str = include_str!("fixtures/policy_self_test.bad_not_match.json");

#[test]
fn example_policy_loads_with_match_and_not_match() {
    let policy: PermissionPolicy =
        serde_json::from_str(EXAMPLE_POLICY).expect("example policy must load");
    policy
        .validate_rule_examples()
        .expect("embedded examples must validate");

    assert_eq!(
        policy.check("bash", &json!({"command": "git status"})),
        PermissionDecision::Allow
    );
    assert_eq!(
        policy.check("bash", &json!({"command": "rm -rf /tmp/scratch"})),
        PermissionDecision::Deny
    );
    assert_eq!(
        policy.check("bash", &json!({"command": "cargo test -p aster-core"})),
        PermissionDecision::Ask
    );
    assert_eq!(
        policy.check("read", &json!({"file_path": "src/permissions/rule.rs"})),
        PermissionDecision::Allow
    );
    assert_eq!(
        policy.check("bash", &json!({"command": "echo hi"})),
        PermissionDecision::Ask,
        "default_decision applies when no rule matches"
    );
}

#[test]
fn bad_not_match_rejects_at_load() {
    let err = serde_json::from_str::<PermissionPolicy>(BAD_NOT_MATCH_POLICY)
        .expect_err("not_match that still matches the rule must reject load");
    let message = err.to_string();
    assert!(
        message.contains("not_match"),
        "error should name not_match, got: {message}"
    );
}

#[test]
fn allow_ask_deny_merge_order_with_self_tests() {
    let policy: PermissionPolicy = serde_json::from_str(
        r#"{
          "deny": [{"rule":"Bash(rm:*)","match":["rm x"],"not_match":["git status"]}],
          "allow": [{"rule":"Bash(git:*)","match":["git status"],"not_match":["rm x"]}],
          "ask": [{"rule":"Bash(cargo:*)","match":["cargo test"],"not_match":["git status"]}],
          "default_decision": "ask"
        }"#,
    )
    .expect("merge fixture must load");

    assert_eq!(
        policy.check("bash", &json!({"command": "rm x"})),
        PermissionDecision::Deny,
        "deny wins over allow/ask"
    );
    assert_eq!(
        policy.check("bash", &json!({"command": "git status"})),
        PermissionDecision::Allow
    );
    assert_eq!(
        policy.check("bash", &json!({"command": "cargo test"})),
        PermissionDecision::Ask
    );
}

#[test]
fn yaml_struct_form_supports_match_not_match() {
    let policy: PermissionPolicy = serde_yaml::from_str(
        r#"
default_decision: ask
allow:
  - rule: "Bash(git status:*)"
    match:
      - git status
    not_match:
      - git statusx
"#,
    )
    .expect("yaml policy with self-tests must load");
    assert_eq!(
        policy.check("bash", &json!({"command": "git status"})),
        PermissionDecision::Allow
    );
}

#[test]
fn validate_rule_examples_reports_failed_match() {
    let mut rule = PermissionRule::new("Bash(git status:*)");
    rule.match_examples = vec![RuleMatchExample::Shorthand("git statusx".into())];
    let err = rule
        .validate_examples("allow")
        .expect_err("non-matching match example must fail");
    assert!(err.contains("match[0]"), "{err}");
}
