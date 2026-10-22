# Reliable workspace retrieval — acceptance evidence

## Result

The scoped implementation and local qualification pass. The full workspace is
**not green**: pre-existing formatting and pinned Studio test failures are
reproduced below. No commit, push, deployment, model download or user-state
migration was performed.

Qualification used Rust 1.97.1 with `CARGO_INCREMENTAL=0`, base `ce0f7b14c`, and
Studio pinned at `08e4e90657b37cb32b74a0455b15e4d4b7fb71e4`. Concurrent work in
the original checkout was isolated in an in-repository detached worktree at
`.codex-worktrees/retrieval`. Final sync checks the original digests of every
owned file before writing; unrelated source, Cargo.lock and submodule changes
are preserved. See `sync-proof.json` and `owned-source-hashes.json`.

## What landed

After qualification, the user requested `提交代码`, authorizing a scoped local
commit of this retrieval slice and its evidence. No-commit and unstaged
statements in the qualification records describe the earlier phase; no push
or deployment was requested.

- ACP compiles and calls its existing local BGE adapter after trusted ACL opt-in.
  The undeclared `local-bge` gate is removed. Missing/invalid assets retain named
  refusals, without installing assets or selecting a remote provider.
- Hybrid reuses one orchestration pipeline with optional semantic input. Exact,
  lexical and available symbol channels continue when semantic is disabled or
  degraded. Definitions, capability notes, examples and per-mode checks agree.
- Semantic/hybrid output selects relevant contiguous windows, including late
  matches and CJK, preserves UTF-8 and escapes controls. Display anchors and full
  chunk anchors are distinct. Rendered text has a 24 KiB budget; omitted results
  and shortened snippets are explicit. Metadata is not included in that text cap.
- A measured existing persistent-index fault is repaired: v3 sparse engine keys
  now reach the adapter on reopen. Missing/duplicate keys refuse the projection
  until a catalog rebuild; v2 dense-key manifests remain readable. No schema
  version, vector persistence, dependency or public Rust API was replaced.
- Versioned strategy/resource qualification, real ACP stdio and A3S Test terminal
  regression, focused CI contracts and current Aster operations docs are retained.

## Commands and results

All commands run from the initialized root workspace. Full argument arrays,
environment and log filenames are in [commands.json](commands.json).

| Check | Result | Evidence |
| --- | --- | --- |
| `cargo test --locked -p a3s-code-core --lib -- workspace::retrieval tools::builtin::search agent_api::retrieval_tests permissions:: --test-threads=4` | **308 passed**, 19.80s execution | [core-focused.log](core-focused.log) |
| `cargo test --locked -p a3s-code-acp --lib -- local_embedding retrieval_seam session_setup execution_capabilities --test-threads=4` | **26 passed**, 0.57s execution; includes 10 formerly disabled adapter cases | [acp-focused.log](acp-focused.log) |
| `cargo test --locked -p a3s-code-acp --test shipped_tui_e2e retrieval::shipped_retrieval_stdio -- --test-threads=1 --nocapture` | **2 passed**, 5.94s; no-model and real missing-asset refusal | [stdio.log](stdio.log) |
| `cargo test --locked -p a3s-code-acp --test shipped_tui_e2e retrieval::shipped_retrieval_a3s_test_terminal_round_trip -- --ignored --exact --nocapture` | **1 passed**, 21.47s; 8 ACL steps | [terminal-test.log](terminal-test.log), [report](terminal-report.json), [bounded VT](terminal/retrieval.vt) |
| `a3s-test check tests/e2e/workspace-retrieval.acl --json` | passed | [terminal-suite-check.json](terminal-suite-check.json) |
| `cargo build --locked -p aster -p a3s-code-acp` | passed; final source identities agree | [build-pair-final.log](build-pair-final.log), [native-pair.json](native-pair.json) |
| `cargo clippy --locked -p a3s-code-core -p a3s-code-acp --lib --test shipped_tui_e2e --example workspace_retrieval_aster` | passed, existing warnings retained | [clippy.log](clippy.log) |
| `cargo check --locked -p a3s-code-core --features advanced-harness,deep-live` | passed | [advanced-harness.log](advanced-harness.log) |
| Scoped rustfmt of all **25 owned Rust files** | passed | [owned-format.log](owned-format.log), full argument list in commands.json |
| `python3.13 tests/workspace_dependencies.py` | **6 passed**; internal A3S dependencies remain local | [workspace-dependencies.log](workspace-dependencies.log) |
| `python3.13 tests/cli_pair_delivery.py` | **10 passed**; paired-delivery fault injection | [cli-pair-delivery.log](cli-pair-delivery.log) |
| Release build of the three named retrieval examples | passed | [release-qualification-build.log](release-qualification-build.log) |

