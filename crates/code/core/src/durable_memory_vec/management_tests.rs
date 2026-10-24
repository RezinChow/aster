use super::*;

fn record(id: &str, content: &str, kind: &str) -> MemoryRecord {
    MemoryRecord {
        id: id.into(),
        content: content.into(),
        tags: vec!["test".into()],
        importance: 0.7,
        memory_type: format!("\"{kind}\""),
        timestamp: "2026-10-24T00:00:00Z".into(),
        meta: r#"{"metadata":{"source":"fixture"},"access_count":2,"last_accessed":null}"#.into(),
    }
}
fn list(
    store: &VecMemoryStore,
    query: &str,
    kind: Option<StoredMemoryType>,
    cursor: Option<String>,
) -> (Vec<ManagedMemory>, usize, Option<String>) {
    match store
        .manage(MemoryManagementRequest::List {
            query: query.into(),
            memory_type: kind,
            cursor,
        })
        .unwrap()
    {
        MemoryManagementResponse::List {
            items,
            total,
            next_cursor,
        } => (items, total, next_cursor),
        _ => panic!("expected catalog"),
    }
}

#[test]
fn management_pages_reach_every_match_without_recall_top_k_loss() {
    let root = tempfile::tempdir().unwrap();
    let store = VecMemoryStore::open(root.path()).unwrap();
    for i in 0..107 {
        store
            .put(&record(
                &format!("m{i:03}"),
                &format!("LOCAL memory {i}"),
                if i % 2 == 0 { "semantic" } else { "working" },
            ))
            .unwrap();
    }
    let (first, total, cursor) = list(&store, "local", None, None);
    assert_eq!((first.len(), total), (50, 107));
    let (second, _, cursor) = list(&store, "local", None, cursor);
    let (last, _, cursor) = list(&store, "local", None, cursor);
    let ids: std::collections::BTreeSet<_> = first
        .into_iter()
        .chain(second)
        .chain(last)
        .map(|item| item.id)
        .collect();
    assert_eq!(ids.len(), 107);
    assert!(ids.contains("m000") && ids.contains("m106") && cursor.is_none());
    let (_, total, _) = list(&store, "local", Some(StoredMemoryType::Semantic), None);
    assert_eq!(total, 54);
}

#[test]
fn management_refuses_stale_cursor_unknown_types_and_oversized_records() {
    let root = tempfile::tempdir().unwrap();
    let store = VecMemoryStore::open(root.path()).unwrap();
    for i in 0..51 {
        store
            .put(&record(
                &format!("{i:03}"),
                &format!("value {i}"),
                "episodic",
            ))
            .unwrap();
    }
    let (_, _, cursor) = list(&store, "", None, None);
    store.put(&record("new", "new value", "working")).unwrap();
    let error = store
        .manage(MemoryManagementRequest::List {
            query: "".into(),
            memory_type: None,
            cursor,
        })
        .unwrap_err();
    assert_eq!(error.code, MemoryManagementCode::Conflict);
    store
        .put(&record("unknown", "unknown type", "imagined"))
        .unwrap();
    assert!(store
        .manage(MemoryManagementRequest::Read {
            id: "unknown".into()
        })
        .is_err());
    store
        .put(&record(
            "large",
            &"x".repeat(MAX_RECORD_BYTES + 1),
            "semantic",
        ))
        .unwrap();
    assert_eq!(
        store
            .manage(MemoryManagementRequest::Read { id: "large".into() })
            .unwrap_err()
            .code,
        MemoryManagementCode::Limit
    );
    for raw in [
        r#"{"operation":"clear"}"#,
        r#"{"operation":"read","id":"a","path":"/other"}"#,
        r#"{"operation":"list","query":"","memory_type":"guess","cursor":null}"#,
    ] {
        assert!(MemoryManagementRequest::parse(raw).is_err());
    }
}

#[tokio::test]
async fn management_delete_is_conditional_durable_and_allows_remembering_again() {
    let root = tempfile::tempdir().unwrap();
    let store = VecMemoryStore::open(root.path()).unwrap();
    store
        .put(&record("a", "uniquefixture", "procedural"))
        .unwrap();
    let item = store.inspect_id("a").unwrap();
    assert_eq!(
        item.metadata.get("source").map(String::as_str),
        Some("fixture")
    );
    assert_eq!(item.access_count, 2);
    MemoryStore::delete(&store, "a").await.unwrap();
    store
        .put(&record("a", "replacement", "procedural"))
        .unwrap();
    assert_eq!(
        store
            .manage(MemoryManagementRequest::Delete {
                id: "a".into(),
                revision: item.revision
            })
            .unwrap_err()
            .code,
        MemoryManagementCode::Conflict
    );
    assert_eq!(store.inspect_id("a").unwrap().content, "replacement");
    let current = store.inspect_id("a").unwrap();
    store
        .manage(MemoryManagementRequest::Delete {
            id: "a".into(),
            revision: current.revision,
        })
        .unwrap();
    assert!(MemoryStore::search(&store, "replacement", 10)
        .await
        .unwrap()
        .is_empty());
    store
        .put(&record("again", "replacement", "semantic"))
        .unwrap();
    drop(store);
    let reopened = VecMemoryStore::open(root.path()).unwrap();
    assert_eq!(reopened.inspect_id("again").unwrap().content, "replacement");
    assert_eq!(
        reopened.inspect_id("a").unwrap_err().code,
        MemoryManagementCode::Missing
    );
}

