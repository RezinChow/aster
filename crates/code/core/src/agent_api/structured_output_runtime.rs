use super::*;
use crate::llm::structured::parse_validated_output;

/// Validate a caller-supplied structured output schema before starting a turn.
pub fn validate_output_schema(schema: &serde_json::Value) -> anyhow::Result<()> {
    jsonschema::options()
        .build(schema)
        .map(|_| ())
        .map_err(|error| anyhow::anyhow!("invalid structured output schema: {error}"))
}

impl AgentSession {
    /// Accept only the original answer when it satisfies the requested schema.
    pub async fn structured_output_from_response(
        &self,
        _prompt: &str,
        response: &str,
        schema: serde_json::Value,
    ) -> anyhow::Result<serde_json::Value> {
        validate_output_schema(&schema)?;
        parse_validated_output(response, &schema).ok_or_else(|| {
            anyhow::anyhow!(
                "final agent answer does not satisfy the requested structured output schema"
            )
        })
    }
}