The terminal fixture uses actual paired binaries and a loopback model. Its
success marker is returned only after the next model request contains the real
search tool result with verified source at line 64. The final terminal report
has no cleanup error; its bounded VT is retained at a stable relative path.
The fixture explicitly isolates `HOME` and `A3S_HOME`; an earlier startup wait
failure led to repairing the fixture isolation. No live external model or Web
adapter is used. A3S Test version: 1.0.1.

The final paired source identity is `aster-cli-pair-v1:3853e77689ba38b2d80d612a0febc17b2c80c600:aarch64-apple-darwin`.
Native dependency inspection finds only macOS system libraries/frameworks in the
built pair; see [native-linkage.log](native-linkage.log). This is local native
execution/linkage qualification, not a cross-platform release archive test.

## Baseline and measured decisions

Before implementation, the existing Core retrieval baseline passed 138 tests
in 223.22s. ACP's provider was gated by an undeclared feature, no-provider hybrid
returned unavailable, and ranked rendering always selected the first 16 lines.
Those behavior findings came from source and contract inspection, not a claimed
before/after latency experiment.

The persistent production example failed twice with an unknown native primary
key after an edit/restart. A new single-edit reopen assertion failed with the
same error in 0.53s before the repair: [persistent-red.log](persistent-red.log),
[persistent-before-fix.stderr](persistent-before-fix.stderr),
[persistent-recheck.stderr](persistent-recheck.stderr). After repair, that
regression and malformed-v3/v2-compatibility cases pass inside the 308-test run,
and the unchanged production example passes.

### P3: keep Lines and RRF defaults

The fixed corpus contains seven Rust/TS/TSX/Markdown/CJK documents, eight positive
queries and one negative control. Three exact-identifier first-place gates are
explicitly authored. Corpus SHA-256: `4cfad08a29b59ef5f913622f88efcd86eeab6e3cc07e4a8e6d84d44e6e4b4f98`.

This matrix fixes Portable lexical scoring and uses orthogonal document/query
unit vectors, so semantic similarity cannot manufacture relevance. It measures
real session, hybrid and rendering paths; it does not measure real embedding
quality or establish representative native-engine relevance.

| Chunking | Ranking | Chunks | Recall@5 | MRR | nDCG@10 | P95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| lines_80 | rrf_only | 7 | 1.0000 | 1.0000 | 1.0000 | 0.622 |
| lines_80 | deterministic_mmr | 7 | 1.0000 | 1.0000 | 1.0000 | 0.578 |
| recursive_512_64 | rrf_only | 9 | 1.0000 | 0.9375 | 0.9539 | 0.531 |
| recursive_512_64 | deterministic_mmr | 9 | 1.0000 | 0.9375 | 0.9539 | 0.538 |

All profiles retain all eight labeled sources, all three exact-identifier gates
and the empty negative control. Recursive moves the split-name query to second
place; the report retains that rank. MMR adds no quality improvement here.
Keep Lines/RRF; no AST dependency or global reranking promotion is justified.

The legacy-prefix display ablation loses the line-64 evidence in every profile;
the current window retains it. Each profile uses one document provider request
at the batching lower bound and returns vector records/bytes to zero on close.
See [aster-profile.json](aster-profile.json). Bytes are not converted to model
tokens, and the display ablation is not a second live agent run.

### P4: keep resource limits; repair the demonstrated restart fault

Final release runs invoke the built executables sequentially under
`/usr/bin/time -l`; compilation is excluded. This task's compiler group was
paused during the measurements and resumed in `finally`. Other tasks were not
stopped. Machine: Apple M5 Max, 18 logical CPUs, 64 GiB RAM, macOS 26.6.2.
See [measurement-context.json](measurement-context.json) and
[release-runs.json](release-runs.json).

| Locked v5 profile | Measured P95 | Existing ceiling |
| --- | ---: | ---: |
| Exact vectors: 25,000 records × 384 dimensions | 4.734625 ms | 30 ms |
| Native a3s-vec hybrid: 4 files, 512 chunks, 544,896 source bytes | 3.330917 ms | 100 ms |
| Same hybrid workload with deterministic MMR | 3.821708 ms | 100 ms |
| Added MMR P95 | 0.490791 ms | 10 ms |

The native hybrid profile makes eight document provider requests for 512 inputs,
exactly the lower bound (amplification 1.0). It includes authoritative source
reads from the warm OS cache, uses a deterministic provider, and excludes live
model inference/network cost. Close and resource ceilings remain asserted by
the existing benchmark. See [retrieval-release.json](retrieval-release.json).

The first run, concurrent with compilation, failed the RRF threshold at
140.074625 ms. Its report remains [retrieval-contended.json](retrieval-contended.json).
The threshold was not loosened; these different-load runs are not a claimed
code-speedup comparison.

The persistent profile passes with 512 files/chunks and 128 concurrent queries:
same-byte generation reuse, changed-byte publication, 10 restart hits and one
retained generation. P95 is 4.391 ms. See
[persistent-release.json](persistent-release.json).

