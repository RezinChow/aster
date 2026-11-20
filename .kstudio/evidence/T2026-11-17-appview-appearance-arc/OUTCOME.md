# T2026-11-17-appview-appearance-arc

Updated: 2026-11-17 · HG2 efficient · AppView shares `Arc<AppearanceConfig>` · ≠ HG2 Pass · ≠ Meta Done

Implementer: [AppView Appearance Arc](a998e508-e0d6-434b-9207-72ddeb853f24)

## Change

- `AppView.appearance`: `AppearanceConfig` → `Arc<AppearanceConfig>`
- `AppView::set_appearance` wraps once, fans out via `ScrollbackState::set_appearance_arc(Arc::clone)`
- Session lifecycle/load/fork use `set_appearance_arc(Arc::clone(&app.appearance))` (no deep clone at session boundary)
- Mutations rebuild owned config then `set_appearance`; tests use `Arc::make_mut` where needed

Continues BlockContext Arc (`T2026-11-17-blockcontext-appearance-arc`).

## Verification

```text
cargo test --locked -p aster-pager --lib app_view \
  -- --skip apply_aster_slash_gate_hides_unsupported_builtins
→ 279 passed; 0 failed

(reconfirm this tip after implementer land)
```

Orthogonal failure left unchanged: `apply_aster_slash_gate_hides_unsupported_builtins`
(`/init` visible but not on `ASTER_EFFECTIVE_COMMANDS`) — not weakened.

## Explicitly not claimed

- HG2 hard goal closed / live latency Pass
- Slash-gate `/init` allowlist fixed
- Meta Harness Done
- H2 Studio land
