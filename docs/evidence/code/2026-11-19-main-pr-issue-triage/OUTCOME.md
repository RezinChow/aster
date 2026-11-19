# Main-repository PR and issue triage

Updated: 2026-11-19

## Scope

Reviewed all five open PRs and all nine open issues in `aster-ai-lab/aster` at
base `58be47b06655b193779e09ed14f314b9b4f08f0a`. Existing working-tree changes
were preserved. No branch, worktree, commit, push, merge, or remote close was
performed.

## Source changes and observed verification

| Item | Result | Evidence |
| --- | --- | --- |
| PR #310 | Ported NUL source manifests; empty, absolute and parent paths fail closed. Existing Git enumeration remains. | `python3 tests/cli_pair_delivery.py -v`: 19 passed. `python3 tests/cli_pair_identity.py -v`: 3 passed. `python3 tests/cli_release_workflow.py`: 18 passed. |
| PR #298 | Kept macOS modules in place; exposed portable metadata and the non-macOS `LiveOverlayEvent` contract. Did not use the PR's incompatible module split. | `cargo test -p capture aster::tests`: 6 passed. Linux `cargo check -p capture --lib --target x86_64-unknown-linux-gnu`: passed. Remaining macOS suite: 391 passed, 1 ignored, 1 filtered known process-cleanup failure. |
| PR #314 / issue #315 | Primary model receives the schema; only its original validated answer is returned. Invalid output and denied tools produce `structuredOutputError`, without a repair model. | `cargo test -p aster-acp --lib structured_output`: 6 passed, including nested evidence, denial and no-second-call assertions. |
| PR #297 | The old patch does not apply to the current UI architecture. Ported only the still-present menu resize defect to `PopupHighlight`; did not port the conflicting Studio/UI rewrite. | Vitest popup-highlight and dropdown-menu: 14 passed across root and mirrored projects. UI `tsc --noEmit`: passed. |
| PR #233 | Reviewed but did not merge the conflicting draft or its retained failures/test changes. No wholesale replacement of current Core/ACP behavior. | `account_import_opt_in_stdio`: 3 passed. `unattended_e2e`: 33 passed. Full ACP library: 545 passed, 3 failed, 10 ignored; see limits. |
| Issue #313 | Local recursive copies skip file, directory and dangling symlinks. | Full marketplace: 151 passed. Focused local suite: 8 passed, including the real transactional update path. |
| Issue #312 | Final client-file read/write/create operations use a `cap-std` directory capability rather than reopening an unchecked absolute path. | Deterministic file/directory swap regression: 1 passed. Handle suite: 226 passed, 6 MCP transport failures; see limits. |
| Issue #311 | Selected tenant resources are now present in generated Tauri resource maps. | `studio_product_test.py`: 11 passed. `studio_delivery_test.py`: 25 passed. |
| Issue #309 | Added shared `outcome`/`terminalReason`, structured provider classification and fail-closed process outcomes while retaining existing envelopes. | Headless: 40 passed. Streaming reducers: 84 passed. Covers completion, cancellation, max-turns/tokens, refusal, structured failure and typed provider errors. |
| Issue #304 | Linux reads Cursor CLI `accessToken` from XDG config or `~/.config/cursor/auth.json`; IDE fallback uses the platform path. macOS keychain behavior is unchanged. | Real Linux Docker test: 9 passed, 2 live ignored, including credential non-leakage. Existing macOS tests: 8 passed, 2 live ignored. |
| Issue #302 | Verify the original release archive digest before extraction/replacement. Missing digest remains compatible; malformed/mismatched digest fails. | Updater: 21 passed and Clippy passed. |
| Issue #301 | Mark directory activation committed before backup cleanup so cleanup failure cannot restore an incomplete old directory. | Updater: 21 passed, including injected partial-cleanup failure. |
| Issue #300 | Release metadata requests have the same 300-second bound as downloads. | Updater: 21 passed, including a stalled-server timeout test. |

The standalone updater is not a root-workspace member. Its tests and Clippy were
run against an isolated copy under `target/updater-check` with its own lockfile;
no second repository or workspace was added to the product tree.

