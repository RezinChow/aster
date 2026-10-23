//! The light-tier provider: Model2Vec static embeddings behind the core trait.

use crate::assets;

/// A static embedding provider loaded from embedded bytes. No install chain,
/// no network, no ONNX — a tokenizer lookup plus an average-pool.
pub struct StaticEmbeddingProvider {
    model: model2vec_rs::model::StaticModel,
    dimension: usize,
}

impl StaticEmbeddingProvider {
    /// Load from the pinned in-repo assets. Refuses a digest drift or an
    /// engine decode failure with a named reason.
    pub fn from_embedded() -> Result<Self, String> {
        assets::verify()?;
        let model = model2vec_rs::model::StaticModel::from_bytes(
            assets::TOKENIZER_BYTES,
            assets::MODEL_BYTES,
            assets::CONFIG_BYTES,
            Some(true),
        )
        .map_err(|error| format!("model2vec from_bytes failed: {error}"))?;
        let probe = model.encode(&["dimension probe".to_owned()]);
        let dimension = probe.first().map(Vec::len).unwrap_or(0);
        if dimension == 0 {
            return Err("model2vec probe produced an empty vector".to_owned());
        }
        Ok(Self { model, dimension })
    }

    pub fn dimension(&self) -> usize {
        self.dimension
    }

    pub fn id(&self) -> &'static str {
        assets::MODEL_ID
    }

    /// Encode one batch. Empty input returns empty; each sentence yields one
    /// unit-normalized vector of `dimension` floats.
    pub fn encode_batch(&self, sentences: &[&str]) -> Vec<Vec<f32>> {
        let owned: Vec<String> = sentences.iter().map(|s| s.to_string()).collect();
        self.model.encode(&owned)
    }
}

#[cfg(test)]
mod provider_tests {
    use super::*;

    #[test]
    fn embedded_assets_load_and_encode() {
        let provider =
            StaticEmbeddingProvider::from_embedded().expect("pinned assets must load offline");
        let vectors = provider.encode_batch(&["fn main() {}", "hello world"]);
        assert_eq!(vectors.len(), 2);
        assert_eq!(vectors[0].len(), provider.dimension());
        assert!(provider.dimension() > 0);
        assert!(provider.id().contains("potion-code"));
    }

    #[test]
    fn similar_code_queries_closer_than_unrelated() {
        let provider = StaticEmbeddingProvider::from_embedded().unwrap();
        let vectors = provider.encode_batch(&[
            "parse the config file",
            "read configuration settings",
            "the weather is sunny today",
        ]);
        let dot = |a: &[f32], b: &[f32]| a.iter().zip(b).map(|(x, y)| x * y).sum::<f32>();
        let related = dot(&vectors[0], &vectors[1]);
        let unrelated = dot(&vectors[0], &vectors[2]);
        assert!(
            related > unrelated,
            "semantic proximity must hold: {related} vs {unrelated}"
        );
    }

    #[test]
    fn digest_verification_passes_on_the_pinned_assets() {
        assert!(crate::assets::verify().is_ok());
    }
}
