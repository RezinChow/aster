# Native Cordis kernel and DSH bridge removal

Updated: 2026-11-19

## Scope

Named YOLO scope: remove the Studio DSH bridge, implement a native Cordis-style
kernel inside Aster Core, and verify it with `erkamyaman/rust-anything`.

Source snapshot: Aster `58be47b06655b193779e09ed14f314b9b4f08f0a`; Studio
`bedc30698c2ad714ae4b4bc5d43e3e602040d84f`; existing unrelated dirty-tree work
was preserved. Verification tool: `rust-anything 1.5.1`.

## Delivered

- Public native API: `aster_core::capability::cordis` with typed services,
  isolation scopes, intercept config merging, sync/async events, waterfall,
  plugins, dependency-driven fibers, restart/update, reverse cleanup, and
  cascading child disposal. No JavaScript runtime is embedded.
- Native behavior driver: `crates/code/core/examples/cordis_behavior.rs`.
- Fixed reference: `@deepseek-ai/cordis` 4.0.4 under
  `crates/code/core/tests/fixtures/cordis-port/`.
- Removed `apps/studio/packages/dsh-bridge`, its dedicated patches, DSH runtime
  dependencies, lockfile entries, and direct bridge documentation contracts.
- Updated `META_HARNESS.md` and `SCOPED_CAPABILITY_ARCHITECTURE.md` to describe
  the native kernel boundary.

## Verification

- `cargo test -p aster-core capability::cordis::tests --lib` — **5 passed, 0
  failed**. Covers services/isolation/intercepts, events, dependency reload,
  reverse cleanup, update/failure, and child disposal.
- `cargo build -p aster-core --example cordis_behavior` — passed.
- `rust-anything app record . --inputs inputs.jsonl --no-traps -- node
  reference.mjs` — recorded 6 fixed cases from the TypeScript original.
- `rust-anything app replay .` — original **6/6 passed**.
- `rust-anything app replay . --build
  /Users/roylin/code/aster/target/debug/examples/cordis_behavior` — native
  **6/6 passed**, every recorded case matches. Report:
  `crates/code/core/tests/fixtures/cordis-port/rust/app-cases/replay-report.md`.
- `cargo clippy --locked -p aster-core --all-targets --no-deps` — completed
  successfully; existing warnings remain, no Cordis warning was reported.
- Targeted `rustfmt --check` for changed Rust files — passed.
- `pnpm --config.verify-deps-before-run=false deps:check` — passed.
- Root and Studio targeted `git diff --check` — passed.
- Studio `package.json` and `pnpm-lock.yaml` contain no `@deepseek-ai/cordis`,
  `@deepseek-ai/dsh`, or `dsh-bridge` entries.

## Development defects closed

- Root-fiber dependency refresh incorrectly scheduled root cleanup and disposed
  child plugins. Root fibers are now excluded from plugin dependency teardown;
  the lifecycle suites pass.
- Failed plugin activation could immediately re-enter activation through a
  global refresh. Failed activation now performs cleanup without triggering a
  global retry; the failure/update test settles instead of hanging.

## Existing or environmental failures

These are not claimed as passes and were not weakened:

- `crate_root_surface`: current tree reports 399 hidden aliases / 77 public
  modules against baselines 644 / 81. The new kernel is nested under
  `capability` and does not increase either count.
- `production_file_size_ratchet`: existing `harness_loop.rs` (2017 lines) and
  `tools/task.rs` (2267 lines) exceed the 2000-line limit.
- `cargo fmt --all -- --check`: existing `terminal_bench_runner.rs` formatting
  differs. Targeted changed-file formatting passes.
- Studio full docs checks retain existing failures: 271 broken links, missing
  `api-gateway`, stale generated index, and 9 unrelated frontmatter source
  violations. The bridge source violation introduced by removal was fixed.
- Studio automatic dependency installation hit the host's `node-gyp` path
  (`npm.asar/.../gyp_main.py` not accessible). Actual dependency lockstep check
  passes with automatic installation disabled.
- `.kstudio/workflow/review.py` and `--run` could not fingerprint the dirty
  `apps/studio` submodule; declared review checks were therefore not run.

## Explicitly not claimed

- No full JavaScript drop-in API or complete Cordis loader/HMR/logger ecosystem.
- No `rust-anything` per-unit `gate` or `app lift`; the passed gate here is the
  fixed black-box `app record` / `app replay` behavior comparison.
- No full Aster Core suite, Studio build, headed run, release, or product Pass.
- No native Windows or Linux runtime verification; this run is macOS arm64.
- No Meta Harness overall Done. Percentage and green checks are not Pass.
