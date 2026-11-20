# P1 — elicitation `begin` fail-closed at ACP / ask_user

Date: 2026-11-16.  
Goal knife: Meta Harness **可信** (defect catalog P1).

## Change

- ACP `request_tool_permission`: on `elicitation::begin` Err, **deny** and do not call `client.request_permission`.
- `ask_user::begin_on_channel`: map `DuplicateId` → `AskUserError::ElicitationBusy`; release run question slot on failure.
- `ask_user` / `ask_user_form` tools surface busy as tool error.

## Verification

```text
cargo test --locked -p aster-core --lib ask_user::tests::begin_fails_closed_when_elicitation_id_already_pending
→ ok

cargo test --locked -p aster-acp --lib duplicate_pending_permission_elicitation_denies_without_host_ask
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- P2 command-hook fail-open, A1 task content dedup, Studio H2.
