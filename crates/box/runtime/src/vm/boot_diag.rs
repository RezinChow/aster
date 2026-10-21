//! Retain boot-failure diagnostics before a failed boot's teardown deletes
//! the box directory. A failed boot's console and shim logs are the only
//! evidence for why the guest exec server never became ready; keep one
//! bounded copy per box id under `<home>/diag/failed-boots/<box_id>/`.

use std::path::Path;

/// Copy `box_dir/logs` into the retained diagnostics location. One copy per
/// box id, replaced on retry. Best-effort: failures are logged and never
/// propagate into the boot-failure path.
pub(crate) fn retain_boot_failure_logs(home_dir: &Path, box_dir: &Path, box_id: &str) {
    let source = box_dir.join("logs");
    if !source.is_dir() {
        tracing::warn!(box_id, "No logs directory to retain for failed boot");
        return;
    }
    let target = home_dir
        .join("diag")
        .join("failed-boots")
        .join(box_id)
        .join("logs");
    if let Err(error) = copy_tree(&source, &target) {
        tracing::error!(
            box_id,
            %error,
            path = %target.display(),
            "Failed to retain boot-failure logs"
        );
    }
}

fn copy_tree(source: &Path, target: &Path) -> std::io::Result<()> {
    // A prior retained copy is replaced, never merged, so the retained
    // snapshot always matches exactly one failed boot attempt.
    if target.exists() {
        std::fs::remove_dir_all(target)?;
    }
    std::fs::create_dir_all(target)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let from = entry.path();
        let to = target.join(entry.file_name());
        if from.is_dir() {
            copy_tree(&from, &to)?;
        } else {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("boot-diag-{tag}-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn copies_console_and_shim_logs_into_the_retained_slot() {
        let root = temp_root("copy");
        let home = root.join("home");
        let box_dir = home.join("boxes").join("box-1");
        std::fs::create_dir_all(box_dir.join("logs")).unwrap();
        std::fs::write(
            box_dir.join("logs/console.log"),
            "KRUN_BOOT_ABORT: stage=event_loop",
        )
        .unwrap();
        std::fs::write(box_dir.join("logs/shim.log"), "shim ready").unwrap();

        retain_boot_failure_logs(&home, &box_dir, "box-1");

        let retained = home.join("diag/failed-boots/box-1/logs");
        assert_eq!(
            std::fs::read_to_string(retained.join("console.log")).unwrap(),
            "KRUN_BOOT_ABORT: stage=event_loop"
        );
        assert_eq!(
            std::fs::read_to_string(retained.join("shim.log")).unwrap(),
            "shim ready"
        );
        // The working box directory is untouched; teardown owns it.
        assert!(box_dir.join("logs/console.log").exists());
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn a_retry_replaces_the_prior_retained_copy() {
        let root = temp_root("replace");
        let home = root.join("home");
        let box_dir = home.join("boxes").join("box-2");
        std::fs::create_dir_all(box_dir.join("logs")).unwrap();
        std::fs::write(box_dir.join("logs/console.log"), "first attempt").unwrap();
        retain_boot_failure_logs(&home, &box_dir, "box-2");

        std::fs::write(box_dir.join("logs/console.log"), "second attempt").unwrap();
        std::fs::write(box_dir.join("logs/guest-init.stderr.log"), "stderr").unwrap();
        retain_boot_failure_logs(&home, &box_dir, "box-2");

        let retained = home.join("diag/failed-boots/box-2/logs");
        assert_eq!(
            std::fs::read_to_string(retained.join("console.log")).unwrap(),
            "second attempt"
        );
        assert!(retained.join("guest-init.stderr.log").exists());
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn a_missing_logs_directory_is_a_logged_no_op() {
        let root = temp_root("noop");
        let home = root.join("home");
        let box_dir = home.join("boxes").join("box-3");
        std::fs::create_dir_all(&box_dir).unwrap();

        retain_boot_failure_logs(&home, &box_dir, "box-3");

        assert!(!home.join("diag/failed-boots/box-3").exists());
        let _ = std::fs::remove_dir_all(root);
    }
}
