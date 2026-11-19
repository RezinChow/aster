# aster-acp 9.3.0 ACP v1 conformance

15 of 15 cases pass. Client: raw JSON-RPC over stdio (`acp/tests/acp_conformance_stdio.rs`), scripted local model.

| Case | ACP v1 requirement | Result |
|---|---|---|
| `initialize-version` | initialize answers protocolVersion 1 for a v1 client, and its latest supported version (1) for a client asking a newer one | pass |
| `initialize-capabilities` | initialize returns agentCapabilities (loadSession, promptCapabilities) and an authMethods list | pass |
| `prompt-end-turn` | session/prompt streams agent_message_chunk updates for the session, then answers stopReason end_turn | pass |
| `prompt-unsupported-content` | session/prompt rejects content that cannot reach the model instead of dropping it or starting a model call | pass |
| `subagent-cancel` | the pager's session-scoped stop method cancels an actual in-flight child model and emits typed progress without harness text | pass |
| `prompt-image` | image and image-only prompts reach the actual model request with unchanged bytes | pass |
| `prompt-unknown-session` | session/prompt for an unknown sessionId is a JSON-RPC error, not a result | pass |
| `prompt-invalid-params` | session/prompt without sessionId is invalid params (-32602) | pass |
| `unknown-method` | an unknown method is method not found (-32601) | pass |
| `cancel-in-flight` | session/cancel during a model call answers the pending session/prompt with stopReason cancelled | pass |
| `permission-request-shape` | session/request_permission names the session and toolCallId and offers options with an optionId, a name and a kind from the closed set; a reject ends the turn normally | pass |
| `permission-cancelled` | a client that cancels the turn and answers the pending permission request with outcome cancelled gets stopReason cancelled | pass |
| `load-replays-history` | with loadSession, session/load replays the conversation as user_message_chunk and agent_message_chunk updates before its response | pass |
| `queue-running-identity` | a prompt carrying _meta.promptId is announced by _aster/queue/changed (golden key set) before the turn's first model output update, and its response echoes the promptId | pass |
| `turn-queue-order` | a second prompt waits behind the running turn; cancelling the running turn does not cancel the queued prompt, which then starts and ends normally | pass |
