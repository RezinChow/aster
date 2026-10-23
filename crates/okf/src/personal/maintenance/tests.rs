#![cfg(test)]

use super::*;
use serde_json::json;

struct Vault(PathBuf);

impl Vault {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let directory = std::env::temp_dir().join(format!(
            "aster-wiki-test-{}-{}-{}",
            std::process::id(),
            clock_ms().unwrap(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        let root = directory.join("wiki/local");
        fs::create_dir_all(&root).unwrap();
        Self(root.canonicalize().unwrap())
    }
    fn write(&self, path: &str, text: &str) {
        let path = self.0.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }
    fn begin(&self) -> KnowledgeJob {
        begin_knowledge_maintenance(&self.0, &[], MaintenanceOperation::Ingest).unwrap()
    }
    fn propose(&self, job: &KnowledgeJob, change: &str) {
        let staging = Path::new(&job.staging);
        fs::create_dir_all(staging.join("concepts")).unwrap();
        fs::write(
            staging.join("concepts/shared.md"),
            "---\ntype: Concept\ntitle: Shared decision\n---\n\nEvidence from the meeting.\n",
        )
        .unwrap();
        fs::write(staging.join(MANIFEST), serde_json::to_vec(&json!({
            "sources":job.sources,"summary":"The meeting provides new evidence.",
            "pages":[{"path":"concepts/shared.md","title":"Shared decision","kind":"concept","change":change,"reason":"The meeting provides new evidence.","requires_review":false,"sources":job.sources}]
        })).unwrap()).unwrap();
    }
}

impl Drop for Vault {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(self.0.parent().unwrap().parent().unwrap());
    }
}

#[test]
fn new_knowledge_is_incremental_cited_and_never_rewrites_sources() {
    let vault = Vault::new();
    let original = "# Meeting\nAster launch date was confirmed.\n";
    vault.write("meeting.md", original);
    let job = vault.begin();
    assert!(Path::new(&job.staging).ends_with("workspace/wiki/local"));
    vault.propose(&job, "create");
    let view = finish_knowledge_maintenance(&vault.0, &job.id).unwrap();
    assert!(view.active.is_none());
    assert_eq!(view.sources[0].status, SourceStatus::Current);
    assert_eq!(view.pages, 1);
    assert!(!Path::new(&job.staging).exists());
    assert_eq!(view.activity[0].published, 1);
    assert_eq!(
        fs::read_to_string(vault.0.join("meeting.md")).unwrap(),
        original
    );
    assert!(fs::read_to_string(vault.0.join("concepts/shared.md"))
        .unwrap()
        .contains("../meeting.md"));
    assert!(fs::read_to_string(vault.0.join("index.md"))
        .unwrap()
        .contains("Shared decision"));
    assert!(begin_knowledge_maintenance(&vault.0, &[], MaintenanceOperation::Ingest).is_err());
    vault.write("meeting.md", "# Meeting\nThe date changed.\n");
    assert_eq!(
        knowledge_maintenance_plan(&vault.0).unwrap().sources[0].status,
        SourceStatus::Pending
    );
}

#[test]
fn an_existing_page_survives_until_the_reviewed_revision_is_accepted() {
    let vault = Vault::new();
    vault.write("meeting.md", "New evidence.");
    let previous = "---\ntype: Concept\ntitle: Shared decision\n---\n\nOriginal conclusion.\n";
    vault.write("concepts/shared.md", previous);
    let job = vault.begin();
    vault.propose(&job, "update");
    let view = finish_knowledge_maintenance(&vault.0, &job.id).unwrap();
    assert_eq!(
        fs::read_to_string(vault.0.join("concepts/shared.md")).unwrap(),
        previous
    );
    let recovered = knowledge_maintenance_plan(&vault.0)
        .unwrap()
        .active
        .unwrap();
    assert!(recovered.ready);
    let detail = knowledge_change(&vault.0, &job.id, "concepts/shared.md").unwrap();
    assert_eq!(detail.before, previous);
    assert!(detail.after.contains("Evidence from the meeting"));
    assert_eq!(detail.evidence["meeting.md"], "New evidence.");
    assert!(
        review_knowledge_change(&vault.0, &job.id, &detail.change.path, "stale-review", true)
            .is_err()
    );
    assert!(view.active.is_some());
    let result = review_knowledge_change(
        &vault.0,
        &job.id,
        &detail.change.path,
        &detail.change.generation,
        true,
    )
    .unwrap();
    assert!(result.active.is_none());
    assert!(fs::read_to_string(vault.0.join("concepts/shared.md"))
        .unwrap()
        .contains("Evidence from the meeting"));
    assert_eq!(
        knowledge_change(&vault.0, &job.id, "concepts/shared.md")
            .unwrap()
            .before,
        previous
    );
}

#[test]
fn model_declared_conflicts_wait_for_review_even_for_new_pages() {
    let vault = Vault::new();
    vault.write("meeting.md", "Conflicting dates.");
    let job = vault.begin();
    vault.propose(&job, "conflict");
    let view = finish_knowledge_maintenance(&vault.0, &job.id).unwrap();
    assert!(!vault.0.join("concepts/shared.md").exists());
    let change = &view.active.unwrap().changes[0];
    let result =
        review_knowledge_change(&vault.0, &job.id, &change.path, &change.generation, false)
            .unwrap();
    assert_eq!(result.sources[0].status, SourceStatus::Attention);
    assert!(!vault.0.join("concepts/shared.md").exists());
    let detail = knowledge_change(&vault.0, &job.id, &change.path).unwrap();
    assert_eq!(detail.before, "");
    assert!(detail.after.contains("Evidence from the meeting"));
}

#[test]
fn changed_sources_or_pages_refuse_publication_without_overwriting_them() {
    for changed in ["meeting.md", "concepts/shared.md"] {
        let vault = Vault::new();
        vault.write("meeting.md", "Original input.");
        vault.write(
            "concepts/shared.md",
            "---\ntype: Concept\ntitle: Shared decision\n---\nOld knowledge.\n",
        );
        let job = vault.begin();
        vault.propose(&job, "update");
        let view = finish_knowledge_maintenance(&vault.0, &job.id).unwrap();
        let change = &view.active.unwrap().changes[0];
        let edited = "Someone saved a newer version.\n";
        vault.write(changed, edited);
        let error =
            review_knowledge_change(&vault.0, &job.id, &change.path, &change.generation, true)
                .unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::AlreadyExists);
        assert_eq!(fs::read_to_string(vault.0.join(changed)).unwrap(), edited);
    }
}

