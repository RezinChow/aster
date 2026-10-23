//! The Cloud WEB0.1 projection is a wire contract, not a hand-adjusted Gateway fixture.

use super::GatewayConfig;

const CLOUD_TARGET: &str =
    include_str!("../../tests/fixtures/contracts/cloud-web-static-bundle-target.acl");

#[test]
fn static_bundle_contract_accepts_exact_cloud_projection() {
    let config = GatewayConfig::from_acl(CLOUD_TARGET).expect("Cloud projection parses");
    let bundle = &config.static_bundles["tenant-web"];
    let manifest = bundle.sealed_manifest();
    manifest.validate().expect("Cloud manifest is admitted");
    assert_eq!(bundle.release_digest, "20".repeat(32));
    assert_eq!(bundle.provenance_digest, Some("10".repeat(32)));
    assert_eq!(
        bundle.manifest.entries["assets/app.js"].digest,
        "30".repeat(32)
    );
    assert_eq!(bundle.manifest.entries["index.html"].size, 13);
    assert_eq!(bundle.spa_fallback.as_deref(), Some("index.html"));
    assert!(bundle.local_digest_store.is_none());
}

#[test]
fn static_bundle_contract_preserves_legacy_hex_and_optional_delivery_defaults() {
    let legacy = CLOUD_TARGET.replace("sha256:", "");
    let start = legacy.find("  delivery {").expect("delivery fixture");
    let end = legacy[start..].find("  }\n").expect("delivery end") + start + 4;
    let legacy = format!("{}{}", &legacy[..start], &legacy[end..]);
    let config = GatewayConfig::from_acl(&legacy).expect("legacy projection parses");
    config.static_bundles["tenant-web"]
        .sealed_manifest()
        .validate()
        .expect("legacy manifest is admitted");
}

#[test]
fn static_bundle_contract_refuses_unknown_digest_algorithms_and_noncanonical_values() {
    for invalid in [
        "sha512:",
        "SHA256:",
        "sha256:sha256:",
        "sha256:A",
        "sha256:../",
    ] {
        let acl = CLOUD_TARGET.replacen("sha256:", invalid, 1);
        assert!(GatewayConfig::from_acl(&acl).is_err(), "accepted {invalid}");
    }
}

#[test]
fn static_bundle_contract_refuses_delivery_policy_drift() {
    for (original, changed) in [
        (
            "content_type_source = \"manifest\"",
            "content_type_source = \"extension\"",
        ),
        (
            "x_content_type_options = \"nosniff\"",
            "x_content_type_options = \"sniff\"",
        ),
        (
            "entry_document_cache = \"no-cache\"",
            "entry_document_cache = \"immutable\"",
        ),
        ("asset_cache = \"immutable\"", "asset_cache = \"public\""),
        ("spa_excludes = [\"/api\"]", "spa_excludes = []"),
        (
            "spa_excludes = [\"/api\"]",
            "spa_excludes = [\"/api\", \"/private\"]",
        ),
        ("    asset_cache = \"immutable\"\n", ""),
    ] {
        let acl = CLOUD_TARGET.replace(original, changed);
        assert_ne!(acl, CLOUD_TARGET, "mutation must change the fixture");
        assert!(GatewayConfig::from_acl(&acl).is_err(), "accepted {changed}");
    }
}

#[test]
fn static_bundle_contract_refuses_unknown_fields_at_each_boundary() {
    for (anchor, injected) in [
        (
            "  base_path = \"/\"",
            "  endpoint = \"https://objects.invalid\"\n",
        ),
        (
            "  base_path = \"/\"",
            "  secret_key = \"must-not-enter-snapshot\"\n",
        ),
        ("  base_path = \"/\"", "  mutable_alias = \"current\"\n"),
        (
            "    entry_document =",
            "    endpoint = \"https://objects.invalid\"\n",
        ),
        (
            "      media_type",
            "      credential = \"must-not-enter-snapshot\"\n",
        ),
        ("    content_type_source", "    compression = \"rewrite\"\n"),
    ] {
        let acl = CLOUD_TARGET.replacen(anchor, &format!("{injected}{anchor}"), 1);
        assert_ne!(acl, CLOUD_TARGET, "mutation must change the fixture");
        assert!(
            GatewayConfig::from_acl(&acl).is_err(),
            "accepted {injected}"
        );
    }
}

#[test]
fn static_bundle_contract_refuses_unknown_or_duplicate_nested_blocks() {
    for injected in [
        "  object_authority { endpoint = \"https://objects.invalid\" }\n",
        "  manifest { entry_document = \"index.html\" }\n",
        "  delivery { content_type_source = \"manifest\" }\n",
        "  delivery \"unrecognized\" {}\n",
    ] {
        let acl = CLOUD_TARGET.replacen("  base_path", &format!("{injected}  base_path"), 1);
        assert!(
            GatewayConfig::from_acl(&acl).is_err(),
            "accepted {injected}"
        );
    }
    let acl = CLOUD_TARGET.replace(
        "    entries \"index.html\" {",
        "    policy {}\n    entries \"index.html\" {",
    );
    assert!(GatewayConfig::from_acl(&acl).is_err());
}

#[test]
fn static_bundle_contract_refuses_duplicate_entry_paths_and_target_names() {
    let duplicate = r#"    entries "index.html" {
      digest = "sha256:4040404040404040404040404040404040404040404040404040404040404040"
      media_type = "text/html"
      size = 13
    }
"#;
    let acl = CLOUD_TARGET.replace(
        "    entry_document",
        &format!("{duplicate}    entry_document"),
    );
    assert!(
        GatewayConfig::from_acl(&acl).is_err(),
        "duplicate entry adopted"
    );
    let acl = format!("{CLOUD_TARGET}\n{CLOUD_TARGET}");
    assert!(
        GatewayConfig::from_acl(&acl).is_err(),
        "duplicate target adopted"
    );
}

#[test]
fn static_bundle_contract_does_not_bypass_missing_managed_object_authority() {
    let acl = format!("mode {{ kind = \"cloud-managed\" }}\n{CLOUD_TARGET}");
    let config = GatewayConfig::from_acl(&acl).expect("Cloud projection parses");
    let error = config
        .validate()
        .expect_err("no trusted object authority")
        .to_string();
    assert!(
        error.contains("object authority"),
        "unexpected refusal: {error}"
    );
}

#[test]
fn static_bundle_contract_refuses_ambiguous_labels_and_identity_attributes() {
    for (original, changed) in [
        (
            "static_bundles \"tenant-web\" {",
            "static_bundles \"tenant-web\" \"other\" {",
        ),
        (
            "static_bundles \"tenant-web\" {",
            "static_bundles \"tenant-web\" { name = \"other\"",
        ),
        ("  manifest {", "  manifest \"other\" {"),
        ("  delivery {", "  delivery \"other\" {"),
        (
            "    entries \"index.html\" {",
            "    entries \"index.html\" { path = \"other.html\"",
        ),
    ] {
        let acl = CLOUD_TARGET.replace(original, changed);
        assert!(GatewayConfig::from_acl(&acl).is_err(), "accepted {changed}");
    }
}

#[test]
fn static_bundle_contract_refuses_delivery_type_coercion_and_entry_subblocks() {
    let acl = CLOUD_TARGET.replace("spa_excludes = [\"/api\"]", "spa_excludes = \"/api\"");
    assert!(GatewayConfig::from_acl(&acl).is_err());
    let acl = CLOUD_TARGET.replace("      media_type", "      source {}\n      media_type");
    assert!(GatewayConfig::from_acl(&acl).is_err());
}
