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
