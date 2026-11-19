# T2026-11-19-main-pr-issue-triage

Scope: user `/k-yolo` — process every open `aster-ai-lab/aster` PR and issue with end-to-end verification.

Result: all 5 PRs and 9 issues were reviewed. Source fixes and regression evidence were delivered for #300, #301, #302, #304, #309, #310, #311, #312, #313, #314/#315, and #298. From #297 only the current menu-resize defect was ported. Conflicting draft #233 and the obsolete remainder of #297 were not merged or claimed.

Evidence of record: `docs/evidence/code/2026-11-19-main-pr-issue-triage/OUTCOME.md` (full commands, counts, and limits).

Observed:
- Pair delivery 19 + identity 3 + release workflow 18 passed.
- Structured output 6 passed; headless 40 and reducers 84 passed.
- Marketplace 151 passed; local/update symlink cases passed.
- Linux Docker Cursor import 9 passed, 2 live ignored.
- Updater 21 passed and Clippy passed.
- Studio product 11 and delivery 25 passed.
- Stdio 3 and unattended E2E 33 passed.
- UI 14 tests and TypeScript check passed.
- Main-workspace Clippy completed with existing warnings.

Not green / not verified: two persistent ACP failures plus one parallel-only `knowledge.busy`; six MCP transport failures; one existing Capture process-cleanup failure; full-repository format/diff has unrelated existing drift. No Windows installer/GUI, live provider, commit, push, merge, or remote close.

Remaining overall goal gap: release qualification and cross-platform/desktop matrix; retained failures must be fixed or explicitly held. % != Pass.


## Final closure

- ACP: 548 passed, 0 failed, 10 ignored.
- Workspace handle: 232 passed, 0 failed.
- Capture: 392 passed, 0 failed, 1 ignored.
- MCP header corrected to valid `X-Aster-Agent-ID`; six former failures closed.
- Invalid pre-analysis fixtures corrected; fifth resumed streaming request and per-turn call counts verified.
- Plugin startup timeout hardened to 10s without changing cancellation assertions; wiki fixtures isolated by unique scope.
- All 14 GitHub items received a factual reply and remain open. Windows installer/GUI remains unverified; #233 and #297 conflicting remainders are not merged.


## Split commits and blocked Windows validation

Parent commits: `2eab42419`, `8c97eb802`, `7b9e5185d`, `4ab8a452f`, `3ace87e73`, `43dce4eed`, `82b72c720`.
Studio commit: `a970022311` (signed + DCO; only two tenant files).
DSH pre-staged changes were preserved and are not in the Studio commit.

#311 is blocked: `win-gates` closes SSH during identification on every attempt. No Windows installer was built or started. No local Windows image is available. No push or parent gitlink bump.


## Mainline closure

Pushed parent main through `0beb6f6d8` and Studio main `a970022311`.
Closed issues #300/#301/#302/#304/#309/#312/#313/#315 and superseded PRs #310/#298/#314.
Issue #311 stays open pending actual Windows installer launch. PRs #233/#297 stay open for their unreviewed remainder.
