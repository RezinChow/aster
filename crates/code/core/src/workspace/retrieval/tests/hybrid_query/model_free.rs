#![cfg(test)]

use super::*;
use crate::workspace::{WorkspaceCapabilities, WorkspaceRef, WorkspaceServices};

fn services(
    files: Arc<MemoryFiles>,
    catalog: Arc<WorkspaceChunkCatalog>,
) -> Arc<WorkspaceServices> {
    WorkspaceServices::builder(WorkspaceRef::new("fixture", "mem://hybrid"), files)
        .chunk_catalog(catalog)
        .build()
}

#[tokio::test]
async fn hybrid_without_embeddings_returns_verified_evidence_and_explicit_channel_status() {
    let entries = &[("src/cache.rs", "pub fn release_vectors() {}\n")];
    let files = MemoryFiles::from_entries(entries);
    let services = services(files.clone(), populated_catalog(entries));
    assert!(services.hybrid_search_available());
    let registry = crate::tools::ToolRegistry::new(std::path::PathBuf::from("/fixture"));
    crate::tools::builtin::register_builtins(&registry, &services);
    let search = registry
        .definitions()
        .into_iter()
        .find(|tool| tool.name == "search")
        .unwrap();
    assert_eq!(
        search.parameters["properties"]["mode"]["enum"],
        serde_json::json!(["hybrid"])
    );
    let result = services
        .hybrid_search(
            WorkspaceHybridSearchRequest::new("release_vectors"),
            CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(result.hits.len(), 1);
    assert!(result.hits[0].exact_identifier);
    assert_eq!(
        result.semantic_status.phase,
        WorkspaceRetrievalPhase::Disabled
    );
    assert_eq!(result.semantic_status.vector_records, 0);
    let semantic = result
        .channels
        .iter()
        .find(|channel| channel.channel == WorkspaceRetrievalChannel::Semantic)
        .unwrap();
    assert_eq!(
        semantic.fallback,
        Some(WorkspaceHybridFallbackReason::Unavailable)
    );
    assert_eq!(semantic.candidate_count, 0);
    assert_eq!(files.read_paths(), vec!["src/cache.rs"]);
}

#[tokio::test]
async fn model_free_hybrid_filters_changed_deleted_and_unreadable_source() {
    let entries = &[("src/cache.rs", "pub fn release_vectors() {}\n")];
    for deleted in [false, true] {
        let files = MemoryFiles::from_entries(entries);
        let services = services(files.clone(), populated_catalog(entries));
        if deleted {
            files.files.lock().unwrap().clear();
        } else {
            files.replace("src/cache.rs", "pub fn changed_content() {}\n");
        }
        let result = services
            .hybrid_search(
                WorkspaceHybridSearchRequest::new("release_vectors"),
                CancellationToken::new(),
            )
            .await
            .unwrap();
        assert!(result.hits.is_empty());
        assert_eq!(
            result.fallback,
            Some(WorkspaceHybridFallbackReason::FilteredStaleHits)
        );
    }
}

#[tokio::test]
async fn model_free_hybrid_refuses_invalid_queries_paths_denied_reads_and_cancellation() {
    let entries = &[("src/cache.rs", "pub fn release_vectors() {}\n")];
    let files = MemoryFiles::from_entries(entries);
    let catalog = populated_catalog(entries);
    let services = services(files.clone(), catalog.clone());
    for request in [
        WorkspaceHybridSearchRequest::new("release_vectors").with_limit(0),
        WorkspaceHybridSearchRequest::new("release_vectors").with_path("../escape"),
        WorkspaceHybridSearchRequest::new("release_vectors").with_include("../*"),
    ] {
        assert!(matches!(
            services
                .hybrid_search(request, CancellationToken::new())
                .await,
            Err(crate::WorkspaceRetrievalError::InvalidQuery(_))
        ));
    }
    let cancelled = CancellationToken::new();
    cancelled.cancel();
    assert!(matches!(
        services
            .hybrid_search(
                WorkspaceHybridSearchRequest::new("release_vectors"),
                cancelled
            )
            .await,
        Err(crate::WorkspaceRetrievalError::Cancelled)
    ));
    let mut capabilities = WorkspaceCapabilities::read_write();
    capabilities.read = false;
    let denied =
        WorkspaceServices::builder(WorkspaceRef::new("denied", "mem://denied"), files.clone())
            .chunk_catalog(catalog)
            .capabilities(capabilities)
            .build();
    assert!(!denied.hybrid_search_available());
    assert!(matches!(
        denied
            .hybrid_search(
                WorkspaceHybridSearchRequest::new("release_vectors"),
                CancellationToken::new()
            )
            .await,
        Err(crate::WorkspaceRetrievalError::Unavailable)
    ));
    assert!(files.read_paths().is_empty());
}

#[tokio::test]
async fn first_model_free_query_waits_for_lazy_source_admission() {
    let root = tempfile::tempdir().unwrap();
    std::fs::write(
        root.path().join("source.rs"),
        "pub fn late_admission() {}\n",
    )
    .unwrap();
    let services = WorkspaceServices::local_with_retrieval(root.path());
    assert!(!services.chunk_catalog_started());
    assert!(matches!(
        services
            .hybrid_search(
                WorkspaceHybridSearchRequest::new("late_admission").with_limit(0),
                CancellationToken::new(),
            )
            .await,
        Err(crate::WorkspaceRetrievalError::InvalidQuery(_))
    ));
    assert!(
        !services.chunk_catalog_started(),
        "invalid query started source admission"
    );
    let result = services
        .hybrid_search(
            WorkspaceHybridSearchRequest::new("late_admission"),
            CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(result.hits.len(), 1);
    assert_eq!(result.hits[0].chunk.path.as_ref(), "source.rs");
}

#[tokio::test]
async fn cancellation_interrupts_initial_catalog_admission() {
    let files = MemoryFiles::from_entries(&[]);
    let catalog = WorkspaceChunkCatalog::new_with_engine(
        ChunkingConfig::default(),
        ChunkCatalogLimits::default(),
        crate::WorkspaceLexicalEngine::Portable,
    )
    .unwrap();
    let services = services(files.clone(), catalog);
    let cancellation = CancellationToken::new();
    let query = services.hybrid_search(
        WorkspaceHybridSearchRequest::new("probe"),
        cancellation.clone(),
    );
    tokio::pin!(query);
    assert!(futures::poll!(&mut query).is_pending());
    cancellation.cancel();
    assert!(matches!(
        tokio::time::timeout(Duration::from_secs(1), query)
            .await
            .unwrap(),
        Err(crate::WorkspaceRetrievalError::Cancelled)
    ));
    assert!(files.read_paths().is_empty());
}
