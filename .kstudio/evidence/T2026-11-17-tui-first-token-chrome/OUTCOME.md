# T2026-11-17 — Aster TUI first-token chrome (simple-prompt silence)

## Task

Fix user-felt Aster TUI hang: simple prompt shows no scrollback output for
~minutes while waiting on LLM headers / first chunk.

## Root cause (source)

1. Pager only pre-created Thinking on **stream rollover** (`last_stream_start_ms`
   already Some); first stamp and local `start_turn` did not.
2. Code ACP `notification_meta` omitted `streamStartMs` / `turnStartMs` /
   `agentTimestampMs`, so hosts had no early stream anchor.
3. Default stream **headers** wait is 120s (`stream_headers_timeout`); idle body
   up to 300s — without chrome this reads as a multi-minute blank turn.

## Change

- `aster-pager` `AgentSession::start_turn` → `pre_create_thinking` immediately.
- Tracker: first `streamStartMs` (last is None) also pre-creates Thinking.
- `aster-acp` stores `turn_started_ms`; `notification_meta` stamps
  `agentTimestampMs` / `turnStartMs` / `streamStartMs`.
- Prompt path emits `emit_turn_started_chrome` (empty thought + meta) before
  hooks / LLM so chrome unlocks without waiting for first token.

## Commands

```bash
cargo test --locked -p aster-pager --lib first_stream_start_pre_creates_thinking
# ok · 1 passed

cargo test --locked -p aster-pager --lib start_turn_pre_creates_thinking_chrome
# ok · 1 passed

cargo test --locked -p aster-acp --lib notification_meta_stamps_turn_and_stream_start_ms
# ok · 1 passed
```

## Explicitly not claimed

- Live / headed Aster TUI E2E with a real slow provider (still park).
- Reducing `ASTER_LLM_STREAM_HEADERS_TIMEOUT_MS` default (120s) — chrome only.
- Meta Harness / product Pass; commit / push / release.
- Session-open 180s `SESSION_RPC_FLOOR` hangs (different mechanism).
