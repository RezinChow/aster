use anyhow::{Context, Result};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

fn running_state(workspace: &Path) -> Result<Option<(PathBuf, Value)>> {
    for root in [".kstudio", ".aster"] {
        let directory = workspace.join(root).join("local/loops");
        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };
        for entry in entries {
            let path = entry?.path();
            let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
                continue;
            };
            if !name.ends_with(".json") || name.ends_with(".spec.json") {
                continue;
            }
            let state: Value = serde_json::from_slice(&std::fs::read(&path)?)?;
            if state.get("status").and_then(Value::as_str) == Some("running") {
                return Ok(Some((path, state)));
            }
        }
    }
    Ok(None)
}

fn receipt_path(workspace: &Path, stdout: &[u8]) -> Result<PathBuf> {
    let text = String::from_utf8_lossy(stdout);
    for line in text.lines() {
        let Some((_, path)) = line.split_once(": ") else {
            continue;
        };
        let path = path.trim();
        if path.ends_with("receipt.json") {
            let path = PathBuf::from(path);
            return Ok(if path.is_absolute() {
                path
            } else {
                workspace.join(path)
            });
        }
    }
    anyhow::bail!("review did not retain a receipt: {text}")
}

/// Repeated KBurn settlement diagnostics that must stop the adapter instead of
/// burning another stream attempt with the same canned nudge.
pub(crate) const SETTLEMENT_STALL_LIMIT: usize = 2;

/// Classify a known KBurn completion-gate diagnostic. Unrelated errors are not
/// classified and never stop the adapter through this path.
pub(crate) fn settlement_stall_signature(message: &str) -> Option<&'static str> {
    if message.contains("KBurn loop was invoked but no task_accepted receipt exists") {
        Some("no_task_accepted_receipt")
    } else if message.contains("KBurn loop state") && message.contains("cannot be") {
        Some("loop_state_unreadable")
    } else if message.contains("KBurn loop state") && message.contains("is invalid") {
        Some("loop_state_invalid")
    } else if message.contains("KBurn loop") && message.contains("is running") {
        Some("loop_running")
    } else if message.contains("controller is not started") {
        Some("controller_not_started")
    } else if message.contains("uncovered_acceptance_scope") {
        Some("uncovered_acceptance_scope")
    } else {
        None
    }
}

#[derive(Debug, Default)]
pub(crate) struct SettlementStallTracker {
    counts: HashMap<&'static str, usize>,
}

impl SettlementStallTracker {
    /// Returns true when the same KBurn settlement diagnostic has repeated
    /// enough times to stop. Each stream attempt contributes at most one
    /// observation, recorded by the caller.
    pub(crate) fn record(&mut self, signature: &'static str) -> bool {
        let count = self.counts.entry(signature).or_insert(0);
        *count = count.saturating_add(1);
        *count >= SETTLEMENT_STALL_LIMIT
    }
}

/// Decide whether a stream's KBurn diagnostic must stop the adapter. The same
/// helper is used by the runner and by the hermetic result-file test so the
/// stop decision cannot drift from its evidence.
pub(crate) fn settlement_stall(
    tracker: &mut SettlementStallTracker,
    signature: Option<&'static str>,
) -> Option<String> {
    let signature = signature?;
    if !tracker.record(signature) {
        return None;
    }
    Some(format!(
        "KBurn settlement stalled after repeated {signature}; reward_valid=false"
    ))
}

/// Execute the declared review and advance a running controller once. This is
/// host orchestration only: semantic feedback and acceptance remain model work.
pub async fn drive_running_loop(workspace: &Path) -> Result<Option<String>> {
    let Some((state_path, state)) = running_state(workspace)? else {
        return Ok(None);
    };
    let task = state
        .get("spec")
        .and_then(|spec| spec.get("task_id"))
        .or_else(|| state.get("task_id"))
        .and_then(Value::as_str)
        .context("running KBurn loop has no task_id")?
        .to_string();
    let controller = state
        .get("controller")
        .and_then(Value::as_str)
        .context("running KBurn loop has no controller")?
        .to_string();
    let root = state_path
        .parent()
        .and_then(|path| path.parent())
        .and_then(|path| path.parent())
        .context("KBurn loop state has no engineering root")?;
    let review = root.join("workflow/review.py");
    let output = tokio::time::timeout(
        Duration::from_secs(900),
        tokio::process::Command::new("python3")
            .arg(&review)
            .arg("--run")
            .current_dir(workspace)
            .output(),
    )
    .await
    .context("KBurn review timed out")??;
    let receipt = receipt_path(workspace, &output.stdout)?;
    let advance = tokio::process::Command::new("python3")
        .arg(root.join("workflow/loop-kstudio.py"))
        .arg("--root")
        .arg(workspace)
        .arg("advance")
        .arg("--run")
        .arg(task)
        .arg("--controller")
        .arg(controller)
        .arg("--receipt")
        .arg(&receipt)
        .current_dir(workspace)
        .output()
        .await?;
    let next: Value = serde_json::from_slice(&advance.stdout).unwrap_or(state);
    let status = next
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let next_action = if status == "ready_for_review" {
        "Host created a fresh receipt and advanced the controller to ready_for_review. Perform the semantic review now and submit loop feedback to reach task_accepted; do not stop before that receipt exists"
            .to_string()
    } else {
        format!(
            "Host ran the declared review and advanced the controller to {status}. Continue the same task with concrete implementation and checks; do not stop before task_accepted"
        )
    };
    Ok(Some(next_action))
}

