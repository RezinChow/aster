# T2026-11-17-blockcontext-appearance-arc

Updated: 2026-11-17 · HG2 efficient knife · BlockContext `appearance: Arc<AppearanceConfig>` · ≠ HG2 Pass · ≠ Meta Done

## Change

Hot-path scrollback no longer deep-clones nested `AppearanceConfig` when building `BlockContext`:

- `BlockContext.appearance` / `ScrollbackState.appearance` → `Arc<AppearanceConfig>`
- `EntryRenderer::with_appearance_arc` + `appearance_shared`
- `ScrollbackEntry::{context,ensure_cached,*}_arc` share the Arc
- layout rebuilds use `Arc::clone(&self.appearance)` (disjoint-field safe under cache mut borrow)

## Verification

```text
cargo test --locked -p aster-pager --lib context_with_mode_arc_shares_appearance_pointer
→ 1 passed (Arc::ptr_eq)

cargo test --locked -p aster-pager --lib 'scrollback::blocks::thinking'
→ 10 passed

cargo test --locked -p aster-pager --lib preamble_multiline
→ 4 passed

cargo test --locked -p aster-pager --lib 'scrollback::entry::'
→ 24 passed (includes ptr_eq + estimate/cache suites)

cargo fmt --all
→ ok

python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_pager_latency
→ 1 suite / 1 passed / 0 failed (hg2_estimate_line_widths_latency_freeze)
```

## Explicitly not claimed

- HG2 hard goal closed / live latency field Pass
- Meta Harness Done
- H2 Studio land (still parked — needs Studio commit/push auth)
- Full `aster-pager` lib suite / clippy workspace Pass
