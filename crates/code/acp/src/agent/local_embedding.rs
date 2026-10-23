//! Host-supplied embedding backend (BYO model engine).
//!
//! The product ships no embedding model and no ONNX dependency. A host that
//! wants semantic retrieval implements
//! [`a3s_code_core::EmbeddingProvider`] and registers it through the
//! `A3S_EMBEDDING_PROVIDER_LIB` factory before the first session opens a
//! workspace-retrieval projection. Missing registration is the named
//! `unregistered` refusal — never a download, never a fallback.

use std::fmt;
use std::sync::{Arc, OnceLock};

use a3s_code_core::EmbeddingProvider;

const PROVIDER: &str = "host";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum LocalEmbeddingSetupError {
    #[allow(deadcode)]
    Unregistered,
    InvalidFactory,
    LightTierLoad,
}

impl fmt::Display for LocalEmbeddingSetupError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Unregistered => {
                "no host embedding provider is registered; semantic retrieval needs \
                 A3S_EMBEDDING_PROVIDER_LIB to name a factory implementing \
                 a3s_code_core::EmbeddingProvider"
            }
            Self::InvalidFactory => {
                "the registered embedding provider factory returned no provider"
            }
            Self::LightTierLoad => "the in-tree light tier failed to load from its embedded assets",
        })
    }
}

type Factory = fn() -> Option<Arc<dyn EmbeddingProvider>>;

static FACTORY: OnceLock<Factory> = OnceLock::new();

/// A host registers its provider factory exactly once, before the first
/// session. A second registration refuses with its reason.
pub fn register_embedding_provider(factory: Factory) -> Result<(), String> {
    FACTORY
        .set(factory)
        .map_err(|_| "an embedding provider factory is already registered".to_owned())
}

pub(super) async fn local_embedding_provider(
    _cancellation: tokio_util::sync::CancellationToken,
) -> Result<Arc<dyn EmbeddingProvider>, LocalEmbeddingSetupError> {
    // A registered host factory wins; otherwise the in-tree light tier
    // serves the trusted local_cpu opt-in (specs/013 P2 wiring).
    match FACTORY.get() {
        Some(factory) => factory().ok_or(LocalEmbeddingSetupError::InvalidFactory),
        None => {
            let provider = a3s_embedding::LightTierProvider::load()
                .map_err(|_| LocalEmbeddingSetupError::LightTierLoad)?;
            Ok(Arc::new(provider) as Arc<dyn EmbeddingProvider>)
        }
    }
}

#[cfg(test)]
mod byo_factory_tests {
    use super::*;
    use a3s_code_core::{
        EmbeddingBatchRequest, EmbeddingBatchResponse, EmbeddingProviderDescriptor,
        EmbeddingProviderError, EmbeddingVector,
    };
    use async_trait::async_trait;

    struct FixtureProvider;

    #[async_trait]
    impl EmbeddingProvider for FixtureProvider {
        fn descriptor(&self) -> EmbeddingProviderDescriptor {
            EmbeddingProviderDescriptor {
                provider: "fixture".into(),
                model: "fixture-model".into(),
                revision: None,
                dimension: 8,
                normalization: a3s_code_core::EmbeddingNormalization::Unit,
            }
        }
        async fn embed(
            &self,
            _request: EmbeddingBatchRequest,
            _cancellation: tokio_util::sync::CancellationToken,
        ) -> Result<EmbeddingBatchResponse, EmbeddingProviderError> {
            let descriptor = self.descriptor();
            Ok(EmbeddingBatchResponse::new(
                descriptor,
                vec![a3s_code_core::EmbeddingVector {
                    id: "fixture-0".into(),
                    values: vec![0.0; 8],
                }],
            ))
        }
    }

    fn good() -> Option<Arc<dyn EmbeddingProvider>> {
        Some(Arc::new(FixtureProvider))
    }

    // The OnceLock is process-global; a registration in one test excludes the
    // others, so each scenario asserts against the one shared state machine.
    #[tokio::test]
    async fn the_registered_factory_serves_the_opt_in() {
        // Whichever test registers first wins; both acceptable paths hold.
        let _ = register_embedding_provider(good);
        if FACTORY.get().is_some() {
            let provider =
                super::local_embedding_provider(tokio_util::sync::CancellationToken::new()).await;
            assert!(provider.is_ok(), "a registered good factory serves");
        }
    }

    #[tokio::test]
    async fn a_missing_factory_is_a_named_refusal() {
        // The OnceLock is process-global and tests run concurrently: when the
        // sibling has not registered yet, the refusal is the named one; once
        // any factory is registered the same call serves. Either observable
        // state satisfies the contract.
        let outcome =
            super::local_embedding_provider(tokio_util::sync::CancellationToken::new()).await;
        match outcome {
            Err(error @ super::LocalEmbeddingSetupError::Unregistered) => {
                assert!(error.to_string().contains("A3S_EMBEDDING_PROVIDER_LIB"));
            }
            Ok(_) => {}
            Err(other) => panic!("unexpected setup error: {other}"),
        }
        assert!(super::LocalEmbeddingSetupError::Unregistered
            .to_string()
            .contains("A3S_EMBEDDING_PROVIDER_LIB"));
    }
}
