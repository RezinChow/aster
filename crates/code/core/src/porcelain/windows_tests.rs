#![cfg(test)]

use super::*;

#[test]
fn actual_windows_files_have_bounded_byte_identities() {
    let root = tempfile::tempdir().unwrap();
    std::fs::write(root.path().join("file.txt"), b"no-newline").unwrap();
    let stamp = observe_identity_windows(root.path(), "file.txt", &mut 10, false).unwrap();
    assert_eq!(
        stamp.content_digest,
        Some(format!("{:x}", Sha256::digest(b"no-newline")))
    );
    assert_eq!(stamp.len, 10);
    assert!(observe_identity_windows(root.path(), "file.txt", &mut 9, false).is_none());
    let metadata = observe_identity_windows(root.path(), "file.txt", &mut 0, true).unwrap();
    assert!(metadata.content_digest.is_none());
    assert!(
        !observe_identity_windows(root.path(), "missing/child", &mut 0, false)
            .unwrap()
            .present
    );
}

#[test]
fn actual_windows_walk_detects_changes_without_git() {
    let root = tempfile::tempdir().unwrap();
    std::fs::write(root.path().join("before.txt"), b"before").unwrap();
    let before = index_files(root.path());
    assert!(!before.incomplete);
    std::fs::write(root.path().join("created.txt"), b"created").unwrap();
    let delta = file_delta(root.path(), &before);
    assert!(!delta.incomplete);
    assert!(delta.paths.contains(&"created.txt".to_string()));
    let effects = observe_path_effects(root.path(), delta);
    assert_eq!(
        effects.completeness,
        a3s_effect::ToolObservationCompleteness::Complete
    );
    assert!(effects
        .changes
        .iter()
        .any(|c| c.path == "created.txt" && c.after.content_digest.is_some()));
}

#[test]
fn windows_observer_refuses_escapes_and_streams() {
    let root = tempfile::tempdir().unwrap();
    assert!(
        observe_identity_windows(&root.path().join("missing-root"), "child", &mut 1024, false)
            .is_none()
    );
    for path in ["../outside", "C:\\Windows\\win.ini", "file.txt:stream", ""] {
        assert!(
            observe_identity_windows(root.path(), path, &mut 1024, false).is_none(),
            "{path}"
        );
    }
    std::fs::write(root.path().join("file"), b"file").unwrap();
    assert!(observe_identity_windows(root.path(), "file/child", &mut 1024, false).is_none());
}

#[test]
fn windows_observer_refuses_reparse_point_ancestors() {
    let root = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::fs::write(outside.path().join("secret.txt"), b"outside").unwrap();
    // A junction requires no symlink privilege and exercises a directory reparse point.
    let status = std::process::Command::new("cmd.exe")
        .args(["/C", "mklink", "/J"])
        .arg(root.path().join("escape"))
        .arg(outside.path())
        .output()
        .unwrap();
    assert!(status.status.success());
    assert!(observe_identity_windows(root.path(), "escape/secret.txt", &mut 1024, false).is_none());
    assert!(
        observe_identity_windows(&root.path().join("escape"), "secret.txt", &mut 1024, false)
            .is_none()
    );
    std::fs::remove_dir(root.path().join("escape")).unwrap();
}