Peak whole-process RSS is 23,379,968 bytes for the matrix, 187,023,360 for the
v5 retrieval benchmark, and 33,980,416 for persistence. macOS time reports bytes;
these are not vector-only or real-model memory numbers. Raw `*.time.log` files
are retained. The real BGE readiness check reports **assets not installed**:
[local-model-status.json](local-model-status.json). No inference or download was
attempted. There is no evidence to promote a new model, ANN, CPU limit or vector
persistence scheme.

## Independent baseline failures

- `cargo fmt --all -- --check` fails on five unchanged base files in unattended,
  fact-control and goal-control. All 25 owned Rust files pass. Each failing file
  matches the isolated base and independently formats differently when its base
  bytes are fed to rustfmt: [format.log](format.log),
  [base-format-reproduction.json](base-format-reproduction.json).
- `cargo check --locked --workspace --all-targets` fails in the clean pinned
  Studio sources: `document_result_import` omits `crate::app_updater`, and a
  Studio lib test includes the absent API `acp-cloud-agent.aix` fixture.
  `cargo check --locked -p a3s-studio --test document_result_import` independently
  reproduces the module error. Source identities, clean submodule status and
  fixture absence are retained in [baseline-ci-reproduction.json](baseline-ci-reproduction.json),
  [workspace-check.log](workspace-check.log) and
  [studio-base-reproduction.log](studio-base-reproduction.log).
- The unchanged Kylin installer tests give 11/16 on native macOS because their
  Linux channel fixtures do not replace `uname`. An extracted unchanged base
  reproduces the same five failures; a declared Linux-host simulation passes
  all 16. No installer or test was changed. See
  [cli-kylin-reproduction.json](cli-kylin-reproduction.json),
  [cli-kylin-base.log](cli-kylin-base.log),
  [cli-kylin-linux-host-simulation.log](cli-kylin-linux-host-simulation.log).

These failing global checks are not represented as passes. They were not fixed
by changing other tasks' source or the private Studio submodule.

## Requirement audit and adversarial review

| Requirement | Authoritative proof |
| --- | --- |
| FR-001 trusted local adapter / named asset refusal | 10 adapter cases within ACP 26, host/workspace trust cases, actual missing-asset stdio case |
| FR-002 optional semantic / available hybrid | Core model-free and failing-provider contracts, ACP seam and both real stdio cases |
| FR-003 APIs / validation / authorization / stale-source / cancellation | Core 308: invalid requests refuse before admission, per-mode governed denial, changed/deleted/unreadable filtering, revision races, admission cancellation and closed-session refusal |
| FR-004 bounded relevant UTF-8 evidence / accurate anchors | Five shared renderer tests, actual session line-64 and total-output tests, stdio and TUI model-evidence assertions |
| FR-005 ephemeral vectors / session isolation | Core lifecycle cases and all four matrix post-close counters equal zero; no vector storage added |
| FR-006 versioned comparison / honest choices | Fixed corpus digest, four profile reports, unchanged v5 gates and explicit P3/P4 decisions |
| FR-007 real entry points / honest model scope | Core/session contracts, 2 ACP stdio cases, paired Aster terminal, local model availability report |
| FR-008 coherent workspace / CI / docs / packaging | Local-dependency guard 6, paired-delivery cases 10, matched actual native identities, selected CI commands and updated runbook; baseline global failures reproduced |
| SC-001 | Core 308 + ACP 26 pass with logs |
| SC-002 | Actual ACP 2 + Aster terminal 1 pass; loopback fixture only |
| SC-003 | Matrix and unchanged release gates pass; identifier, stale-source and persistence regressions included |
| SC-004 | Scoped fmt, Clippy, optional harness and paired build pass; full-tree fmt/Studio failures independently reproduced and explicitly reported |

Review confirms that fusion is not duplicated, the catalog remains the source
owner, verification still rereads admitted files, cancellation and error
handling remain present, permissions execute before source admission, and a
failed optional provider does not enable another backend. Regex is used only
for escaped literal snippet ranking, never to guess names, identity or intent.
No new production `unwrap()`/`expect()`, configuration language, external A3S
dependency, native picker, binding or persistent vector schema was introduced.
The persistent fault and fixture-home leak found during qualification have
regressions or explicit fixture isolation. No unresolved scoped defect remains.

## Explicitly not claimed

- Real BGE semantic quality, weights/runtime CPU performance or actual model
  token savings; admitted assets were absent.
- Semble parity, universal relevance, cold-disk latency, ANN scale, a 25,000-record
  hybrid result, vector-only RSS, or a causal speedup from different-load runs.
- Green full-workspace CI, live Web/GUI testing, Linux/Windows native execution,
  installer execution on Kylin hardware, or a published release archive.
- New AST chunking, embedding model, multi-repository search, remote clone,
  semantic persistence, auto opt-in, new SDK/bindings, commit, push or deployment.

The default changes deliberately stop at the demonstrated defects. Initial
logs from the original concurrent checkout are preserved under `initial-run/`;
current authoritative evidence is named above.
