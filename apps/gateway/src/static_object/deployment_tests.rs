use super::*;
use crate::static_object::port::sha256_hex;
use crate::static_object::{StaticObjectEntry, STATIC_BUNDLE_MANIFEST_SCHEMA};
use object_store::memory::InMemory;

fn manifest(body: &[u8]) -> StaticBundleManifest {
    StaticBundleManifest {
        schema: STATIC_BUNDLE_MANIFEST_SCHEMA.into(),
        release_digest: sha256_hex(b"release"),
        entry_document: "index.html".into(),
        base_path: "/".into(),
        spa_fallback: None,
        provenance_digest: None,
        entries: BTreeMap::from([(
            "index.html".into(),
            StaticObjectEntry {
                digest: sha256_hex(body),
                size: body.len() as u64,
                media_type: "text/html".into(),
                content_encoding: None,
            },
        )]),
    }
}

fn authority(
    store: Arc<dyn ObjectStore>,
    manifest: &StaticBundleManifest,
) -> DeploymentObjectAuthority {
    DeploymentObjectAuthority::new(
        store,
        "cloud/web-bundles",
        "organizations/a/web/release-a",
        manifest,
        Duration::from_secs(1),
    )
    .unwrap()
}

async fn put(store: &InMemory, namespace: &str, body: &'static [u8]) {
    let key =
        ObjectPath::parse(format!("cloud/web-bundles/{namespace}/objects/index.html")).unwrap();
    store
        .put(&key, Bytes::from_static(body).into())
        .await
        .unwrap();
}

#[tokio::test]
async fn deployment_static_object_reads_only_the_exact_cloud_publication_key() {
    let store = Arc::new(InMemory::new());
    let body = b"<html>tenant-a</html>";
    put(&store, "organizations/a/web/release-a", body).await;
    let manifest = manifest(body);
    let port = authority(store, &manifest);
    let digest = sha256_hex(body);
    assert_eq!(port.head(&digest).await.unwrap().size, body.len() as u64);
    assert_eq!(port.get(&digest).await.unwrap().body.as_ref(), body);
}

#[tokio::test]
async fn deployment_static_object_does_not_adopt_another_tenant_or_release() {
    let store = Arc::new(InMemory::new());
    let body = b"same-object-bytes";
    put(&store, "organizations/b/web/release-a", body).await;
    put(&store, "organizations/a/web/release-b", body).await;
    let port = authority(store, &manifest(body));
    let digest = sha256_hex(body);
    assert!(matches!(
        port.head(&digest).await,
        Err(StaticObjectError::NotFound(_))
    ));
    assert!(matches!(
        port.get(&digest).await,
        Err(StaticObjectError::NotFound(_))
    ));
}

#[tokio::test]
async fn deployment_static_object_refuses_unadmitted_digest_even_if_provider_has_it() {
    let store = Arc::new(InMemory::new());
    put(&store, "organizations/a/web/release-a", b"private-bytes").await;
    let port = authority(store, &manifest(b"public-bytes"));
    assert!(matches!(
        port.get(&sha256_hex(b"private-bytes")).await,
        Err(StaticObjectError::NotFound(_))
    ));
    assert!(matches!(
        port.get("../other").await,
        Err(StaticObjectError::NotFound(_))
    ));
}

#[tokio::test]
async fn deployment_static_object_refuses_size_and_same_size_digest_corruption() {
    for body in [b"short".as_slice(), b"BAD-CONTENT".as_slice()] {
        let store = Arc::new(InMemory::new());
        put(&store, "organizations/a/web/release-a", body).await;
        let port = authority(store, &manifest(b"web-content"));
        assert!(matches!(
            port.get(&sha256_hex(b"web-content")).await,
            Err(StaticObjectError::Integrity(_))
        ));
    }
}

#[test]
fn deployment_static_object_refuses_namespace_escape_bounds_and_conflicting_digest_sizes() {
    let manifest = manifest(b"web-content");
    for namespace in ["", "../other", "/other", "org//release", "org\\release"] {
        assert!(DeploymentObjectAuthority::new(
            Arc::new(InMemory::new()),
            "cloud/web-bundles",
            namespace,
            &manifest,
            Duration::from_secs(1)
        )
        .is_err());
    }
    assert!(DeploymentObjectAuthority::new(
        Arc::new(InMemory::new()),
        "cloud/web-bundles",
        "org/release",
        &manifest,
        Duration::ZERO
    )
    .is_err());
    let mut oversized = manifest.clone();
    oversized.entries.get_mut("index.html").unwrap().size = MAX_OBJECT_BYTES + 1;
    assert!(DeploymentObjectAuthority::new(
        Arc::new(InMemory::new()),
        "cloud/web-bundles",
        "org/release",
        &oversized,
        Duration::from_secs(1)
    )
    .is_err());
    let mut conflicting = manifest.clone();
    let mut entry = conflicting.entries["index.html"].clone();
    entry.size += 1;
    conflicting.entries.insert("other.html".into(), entry);
    assert!(DeploymentObjectAuthority::new(
        Arc::new(InMemory::new()),
        "cloud/web-bundles",
        "org/release",
        &conflicting,
        Duration::from_secs(1)
    )
    .is_err());
}

#[tokio::test]
async fn deployment_static_object_admits_identical_digest_references_within_one_release() {
    let store = Arc::new(InMemory::new());
    let body = b"<html>same</html>";
    put(&store, "organizations/a/web/release-a", body).await;
    let mut manifest = manifest(body);
    manifest
        .entries
        .insert("other.html".into(), manifest.entries["index.html"].clone());
    let port = authority(store, &manifest);
    assert_eq!(
        port.get(&sha256_hex(body)).await.unwrap().body.as_ref(),
        body
    );
}
