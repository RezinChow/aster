# T2026-11-18-fact-log-five-repairs

Updated: 2026-11-18 · scope: isolate and repair the five current `fact_log` failures · **87/87 verified** · **≠ Meta Harness Done**

## Isolation

Initial broad run: **82 passed / 5 failed**. Each failure was reproduced individually.
None of the five enabled `read_only_synthesis_rounds`, so the staged-synthesis policy was
not active in these cases. No test or gate was disabled or weakened to obtain the final
result. The existing dirty checkout was reviewed directly; no worktree, branch, stash,
or source-copy baseline was created.

## Repairs and root causes

1. **Usage accounting fixture** — the scripted client served the final answer again to
   the auxiliary memory-extraction call, double-counting its 12 tokens. The fixture now
   supplies an explicit zero-usage auxiliary response. The production assertion remains
   12 total tokens; this was a test-data defect, not a claim of a product accounting fix.
2. **Restored tool image bytes** — `tool_image_ids_to_stub` scanned the entire log and
   permanently stripped pixels after any later model turn. It now scans only the segment
   after the latest `user.message`, so a new user question reloads retained image bytes
   while same-turn repeated activity can still use the stub.
3. **No-authority tool projection** — OwnedPreparation always installs a runtime
   permission wrapper. That made the visibility layer mistake a default Ask for an
   executable authority. `RuntimePermissionChecker` now hides default-Ask tools when no
   confirmation route and no explicit access rule exist, while preserving explicit rules,
   upper-ceiling Allow, and execution-time checks.
4. **Instruction-skill visibility/content** — the permission wrapper now distinguishes
   registered instruction-only skill content from executable tools. A named instruction
   skill may be visible and return its content without HITL; explicit ceiling Deny still
   wins, tool skills and nested tools retain their gates, and empty registries do not
   advertise `Skill`. The global `Ask without manager = safe deny` test remains green.
5. **Diagnostic error-fidelity fixture** — the old search request had become a successful
   unified-search call. The fixture now uses a schema-valid but runtime-refused summary
   pagination combination. The test proves the refused result reaches the model with
   `is_error=true`; an earlier schema-invalid variant was correctly rejected at entry and
   was not used as a substitute.

## Verification

- `cargo test --locked -p aster-core --lib agent_api::tests::fact_log` — **87 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib fact_control::tool_history_tests` — **28 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib agent_api::direct_tools::governed_tests` — **7 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib safety_gate::` — **12 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib permissions::` — **128 passed / 0 failed**.
- `cargo test --locked -p aster-core --lib agent_api::tests::read_only_delivery` — **4 passed / 0 failed**.
- `cargo clippy --locked -p aster-core --all-targets --no-deps` — **exit 0**; existing warnings retained.
- `cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp` — **exit 0**.
- `python3 .kstudio/workflow/verify-ai-eng.py --level L3` — **PASS**, not product Pass.
- `git diff --check -- crates/code/core/src` — **exit 0**.
- `cargo fmt --all -- --check` — **exit 1** only for the pre-existing
  `examples/terminal_bench_runner.rs`; no current `core/src` formatting difference.

## Explicitly not claimed

- No full Core suite, live-provider rerun, Windows native check, release, commit, push,
  or whole-product Pass is claimed for this repair slice.
- No kbox copy/edit, branch, worktree, stash, or unrelated failure cleanup was performed.