#[test]
fn source_mutation_and_unlisted_writes_are_rejected_before_any_page_is_published() {
    for modified in ["meeting.md", "concepts/undeclared.md"] {
        let vault = Vault::new();
        vault.write("meeting.md", "Original input.");
        let job = vault.begin();
        vault.propose(&job, "create");
        fs::write(
            Path::new(&job.staging).join(modified),
            "An unapproved write.",
        )
        .unwrap();
        assert!(finish_knowledge_maintenance(&vault.0, &job.id).is_err());
        assert!(!vault.0.join("concepts/shared.md").exists());
        assert_eq!(
            fs::read_to_string(vault.0.join("meeting.md")).unwrap(),
            "Original input."
        );
    }
}

#[test]
fn unknown_manifest_values_and_unsafe_paths_fail_closed() {
    for invalid in [
        "../../outside.md",
        "concepts/../outside.md",
        "concepts/sub/page.md",
    ] {
        let vault = Vault::new();
        vault.write("meeting.md", "Input.");
        let job = vault.begin();
        vault.propose(&job, "create");
        let manifest = Path::new(&job.staging).join(MANIFEST);
        let mut value: serde_json::Value =
            serde_json::from_slice(&fs::read(&manifest).unwrap()).unwrap();
        value["pages"][0]["path"] = json!(invalid);
        fs::write(&manifest, serde_json::to_vec(&value).unwrap()).unwrap();
        assert!(finish_knowledge_maintenance(&vault.0, &job.id).is_err());
        assert!(!vault.0.join("concepts/shared.md").exists());
    }
    assert!(PageKind::parse("guessed-entity").is_err());
    assert_eq!(PageKind::parse("entity").unwrap().as_str(), "entity");
    assert!(MaintenanceOperation::parse("rewrite-everything").is_err());
}

