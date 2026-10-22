#![cfg(test)]

use super::*;

#[tokio::test]
async fn model_free_session_returns_late_evidence_and_refuses_calls_after_close() {
    let _permit = crate::test_support::resource_intensive_test_permit().await;
    let workspace = tempfile::tempdir().unwrap();
    let mut lines = vec!["// unrelated source"; 79];
    lines[63] = "pub fn release_workspace_vectors() { /* verified-late-evidence */ }";
    std::fs::write(workspace.path().join("cache.rs"), lines.join("\n")).unwrap();
    std::fs::write(
        workspace.path().join(".env"),
        "SECRET=release_workspace_vectors",
    )
    .unwrap();
    let agent = Agent::from_config(super::super::tests::test_config())
        .await
        .unwrap();
    let session = agent
        .session_async(workspace.path().to_string_lossy(), None)
        .await
        .unwrap();
    let result = session
        .tool(
            "search",
            serde_json::json!({
                "mode": "hybrid", "query": "release_workspace_vectors", "limit": 1,
            }),
        )
        .await
        .unwrap();
    assert_eq!(result.exit_code, 0, "{}", result.output);
    assert!(
        result
            .output
            .contains("64 | pub fn release_workspace_vectors()"),
        "{}",
        result.output
    );
    assert!(result.output.contains("verified-late-evidence"));
    assert!(!result.output.contains("SECRET="));
    assert!(result.output.len() <= 24 * 1024);
    let metadata = result.metadata.unwrap();
    assert_eq!(metadata["results"][0]["start_line"], 61);
    assert_eq!(metadata["results"][0]["end_line"], 76);
    assert_eq!(metadata["results"][0]["chunk_start_line"], 1);
    assert_eq!(metadata["results"][0]["chunk_end_line"], 79);
    assert_eq!(metadata["results"][0]["digest_verified"], true);
    assert_eq!(metadata["semantic_status"]["phase"], "disabled");
    assert_eq!(session.workspace_retrieval_status().vector_records, 0);
    let secret = session
        .hybrid_search(
            crate::WorkspaceHybridSearchRequest::new("release_workspace_vectors").with_path(".env"),
        )
        .await
        .unwrap();
    assert!(secret.hits.is_empty());
    session.close().await;
    assert!(matches!(
        session
            .hybrid_search(crate::WorkspaceHybridSearchRequest::new(
                "release_workspace_vectors"
            ))
            .await,
        Err(crate::WorkspaceRetrievalError::Unavailable)
    ));
}

#[tokio::test]
async fn model_free_hybrid_obeys_per_mode_permissions_before_source_admission() {
    let _permit = crate::test_support::resource_intensive_test_permit().await;
    let workspace = tempfile::tempdir().unwrap();
    std::fs::write(
        workspace.path().join("source.rs"),
        "private_hybrid_evidence",
    )
    .unwrap();
    let agent = Agent::from_config(super::super::tests::test_config())
        .await
        .unwrap();
    let policy = crate::permissions::PermissionPolicy::new()
        .allow("Grep(*)")
        .deny("search(hybrid **)");
    let options = SessionOptions::new().with_permission_policy(policy);
    let session = agent
        .session_async(workspace.path().to_string_lossy(), Some(options))
        .await
        .unwrap();
    let result = session
        .governed_tool(
            "search",
            serde_json::json!({
                "mode": "hybrid", "query": "private_hybrid_evidence",
            }),
        )
        .await
        .unwrap();
    assert_ne!(result.exit_code, 0);
    assert!(
        !result.output.contains("private_hybrid_evidence"),
        "{}",
        result.output
    );
    assert!(!session
        .tool_context
        .workspace_services
        .chunk_catalog_started());
    session.close().await;
}

#[tokio::test]
async fn model_free_hybrid_output_budget_keeps_metadata_aligned_with_displayed_results() {
    let _permit = crate::test_support::resource_intensive_test_permit().await;
    let workspace = tempfile::tempdir().unwrap();
    let line = format!("budget_probe {}\n", "x".repeat(600));
    for index in 0..8 {
        std::fs::write(
            workspace.path().join(format!("source-{index}.rs")),
            line.repeat(20),
        )
        .unwrap();
    }
    let agent = Agent::from_config(super::super::tests::test_config())
        .await
        .unwrap();
    let session = agent
        .session_async(workspace.path().to_string_lossy(), None)
        .await
        .unwrap();
    let result = session
        .tool(
            "search",
            serde_json::json!({"mode":"hybrid", "query":"budget_probe", "limit":25}),
        )
        .await
        .unwrap();
    assert_eq!(result.exit_code, 0, "{}", result.output);
    assert!(result.output.len() <= 24 * 1024);
    let metadata = result.metadata.unwrap();
    assert_eq!(metadata["output_budget_reached"], true);
    assert_eq!(metadata["truncated"], true);
    let hits = metadata["results"].as_array().unwrap();
    assert!(!hits.is_empty() && hits.len() < 8);
    assert_eq!(
        metadata["returned_results"].as_u64().unwrap() as usize,
        hits.len()
    );
    assert_eq!(
        metadata["source_anchors"].as_array().unwrap().len(),
        hits.len()
    );
    assert!(result
        .output
        .contains(&format!("{} current-source-verified result(s)", hits.len())));
    session.close().await;
}
