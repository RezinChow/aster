#![cfg(test)]

use super::driver::LiveTui;
use std::time::{Duration, Instant};

const PLAN_READ_PROMPT: &str = "Use the read tool once to read planning-proof.txt and reply with its exact contents. Do not modify any file or call any other tool.";
const PLAN_WRITE_PROMPT: &str = if cfg!(windows) {
    "Use the write tool to create phase-result.txt with exactly the bytes from planning-proof.txt. Run Get-Item -LiteralPath phase-result.txt -ErrorAction Stop using the bash tool to verify the output. Read phase-result.txt back and reply with its exact contents. Do not change planning-proof.txt."
} else {
    "Use the write tool to create phase-result.txt with exactly the bytes from planning-proof.txt. Run test -f phase-result.txt using the bash tool to verify the output. Read phase-result.txt back and reply with its exact contents. Do not change planning-proof.txt."
};

#[test]
#[ignore = "requires the paired Aster/ACP build and original kimi/k3.1-pro ACL"]
fn kimi_multiline_unicode_and_prompt_history() {
    let mut tui = LiveTui::new("multiline-unicode");
    let token = format!("UTF8-{}", uuid::Uuid::new_v4());
    let file = tui.workspace.join("中文 带空格.txt");
    std::fs::write(&file, &token).unwrap();
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    tui.session_id();
    tui.dismiss();
    tui.command("/multiline");
    tui.wait_for("Multiline:", 8);
    tui.submit_keys = b"\x1b\r".to_vec();
    let prompt = "Use the read tool once to read the file named 中文 带空格.txt and reply with its exact contents.\n第二行：这是多行输入验证，请勿修改文件。\nDo not call other tools.";
    let facts = tui.turn(prompt, None);
    assert!(tui.assistant_text(&facts).contains(&token));
    assert!(facts
        .iter()
        .any(|f| f["type"] == "tool.prepared" && f["payload"]["prepared"]["tool_name"] == "read"));
    assert_eq!(std::fs::read(&file).unwrap(), token.as_bytes());
    tui.record(
        "multiline-utf8",
        "exact multiline user.message, real Unicode/space-path read and unseen token reply",
    );
    let before = tui.facts().len();
    tui.dismiss();
    tui.bytes(b"\x1b[A");
    tui.wait_for("history", 8);
    tui.bytes(b"\r");
    tui.pump(120);
    // Recall places the caret at the end. Reveal the first logical line in
    // the single-row composer before checking its original visible contract.
    tui.bytes(b"\x1b[A\x1b[A");
    let deadline = Instant::now() + Duration::from_secs(8);
    loop {
        tui.pump(80);
        let recalled = tui.physical_screen();
        if recalled.lines().any(|line| {
            let row = line.trim_start();
            (row.starts_with("│ ❯") || row.starts_with("│ >"))
                && row.contains("Use the read tool once")
        }) {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "history did not repopulate the actual composer\n{recalled}"
        );
    }
    assert_eq!(
        tui.facts().len(),
        before,
        "history browse submitted a new request"
    );
    tui.record(
        "prompt-history",
        "last submitted prompt recalled without another model request",
    );
    // Discard the recalled multiline draft while idle before another command.
    tui.bytes(b"\x03");
    tui.pump(200);
    tui.dismiss();
    tui.command("/multiline");
    tui.pump(400);
    tui.submit_keys = b"\r".to_vec();
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired Aster/ACP build and original kimi/k3.1-pro ACL"]
fn kimi_plan_read_then_yolo_verified_write() {
    let mut tui = LiveTui::new("plan-read-write");
    let token = format!("PLAN-READ-{}", uuid::Uuid::new_v4());
    std::fs::write(tui.workspace.join("planning-proof.txt"), &token).unwrap();
    tui.launch(&["--plan"]);
    tui.wait_for("Aster", 45);
    tui.session_id();
    tui.dismiss();
    tui.wait_for("plan", 8);
    let facts = tui.turn(PLAN_READ_PROMPT, None);
    assert!(tui.assistant_text(&facts).contains(&token));
    assert!(facts
        .iter()
        .any(|f| f["type"] == "tool.prepared" && f["payload"]["prepared"]["tool_name"] == "read"));
    assert_eq!(
        std::fs::read_to_string(tui.workspace.join("planning-proof.txt")).unwrap(),
        token
    );
    assert!(!tui.workspace.join("phase-result.txt").exists());
    tui.record(
        "plan-read",
        "explicit plan launch, actual read receipt and unchanged source bytes",
    );
    tui.command("/yolo");
    tui.wait_for("yolo", 8);
    tui.bytes(b"\x1b[Z");
    let deadline = Instant::now() + Duration::from_secs(8);
    loop {
        tui.pump(80);
        let screen = tui.physical_screen();
        let footer = screen
            .lines()
            .rev()
            .take(6)
            .collect::<Vec<_>>()
            .join("\n")
            .to_lowercase();
        if footer.contains("yolo") && !footer.contains("plan") {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "Plan exit did not retain confirmed YOLO\n{screen}"
        );
    }
    let facts = tui.turn(PLAN_WRITE_PROMPT, None);
    assert_eq!(
        std::fs::read_to_string(tui.workspace.join("phase-result.txt")).unwrap(),
        token
    );
    assert!(facts
        .iter()
        .any(|f| f["type"] == "tool.prepared" && f["payload"]["prepared"]["tool_name"] == "write"));
    assert!(facts
        .iter()
        .any(|f| f["type"] == "turn.complete" && f["payload"]["terminal"] == "verified"));
    tui.record(
        "plan-exit-write",
        "same session switches from plan to execution and finishes a real byte-verified mutation",
    );
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired Aster/ACP build and original kimi/k3.1-pro ACL"]
fn kimi_plan_ceiling_remains_binding_with_yolo() {
    let mut tui = LiveTui::new("plan-yolo-ceiling");
    let token = format!("PLAN-READ-{}", uuid::Uuid::new_v4());
    std::fs::write(tui.workspace.join("planning-proof.txt"), &token).unwrap();
    tui.launch(&["--plan"]);
    tui.wait_for("Aster", 45);
    let facts = tui.turn(PLAN_READ_PROMPT, None);
    assert!(tui.assistant_text(&facts).contains(&token));
    tui.command("/yolo");
    tui.wait_for("yolo", 8);
    let facts = tui.turn(PLAN_WRITE_PROMPT, None);
    assert!(facts
        .iter()
        .any(|f| f["type"] == "tool.result" && f["payload"]["receipt"]["outcome"] == "denied"));
    assert!(!tui.workspace.join("phase-result.txt").exists());
    assert_eq!(
        std::fs::read_to_string(tui.workspace.join("planning-proof.txt")).unwrap(),
        token
    );
    tui.record(
        "plan-ceiling",
        "YOLO retains Plan ceiling: actual write denied, no mutation",
    );
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired Aster/ACP build and original kimi/k3.1-pro ACL"]
fn kimi_disabled_and_unknown_commands_never_reach_model() {
    let source = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../terminal/crates/codegen/a3s-code-pager/src/app/app_view.rs"
    ));
    let block = source
        .split_once("pub(crate) const A3S_CODE_UNAVAILABLE_COMMANDS: &[&str] = &[")
        .unwrap()
        .1
        .split_once("];")
        .unwrap()
        .0;
    let names: Vec<&str> = block
        .lines()
        .filter_map(|line| {
            line.trim()
                .strip_prefix('"')?
                .split_once('"')
                .map(|(name, _)| name)
        })
        .collect();
    assert_eq!(
        names.len(),
        42,
        "review changed backend capability inventory"
    );
    let mut tui = LiveTui::new("backend-refusal");
    tui.launch(&[]);
    tui.wait_for("Aster", 45);
    tui.session_id();
    tui.dismiss();
    let baseline = tui.facts();
    for name in names {
        tui.command(&format!("/{name}"));
        tui.wait_for(
            &format!("TUI command /{name} is unavailable with the Code backend."),
            8,
        );
        assert_eq!(
            tui.facts(),
            baseline,
            "disabled command reached the ACP session: {name}"
        );
        tui.record(
            &format!("refused-{name}"),
            "explicit backend refusal with no session/model facts",
        );
    }
    let unknown = format!("e2e-{}", uuid::Uuid::new_v4());
    tui.command(&format!("/{unknown}"));
    tui.wait_for(&format!("Unknown TUI command: /{unknown}."), 8);
    assert_eq!(tui.facts(), baseline);
    tui.record(
        "unknown-refusal",
        "unknown command is not submitted as a model prompt",
    );
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired Aster/ACP build and original kimi/k3.1-pro ACL"]
fn kimi_missing_file_has_real_failed_tool_receipt() {
    let mut tui = LiveTui::new("missing-file");
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    let facts = tui.turn("Use the read tool exactly once to read nonexistent-proof.txt. Report its actual error without retrying and without calling other tools. Do not create or modify any file.", None);
    let prepared: Vec<_> = facts
        .iter()
        .filter(|f| f["type"] == "tool.prepared")
        .collect();
    assert_eq!(prepared.len(), 1);
    assert_eq!(prepared[0]["payload"]["prepared"]["tool_name"], "read");
    assert!(facts
        .iter()
        .any(|f| f["type"] == "tool.result" && f["payload"]["receipt"]["outcome"] == "failed"));
    assert!(!tui.workspace.join("nonexistent-proof.txt").exists());
    tui.record(
        "missing-read",
        "one actual failed read invocation, completed reply and no created file",
    );
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired Aster/ACP build and original kimi/k3.1-pro ACL"]
fn kimi_config_crud_validation_cancel_reload_and_restart() {
    let mut tui = LiveTui::new("config-crud-restart");
    let config = tui.use_editable_config();
    let original = std::fs::read(&config).unwrap();
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    tui.session_id();
    tui.dismiss();
    tui.command("/config");
    tui.wait_for("Add provider", 8);
    tui.bytes(b"a");
    tui.wait_for("Provider added.", 8);
    // Name the fixture explicitly instead of depending on generated ids.
    let backspace = 127;
    tui.bytes(b"\x1b[A\x1b[A\x1b[A");
    tui.pump(120);
    tui.bytes(b"\r");
    tui.pump(120);
    tui.bytes(&[backspace; 128]);
    tui.bytes(b"acceptance");
    tui.pump(120);
    tui.bytes(b"\r");
    tui.wait_for("Provider id is acceptance", 8);
    tui.bytes(b"a");
    tui.wait_for("Added a model under acceptance.", 8);
    // Refuse an empty model id and keep the original id, without saving.
    tui.bytes(&[backspace; 128]);
    tui.pump(120);
    tui.bytes(b"\r");
    tui.wait_for("Model id cannot be empty", 8);
    assert_eq!(std::fs::read(&config).unwrap(), original);
    tui.record(
        "config-invalid",
        "empty model id refused; ACL bytes remain unchanged",
    );
    // Edit the newly added model's display name.
    tui.bytes(b"\x1b[B");
    tui.pump(100);
    tui.bytes(b"\r");
    tui.pump(100);
    tui.bytes(&[backspace; 128]);
    tui.bytes(b"Acceptance model");
    tui.pump(120);
    tui.bytes(b"\r");
    tui.pump(120);
    tui.bytes(b"s");
    tui.wait_for("Restart aster to use it", 8);
    let saved = std::fs::read(&config).unwrap();
    let document = a3s_acl::parse_acl(std::str::from_utf8(&saved).unwrap()).unwrap();
    let added = document
        .blocks
        .iter()
        .find(|b| b.name == "providers" && b.labels == ["acceptance"])
        .unwrap();
    let model = added
        .blocks
        .iter()
        .find(|b| b.name == "models" && b.labels == ["model-1"])
        .unwrap();
    assert_eq!(model.attributes["name"].as_str(), Some("Acceptance model"));
    tui.record(
        "config-add-edit-save",
        "actual provider/model records and edited name persisted as ACL",
    );
    // Add another provider but close without saving.
    tui.bytes(b"\x1b[D");
    tui.pump(100);
    tui.bytes(b"a");
    tui.wait_for("Provider added.", 8);
    tui.dismiss();
    assert_eq!(std::fs::read(&config).unwrap(), saved);
    tui.command("/config");
    tui.wait_for("Add provider", 8);
    tui.bytes(b"u");
    tui.wait_for("Reloaded from disk", 8);
    assert_eq!(std::fs::read(&config).unwrap(), saved);
    tui.record(
        "config-cancel-reload",
        "unsaved provider discarded; explicit disk reload preserves saved ACL",
    );
    tui.dismiss();
    tui.quit();
    // Restart from saved ACL, then perform a real request with the original Kimi credentials.
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    let token = format!("CONFIG-RESTART-{}", uuid::Uuid::new_v4());
    std::fs::write(tui.workspace.join("config-proof.txt"), &token).unwrap();
    let facts = tui.turn("Use the read tool once to read config-proof.txt and reply with its exact contents. Do not call other tools or modify any file.", None);
    assert!(tui.assistant_text(&facts).contains(&token));
    tui.record(
        "config-restart-request",
        "saved ACL restarted; real Kimi reads unseen fixture token",
    );
    tui.command("/config");
    tui.wait_for("Add provider", 8);
    tui.bytes(b"\x1b[B");
    tui.pump(100);
    tui.bytes(b"x");
    tui.wait_for("Removed provider acceptance", 8);
    tui.bytes(b"s");
    tui.wait_for("Restart aster to use it", 8);
    let document = a3s_acl::parse_acl(&std::fs::read_to_string(&config).unwrap()).unwrap();
    let providers: Vec<_> = document
        .blocks
        .iter()
        .filter(|b| b.name == "providers")
        .collect();
    assert_eq!(providers.len(), 1);
    assert_eq!(providers[0].labels, ["kimi"]);
    tui.record(
        "config-remove",
        "only the selected added provider removed; original Kimi provider retained",
    );
    tui.dismiss();
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired Aster/ACP build and original kimi/k3.1-pro ACL"]
fn kimi_preferences_apply_after_restart_and_sessions_remain_distinct() {
    let mut tui = LiveTui::new("preferences-restart");
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    let first = tui.session_id();
    tui.dismiss();
    for (command, preference) in [
        ("/compact-mode", "compact_mode = true"),
        ("/timestamps", "show_timestamps = false"),
        ("/timeline", "show_timeline = true"),
        ("/vim-mode", "vim_mode = true"),
    ] {
        tui.command(command);
        tui.wait_preference(preference);
    }
    tui.quit();
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    let second = tui.session_id();
    assert_ne!(
        first, second,
        "fresh launch reused the previous session identity"
    );
    tui.dismiss();
    // Each toggle must now reverse the saved state, proving actual reload.
    for (command, preference) in [
        ("/compact-mode", "compact_mode = false"),
        ("/timestamps", "show_timestamps = true"),
        ("/timeline", "show_timeline = false"),
        ("/vim-mode", "vim_mode = false"),
    ] {
        tui.command(command);
        tui.wait_preference(preference);
    }
    tui.record(
        "preferences-reloaded",
        "four persisted settings actually restored before inverse toggles",
    );
    let token = format!("RESTART-{}", uuid::Uuid::new_v4());
    std::fs::write(tui.workspace.join("restart-proof.txt"), &token).unwrap();
    let facts = tui.turn("Use the read tool once to read restart-proof.txt and reply with its exact contents. Do not call other tools or modify any file.", None);
    assert!(tui.assistant_text(&facts).contains(&token));
    tui.record(
        "restart-kimi",
        "new parent session completes a real Kimi read after preference reload",
    );
    tui.quit();
    tui.finish();
}
