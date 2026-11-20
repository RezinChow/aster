#![cfg(test)]

use super::*;
use crate::skills::{Skill, SkillKind, SkillRegistry};

fn loop_skills() -> Arc<SkillRegistry> {
    let registry = Arc::new(SkillRegistry::with_builtins());
    registry.register_unchecked(Arc::new(Skill {
        name: "loop".into(),
        description: "test KBurn loop".into(),
        allowed_tools: None,
        disable_model_invocation: false,
        kind: SkillKind::Instruction,
        content: "Drive implementation, evidence, review and acceptance.".into(),
        tags: vec![],
        version: None,
    }));
    registry
}

fn loop_state(workspace: &std::path::Path, status: &str) {
    let directory = workspace.join(".kstudio/local/loops");
    std::fs::create_dir_all(&directory).unwrap();
    let hash = "a".repeat(64);
    let state = if status == "task_accepted" {
        serde_json::json!({
            "schema": "kstudio.loop-state.v1",
            "spec": {"task_id": "demo"},
            "status": status,
            "last_receipt_sha256": hash,
            "seen_feedback": [hash],
            "history": [{"kind": "feedback", "status": status}]
        })
    } else {
        serde_json::json!({"task_id":"demo", "status":status})
    };
    std::fs::write(directory.join("demo.json"), state.to_string()).unwrap();
}

async fn finish_after_loop_skill(
    workspace: &std::path::Path,
) -> crate::error::Result<crate::AgentResult> {
    let agent = crate::Agent::from_config(test_config()).await.unwrap();
    let session = agent
        .build_session(
            workspace.to_string_lossy().into_owned(),
            Arc::new(ScriptedStreamingClient::new(vec![
                scripted_tool_call_response(
                    "kburn-loop",
                    "Skill",
                    serde_json::json!({"skill_name":"loop"}),
                ),
                scripted_text_response("The implementation is complete."),
            ])),
            &crate::SessionOptions::new()
                .with_session_id("kburn-loop-completion")
                .with_skill_registry(loop_skills())
                .with_permission_policy(crate::permissions::PermissionPolicy::new().allow("*"))
                .with_planning_mode(crate::prompts::PlanningMode::Disabled)
                .with_auto_delegation_enabled(false)
                .with_auto_compact(false)
                .with_continuation(false),
        )
        .unwrap();
    session.send("Complete the scoped task.", None).await
}

#[tokio::test]
async fn kburn_loop_completion_requires_real_acceptance_on_agent_path() {
    let workspace = tempfile::tempdir().unwrap();
    loop_state(workspace.path(), "running");
    let error = finish_after_loop_skill(workspace.path())
        .await
        .expect_err("an active KBurn loop must not finish");
    assert!(
        error.to_string().contains("KBurn loop demo is running"),
        "{error}"
    );

    loop_state(workspace.path(), "task_accepted");
    let result = finish_after_loop_skill(workspace.path())
        .await
        .expect("a real accepted loop may finish");
    assert_eq!(result.text, "The implementation is complete.");
}

#[tokio::test]
async fn kburn_loop_skill_without_state_cannot_finish_on_agent_path() {
    let workspace = tempfile::tempdir().unwrap();
    let error = finish_after_loop_skill(workspace.path())
        .await
        .expect_err("loading the loop skill is not task acceptance");
    assert!(
        error.to_string().contains("no task_accepted receipt"),
        "{error}"
    );
}
