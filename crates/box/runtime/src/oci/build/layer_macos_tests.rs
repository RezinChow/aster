#![cfg(all(test, target_os = "macos"))]

use super::*;
use std::collections::BTreeMap;

const GUEST_STAT: &str = "user.containers.override_stat";

fn set_guest_stat(path: &Path, value: &str) {
    xattr::set(path, GUEST_STAT, value.as_bytes()).unwrap();
}

fn layer_headers(path: &Path) -> BTreeMap<PathBuf, (u64, u64, u32)> {
    let file = std::fs::File::open(path).unwrap();
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(file));
    archive
        .entries()
        .unwrap()
        .map(|entry| {
            let entry = entry.unwrap();
            let path = entry.path().unwrap().into_owned();
            let header = entry.header();
            (
                path,
                (
                    header.uid().unwrap(),
                    header.gid().unwrap(),
                    header.mode().unwrap() & 0o7777,
                ),
            )
        })
        .collect()
}

#[test]
fn snapshots_detect_guest_chmod_and_chown_without_host_metadata_changes() {
    let root = tempfile::tempdir().unwrap();
    let file = root.path().join("entrypoint.sh");
    std::fs::write(&file, "#!/bin/sh\n").unwrap();
    set_guest_stat(&file, "0:0:0100644");
    let before = DirSnapshot::capture(root.path()).unwrap();
    set_guest_stat(&file, "0:0:0100755");
    let executable = DirSnapshot::capture(root.path()).unwrap();
    assert_eq!(before.diff(&executable), [PathBuf::from("entrypoint.sh")]);
    set_guest_stat(&file, "10001:10002:0100755");
    let owned = DirSnapshot::capture(root.path()).unwrap();
    assert_eq!(executable.diff(&owned), [PathBuf::from("entrypoint.sh")]);
    let entry = &owned.entries[Path::new("entrypoint.sh")];
    assert_eq!((entry.uid, entry.gid, entry.mode), (10001, 10002, 0o100755));
}

#[test]
fn run_and_copy_layers_export_guest_permissions_and_ownership() {
    let root = tempfile::tempdir().unwrap();
    let output = tempfile::tempdir().unwrap();
    std::fs::create_dir(root.path().join("bin")).unwrap();
    std::fs::write(root.path().join("bin/app"), "executable payload").unwrap();
    set_guest_stat(&root.path().join("bin"), "10001:10002:040750");
    set_guest_stat(&root.path().join("bin/app"), "10001:10002:0100755");
    let changed = vec![PathBuf::from("bin"), PathBuf::from("bin/app")];
    let run = output.path().join("run.tar.gz");
    create_layer(root.path(), &changed, &run).unwrap();
    let headers = layer_headers(&run);
    assert_eq!(headers[Path::new("bin")], (10001, 10002, 0o750));
    assert_eq!(headers[Path::new("bin/app")], (10001, 10002, 0o755));
    let copy = output.path().join("copy.tar.gz");
    create_layer_from_dir_with_chown(root.path(), Path::new("opt"), &copy, Some((7, 8))).unwrap();
    let headers = layer_headers(&copy);
    assert_eq!(headers[Path::new("opt/bin")], (7, 8, 0o750));
    assert_eq!(headers[Path::new("opt/bin/app")], (7, 8, 0o755));
}

#[test]
fn malformed_guest_metadata_refuses_snapshot_and_layer_publication() {
    let root = tempfile::tempdir().unwrap();
    let output = tempfile::tempdir().unwrap();
    let file = root.path().join("app");
    std::fs::write(&file, "payload").unwrap();
    for value in [
        "10001:10002",
        "10001:10002:0100755:extra",
        "invalid:10002:0100755",
        "10001:4294967296:0100755",
        "10001:10002:invalid",
        "10001:10002:040755",
    ] {
        set_guest_stat(&file, value);
        assert!(DirSnapshot::capture(root.path()).is_err(), "{value}");
        assert!(
            create_layer(
                root.path(),
                &[PathBuf::from("app")],
                &output.path().join("bad.tar.gz")
            )
            .is_err(),
            "{value}"
        );
    }
}

#[test]
fn symlink_export_does_not_inherit_the_targets_guest_identity() {
    let root = tempfile::tempdir().unwrap();
    let output = tempfile::tempdir().unwrap();
    std::fs::write(root.path().join("app"), "payload").unwrap();
    set_guest_stat(&root.path().join("app"), "10001:10002:0100750");
    std::os::unix::fs::symlink("app", root.path().join("link")).unwrap();
    let layer = output.path().join("link.tar.gz");
    create_layer(root.path(), &[PathBuf::from("link")], &layer).unwrap();
    let headers = layer_headers(&layer);
    assert_ne!(headers[Path::new("link")], (10001, 10002, 0o750));
}
