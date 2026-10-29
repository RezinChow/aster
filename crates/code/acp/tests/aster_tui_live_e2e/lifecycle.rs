use super::driver::LiveTui;
use std::time::{Duration, Instant};

const READ_SESSION: &str = "Use the read tool once to read session-proof.txt and reply with its exact contents. Do not call other tools or modify any file.";
const RECALL_SESSION: &str = "Reply with the exact contents of session-proof.txt that you read earlier in this conversation. Do not call any tools.";
const CAT_APPROVAL: &str = "Use the bash tool exactly once to run cat approval-proof.txt. Reply with its exact output. Do not call other tools or modify any file.";

fn assert_one_bash(facts: &[serde_json::Value]) {
    let prepared: Vec<_> = facts
        .iter()
        .filter(|f| f["type"] == "tool.prepared")
        .collect();
    assert_eq!(prepared.len(), 1);
    assert_eq!(prepared[0]["payload"]["prepared"]["tool_name"], "bash");
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_resume_and_continue_restore_model_history() {
    let mut tui = LiveTui::new("resume-model-history");
    let token = format!("RESTORED-{}", uuid::Uuid::new_v4());
    std::fs::write(tui.workspace.join("session-proof.txt"), &token).unwrap();
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    let id = tui.session_id();
    tui.dismiss();
    let facts = tui.turn(READ_SESSION, None);
    assert!(tui.assistant_text(&facts).contains(&token));
    tui.checkpoint_session("original");
    tui.quit();
    for flag in ["--resume", "--continue"] {
        let args = if flag == "--resume" {
            vec![flag, id.as_str()]
        } else {
            vec![flag]
        };
        tui.launch_default(&args);
        tui.wait_for("kimi/", 45);
        assert_eq!(tui.session_id(), id);
        tui.dismiss();
        let facts = tui.turn(RECALL_SESSION, None);
        assert!(tui.assistant_text(&facts).contains(&token));
        assert!(
            !facts.iter().any(|f| f["type"] == "tool.prepared"),
            "restored recall must use model history, not another read"
        );
        tui.record(flag, "same parent identity; Kimi recalls unseen token from restored conversation without tools");
        tui.checkpoint_session(flag);
        tui.quit();
    }
    tui.finish();
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_explicit_deny_survives_yolo_and_next_read() {
    let mut tui = LiveTui::new("yolo-explicit-deny");
    let token = format!("PROTECTED-{}", uuid::Uuid::new_v4());
    let file = tui.workspace.join("protected.txt");
    std::fs::write(&file, &token).unwrap();
    tui.launch(&["--yolo", "--deny", "Write(*)"]);
    tui.wait_for("Aster", 45);
    let facts = tui.turn("Use the write tool exactly once to replace protected.txt with REPLACED. Do not call any other tools. Report the actual result.", None);
    assert!(facts
        .iter()
        .any(|f| f["type"] == "tool.prepared" && f["payload"]["prepared"]["tool_name"] == "write"));
    assert!(facts
        .iter()
        .any(|f| f["type"] == "tool.result" && f["payload"]["receipt"]["outcome"] == "denied"));
    assert_eq!(std::fs::read(&file).unwrap(), token.as_bytes());
    tui.record(
        "explicit-deny",
        "actual write denied under YOLO; exact original bytes retained",
    );
    let facts = tui.turn("Use the read tool once to read protected.txt and reply with its exact contents. Do not call other tools or modify any file.", None);
    assert!(tui.assistant_text(&facts).contains(&token));
    tui.record(
        "usable-after-denial",
        "subsequent actual Kimi read completes in the same session",
    );
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_allow_always_survives_restart_and_is_workspace_scoped() {
    let mut tui = LiveTui::new("learned-approval");
    let token = format!("LEARNED-{}", uuid::Uuid::new_v4());
    std::fs::write(tui.workspace.join("approval-proof.txt"), &token).unwrap();
    tui.launch(&[]);
    tui.wait_for("Aster", 45);
    let facts = tui.turn(CAT_APPROVAL, Some(b"\x1b[B\r"));
    assert_one_bash(&facts);
    assert_eq!(tui.permission_answer_count(), 1);
    assert!(tui.assistant_text(&facts).contains(&token));
    let store = tui
        .files(&tui.home, "acl")
        .into_iter()
        .find(|p| p.file_name().and_then(|v| v.to_str()) == Some("approvals.acl"))
        .expect("allow-always must persist an ACL store in the isolated home");
    let saved = std::fs::read_to_string(&store).unwrap();
    let document = a3s_acl::parse_acl(&saved).unwrap();
    assert!(document.blocks.iter().any(|b| matches!(b.attributes.get("rules"), Some(a3s_acl::Value::List(rules)) if rules.contains(&a3s_acl::Value::String("cat".into())))));
    tui.record(
        "allow-always",
        "actual permission selection persisted the exact cat rule in ACL",
    );
    tui.checkpoint_session("learned");
    tui.quit();
    tui.launch(&[]);
    tui.wait_for("Aster", 45);
    let facts = tui.turn(CAT_APPROVAL, None);
    assert_one_bash(&facts);
    assert_eq!(tui.permission_answer_count(), 1);
    assert!(tui.assistant_text(&facts).contains(&token));
    tui.record(
        "learned-restart",
        "same workspace reuses persisted approval with no permission card",
    );
    tui.checkpoint_session("restarted");
    tui.quit();
    let other = tui.workspace.parent().unwrap().join("other-workspace");
    std::fs::create_dir(&other).unwrap();
    let other_token = format!("OTHER-{}", uuid::Uuid::new_v4());
    std::fs::write(other.join("approval-proof.txt"), &other_token).unwrap();
    tui.workspace = other;
    tui.launch(&[]);
    tui.wait_for("Aster", 45);
    let facts = tui.turn(CAT_APPROVAL, Some(b"\r"));
    assert_one_bash(&facts);
    assert_eq!(
        tui.permission_answer_count(),
        2,
        "the other workspace must show a real new permission card"
    );
    assert!(tui.assistant_text(&facts).contains(&other_token));
    assert_eq!(
        std::fs::read_to_string(store).unwrap(),
        saved,
        "allow-once in another workspace must not learn or change the original rule"
    );
    tui.record(
        "approval-workspace-scope",
        "another workspace asks again and returns its own unseen token",
    );
    tui.checkpoint_session("other-workspace");
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_copy_nth_exact_bytes_and_export_failures() {
    let mut tui = LiveTui::new("copy-export-contract");
    tui.launch(&[]);
    tui.wait_for("Aster", 45);
    let mut answers = Vec::new();
    let mut tokens = Vec::new();
    for (file, prompt) in [
        ("first.txt", "Use the read tool once to read first.txt and reply with its exact contents. Do not call other tools or modify any file."),
        ("second.txt", "Use the read tool once to read second.txt and reply with its exact contents. Do not call other tools or modify any file."),
    ] {
        let token = format!("导出-{}", uuid::Uuid::new_v4());
        std::fs::write(tui.workspace.join(file), &token).unwrap();
        let facts = tui.turn(prompt, None);
        let answer = facts.iter().filter(|f| f["type"] == "model.turn").filter_map(|f| f["payload"]["text"].as_str()).filter(|s| !s.is_empty()).last().unwrap().to_owned();
        assert!(answer.contains(&token));
        answers.push(answer);
        tokens.push(token);
    }
    for (n, expected) in [(1, &answers[1]), (2, &answers[0])] {
        let file = tui.workspace.join(format!("第 {n} 条.txt"));
        tui.literal_command(&format!("/copy {n} {}", file.display()));
        let deadline = Instant::now() + Duration::from_secs(8);
        while !file.is_file() {
            tui.pump(80);
            assert!(Instant::now() < deadline, "copy output was not created");
        }
        assert_eq!(std::fs::read(&file).unwrap(), expected.as_bytes());
        tui.record(
            &format!("copy-{n}"),
            "requested assistant response exported with exact UTF-8 bytes",
        );
    }
    let export = tui.workspace.join("完整 会话.md");
    tui.literal_command(&format!("/export {}", export.display()));
    tui.wait_for("Conversation exported", 8);
    let text = std::fs::read_to_string(export).unwrap();
    assert!(text.find(&tokens[0]).unwrap() < text.find(&tokens[1]).unwrap());
    assert!(text.contains("first.txt") && text.contains("second.txt"));
    tui.record(
        "export-order",
        "full transcript contains both prompts and replies in order",
    );
    let directory = tui.workspace.join("directory-output");
    std::fs::create_dir(&directory).unwrap();
    let before = tui.facts().len();
    tui.literal_command(&format!("/copy {}", directory.display()));
    tui.wait_for("Failed to write file:", 8);
    assert!(directory.is_dir());
    assert_eq!(tui.facts().len(), before);
    tui.command("/copy 0");
    tui.wait_for("where N is 1", 8);
    assert_eq!(tui.facts().len(), before);
    tui.record(
        "export-refusal",
        "directory write and invalid response index fail explicitly without model work",
    );
    tui.quit();
    tui.finish();
}