#[test]
fn a_changed_review_candidate_cannot_be_accepted() {
    let vault = Vault::new();
    vault.write("meeting.md", "Conflicting dates.");
    let job = vault.begin();
    vault.propose(&job, "conflict");
    let view = finish_knowledge_maintenance(&vault.0, &job.id).unwrap();
    let change = &view.active.unwrap().changes[0];
    vault.write(
        &format!(".wiki-history/{}/after/{}", job.id, change.path),
        "Changed after review.",
    );
    assert!(
        review_knowledge_change(&vault.0, &job.id, &change.path, &change.generation, true).is_err()
    );
    assert!(!vault.0.join(&change.path).exists());
}

#[test]
fn failed_work_is_durable_and_explicit_retry_does_not_destroy_sources() {
    let vault = Vault::new();
    vault.write("meeting.md", "Input.");
    let job = vault.begin();
    assert!(finish_knowledge_maintenance(&vault.0, &job.id).is_err());
    assert_eq!(vault.begin().id, job.id);
    assert_eq!(
        knowledge_maintenance_plan(&vault.0)
            .unwrap()
            .active
            .unwrap()
            .id,
        job.id
    );
    assert!(Path::new(&job.staging).exists());
    let view = abandon_knowledge_maintenance(&vault.0, &job.id).unwrap();
    assert!(!Path::new(&job.staging).exists());
    assert!(view.active.is_none());
    assert_eq!(view.sources[0].status, SourceStatus::Attention);
    assert_eq!(view.activity[0].status, ActivityStatus::Discarded);
    let retry = begin_knowledge_maintenance(
        &vault.0,
        &["meeting.md".into()],
        MaintenanceOperation::Ingest,
    )
    .unwrap();
    assert_ne!(retry.id, job.id);
    assert_eq!(
        fs::read_to_string(vault.0.join("meeting.md")).unwrap(),
        "Input."
    );
}

#[test]
fn consequential_new_claims_require_confirmation() {
    let vault = Vault::new();
    vault.write("meeting.md", "A consequential decision.");
    let job = vault.begin();
    vault.propose(&job, "create");
    let manifest = Path::new(&job.staging).join(MANIFEST);
    let mut value: serde_json::Value =
        serde_json::from_slice(&fs::read(&manifest).unwrap()).unwrap();
    value["pages"][0]["requires_review"] = json!(true);
    fs::write(&manifest, serde_json::to_vec(&value).unwrap()).unwrap();
    let view = finish_knowledge_maintenance(&vault.0, &job.id).unwrap();
    assert!(view.active.unwrap().changes[0].requires_review);
    assert!(!vault.0.join("concepts/shared.md").exists());
}

#[test]
fn healthy_audits_record_findings_without_inventing_a_change() {
    let vault = Vault::new();
    vault.write("meeting.md", "Evidence.");
    let ingest = vault.begin();
    vault.propose(&ingest, "create");
    finish_knowledge_maintenance(&vault.0, &ingest.id).unwrap();
    let audit = begin_knowledge_maintenance(&vault.0, &[], MaintenanceOperation::Audit).unwrap();
    fs::write(Path::new(&audit.staging).join(MANIFEST), serde_json::to_vec(&json!({
        "sources": audit.sources, "summary": "No contradictory evidence or unsupported claims were found.", "pages": []
    })).unwrap()).unwrap();
    let view = finish_knowledge_maintenance(&vault.0, &audit.id).unwrap();
    assert!(view.active.is_none());
    assert_eq!(view.activity[0].published, 0);
    assert!(view.activity[0].summary.contains("No contradictory"));
    assert_eq!(view.sources[0].status, SourceStatus::Current);
    assert_eq!(view.pages, 1);
}

