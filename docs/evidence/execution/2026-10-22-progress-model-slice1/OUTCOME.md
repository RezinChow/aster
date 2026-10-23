# Progress-model slice 1 — turn-scoped obligations + unhostable-window guard

Date: 2026-10-22. Spec: `specs/010-unified-progress-model/`. Responds to the
user's rule-accretion feedback (verified deadlock: a session-lifetime
uncertainty latch × acceptance gate requiring workspace change × unattended
continuation — no exit; terminal-bench-4 read-only tasks froze a home
server).

## Result

The uncertainty latch gains its missing exit path: at turn settlement,
unresolved non-child obligations become **recorded, goal-visible debt**
(`MutationLedger.recorded_uncertainties`) and stop denying future mutating
calls. Nothing is waived — the discharge invariants PR #8 pinned stay
byte-identical (a first attempt that discharged on observed receipts broke
two pinned tests and was reverted before landing). A late turn settle is
the only new transition; `workspace-child:*` keys keep their exact-terminal
path.

Separately, the unhostable-window guard lands: a declared context window
below the harness prompt floor (12,288 tokens) refuses session start with
`context_window_unhostable` naming both numbers and the fix, instead of
running at permanent 100% context (the user's TUI had declared
`context = 4096`; their ACL was also corrected to 32768/8192, which needs
a serving backend whose max context actually fits the harness prompt).

## Validation

| Command | Result |
| --- | --- |
| `cargo test -p a3s-code-core --lib -- hostable_window` | 2/0 |
| `cargo test -p a3s-code-core --lib -- session_config resolve` | 42/0 |
| `cargo test -p a3s-code-core --lib -- harness_loop receipt` | 235/2 → after the discharge revert only the pre-existing `child_debt_requires_exact_committed_terminal…` red remains (proven pre-existing by stashing this lane's harness_loop edits: the test fails identically on pristine HEAD; part of the concurrent lane's recorded ~16 core-lib failures) |

## Explicitly not claimed

- Recorded uncertainties are not yet surfaced into `verified_turn_text`
  (Phase 1 consumes the reader).
- The single red in the receipt battery
  (`child_debt_requires_exact_committed_terminal…`) is pre-existing at
  HEAD (proven by stashing this lane's harness_loop edits).
- No behavioral claim on terminal-bench scores yet.

## Landing note

The slice-1 code and the unhostable-window guard landed inside the
concurrent session's workspace sweep `c39469abc` (verified file-by-file:
guard in agent.rs/session_config.rs/lib.rs, settle machinery in
harness_loop.rs, wiring in receipts.rs, gen rename in host_env.rs, the
WorkBuddy evidence removal record, and the storage widening revert).
This lane adds the spec/plan and this evidence record. Wiring IS live:
`prepare_tools` settles prior turns via the watermark before the deny
check reads the ledger.

## Also recorded

The same session's WorkBuddy integration was removed by `288e53a3b`
(concurrent session); its evidence doc now records the removal, and the
orphaned `write_auth_json` widening was reverted.


## Phase 1 addendum (commit 5e855a3d2)

`TurnProgressDelta` (information/mutation/uncertainty/plan) is computed
at the settle watermark and returned to the fact path; 4 hermetic tests
pin the all-zero stall case, text-exploration, obligation-growth sign,
and the JSON shape. Battery 279/1 (the single red pre-existing).

## Phase 2 seam discovery (commit e3232d260)

The stall exit already exists (`slices_since_progress`, bound 3, replan
grace) behind a `ProgressBasis` closed set with one mutation-only
member; P2 narrows to adding a `TurnProgressDeltaV1` basis member fed
by Phase 1's settle output. No new termination machinery is needed.


## Phase 2 addendum (commit 56db26772)

`ProgressBasis::TurnProgressDeltaV1` joined the closed set; the settle
fact carries the slice's four-dimension delta (`SettledBody.progress`),
the fold resets the stall counter on any nonzero dimension (facts
without the field stay mutation-only; `skip_serializing_if` keeps old
digests identical), the facade declares the delta basis, and the ledger
gained a slice accumulator (`take_slice_delta`). Battery 321/1 (the
single red still the pre-existing child_debt).

## GitHub issues closed this pass (2026-10-22 evening)

- #15 usage accounting rides `_meta` (f716889e4) — closed.
- #14 posture menu always opens on a closed-menu click (studio
  e04197651) — closed, Kylin retest requested.
- #10/#16 kylin glibc-2.31 archive — the concurrent lane's 4854bfbf5
  shipped `aster-cli-v0.1.2-kylin.tar.gz`; both closed as completed.
- #13 /app read-only — root-caused to the flatpak prefix (commented);
  the fix lane (writable WORKDIR mapping) stays open in that thread.
Live open-issue inventory after this pass: zero.


## Real-LLM e2e (tui_913, Layer C gate)

First run failed before any model call: the user ACL still named the
`workbuddy` import whose closed-set member the removal commit deleted,
making the whole ACL unloadable (`CodeConfig::from_file` refused —
fail-closed, correctly). Fixed the user's two ACL layers to the live
set (`import_accounts = ["codex"]`) and reran. NOTE for the removal
lane: any user ACL carrying `workbuddy` now hard-fails config load; a
migration note belongs in the release changelog.


## Real-LLM e2e FINAL (passed)

`A3S_CONFIG_FILE=~/.a3s/config.acl cargo test -p a3s-code-acp --test
tui_913_real_llm real_llm_tui_turn_shows_assistant_text -- --ignored
--test-threads=1 --nocapture` → **1 passed / 0 failed in 27.78 s**.
The Layer C gate drove the real TUI binary + ACP companion against the
live gateway/prism-27b provider (the user's qwen3.8-27B endpoint) with
the P0/P1/P2 core: a real model turn completed end to end — assistant
text visible in the pty, workspace sentinel intact, turn terminal.
Operational note: a concurrent workspace `cargo check` had stalled at
0% CPU holding the build lock; it was cleared to unblock the queued
test (16 min lock wait, then 28 s to green).


## BYO embedding refactor verification (2026-10-23, commit 85a811512)

The product dropped its a3s-use-bge edge: the trusted local_cpu opt-in
resolves through register_embedding_provider (host-supplied factory); an
unregistered host gets the named refusal. Verification after the change:
BYO factory contract tests 2/0, lane battery (local_embedding +
session_open + retrieval_seam) 3/0, cargo check clean with chrono
restored (a rebase-ordering artifact briefly unlinked it — caught by the
first e2e attempt, fixed by the working-tree dep). **Real-LLM e2e on the
BYO build: tui_913 vs the live prism-27b gateway, 1 passed / 0 failed in
31.08 s** (assistant reply delivered end to end). The acp full-lib run
showed 353/3 with the 3 failures isolated to plugin process-supervision
tests that pass individually and on pristine HEAD (stash-probe 18/0) —
they fail only in combination with the concurrent session's in-flight
workspace-direct-file edits, which is that lane's integration point, not
the BYO refactor.
