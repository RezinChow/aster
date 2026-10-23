#![cfg(test)]

use super::*;

#[tokio::test]
async fn direct_reads_preserve_the_selected_backend_policy_and_refuse_missing_authority() {
    let root = tempfile::tempdir().unwrap();
    std::fs::write(root.path().join("ordinary.xlsx"), b"fixture").unwrap();
    std::fs::write(root.path().join(".env.xlsx"), b"ordinary test data").unwrap();
    std::fs::hard_link(
        root.path().join("ordinary.xlsx"),
        root.path().join("alias.xlsx"),
    )
    .unwrap();
    let guarded = WorkspaceServices::local_with_manifest_backend(
        ManifestWorkspaceBackend::new_with_access_policy(
            root.path(),
            LocalWorkspaceAccessPolicy::CredentialBoundary,
        ),
    );
    let overlay = guarded.with_read_overlay(Arc::new(
        WorkspaceReadOverlaySnapshot::new(Default::default()).unwrap(),
    ));
    let unrestricted = WorkspaceServices::local(root.path());
    let without_guard =
        WorkspaceServicesBuilder::new(guarded.workspace_ref().clone(), guarded.fs()).build();
    for name in ["ordinary.xlsx", ".env.xlsx", "alias.xlsx"] {
        let path = WorkspacePath::from_normalized(name);
        let file = std::fs::File::open(root.path().join(name)).unwrap();
        assert!(unrestricted.refuse_direct_read(&path, &file).is_ok());
        assert!(guarded.refuse_direct_read(&path, &file).is_err(), "{name}");
        assert!(overlay.refuse_direct_read(&path, &file).is_err(), "{name}");
        assert!(without_guard
            .refuse_direct_read(&path, &file)
            .unwrap_err()
            .to_string()
            .contains("does not grant direct file reads"));
    }
    std::fs::write(root.path().join("single.xlsx"), b"fixture").unwrap();
    let file = std::fs::File::open(root.path().join("single.xlsx")).unwrap();
    assert!(guarded
        .refuse_direct_read(&WorkspacePath::from_normalized("single.xlsx"), &file)
        .is_ok());
}
