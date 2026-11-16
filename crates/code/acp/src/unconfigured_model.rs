//! First-run stand-in when the ACL names a model but has only a placeholder key.
//!
//! Lets `session/new` succeed so the host can open model config (`openModelConfig`)
//! without inventing credentials. Every generation refuses until a real key exists.

use std::sync::Arc;

use aster_core::llm::{LlmClient, LlmResponse, Message, StreamEvent, ToolDefinition};
use async_trait::async_trait;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

/// Fail-closed client used only while first-run placeholders are in effect.
pub(crate) struct UnconfiguredModelClient {
    model_id: String,
}

impl UnconfiguredModelClient {
    pub(crate) fn new(model_id: impl Into<String>) -> Self {
        Self {
            model_id: model_id.into(),
        }
    }

    fn refusal(&self) -> anyhow::Error {
        anyhow::anyhow!(
            "model '{}' has no API key yet; open Models / edit ~/.aster/config.acl and replace the placeholder key",
            self.model_id
        )
    }
}

#[async_trait]
impl LlmClient for UnconfiguredModelClient {
    async fn complete(
        &self,
        _messages: &[Message],
        _system: Option<&str>,
        _tools: &[ToolDefinition],
    ) -> anyhow::Result<LlmResponse> {
        Err(self.refusal())
    }

    async fn complete_streaming(
        &self,
        _messages: &[Message],
        _system: Option<&str>,
        _tools: &[ToolDefinition],
        _cancel_token: CancellationToken,
    ) -> anyhow::Result<mpsc::Receiver<StreamEvent>> {
        Err(self.refusal())
    }
}

/// When first-run ACL still has a placeholder for `model_id`, return a refusing client.
pub(crate) fn first_run_placeholder_client(
    config: &aster_core::CodeConfig,
    model_id: &str,
) -> Option<Arc<dyn LlmClient>> {
    let (provider_name, model_name) = model_id.split_once('/')?;
    let provider = config.find_provider(provider_name)?;
    let model = provider.find_model(model_name)?;
    if provider.get_api_key(model).is_some() {
        return None;
    }
    Some(Arc::new(UnconfiguredModelClient::new(model_id)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use aster_core::config::{ModelConfig, ProviderConfig};

    #[test]
    fn missing_key_with_declared_model_yields_a_refusing_client() {
        // Load strips `替换为你的密钥` to None; the stand-in keys on that shape.
        let mut config = aster_core::CodeConfig::default();
        config.providers.push(ProviderConfig {
            protocol: None,
            name: "deepseek".into(),
            api_key: None,
            base_url: Some("https://api.deepseek.com".into()),
            headers: Default::default(),
            session_id_header: None,
            models: vec![ModelConfig {
                id: "deepseek-flash".into(),
                name: "DeepSeek Flash".into(),
                family: String::new(),
                api_key: None,
                base_url: None,
                headers: Default::default(),
                session_id_header: None,
                attachment: false,
                reasoning: false,
                reasoning_control: None,
                tool_call: true,
                temperature: true,
                release_date: None,
                modalities: Default::default(),
                cost: Default::default(),
                limit: Default::default(),
            }],
        });
        assert!(config.llm_config("deepseek", "deepseek-flash").is_none());
        assert!(first_run_placeholder_client(&config, "deepseek/deepseek-flash").is_some());
        assert!(first_run_placeholder_client(&config, "missing/model").is_none());
    }

    #[tokio::test]
    async fn refusing_client_names_the_configure_path() {
        let client = UnconfiguredModelClient::new("deepseek/deepseek-flash");
        let err = client
            .complete(&[], None, &[])
            .await
            .unwrap_err()
            .to_string();
        assert!(err.contains("no API key"), "{err}");
        assert!(
            err.contains("config.acl") || err.contains("Models"),
            "{err}"
        );
    }
}
