# Runtime usage/analytics export honesty — specs/005 US-7 (+FR-002)

**Date**: 2026-10-21
**Epic**: `specs/005-os-convergence-execution` (US-7, FR-002, US-6 证据修正)
**Scope**: `apps/runtime` (package `a3s-gateway-runtime`, root workspace member,
product regime) and `.github/workflows/backend.yml` (fmt job toolchain
provisioning).

## What changed

1. `POST /v1/api/usage/batch` no longer answers `200` with an empty batch and
   `"stub: lifecycle export not yet wired in Rust runtime"`. It now refuses
   with `501`, `error_code: usage_export.not_wired`, message "lifecycle export
   is not wired in this runtime" (after authentication; unauthenticated calls
   still get `401`). The stub's loose body validation was removed with the
   stub — there is no body contract while the capability is refused.
2. `GET /v1/api/analytics` no longer answers `200` with an empty feed. It
   refuses with `501`, `error_code: analytics.not_wired`.
3. `GET /v1/api/usage` keeps its real per-request records and spend fields;
   the unwired lifecycle advertisement (`lifecycle_events: 0`,
   `lifecycle_schema`, `batch_schema`) is removed from the response.
4. `.github/workflows/backend.yml` fmt job now runs `rustup component add
   rustfmt` after the `--profile minimal` toolchain install (the 2026-10-20
   baseline run failed with "'cargo-fmt' is not installed for the toolchain
   '1.97.1'"). Only the fmt job gained the component; no job was removed or
   relaxed.
5. `apps/runtime/src/lib.rs` doc comment aligned with the package name
   (`a3s-gateway-runtime`); the `a3s-runtime` package name belongs solely to
   `crates/runtime`. Wire identity strings (health `service`, user_agent)
   are deliberately unchanged pending consumer clarification.

Tests live in the sibling file
`apps/runtime/src/http/router/usage_export_tests.rs` (constitution X).

## Consumer safety

Repo-wide scan for callers/readers before the change: no product code
(`apps/studio`, `apps/aster`, `apps/desktop`, `apps/web`, `packages`) calls
`/v1/api/usage/batch` or `/v1/api/analytics`, and none reads
`lifecycle_events` / `batch_schema` / `lifecycle_schema` from the usage view.
The only textual references are a historical merge-evidence patch document
(`packages/ui/docs/merge-evidence/a3s-ui-web-working-tree-2026-10-03.patch`).

## Commands and counts

- `cargo test --locked -p a3s-gateway-runtime`
  → `test result: ok. 5 passed; 0 failed; 0 ignored` — the two pre-existing
  router tests plus the three new contract tests
  (`usage_batch_refuses_with_named_reason_until_wired`,
  `analytics_refuses_with_named_reason_until_wired`,
  `usage_view_carries_real_records_and_no_lifecycle_advertisement`).
  The run first blocked ~11m on the build-directory lock held by a concurrent
  session, then compiled and passed.
- `cargo fmt -p a3s-gateway-runtime -- --check` → clean.
- Workspace `cargo check --locked --workspace --all-targets` and the
  workspace fmt gate: recorded separately below once complete.

## specs/005 corrections recorded with this slice

- US-6 premise corrected by evidence: the rename already happened
  (`apps/runtime/Cargo.toml` package `a3s-gateway-runtime`; root member).
  D-C marked resolved in the spec. Residual: registry-builder registration
  (pinned extension 0.1.3) and wire identity strings.
- Evidence domain note in the spec aligned to the existing
  `docs/evidence/development/` directory.

## Phase B diagnosis (same day, appended)

1. **Workspace `cargo check --locked --workspace --all-targets` fails at
   committed HEAD** (real exit 101; reproduced locally after the concurrent
   session's lock cleared): `a3s-use` test targets `include_str!` /
   `include_bytes!` four upstream root fixtures that the import excluded —
   `crates/use/.github/workflows/{ci,release,publish-crates,docs-pages}.yml`,
   `crates/use/{Cargo.lock,install.sh,install.ps1}` — plus four stale
   nested-layout paths (`../crates/core|extension/...`) left over from the
   upstream `crates/use/crates/*` layout that this repository flattened.
2. **Fix applied** (import-faithful where possible, layout ruling where
   required): the seven root fixtures are restored verbatim from
   `../a3s/crates/use` (bytes unchanged, `install.sh` exec bit preserved;
   the nested `.github` is inert to GitHub Actions); **33 stale nested
   include sites across 15 files** (`crates/use/src/**` cfg-test modules
   plus `crates/use/tests/**`) are repointed from the upstream
   `../crates/{core,extension}/...` layout to this repository's flattened
   `../{core,extension}/...` paths. Every flattened target was verified to
   already exist (Python resolution pass, zero gaps); the four compared
   fixtures are byte-identical to upstream's nested copies (`cmp`), so the
   tests still read the same bytes. Zero `(\.\./)+crates/` references
   remain (grep residual count 0). `cargo fmt -p a3s-use -- --check` clean.
   Compile verification recorded below.
3. **backend.yml structural finding — verified, then fixed by owner decision
   (a)**: `cargo metadata --no-deps` at the root resolves
   `a3s-gateway-runtime`, `a3s-runner`, `a3s-use-core`, `a3s-box-runtime`,
   `a3s-form-core`, `a3s-sms` but NOT `a3s-api`, `a3s-cloud-contracts`,
   `a3s-cloud-node-agent`, `a3s-cloud-sdk`, `a3s-cloud-control-plane` —
   those live in the `apps/api` / `apps/cloud` submodule workspaces, and
   the `hermetic`/`campaigns` jobs did not check submodules out. The owner
   chose option (a) (keep coverage). The fix: a new
   `.github/actions/checkout-os-backend` composite action mirroring
   `checkout-studio` (fail-closed token requirement, gitlink pin resolution
   via `git rev-parse HEAD:<path>`, token checkout of
   `kense-labs/{api,cloud}` with `persist-credentials: false`); the
   `hermetic` matrix now carries `submodule` + explicit `test_args` per
   entry, with the backend checkout gated on `matrix.submodule` truthiness
   (missing key is null — `!= ''` would mis-fire); `campaigns` checks out
   both submodules and scopes its three serial commands with
   `--manifest-path apps/{cloud,api}/Cargo.toml`. `rust-cache` gains the
   matching `workspaces` entries. Local proofs: YAML parses; all five
   submodule packages resolve under their own manifests
   (`cargo metadata --manifest-path`); gitlink pins resolve. Not claimed:
   a real CI execution — if `STUDIO_READ_TOKEN` lacks read scope on
   kense-labs/api and kense-labs/cloud, the checkout fails closed with the
   named token error, which is the intended refusal, not a bypass.
4. **Two committed `a3s-gateway` target breakages found by the first full
   recheck and fixed in this slice** (tree clean, so committed debt, not
   concurrent-session in-flight edits): `benches/routing.rs` was missing
   the new `RouterConfig.parking` field (added `parking: None`, matching
   the `Default` at `src/config/router.rs:95`), and
   `examples/protocol_benchmark_load.rs:138` passed `Vec<u8>` where
   tungstenite 0.26 requires `Bytes` (converted with `.into()`).
   `cargo check --locked -p a3s-gateway --benches --examples` now finishes
   with zero errors; `cargo fmt -p a3s-gateway -- --check` clean. The
   final full-workspace verdict is recorded below.

## Final verdict (2026-10-21, closing the slice)

- `cargo check --locked --workspace --all-targets` → **exit 0, zero
  errors** ("Finished `dev` profile ... in 29m 15s"). The committed-HEAD
  exit-101 from the morning is resolved by this slice's a3s-use fixture
  restore and the two a3s-gateway target fixes.
- Workspace fmt gate at **HEAD is green**: the only remaining
  `cargo fmt --all -- --check` diff is
  `crates/effect/src/coding/revalidation_tests.rs:59`, which is uncommitted
  in-flight work of the concurrent session (invisible to CI). The four
  studio `agent_plane` files flagged in the morning scan carried that
  session's since-absorbed working-tree bytes; `plugin_selection.rs` was
  last committed 2026-10-11 and its HEAD bytes are fmt-clean — no studio
  submodule commit was needed.
- `python3.13 tests/workspace_dependencies.py` → 6 tests OK (no new
  remote `a3s-*` dependency from this slice).
- Landed on main as commits `81b306892`, `737255abd`, `215cdf8a8`,
  `3c2638fa8`, and the option-(a) backend checkout fix `10a7f21ab`, pushed
  to `origin/main` (fast-forward; the concurrent session's in-flight edits
  were staged around, never included).

## Remote CI verdict (2026-10-21, appended after push)

The pushed commits triggered real runs, and **every backend/Rust job fails
at the first checkout step**: the `checkout-studio` fail-closed guard
reports `Configure STUDIO_READ_TOKEN with read access to
kense-labs/studio` (backend run 39540474980 on `17ef780db`, fmt and
check; the Rust workflow's ubuntu/macos checks fail identically;
hermetic/campaigns are skipped behind check). No cargo command runs at
all. The 2026-10-20 baseline runs passed this step and died in cargo, so
the secret was configured then and is missing or expired now. The
option-(a) backend checkout reuses the same token and therefore also
awaits it (needing read scope on kense-labs/studio, api, and cloud).
**Single owner action unblocks all three workflows**: configure
`STUDIO_READ_TOKEN` in aster-ai-lab/aster repository secrets. This
remote red is not attributable to any commit in this slice; the local
green verdicts above stand.

## Explicitly not claimed

- No real lifecycle export or analytics aggregation was wired; the endpoints
  refuse rather than deliver. Wiring them is future work under the same
  spec story (200 only with real records remains the contract).
- The full CI-green claim for main (US-1) is not made here: this slice fixes
  the fmt provisioning and lands the runtime changes; the in-flight workspace
  fixes from the concurrent session remain uncommitted and are not staged by
  this slice. The workspace fmt gate is red at 8 files in the concurrent
  session's in-flight trees (`apps/studio` agent_plane, `crates/code/acp`,
  `crates/code/core`, `crates/effect`) plus `crates/use` test files pending
  `cargo fmt` on this slice's edits.
- The a3s-use test targets are compile-verified; their runtime pass/fail
  (upstream CI-pinning assertions against the restored workflow fixtures)
  is recorded in a follow-up run, not claimed here.
- No commit was made; files are left in the working tree for individual
  staging.
- macOS execution qualification, upstream submodule work (T0.4.2, lane
  payload reconcile), and GA-2 retained runs are untouched.