#[test]
fn an_audit_cannot_mark_unprocessed_sources_current_without_evidence() {
    let vault = Vault::new();
    vault.write("meeting.md", "New evidence.");
    let audit = begin_knowledge_maintenance(&vault.0, &[], MaintenanceOperation::Audit).unwrap();
    fs::write(
        Path::new(&audit.staging).join(MANIFEST),
        serde_json::to_vec(&json!({
            "sources": audit.sources, "summary": "Nothing to do.", "pages": []
        }))
        .unwrap(),
    )
    .unwrap();
    assert!(finish_knowledge_maintenance(&vault.0, &audit.id).is_err());
    assert!(knowledge_maintenance_plan(&vault.0)
        .unwrap()
        .active
        .unwrap()
        .error
        .is_some());
}

#[cfg(unix)]
#[test]
fn source_symlinks_and_unbounded_files_are_refused() {
    let vault = Vault::new();
    let external = vault.0.parent().unwrap().join("external.md");
    fs::write(&external, "Private outside source.").unwrap();
    std::os::unix::fs::symlink(&external, vault.0.join("link.md")).unwrap();
    assert!(knowledge_maintenance_plan(&vault.0).is_err());
    fs::remove_file(vault.0.join("link.md")).unwrap();
    fs::write(vault.0.join("large.md"), vec![b'x'; MAX_TEXT_BYTES + 1]).unwrap();
    assert!(knowledge_maintenance_plan(&vault.0).is_err());
}

#[test]
fn archived_evidence_survives_later_source_edits() {
    let vault = Vault::new();
    vault.write("meeting.md", "Original cited evidence.");
    let job = vault.begin();
    vault.propose(&job, "create");
    finish_knowledge_maintenance(&vault.0, &job.id).unwrap();
    vault.write("meeting.md", "Later evidence.");
    let detail = knowledge_change(&vault.0, &job.id, "concepts/shared.md").unwrap();
    assert_eq!(detail.evidence["meeting.md"], "Original cited evidence.");
    vault.write(
        &format!(".wiki-history/{}/sources/meeting.md", job.id),
        "Tampered history.",
    );
    assert!(knowledge_change(&vault.0, &job.id, "concepts/shared.md").is_err());
}

#[test]
fn source_citations_encode_literal_url_characters() {
    let body = cited_body(
        b"---\ntype: Concept\ntitle: Evidence\n---\nEvidence.\n",
        &["notes/a%20b?# (final).md".into()],
    )
    .unwrap();
    assert!(body.contains("../notes/a%2520b%3F%23%20%28final%29.md"));
}

#[test]
fn persisted_provenance_paths_are_revalidated_before_reading_evidence() {
    let vault = Vault::new();
    vault.write("meeting.md", "Evidence.");
    let job = vault.begin();
    vault.propose(&job, "conflict");
    finish_knowledge_maintenance(&vault.0, &job.id).unwrap();
    let state = vault.0.join(STATE);
    let mut ledger: serde_json::Value = serde_json::from_slice(&fs::read(&state).unwrap()).unwrap();
    ledger["active"]["source_generations"]["../../outside.md"] = json!("forged");
    ledger["active"]["changes"][0]["sources"] = json!(["../../outside.md"]);
    fs::write(state, serde_json::to_vec(&ledger).unwrap()).unwrap();
    assert_eq!(
        knowledge_change(&vault.0, &job.id, "concepts/shared.md")
            .unwrap_err()
            .kind(),
        io::ErrorKind::InvalidData
    );
}

#[cfg(unix)]
#[test]
fn literal_backslashes_in_filenames_cannot_become_parent_traversals() {
    let vault = Vault::new();
    vault.write(r"x\..\..\escaped.md", "Untrusted filename.");
    assert!(knowledge_maintenance_plan(&vault.0).is_err());
    assert!(begin_knowledge_maintenance(&vault.0, &[], MaintenanceOperation::Ingest).is_err());
}
