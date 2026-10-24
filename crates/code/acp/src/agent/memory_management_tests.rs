use super::*;
use a3s_code_core::durable_memory_vec::management::MemoryManagementResponse;

#[tokio::test]
async fn management_works_without_model_or_session_and_refuses_another_workspace() {
    let root = tempfile::tempdir().unwrap();
    let mut launch = test_launch(None);
    launch.workspace = root.path().canonicalize().unwrap();
    launch.model_id.clear();
    launch.config = Default::default();
    launch.config.memory_dir = Some(root.path().join("private-memory"));
    let store = a3s_code_core::durable_memory_vec::VecMemoryStore::open(
        launch.config.memory_dir.as_ref().unwrap(),
    )
    .unwrap();
    store
        .put(&a3s_code_core::durable_memory_vec::MemoryRecord {
            id: "fixture".into(),
            content: "provider-free inspection".into(),
            tags: vec![],
            importance: 0.6,
            memory_type: "\"semantic\"".into(),
            timestamp: "2026-10-24T00:00:00Z".into(),
            meta: "{}".into(),
        })
        .unwrap();
    drop(store);
    let host = A3sCodeAgent::new(launch);
    let request = |workspace: &std::path::Path, body: serde_json::Value| {
        acp::ExtRequest::new(
            "a3s/memory/manage",
            serde_json::value::to_raw_value(
                &serde_json::json!({ "workspace_root": workspace, "request": body }),
            )
            .unwrap()
            .into(),
        )
    };
    let query = serde_json::json!({ "operation": "list", "query": "", "memory_type": null, "cursor": null });
    let workspace = root.path().canonicalize().unwrap();
    let answer = host
        .handle_memory_management(&request(&workspace, query.clone()))
        .await
        .unwrap();
    let value: serde_json::Value = serde_json::from_str(answer.0.get()).unwrap();
    let response: MemoryManagementResponse =
        serde_json::from_value(value["outcome"]["Ok"].clone()).unwrap();
    assert!(matches!(
        response,
        MemoryManagementResponse::List { total: 1, .. }
    ));
    let answer = host
        .handle_memory_management(&request(
            &workspace,
            serde_json::json!({ "operation": "read", "id": "fixture" }),
        ))
        .await
        .unwrap();
    let value: serde_json::Value = serde_json::from_str(answer.0.get()).unwrap();
    assert_eq!(
        value["outcome"]["Ok"]["item"]["content"],
        "provider-free inspection"
    );
    let revision = &value["outcome"]["Ok"]["item"]["revision"];
    let answer = host
        .handle_memory_management(&request(
            &workspace,
            serde_json::json!({ "operation": "delete", "id": "fixture", "revision": revision }),
        ))
        .await
        .unwrap();
    let value: serde_json::Value = serde_json::from_str(answer.0.get()).unwrap();
    assert_eq!(value["outcome"]["Ok"]["id"], "fixture");
    assert!(host.sessions.lock().await.is_empty());
    assert!(host.core_agent.lock().await.is_none());
    let elsewhere = tempfile::tempdir().unwrap();
    assert!(host
        .handle_memory_management(&request(elsewhere.path(), query))
        .await
        .is_err());
    assert!(host
        .handle_memory_management(&request(
            root.path(),
            serde_json::json!({ "operation": "read", "id": "a", "memory_directory": "/other" })
        ))
        .await
        .is_err());
}
