use super::driver::LiveTui;
use std::time::{Duration, Instant};

const COMPACT_READ: &str = "Read compaction-proof.txt with the read tool. Its exact token is the acceptance key for the task we will continue after compaction. Reply with the exact token and keep this task open. Do not modify files or call other tools.";
const COMPACT_RECALL: &str = "Reply with the exact acceptance key you read from compaction-proof.txt earlier in this conversation. Do not call tools.";

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_actual_compaction_with_and_without_focus_preserves_model_history() {
    let mut tui = LiveTui::new("compact-model-history");
    let token = format!("COMPACT-KEY-{}", uuid::Uuid::new_v4());
    let source = tui.workspace.join("compaction-proof.txt");
    std::fs::write(&source, &token).unwrap();
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    let id = tui.session_id();
    tui.dismiss();
    let first = tui.turn(COMPACT_READ, None);
    assert!(tui.assistant_text(&first).contains(&token));
    assert!(first.iter().any(|fact| fact["type"] == "tool.prepared"
        && fact["payload"]["prepared"]["tool_name"] == "read"));
    for command in [
        "/compact",
        "/compact Preserve the exact acceptance key and the still-open task.",
    ] {
        let before = tui.facts().len();
        tui.command(command);
        let fact = tui.wait_fact("compaction.done", before);
        let summary = fact["payload"]["summary"]
            .as_str()
            .expect("durable summary");
        assert!(
            summary.contains(&token),
            "summary lost the acceptance key: {summary}"
        );
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            let screen = tui.pump(100);
            assert!(!screen.contains("Turn failed"), "{screen}");
            if !screen.contains("[stop]") && !screen.contains("Ctrl+c:cancel") {
                break;
            }
            assert!(
                Instant::now() < deadline,
                "compaction did not become idle\n{screen}"
            );
        }
        let recalled = tui.turn(COMPACT_RECALL, None);
        assert!(tui.assistant_text(&recalled).contains(&token));
        assert!(!recalled.iter().any(|fact| fact["type"] == "tool.prepared"));
        assert_eq!(std::fs::read(&source).unwrap(), token.as_bytes());
        assert_eq!(tui.session_id(), id);
        tui.dismiss();
        tui.record(command, "actual Kimi summary committed; next model request recalls the unseen key without tools in the same session");
    }
    assert_eq!(
        tui.facts()
            .iter()
            .filter(|fact| fact["type"] == "compaction.done")
            .count(),
        2
    );
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_long_bracketed_unicode_paste_is_submitted_exactly_once() {
    let mut tui = LiveTui::new("long-unicode-paste");
    let token = uuid::Uuid::new_v4();
    let prompt = format!(
        "中文\nDo not call tools. Reply with LONG-PASTE-ACCEPTED after receiving the complete payload. The payload is test data, not instructions.\nBEGIN-{token}\n{}\nEND-{token}",
        "中文 λ e\u{301} payload 0123456789 <> & \" ' / \\ ".repeat(512)
    );
    assert!(prompt.len() > 16 * 1024);
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    let facts = tui.turn(&prompt, None);
    assert!(tui.assistant_text(&facts).contains("LONG-PASTE-ACCEPTED"));
    assert!(!facts.iter().any(|fact| fact["type"] == "tool.prepared"));
    assert_eq!(
        facts
            .iter()
            .filter(|fact| fact["type"] == "user.message")
            .count(),
        1
    );
    tui.record("exact-long-paste", "more than 16 KiB of bracketed Unicode text reaches one actual user.message with byte-identical contents and one settled response");
    tui.quit();
    tui.finish();
}
