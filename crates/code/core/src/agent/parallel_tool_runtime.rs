use super::execution_state::ExecutionLoopState;
use super::tool_result_runtime::{push_tool_result_message, NormalizedToolResult};
use super::AgentEvent;
use crate::llm::ToolCall;
use crate::tools::{ToolContext, ToolInvocation};
use serde_json::Value;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

impl crate::agent::TurnEngine {
    #[expect(
        clippy::too_many_arguments,
        reason = "Parallel dispatch uses the same turn-scoped invocation context as the sequential path"
    )]
    pub(super) async fn execute_parallel_tool_batch(
        &self,
        tool_calls: &[ToolCall],
        state: &mut ExecutionLoopState,
        event_tx: &Option<mpsc::Sender<AgentEvent>>,
        session_id: Option<&str>,
        cancel_token: &CancellationToken,
        base_tool_context: &ToolContext,
        max_concurrency: usize,
    ) {
        tracing::info!(
            count = tool_calls.len(),
            max_concurrency,
            "Parallel tool batch: executing independent calls concurrently"
        );

        let tool_calls = tool_calls.to_vec();
        let recent_tools = state.recent_tool_signatures();
        let invoker = self.scoped_tool_invoker(session_id, event_tx);
        let tool_context = base_tool_context
            .clone()
            .without_host_direct_policy()
            .with_cancellation(cancel_token.clone())
            .with_tool_invoker(Arc::clone(&invoker));
        let results = crate::ordered_parallel::run_ordered_parallel_with_limit(
            tool_calls.clone(),
            max_concurrency,
            {
                let tool_context = tool_context.clone();
                let invoker = Arc::clone(&invoker);
                move |_index, tc| {
                    let ctx = tool_context.clone();
                    let invoker = Arc::clone(&invoker);
                    let recent_tools = recent_tools.clone();
                    async move {
                        invoker
                            .invoke(
                                ToolInvocation::agent(tc.id, tc.name, tc.args, recent_tools),
                                &ctx,
                            )
                            .await
                    }
                }
            },
        )
        .await;

        for (tc, result) in tool_calls.iter().zip(results) {
            state.record_tool_call();
            let normalized = match result.output {
                Ok(result) => NormalizedToolResult::from_tool_result(result),
                Err(error) => NormalizedToolResult::from_execution(Err(anyhow::anyhow!(
                    "parallel tool execution failed: {}",
                    error
                ))),
            };
            Self::collect_verification_report(
                &mut state.verification_reports,
                &normalized.metadata,
            );
            let output = normalized.output.clone();

            if let Some(tx) = event_tx {
                tx.send(AgentEvent::ToolEnd {
                    id: tc.id.clone(),
                    name: tc.name.clone(),
                    args: Some(tc.args.clone()),
                    output: output.clone(),
                    exit_code: normalized.exit_code,
                    metadata: normalized.metadata.clone(),
                    error_kind: normalized.error_kind.clone(),
                })
                .await
                .ok();
            }

            push_tool_result_message(
                state,
                &tc.id,
                &output,
                normalized.is_error,
                normalized.images,
                normalized.trust,
                normalized.redaction_reviewed,
            );
        }
    }

    pub(super) fn parallel_read_batch_limit(&self, tool_calls: &[ToolCall]) -> Option<usize> {
        if tool_calls.len() <= 1 {
            return None;
        }
        let mut limit = self.config.max_parallel_tasks;
        for call in tool_calls {
            let capabilities = self
                .tool_executor
                .registry()
                .capabilities(&call.name, &call.args)?;
            if !capabilities.allows_parallel_batch() {
                return None;
            }
            limit = limit.min(capabilities.max_parallelism);
        }
        Some(limit.max(1))
    }

    pub(super) fn can_run_parallel_write_batch(&self, tool_calls: &[ToolCall]) -> bool {
        if tool_calls.len() <= 1 {
            return false;
        }

        // Governance is applied independently to every branch by ToolInvoker.
        // This predicate is therefore limited to data-race safety: only known
        // write operations targeting distinct paths may execute concurrently.
        if !tool_calls
            .iter()
            .all(|tc| is_parallel_safe_write(&tc.name, &tc.args))
        {
            return false;
        }

        let paths = tool_calls
            .iter()
            .filter_map(|tc| extract_write_path(&tc.args))
            .collect::<Vec<_>>();
        paths.len() == tool_calls.len() && paths.iter().collect::<HashSet<_>>().len() == paths.len()
    }
}

/// Parallel-safe write names use the REGISTERED tool names (`write`, `edit`).
/// The original set drifted to registry-absent verbs (`write_file`,
/// `edit_file`, …), which silently disabled concurrent writes on this path.
fn is_parallel_safe_write(name: &str, _args: &Value) -> bool {
    matches!(name, "write" | "edit")
}

/// Write-class tools key their target on `file_path` (the registered schema);
/// a call without it stays sequential rather than guessing.
fn extract_write_path(args: &Value) -> Option<String> {
    args.get("file_path")
        .or_else(|| args.get("path"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parallel_write_safety_requires_known_write_tool_and_path() {
        assert!(is_parallel_safe_write(
            "write",
            &json!({"file_path":"a.txt"})
        ));
        assert!(is_parallel_safe_write(
            "edit",
            &json!({"file_path":"a.txt"})
        ));
        assert!(!is_parallel_safe_write(
            "read",
            &json!({"file_path":"a.txt"})
        ));
        for drifted in ["write_file", "edit_file", "create_file"] {
            assert!(
                !is_parallel_safe_write(drifted, &json!({"file_path":"a.txt"})),
                "{drifted} is not a registered tool name"
            );
        }
        assert_eq!(
            extract_write_path(&json!({"file_path":"a.txt"})),
            Some("a.txt".to_string())
        );
        assert_eq!(extract_write_path(&json!({"file":"a.txt"})), None);
    }
}
