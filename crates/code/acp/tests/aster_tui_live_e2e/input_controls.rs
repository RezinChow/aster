#![cfg(test)]

use super::driver::LiveTui;
use std::time::{Duration, Instant};

fn paste_draft(tui: &mut LiveTui, text: &str, visible_tail: &str) {
    tui.bytes(b"\x1b[200~");
    tui.bytes(text.as_bytes());
    tui.bytes(b"\x1b[201~");
    tui.bytes(b"\x1b[F");
    let prefix: String = text.chars().take(40).collect();
    tui.wait_for(&prefix, 8);
    tui.wait_for(visible_tail, 8);
    tui.pump(150);
}

fn key(tui: &mut LiveTui, sequence: &[u8]) {
    tui.bytes(sequence);
    tui.pump(200);
}

fn wait_absent(tui: &mut LiveTui, text: &str) {
    let started = Instant::now();
    let deadline = started + Duration::from_secs(8);
    loop {
        let screen = tui.physical_screen();
        if !screen.contains(text) {
            tui.record(
                "draft-redraw",
                &format!(
                    "one key operation removes {text:?}; additional display wait={} ms",
                    started.elapsed().as_millis()
                ),
            );
            return;
        }
        assert!(
            Instant::now() < deadline,
            "draft still contains {text:?}\n{screen}"
        );
        tui.pump(40);
    }
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_draft_edits_undo_redo_stash_and_clear_preserve_exact_text() {
    let mut tui = LiveTui::new("draft-edit-controls");
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    tui.session_id();
    tui.dismiss();
    let expected = "Reply with INPUT-EDIT-OK. Do not call tools. 数据 中文 e\u{301} RIGHT";
    paste_draft(&mut tui, &expected.replace("RIGHT", "WRONG"), "WRONG");
    key(&mut tui, b"\x17");
    wait_absent(&mut tui, "WRONG");
    paste_draft(&mut tui, "RIGHT", "RIGHT");
    key(&mut tui, b"\x1a");
    wait_absent(&mut tui, "RIGHT");
    key(&mut tui, b"\x1bz");
    tui.wait_for("RIGHT", 8);
    tui.record(
        "undo-redo",
        "word deletion and actual undo/redo restore the intended draft",
    );

    key(&mut tui, b"\x13");
    wait_absent(&mut tui, "数据");
    key(&mut tui, b"\x13");
    tui.wait_for("RIGHT", 8);
    tui.record(
        "stash-pop",
        "Ctrl+S clears and restores the Unicode draft without submitting it",
    );

    key(&mut tui, b"\x01");
    tui.bytes(b"BROKEN");
    tui.wait_for("BROKEN", 8);
    key(&mut tui, b"\x15");
    wait_absent(&mut tui, "BROKEN");
    key(&mut tui, b"\x05");
    key(&mut tui, b"\x03");
    wait_absent(&mut tui, "数据");
    key(&mut tui, b"\x1a");
    tui.wait_for("RIGHT", 8);
    assert!(!tui
        .facts()
        .iter()
        .any(|fact| fact["type"] == "user.message"));
    let before = tui.facts().len();
    key(&mut tui, b"\r");
    let facts = tui.settle_turn(before, expected, None);
    assert!(tui.assistant_text(&facts).contains("INPUT-EDIT-OK"));
    assert!(!facts.iter().any(|fact| fact["type"] == "tool.prepared"));
    tui.record(
        "exact-edited-prompt",
        "cursor/line deletion, clear and undo retain exact UTF-8 bytes in one real model request",
    );
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_external_editor_save_and_failures_preserve_draft_and_terminal() {
    for outcome in ["save", "nonzero", "invalid-utf8", "missing-program"] {
        let mut tui = LiveTui::new(&format!("editor-{outcome}"));
        let original = "Reply with EDITOR-CONTROL-OK. Do not call tools. ORIGINAL-DRAFT";
        let saved = "Reply with EDITOR-CONTROL-OK. Do not call tools. SAVED-DRAFT";
        let script = tui.workspace.join(if cfg!(windows) {
            "editor.ps1"
        } else {
            "editor.sh"
        });
        if outcome == "missing-program" {
            tui.editor = Some("aster-e2e-missing-editor-program".into());
        } else if cfg!(windows) {
            let body = match outcome {
                "save" => format!("[IO.File]::WriteAllText($args[0], '{saved}'); exit 0"),
                "nonzero" => "[IO.File]::WriteAllText($args[0], 'DISCARDED-DRAFT'); exit 7".into(),
                "invalid-utf8" => {
                    "[IO.File]::WriteAllBytes($args[0], [byte[]]@(255,254,255)); exit 0".into()
                }
                _ => unreachable!(),
            };
            std::fs::write(&script, body).unwrap();
            let shell = std::path::PathBuf::from(std::env::var_os("SystemRoot").unwrap())
                .join("System32/WindowsPowerShell/v1.0/powershell.exe");
            tui.editor = Some(format!(
                "\"{}\" -NoProfile -ExecutionPolicy Bypass -File \"{}\"",
                shell.display().to_string().replace('\\', "/"),
                script.display().to_string().replace('\\', "/")
            ));
        } else {
            let body = match outcome {
                "save" => format!("printf '%s' '{saved}' > \"$1\"\n"),
                "nonzero" => "printf DISCARDED-DRAFT > \"$1\"\nexit 7\n".into(),
                "invalid-utf8" => "printf '\\377\\376\\377' > \"$1\"\n".into(),
                _ => unreachable!(),
            };
            std::fs::write(&script, body).unwrap();
            tui.editor = Some(format!("/bin/sh '{}'", script.display()));
        }
        tui.launch_default(&["--minimal"]);
        tui.wait_for("Aster", 45);
        tui.session_id();
        tui.dismiss();
        paste_draft(&mut tui, original, "ORIGINAL-DRAFT");
        let before = tui.facts().len();
        key(&mut tui, b"\x07");
        let expected = if outcome == "save" {
            tui.wait_for("SAVED-DRAFT", 20);
            saved
        } else {
            let error = match outcome {
                "nonzero" => "editor exited unsuccessfully",
                "invalid-utf8" => "editor saved invalid UTF-8",
                "missing-program" => "editor failed",
                _ => unreachable!(),
            };
            tui.wait_for(error, 20);
            assert!(tui.physical_screen().contains("ORIGINAL-DRAFT"));
            original
        };
        assert_eq!(
            tui.facts().len(),
            before,
            "editing sent work before explicit submission"
        );
        key(&mut tui, b"\r");
        let facts = tui.settle_turn(before, expected, None);
        assert!(tui.assistant_text(&facts).contains("EDITOR-CONTROL-OK"));
        tui.record("editor-roundtrip", "real editor save/failure returns control; only the explicitly submitted exact draft reaches Kimi");
        tui.quit();
        tui.finish();
    }
}

fn shortcut_detail(case: &str, query: &str, body: &str, forbidden: &[&str]) {
    let mut tui = LiveTui::new(case);
    tui.launch_default(&[]);
    tui.wait_for("Aster", 45);
    tui.session_id();
    tui.dismiss();
    let before = tui.facts();
    key(&mut tui, b"\x18");
    tui.wait_for("Keyboard Shortcuts", 8);
    key(&mut tui, b"/");
    tui.bytes(query.as_bytes());
    tui.pump(300);
    key(&mut tui, b"\x1b[B");
    key(&mut tui, b"\r");
    tui.wait_for(body, 8);
    let detail = tui.physical_screen();
    assert!(detail.contains(query), "missing shortcut detail: {detail}");
    for text in forbidden {
        assert!(
            !detail.contains(text),
            "Code shortcut help advertises unsupported {text:?}: {detail}"
        );
    }
    tui.record(
        "capability-help",
        "actual shortcut detail does not promise backend-refused commands or content types",
    );
    key(&mut tui, b"\x18");
    assert_eq!(tui.facts(), before);
    tui.quit();
    tui.finish();
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_paste_help_matches_text_only_backend() {
    shortcut_detail(
        "paste-help-capability",
        "paste",
        "clipboard",
        &["clipboard images", "drag an image"],
    );
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_history_help_uses_reachable_entry() {
    shortcut_detail(
        "history-help-capability",
        "history",
        "Recalls previously sent prompts",
        &["/history"],
    );
}

#[test]
#[ignore = "requires the paired source build and original kimi/k3.1-pro ACL"]
fn kimi_sessions_help_uses_reachable_entry() {
    shortcut_detail(
        "sessions-help-capability",
        "sessions",
        "Opens the session browser",
        &["/resume", "Agent Dashboard"],
    );
    shortcut_detail(
        "send-now-help-capability",
        "Send now",
        "Cancels the current turn",
        &["without cancelling", "merges composer text"],
    );
}