#[cfg(test)]
mod tests {
    use super::super::result::{persist_result, RunProgress, TerminalReason};
    use super::*;
    use aster_core::execution_identity::ExecutionResultOutcomeV1;

    #[tokio::test]
    async fn host_review_advances_running_controller() {
        let workspace = tempfile::tempdir().unwrap();
        let workflow = workspace.path().join(".kstudio/workflow");
        std::fs::create_dir_all(&workflow).unwrap();
        let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../.kstudio/workflow");
        for name in ["review.py", "loop-kstudio.py"] {
            std::fs::copy(source.join(name), workflow.join(name)).unwrap();
        }
        std::fs::write(
            workflow.join("review-checks.json"),
            serde_json::json!({
                "schema":"kstudio.review-checks.v1",
                "checks":[{"id":"smoke","paths":["src"],"argv":["python3","-c","import sys;sys.exit(0)"]}]
            })
            .to_string(),
        )
        .unwrap();
        std::fs::write(
            workflow.join("billets.json"),
            serde_json::json!({"billets":[{"id":"B","write_policy":"code_ok","duty":"implement"}]})
                .to_string(),
        )
        .unwrap();
        std::fs::create_dir(workspace.path().join("src")).unwrap();
        std::fs::write(workspace.path().join("src/a.py"), "value = 1\n").unwrap();
        let spec = workspace.path().join(".kstudio/local/loops/demo.spec.json");
        std::fs::create_dir_all(spec.parent().unwrap()).unwrap();
        std::fs::write(
            &spec,
            serde_json::json!({
                "schema":"kstudio.loop-spec.v1",
                "task_id":"demo",
                "goal":"verify host advance",
                "roles":["B"],
                "write_paths":["src"],
                "acceptance":{"description":"smoke passes","check_ids":["smoke"]},
                "limits":{"max_iterations":2,"max_seconds":60,"max_stagnant":2,"max_same_failure":2}
            })
            .to_string(),
        )
        .unwrap();
        let started = std::process::Command::new("python3")
            .arg(workflow.join("loop-kstudio.py"))
            .arg("--root")
            .arg(workspace.path())
            .arg("start")
            .arg("--spec")
            .arg(&spec)
            .arg("--controller")
            .arg("test")
            .output()
            .unwrap();
        assert!(started.status.success(), "{started:?}");
        let prompt = drive_running_loop(workspace.path())
            .await
            .unwrap()
            .expect("running loop must advance");
        assert!(prompt.contains("ready_for_review"), "{prompt}");
        let state: Value = serde_json::from_slice(
            &std::fs::read(workspace.path().join(".kstudio/local/loops/demo.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(state["status"], "ready_for_review");
        assert_eq!(state["iterations"], 1);
        assert!(state["last_receipt_sha256"].is_string());
    }

    #[test]
    fn settlement_signature_classifies_known_kburn_gates_only() {
        assert_eq!(
            settlement_stall_signature(
                "KBurn loop was invoked but no task_accepted receipt exists. Inspect controller status"
            ),
            Some("no_task_accepted_receipt")
        );
        assert_eq!(
            settlement_stall_signature("KBurn loop demo is running; finish review first"),
            Some("loop_running")
        );
        assert_eq!(
            settlement_stall_signature(
                "loop controller is not started; rename it to demo.spec.json"
            ),
            Some("controller_not_started")
        );
        assert_eq!(
            settlement_stall_signature("provider returned HTTP 402"),
            None
        );
    }

    #[test]
    fn repeated_settlement_diagnostic_stalls_after_two_observations() {
        let mut tracker = SettlementStallTracker::default();
        assert!(!tracker.record("no_task_accepted_receipt"));
        assert!(tracker.record("no_task_accepted_receipt"));
        assert!(!tracker.record("loop_running"));
    }

    #[tokio::test]
    async fn settlement_stall_writes_an_invalid_reward_result() {
        let mut tracker = SettlementStallTracker::default();
        let mut progress = RunProgress::new();
        let signature = Some("no_task_accepted_receipt");

        assert!(settlement_stall(&mut tracker, signature).is_none());
        let diagnostic = settlement_stall(&mut tracker, signature)
            .expect("same diagnostic must stop on the second observation");
        assert!(diagnostic.contains("reward_valid=false"));
        progress.remember_error(&diagnostic);
        progress.mark_reward_invalid();

        let report = progress.report(
            ExecutionResultOutcomeV1::Failed,
            TerminalReason::ExecutionFailed,
            840_000,
        );
        let directory = tempfile::tempdir().unwrap();
        let result_path = directory.path().join("aster.result.json");
        persist_result(&result_path, &report)
            .await
            .expect("result must be persisted");
        let value: Value = serde_json::from_slice(&std::fs::read(&result_path).unwrap())
            .expect("valid result JSON");
        assert_eq!(value["reward_valid"], false);
        assert_eq!(value["outcome"], "failed");
        assert!(value["lastError"]
            .as_str()
            .is_some_and(|error| error.contains("reward_valid=false")));
    }
}