#[test]
fn management_revision_binds_metadata_and_owner_scope() {
    let a = tempfile::tempdir().unwrap();
    let b = tempfile::tempdir().unwrap();
    let first = VecMemoryStore::open(a.path()).unwrap();
    let second = VecMemoryStore::open(b.path()).unwrap();
    first
        .put(&record("same", "same stored content", "semantic"))
        .unwrap();
    second
        .put(&record("same", "same stored content", "semantic"))
        .unwrap();
    let version = first.inspect_id("same").unwrap().revision;
    assert_eq!(
        second
            .manage(MemoryManagementRequest::Delete {
                id: "same".into(),
                revision: version
            })
            .unwrap_err()
            .code,
        MemoryManagementCode::Conflict
    );
    assert_eq!(
        second.inspect_id("same").unwrap().content,
        "same stored content"
    );
    for kind in [
        StoredMemoryType::Episodic,
        StoredMemoryType::Semantic,
        StoredMemoryType::Procedural,
        StoredMemoryType::Working,
    ] {
        assert_eq!(StoredMemoryType::parse(kind.as_str()), Some(kind));
    }
}

#[test]
fn management_bounds_page_bytes_and_rejects_unknown_auxiliary_state() {
    let root = tempfile::tempdir().unwrap();
    let store = VecMemoryStore::open(root.path()).unwrap();
    for i in 0..12 {
        store
            .put(&record(
                &format!("{i:02}"),
                &format!("{i} {}", "x".repeat(50 * 1024)),
                "semantic",
            ))
            .unwrap();
    }
    let (first, total, cursor) = list(&store, "", None, None);
    assert_eq!(total, 12);
    assert!(first.len() < 12 && cursor.is_some());
    assert!(serde_json::to_vec(&first).unwrap().len() < 256 * 1024);
    let mut broken = record("unknown-meta", "unknown meta", "semantic");
    broken.meta = r#"{"guessed_provenance":"unknown"}"#.into();
    store.put(&broken).unwrap();
    assert_eq!(
        store
            .manage(MemoryManagementRequest::Read { id: broken.id })
            .unwrap_err()
            .code,
        MemoryManagementCode::Failed
    );
}

#[test]
fn management_stale_deletion_never_removes_a_concurrent_sdk_replacement() {
    let root = tempfile::tempdir().unwrap();
    let store = Arc::new(VecMemoryStore::open(root.path()).unwrap());
    let runtime = Arc::new(
        tokio::runtime::Builder::new_current_thread()
            .build()
            .unwrap(),
    );
    for iteration in 0..32 {
        store
            .put(&record("target", &format!("old {iteration}"), "semantic"))
            .unwrap();
        let revision = store.inspect_id("target").unwrap().revision;
        let barrier = Arc::new(std::sync::Barrier::new(3));
        let delete = {
            let store = Arc::clone(&store);
            let barrier = Arc::clone(&barrier);
            std::thread::spawn(move || {
                barrier.wait();
                store.manage(MemoryManagementRequest::Delete {
                    id: "target".into(),
                    revision,
                })
            })
        };
        let replace = {
            let store = Arc::clone(&store);
            let barrier = Arc::clone(&barrier);
            let runtime = Arc::clone(&runtime);
            std::thread::spawn(move || {
                barrier.wait();
                let _ = runtime.block_on(MemoryStore::delete(store.as_ref(), "target"));
                store
                    .put(&record("target", &format!("new {iteration}"), "semantic"))
                    .unwrap();
            })
        };
        barrier.wait();
        replace.join().unwrap();
        if let Err(error) = delete.join().unwrap() {
            assert!(matches!(
                error.code,
                MemoryManagementCode::Missing | MemoryManagementCode::Conflict
            ));
        }
        assert_eq!(
            store.inspect_id("target").unwrap().content,
            format!("new {iteration}")
        );
        runtime
            .block_on(MemoryStore::delete(store.as_ref(), "target"))
            .unwrap();
    }
}
