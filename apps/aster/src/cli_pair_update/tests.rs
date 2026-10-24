use super::{Version, asset_name_for, channel_for, parse_manifest};

#[test]
fn standard_platforms_use_one_canonical_archive_each() {
    for (os, extension) in [("macos", "tar.gz"), ("linux", "tar.gz"), ("windows", "zip")] {
        assert_eq!(channel_for(os), os);
        assert_eq!(
            asset_name_for(Version(0, 1, 3), channel_for(os)),
            format!("aster-cli-v0.1.3-{os}.{extension}")
        );
    }
    assert_eq!(channel_for("freebsd"), "unsupported");
}

#[test]
fn updater_accepts_the_three_platform_manifest_and_refuses_a_retired_channel() {
    let mut manifest = serde_json::json!({
        "version": "0.1.3",
        "tag": "aster-cli-v0.1.3",
        "assets": {}
    });
    for (os, extension) in [("macos", "tar.gz"), ("linux", "tar.gz"), ("windows", "zip")] {
        manifest["assets"][os] = serde_json::json!({
            "name": format!("aster-cli-v0.1.3-{os}.{extension}"),
            "sha256": "a".repeat(64)
        });
    }
    let parsed = parse_manifest(&serde_json::to_vec(&manifest).unwrap(), "").unwrap();
    assert_eq!(parsed.assets.len(), 3);
    manifest["assets"]["kylin"] = serde_json::json!({
        "name": "aster-cli-v0.1.3-kylin.tar.gz",
        "sha256": "a".repeat(64)
    });
    let error = parse_manifest(&serde_json::to_vec(&manifest).unwrap(), "")
        .err()
        .unwrap();
    assert!(error.to_string().contains("unsupported platform kylin"));
}
