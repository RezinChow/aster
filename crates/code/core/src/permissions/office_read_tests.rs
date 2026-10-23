#![cfg(test)]

use super::*;
use serde_json::json;

#[test]
fn native_office_reads_use_existing_read_boundaries_and_exact_path_denies() {
    let root = tempfile::tempdir().unwrap();
    for mode in ["default", "plan", "auto", "force"] {
        let guard = InteractiveToolGuardrail::for_mode(mode)
            .unwrap()
            .with_workspace(root.path());
        for path in ["source.xlsx", "../private.xlsx", "/private.xlsx", ""] {
            let args = json!({"file_path":path});
            assert_eq!(
                guard.check("office_read", &args),
                guard.check("read", &args),
                "{mode}: {path}"
            );
        }
        assert_eq!(
            guard
                .assess("office_read", &json!({"file_path":"source.xlsx"}))
                .dimensions
                .tool_type,
            ToolRiskType::ReadOnly
        );
    }
    let policy = policy_for_posture("yolo").deny("office_read(private/*)");
    assert_eq!(
        policy.check("office_read", &json!({"file_path":"private/report.xlsx"})),
        PermissionDecision::Deny
    );
    assert_eq!(
        InteractiveToolGuardrail::default()
            .check("office_read_write", &json!({"file_path":"source.xlsx"})),
        PermissionDecision::Ask
    );
}