## End-to-end and lint commands

- `cargo test --locked -p aster-acp --test account_import_opt_in_stdio --test unattended_e2e` — 36 passed total.
- Docker `rust:1.97.1`, read-only source mount, isolated target:
  `cargo test --locked -p aster-acp --lib cursor_account::tests` — 9 passed, 2 ignored.
- `cargo clippy --locked -p aster-acp -p aster-pager -p aster-workspace -p capture -p aster-plugin-marketplace --all-targets --no-deps` — completed successfully; existing warnings remain.
- `packages/ui/node_modules/.bin/tsc --noEmit -p packages/ui/tsconfig.json` — passed.
- Scoped `git diff --check` for all changed product files — passed.

## Explicitly not claimed

- No remote PR was merged and no issue was closed; all remained open at the final `gh` check.
- No Windows installer or Studio GUI was built or run. The Windows Capture cross-check stopped in the existing `transcribe-cpp-sys` Visual Studio requirement; Linux portable compilation passed.
- No live Cursor account or paid provider request was used.
- The full ACP suite is not green: engineering configuration and reasoning transport still fail in isolation; `knowledge.busy` failed only in the parallel run and passed alone.
- The workspace handle suite is not green: six MCP transport tests fail in both parallel and serial runs. The deterministic confinement regression passes.
- Capture's pre-existing `stdout_held_outside_the_group_is_closed_when_capture_gives_up` still fails its three-second assertion. It was not hidden: the full run reported 391 passed, 1 failed, 1 ignored; the follow-up suite filtered only that named test.
- Full-repository `cargo fmt --all -- --check` still reports unrelated existing drift. Full `git diff --check` also stops on an existing `.kstudio/skills/README.md` trailing-space line. Changed-file checks passed.
- PR #233 and the unported portions of PR #297 are not accepted or claimed as delivered. This campaign does not claim overall Meta Harness completion or product Pass.

## Remaining gap

Release qualification remains: commit and review the source changes through the
normal workflow, produce and launch a Windows installer containing the selected
tenant assets, resolve or explicitly hold the retained ACP/MCP/Capture failures,
and run the required desktop and cross-platform release matrix.


## Final closure and per-item replies

The remaining failures were resolved after the first evidence snapshot:

- Corrected the invalid MCP Agent HTTP header name to `X-Aster-Agent-ID`; the six transport failures now pass and the handle suite is **232 passed, 0 failed**.
- Corrected two fixtures that returned schema-invalid pre-analysis responses, which had caused repeated repairs and hidden the actual contracts. The engineering session now verifies two analysis and two primary calls; reasoning resume verifies the fifth streaming call and one analysis per turn.
- Kept the full cancellation assertions while allowing 10 seconds for actual plugin process startup under full parallel load.
- Isolated wiki fixtures with unique knowledge scopes instead of letting parallel tests lock the same publication.
- Capture required no product change. Its prescribed two-thread full suite is **392 passed, 0 failed, 1 ignored**, including the former three-second process-cleanup case.
- Final ACP library result: **548 passed, 0 failed, 10 ignored**.
- `aster-mcp` and `aster-acp` Clippy completed with existing warnings.

All 14 items received a factual GitHub reply. The comments report workspace verification, not merged or released status:

| Item | Comment |
| --- | --- |
| PR #233 | 7011766233 |
| PR #297 | 7011765155 |
| PR #298 | 7011763057 |
| Issue #300 | 7011731199 |
| Issue #301 | 7011732032 |
| Issue #302 | 7011732914 |
| Issue #304 | 7011733698 |
| Issue #309 | 7011734433 |
| PR #310 | 7011762240 |
| Issue #311 | 7011744576 |
| Issue #312 | 7011745512 |
| Issue #313 | 7011746597 |
| PR #314 | 7011763948 |
| Issue #315 | 7011747504 |

Final `gh` inspection confirmed all five PRs and nine issues remain open. No merge, close, commit, or push was performed. Windows installer/GUI verification remains outstanding. PR #233 and the conflicting remainder of #297 still require rebase and split review.
