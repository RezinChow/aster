# P6 — Ask without confirmation provider fail-closed

Date: 2026-11-16.  
Branch: `main`.  
Goal knife: Meta Harness **可信** (defect catalog P6).

## Change

Fact-path `unconfirmed_ask`: when permission is Ask, `needs_confirmation` is
false, and the agent has **no** HITL confirmation manager, refuse with
`confirmation_required` (was implicit continue). Aligns with tool-invoker deny
when no manager is configured.

## Verification

```text
cargo test --locked -p aster-core --lib ask_without_confirmation_provider_refuses
→ ok
```

## Explicitly not claimed

- Product Pass / Meta Harness Done.
- Studio H2 land/push.
- A9 BG workspace_child settle.
