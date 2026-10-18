#![cfg(test)]

use super::*;

fn image_accounts() -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir(root.path().join("etc")).unwrap();
    std::fs::write(
        root.path().join("etc/passwd"),
        "root:x:0:0:root:/root:/bin/sh\nreader:x:1201:1202:Reader:/home/reader:/bin/sh\n",
    )
    .unwrap();
    std::fs::write(
        root.path().join("etc/group"),
        "root:x:0:\nreader:x:1202:\nresearch:x:2403:reader\n",
    )
    .unwrap();
    root
}

#[test]
fn named_image_user_and_group_resolve_to_the_declared_numeric_identity() {
    let root = image_accounts();
    let resolved = resolve_named_user("reader:research", root.path().to_str().unwrap()).unwrap();
    assert_eq!(resolved, "1201:2403");
    assert_eq!(
        parse_process_user(Some(&resolved)).unwrap(),
        Some(ProcessUser {
            uid: 1201,
            gid: Some(2403)
        })
    );
}

#[test]
fn numeric_or_root_user_can_select_an_exact_named_image_group() {
    let root = image_accounts();
    for (input, expected) in [("1201:research", "1201:2403"), ("root:research", "0:2403")] {
        assert_eq!(
            resolve_named_user(input, root.path().to_str().unwrap()).as_deref(),
            Some(expected)
        );
    }
}

#[test]
fn existing_numeric_and_default_group_semantics_are_preserved() {
    let root = image_accounts();
    for (input, expected) in [
        ("reader", "1201:1202"),
        ("reader:99", "1201:99"),
        ("reader:root", "1201:0"),
    ] {
        let resolved = resolve_named_user(input, root.path().to_str().unwrap()).unwrap();
        let identity = parse_process_user(Some(&resolved)).unwrap();
        assert_eq!(identity, parse_process_user(Some(expected)).unwrap());
    }
    for input in ["0", "1201", "1201:99", "root", "root:root"] {
        assert_eq!(
            resolve_named_user(input, root.path().to_str().unwrap()),
            None
        );
        assert!(parse_process_user(Some(input)).is_ok());
    }
}

#[test]
fn missing_or_malformed_names_fail_closed_instead_of_selecting_root() {
    let root = image_accounts();
    for input in [
        "missing:research",
        "reader:missing",
        "reader:Research",
        "read:research",
        ":research",
        "reader:",
        "reader:research:0",
    ] {
        let resolved = resolve_named_user(input, root.path().to_str().unwrap());
        assert!(
            parse_process_user(Some(resolved.as_deref().unwrap_or(input))).is_err(),
            "{input}"
        );
    }
    std::fs::remove_file(root.path().join("etc/group")).unwrap();
    assert_eq!(
        resolve_named_user("reader:research", root.path().to_str().unwrap()),
        None
    );
}

#[test]
fn invalid_group_ids_do_not_fall_back_to_the_passwd_group() {
    let root = image_accounts();
    for gid in ["-1", "4294967296", "invalid", ""] {
        std::fs::write(
            root.path().join("etc/group"),
            format!("research:x:{gid}:reader\n"),
        )
        .unwrap();
        assert_eq!(
            resolve_named_user("reader:research", root.path().to_str().unwrap()),
            None
        );
    }
}
