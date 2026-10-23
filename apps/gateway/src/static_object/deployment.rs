//! Read only the exact objects in one admitted Cloud Web release.
//!
//! Cloud's shared object client publishes under
//! `<deployment-prefix>/web-bundles/<object-namespace>/objects/<manifest-path>`.
//! Bootstrap supplies that deployment prefix (including `web-bundles`); the
//! traffic snapshot supplies only the sealed namespace and manifest. An object
//! digest never authorizes bucket scanning or a cross-release lookup.

use super::path::normalize_object_path;
use super::port::{admit_object_bytes, ReadOnlyObjectPort, StaticObjectBytes, StaticObjectMeta};
use super::{StaticBundleManifest, StaticObjectError};
use async_trait::async_trait;
use bytes::Bytes;
use futures_util::TryStreamExt;
use object_store::path::Path as ObjectPath;
use object_store::ObjectStore;
use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

const MAX_OBJECT_BYTES: u64 = 64 * 1024 * 1024;
const MAX_BUNDLE_BYTES: u64 = 1024 * 1024 * 1024;

#[derive(Debug)]
struct SealedObject {
    key: ObjectPath,
    size: u64,
}

pub(crate) struct DeploymentObjectAuthority {
    objects: Arc<dyn ObjectStore>,
    admitted: BTreeMap<String, SealedObject>,
    timeout: Duration,
}

impl DeploymentObjectAuthority {
    pub(crate) fn new(
        objects: Arc<dyn ObjectStore>,
        deployment_prefix: &str,
        object_namespace: &str,
        manifest: &StaticBundleManifest,
        timeout: Duration,
    ) -> Result<Self, StaticObjectError> {
        manifest.validate()?;
        for path in [deployment_prefix, object_namespace] {
            if path.is_empty() || normalize_object_path(path)? != path {
                return Err(StaticObjectError::Contract(
                    "static object authority requires canonical deployment and release namespaces"
                        .into(),
                ));
            }
        }
        if timeout.is_zero() || timeout > Duration::from_secs(60) {
            return Err(StaticObjectError::Contract(
                "static object authority timeout must be positive and at most 60 seconds".into(),
            ));
        }
        let mut admitted: BTreeMap<String, SealedObject> = BTreeMap::new();
        let mut total = 0u64;
        for (path, entry) in &manifest.entries {
            total = total.checked_add(entry.size).ok_or_else(|| {
                StaticObjectError::Contract("static bundle size overflowed".into())
            })?;
            if entry.size > MAX_OBJECT_BYTES || total > MAX_BUNDLE_BYTES {
                return Err(StaticObjectError::Contract(
                    "static bundle exceeds the 64 MiB object or 1 GiB bundle limit".into(),
                ));
            }
            if let Some(previous) = admitted.get(&entry.digest) {
                if previous.size != entry.size {
                    return Err(StaticObjectError::Contract(
                        "static bundle assigns different sizes to the same object digest".into(),
                    ));
                }
                continue;
            }
            let key = ObjectPath::parse(format!(
                "{deployment_prefix}/{object_namespace}/objects/{path}"
            ))
            .map_err(|_| StaticObjectError::InvalidPath("static object key is invalid".into()))?;
            admitted.insert(
                entry.digest.clone(),
                SealedObject {
                    key,
                    size: entry.size,
                },
            );
        }
        Ok(Self {
            objects,
            admitted,
            timeout,
        })
    }

    fn admitted(&self, digest: &str) -> Result<&SealedObject, StaticObjectError> {
        self.admitted.get(digest).ok_or_else(|| {
            StaticObjectError::NotFound("object digest is not admitted by this Web release".into())
        })
    }

    fn read_error(error: object_store::Error) -> StaticObjectError {
        match error {
            object_store::Error::NotFound { .. } => {
                StaticObjectError::NotFound("admitted static object is missing".into())
            }
            // Provider errors may include endpoints, signed query strings or
            // credential diagnostics. They do not cross the public response.
            _ => StaticObjectError::Contract("static object authority read failed".into()),
        }
    }

    fn timeout_error() -> StaticObjectError {
        StaticObjectError::Contract("static object authority request timed out".into())
    }
}

#[async_trait]
impl ReadOnlyObjectPort for DeploymentObjectAuthority {
    async fn head(&self, digest: &str) -> Result<StaticObjectMeta, StaticObjectError> {
        let admitted = self.admitted(digest)?;
        let meta = tokio::time::timeout(self.timeout, self.objects.head(&admitted.key))
            .await
            .map_err(|_| Self::timeout_error())?
            .map_err(Self::read_error)?;
        if meta.size as u64 != admitted.size {
            return Err(StaticObjectError::Integrity(
                "static object metadata size does not match the sealed manifest".into(),
            ));
        }
        Ok(StaticObjectMeta {
            digest: digest.into(),
            size: admitted.size,
        })
    }

    async fn get(&self, digest: &str) -> Result<StaticObjectBytes, StaticObjectError> {
        let admitted = self.admitted(digest)?;
        tokio::time::timeout(self.timeout, async {
            let object = self
                .objects
                .get(&admitted.key)
                .await
                .map_err(Self::read_error)?;
            if object.meta.size as u64 != admitted.size {
                return Err(StaticObjectError::Integrity(
                    "static object size does not match the sealed manifest".into(),
                ));
            }
            let mut stream = object.into_stream();
            let mut body = Vec::new();
            while let Some(chunk) = stream.try_next().await.map_err(Self::read_error)? {
                if chunk.len() as u64 > admitted.size.saturating_sub(body.len() as u64) {
                    return Err(StaticObjectError::Integrity(
                        "static object stream exceeds the sealed size".into(),
                    ));
                }
                body.extend_from_slice(&chunk);
            }
            admit_object_bytes(digest, admitted.size, Bytes::from(body))
        })
        .await
        .map_err(|_| Self::timeout_error())?
    }
}

#[cfg(test)]
#[path = "deployment_tests.rs"]
mod tests;
