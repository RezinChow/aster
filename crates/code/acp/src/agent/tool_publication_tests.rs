use super::*;

#[test]
fn validated_publication_survives_an_invalid_truncated_json_preview() {
    let metadata = serde_json::json!({
        "file_path":"/workspace/report.xlsx", "files":["/workspace/report.xlsx"],
        "artifact_relative_path":"report.xlsx", "artifact_requested_path":"report.xlsx",
        "artifact_content_digest":"a".repeat(64), "kind":"xlsx", "bytes":7605,
        "validated":true, "readback":"cell data ".repeat(1000), "readback_truncated":true
    });
    let text = metadata.to_string();
    let contents = serde_json::to_value(tool_call_content("office_file", None, &text)).unwrap();
    let preview = contents[0]["content"]["text"].as_str().unwrap();
    assert!(serde_json::from_str::<serde_json::Value>(preview).is_err());
    let publication = tool_publication_output("office_file", Some(&metadata), 0).unwrap();
    assert_eq!(publication["artifact_relative_path"], "report.xlsx");
    assert_eq!(publication["artifact_content_digest"], "a".repeat(64));
    assert_eq!(publication["validated"], true);
    assert!(publication.get("readback").is_none());
    assert!(publication.to_string().len() < 1000);
}

#[test]
fn failed_reads_and_unverified_metadata_do_not_become_publications() {
    let valid = serde_json::json!({"artifact_relative_path":"report.xlsx","validated":true});
    assert!(tool_publication_output("office_file", Some(&valid), 1).is_none());
    assert!(tool_publication_output("office_read", Some(&valid), 0).is_none());
    assert!(tool_publication_output("office_file", None, 0).is_none());
    for metadata in [
        serde_json::Value::Null,
        serde_json::json!({"file_path":"input.xlsx","validated":true}),
        serde_json::json!({"artifact_relative_path":"report.xlsx","validated":false}),
        serde_json::json!({"artifact_relative_path":"","validated":true}),
        serde_json::json!({"artifact_relative_path":42,"validated":true}),
    ] {
        assert!(tool_publication_output("office_file", Some(&metadata), 0).is_none());
    }
}
