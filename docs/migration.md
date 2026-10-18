# Harness migration

The 2026-10-18 import copies the required Rust source snapshots from
`../a3s` into a standalone Aster workspace. The source checkout is left
untouched. Package-level provenance is recorded in
[`source-manifest.json`](source-manifest.json). Local snapshots include
working-tree changes; repository revisions do not imply release certification.

## Product and dependency boundaries

`aster` directly runs the existing pager composition root. It starts the
sibling `a3s-code-acp` process, which owns the Code Core harness. There is
no umbrella CLI or second agent loop. The old A3S umbrella CLI, cloud,
gateway, other desktop apps, web sites, distribution installers, and Code's
Node/Python/Go SDKs are outside this product.

The imported support crates cover the harness fact log, ACL parser,
native sandbox, memory, lexical retrieval, search/browser contracts,
extension reconciliation, OKF, optional workflows, and typed decisions.
Terminal support remains in its upstream directory structure to retain
resource paths, test fixtures, protocol definitions, and third-party notices.
The PTY controller and harness remain available for terminal regression tests.

All imported Rust packages and Work are members of one Cargo workspace with resolver 3,
shared dependency declarations, one checked-in `Cargo.lock`, one build
directory, and Rust 1.97.1. This follows the
[Cargo workspace model](https://doc.rust-lang.org/cargo/reference/workspaces.html).
The two default members build the terminal and ACP companion together.
Retained package names and Rust module paths keep the embeddable SDK stable.

## Compatibility decisions

- **Flow:** Code 9.1.4 uses Flow 1.1 contracts removed in the sibling's
  Flow 2.0 tree. The exact Code-pinned Flow commit
  `2948ad51a1395177764766c3ddf7e44338f9e374` is copied from the existing
  Cargo source cache. It is a local workspace dependency. Flow's optional
  Boot, Event, and ORM integrations now resolve to in-tree sources too.
- **Small support libraries:** Common 0.1.1, Lane 0.5.1, and Updater 0.2.0
  have no source project in the sibling tree. Their exact cached crate
  sources are included locally, with original licenses and provenance.
  Updater is retained for the standalone Search package; Aster's own
  automatic and explicit binary-update entry points are disabled.
- **ACL:** all imported consumers use the sibling's ACL 0.3.0 locally.
  Host-authoritative configuration remains protected from repository
  overrides. Workspace MCP trust and sandbox checks remain in place.
- **SQLite:** ACP and Memory move from rusqlite 0.32 to 0.37, matching
  the terminal crates, because Cargo permits only one `sqlite3` native
  linkage. Both memory adapters use sqlite-vec 0.1.7-alpha.10. Existing
  database schemas and migrations remain intact.
- **Runtime:** Tokio Util requires at least 0.7.19 for cancellation-token
  identity comparisons already used by Core.
- **Vector test utilities:** Vec's old exact tempfile 3.14 dev pin is
  widened to 3.27 to share the workspace's temporary-file library.
- **Configuration and state:** existing `.a3s` / `.a3s-code` paths and
  `A3S_*` environment variables remain compatible. The migration copies
  no personal credentials, session stores, browser profiles, or build outputs.
- **macOS native execution:** the source Core deliberately refuses native
  shell execution with `native_process_lifetime_unqualified` until descendant
  lifetime and settlement are qualified. This guard remains intact. The two
  shell-dependent PTY success tests are skipped only on macOS; native refusal
  tests cover the guard. Launching, model chat, and file tools remain available.
- **SDK-independent fixtures:** evaluation/research wire fixtures move
  from `sdk/` into `crates/code/fixtures/protocol`; Rust protocol tests
  point at the new paths. No foreign-language bindings are retained.
- **Release tests:** Search's standalone upstream release-workflow test is
  retired with that release pipeline. Root workspace CI and Aster's
  migration tests replace the obsolete publication-layout assumptions.
- **Memory tests:** the legacy ACP `v912_remember_before_stream_close`
  oracle expects a raw-input fallback and JSON files even when the extraction
  model returns no memories. Current Core explicitly forbids that fallback
  and uses Vec snapshots. The historical test remains ignored with its reason;
  Core's current memory-retention tests verify the supported contract.
- **Hardware and linking:** retain Apple Silicon's 16 KiB jemalloc page
  calibration, Linux ARM64 page settings, static MSVC CRT settings, and
  musl linker hardening. Python-extension dynamic lookup flags are removed.

## Licensing

The terminal and Aster entry point retain Apache-2.0 licensing. Code Core,
ACP, and the supporting A3S libraries retain their original MIT licenses.
Third-party notices remain under `crates/terminal`. The root Apache license
covers the product entry point and does not relicense imported MIT code.

## Validation

Validation results are recorded in [`validation.md`](validation.md).
Real-model qualification, external browser installation, optional cloud
backends, and release certification are separate from the local migration.

## Local launch commands

`just code` builds both default workspace members and runs the current
`aster` TUI. Arguments are forwarded as positional shell arguments.

`just work` opens the newest executable macOS bundle from the workspace
target directory or the previous Work target directory. Work is included
in the same Rust workspace. Its former Git metadata is preserved locally
under `.git/imported-work.git`; its source files are part of this repository.
The launcher uses executable modification times, preserves paths containing
spaces, and reports an actionable error when no compiled bundle exists.

The welcome screen uses the supplied Aster logo, retained at
`assets/aster-logo.png`, with full and compact ASCII artwork. Forty-eight
frames are cached lazily and replayed at 12 FPS. Glyph and color sweeps
share the existing welcome-screen redraw clock. Compact artwork reserves
five rows so a standard 80-by-24 terminal can still show it. Color output
uses the terminal's existing quantization and NO_COLOR handling.


## Complete internalization

The workspace now contains 135 Rust packages. A3S dependencies in every
manifest and the lockfile resolve to local source, including optional,
target-specific, and test dependencies. Every workspace member is marked
`publish = false`. The additional source snapshots are recorded in
[`internalized-sources.json`](internalized-sources.json).

Work shares ACL, OKF, Vec, Use Core, and reconciliation with Code. OCR,
Use Extension, Tool Acquire, Boot (including macros), Event 0.3, ORM, and
Office's four native/kernel crates are included. The pinned OpenAI client
fork and Work's modified PTY adapter are local as well. OCR's image dependency
uses the workspace-compatible 0.25.10 release.

Code's Flow 1 API remains at `crates/flow`, with internal package name
`aster-flow-legacy` and the existing `a3s_flow` library identity. Work's Flow
2 API and authoring source live at `crates/flow-v2`. Both use local service
integrations and compile with all their features. This preserves each
consumer's contracts without a forced engine API migration.

Work's desktop copies of the shared Rust libraries and its separate lockfile
are removed. Its renderer stays in a pnpm workspace. Office's full editor
source, build configuration, and checked-in WASM kernel replace the old
artifact-only dependency; `pnpm install` builds the editor locally. Work's
source packages are private and standalone package publication scripts are
removed. Its default tenant assets and formerly external test fixture are
included. Source builds, development launchers, macOS packaging, and the
Linux container build use the root Cargo workspace and target directory.

Work remains AGPL-3.0 under `apps/work/LICENSE`; the Rust libraries and third-
party forks retain their respective original licenses.

## macOS command lifetime follow-up

On 2026-10-18, Aster adopted the owner-bound Guest adapter from Code commit
`cd3764c9` and the host-availability provider from `cb5b5521`. The paired OCI
Runtime shim is source commit `3189636cb`; it watches both the direct Core
process and the shim that owns the VM worker. The adapter and shim must be
deployed together. Exclusive command-script creation also rejects existing
files and links without overwriting them.

[Retained execution evidence](evidence/execution/2026-10-18-macos-guest-owner/OUTCOME.md)
binds the exact local sources and signed fixture artifact. Native macOS Shell
remains refused; product packaging, policy composition, control-file recovery,
network mediation, background streaming and the Python environment remain open.
No additional language SDK or in-process code sandbox was introduced.
