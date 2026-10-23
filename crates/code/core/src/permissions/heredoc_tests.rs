#![cfg(test)]

use super::*;

#[test]
fn ordinary_python_heredocs_require_confirmation_without_parsing_their_body_as_shell() {
    let root = tempfile::tempdir().unwrap();
    let guard = InteractiveToolGuardrail::default().with_workspace(root.path());
    let calls: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/heredoc_permission_calls.json")).unwrap();
    for call in calls.as_array().unwrap() {
        let command = call["args"]["command"]
            .as_str()
            .unwrap()
            .replace("__WORKSPACE__", root.path().to_str().unwrap());
        let args = serde_json::json!({"command":command});
        assert_eq!(
            guard.check("bash", &args),
            PermissionDecision::Ask,
            "{}: {:?}",
            call["id"],
            guard.assess("bash", &args)
        );
    }
}
