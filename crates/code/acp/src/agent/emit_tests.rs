use super::*;
use acp::Agent as _;
use aster_core::llm::{LlmClient, LlmResponse, Message, StreamEvent, TokenUsage, ToolDefinition};
use tokio::io::AsyncBufReadExt;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

struct ReportedClient;

#[async_trait::async_trait]
impl LlmClient for ReportedClient {
    async fn complete(
        &self,
        _: &[Message],
        _: Option<&str>,
        _: &[ToolDefinition],
    ) -> anyhow::Result<LlmResponse> {
        Ok(LlmResponse {
            message: Message::assistant("Complete"),
            usage: TokenUsage {
                prompt_tokens: 5,
                completion_tokens: 2,
                total_tokens: 7,
                ..Default::default()
            },
            stop_reason: None,
            token_logprobs: vec![],
            meta: None,
        })
    }
    async fn complete_streaming(
        &self,
        _: &[Message],
        _: Option<&str>,
        _: &[ToolDefinition],
        _: tokio_util::sync::CancellationToken,
    ) -> anyhow::Result<tokio::sync::mpsc::Receiver<StreamEvent>> {
        anyhow::bail!("non-streaming fixture")
    }
}

#[tokio::test]
async fn session_usage_notifications_follow_core_calls_outside_an_acp_prompt_without_retaining_client(
) {
    tokio::task::LocalSet::new()
        .run_until(async {
            let root = tempfile::tempdir().unwrap();
            let mut config = aster_core::CodeConfig::default();
            config.memory = Some(aster_core::memory::MemoryConfig {
                llm_extraction: false,
                ..Default::default()
            });
            let core = aster_core::Agent::from_config(config).await.unwrap();
            let session = core
                .session_async(
                    root.path().display().to_string(),
                    Some(
                        aster_core::SessionOptions::new()
                            .with_llm_client(Arc::new(ReportedClient))
                            .with_planning_mode(aster_core::PlanningMode::Disabled),
                    ),
                )
                .await
                .unwrap();
            let agent = AsterCodeAgent::new(crate::agent::tests::test_launch(None));
            let (client_end, agent_end) = tokio::io::duplex(64 * 1024);
            let (read, write) = tokio::io::split(agent_end);
            let (connection, io) = acp::AgentSideConnection::new(
                AsterCodeAgent::new(crate::agent::tests::test_launch(None)),
                write.compat_write(),
                read.compat(),
                |future| {
                    tokio::task::spawn_local(future);
                },
            );
            let transport = tokio::task::spawn_local(io);
            let connection = Rc::new(connection);
            let weak = Rc::downgrade(&connection);
            agent.set_client(connection.clone());
            drop(connection);
            let mut lines = tokio::io::BufReader::new(client_end).lines();
            agent.announce_session_usage(session.session_id(), &session);
            for expected in [0, 7, 14] {
                if expected > 0 {
                    session.send("Report one call", None).await.unwrap();
                }
                let line =
                    tokio::time::timeout(std::time::Duration::from_secs(1), lines.next_line())
                        .await
                        .unwrap()
                        .unwrap()
                        .unwrap();
                let packet: serde_json::Value = serde_json::from_str(&line).unwrap();
                assert_eq!(packet["method"], "_aster/session_notification");
                assert_eq!(packet["params"]["sessionId"], session.session_id());
                assert_eq!(packet["params"]["update"]["sessionUpdate"], "model_info");
                assert_eq!(packet["params"]["update"]["sessionTotalTokens"], expected);
            }
            agent.client.borrow_mut().take();
            tokio::task::yield_now().await;
            assert!(weak.upgrade().is_none());
            session.close().await;
            core.close().await;
            transport.abort();
            let _ = transport.await;
        })
        .await;
}

#[test]
fn provider_retry_update_uses_existing_pager_retry_state_contract() {
    let update = provider_retry_update(aster_core::llm::RetryNotice {
        attempt: 1,
        max_attempts: 11,
        reason: "API error (status 429 Too Many Requests): rate limited".into(),
    });
    assert_eq!(
        update,
        serde_json::json!({
            "sessionUpdate": "retry_state",
            "type": "retrying",
            "attempt": 1,
            "maxRetries": 11,
            "reason": "API error (status 429 Too Many Requests): rate limited",
        })
    );
}

#[tokio::test]
async fn notification_meta_stamps_turn_and_stream_start_ms() {
    let root = tempfile::tempdir().unwrap();
    let mut launch = crate::agent::tests::test_launch(Some(root.path().join("store")));
    launch.workspace = root.path().to_owned();
    let agent = AsterCodeAgent::new(launch);
    let id = agent
        .new_session(acp::NewSessionRequest::new(root.path()))
        .await
        .unwrap()
        .session_id;
    {
        let sessions = agent.sessions.lock().await;
        let live = sessions.get(id.0.as_ref()).unwrap();
        *live.turn_started_ms.lock().unwrap() = Some(1_700_000_000_000);
    }
    let meta = agent.notification_meta(&id);
    assert_eq!(
        meta.get("turnStartMs").and_then(|v| v.as_i64()),
        Some(1_700_000_000_000)
    );
    assert_eq!(
        meta.get("streamStartMs").and_then(|v| v.as_i64()),
        Some(1_700_000_000_000)
    );
    assert!(meta
        .get("agentTimestampMs")
        .and_then(|v| v.as_i64())
        .is_some());
    assert_eq!(
        meta.get("streamHeadersTimeoutMs").and_then(|v| v.as_u64()),
        Some(aster_core::llm::http::stream_headers_timeout_ms())
    );
}

#[test]
fn a10_subagent_post_turn_drain_ttl_is_finite_and_enforced() {
    assert_eq!(
        subagent_post_turn_drain_ttl(),
        std::time::Duration::from_secs(30)
    );
    let start = tokio::time::Instant::now();
    let deadline = start + subagent_post_turn_drain_ttl();
    assert!(!subagent_post_turn_drain_timed_out(deadline, start));
    assert!(subagent_post_turn_drain_timed_out(deadline, deadline));
    assert!(subagent_post_turn_drain_timed_out(
        deadline,
        deadline + std::time::Duration::from_millis(1)
    ));
}

#[test]
fn subagent_finished_wire_copies_parent_tool_call_id() {
    let mut state = super::super::TurnState::default();
    state.subagent_started_ms.insert("task-1".into(), 10);
    state
        .subagent_parent_tool
        .insert("task-1".into(), "call-parent".into());
    let update = project_subagent_end(&state, None, "task-1", "child-1", true, "ok", 40);
    assert_eq!(update["toolCallId"], "call-parent");
    assert_eq!(update["sessionUpdate"], "subagent_finished");
}
