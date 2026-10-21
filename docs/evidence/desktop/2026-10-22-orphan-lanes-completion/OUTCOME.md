# Orphan lanes completion — outcome

Date: 2026-10-22. The session that owned these lanes died mid-flight on
2026-10-22; this landing verifies and commits its working tree per lane,
following the owner's triage order. Studio submodule first (11 signed
commits), then the parent commits that carry the crates, guards, spec
maintenance, and the studio gitlink.

## Lane disposition

| Lane | Verdict | Studio commit | Verification |
| --- | --- | --- | --- |
| Review-anchor test alignment (pre-existing red on main) | fixed | `108cd04fa` | reviewAnchors 2/2 |
| B knowledge compile (renderer + host) | landed | `53baa3f96`, `65f9da60f` | vitest green; okf personal:: 22/0; studio battery 11/0 |
| A CUA / computer use (+ dock-skill shared native) | landed | `efd21e0b7` | studio battery 11/0 (computer_use filters); e2e py 30/30 |
| Packaging locked binaries | landed | `85caf9f5a` | workspace_dependencies 6/6 (darwin uchg checks) |
| D task conversation (proof artifacts, product download) | landed | `97a395066` | vitest green in the 465-test batch |
| E documents failure counts | landed | `a575ba47f` | vitest green |
| Preferences visibility (A ripple) | landed | `5a0bdb3d1` | covered by agent-plane tests |
| Workbench deliverable directive | landed | `ec23d1fd4` | workbenchHomeCapabilities tests green |
| F dev tooling (studio) | landed | `ebb8abcb0` | scripts project suite; `just dev` in live use |
| i18n strings for the lanes | landed | `c01ac59d9` | locale JSON validated |
| B crates/okf (parent) | landed | `ce1998971` | 22/0 + 11/0 |
| Posture/research policy (parent, dock-skill lane) | landed | `4d2ac56e2` | core 311/0; acp 15/0 |
| F guards (parent) | landed | this commit's series | just_work 11 OK; workspace_dependencies 6 OK |

specs/001 T019–T021 have **no** orphan code in this tree — nothing of them
was started; they remain open tasks. specs/004 T012 is reworded to the
2026-10-22 parity directive (specs/007).

## Commands and counts (2026-10-22)

- Renderer vitest, targeted per-lane files: 465 passed / 1 failed /
  1 skipped. The single failure (`数据 ActivityBar` SQLite child engine)
  is environmental and pre-existing — proven by re-running with the
  renderer tree stashed to HEAD.
- `cargo test --locked -p a3s-okf --lib personal::` → 22/0.
- `cargo test --locked -p a3s-studio --lib -- computer_use
  knowledge_compile_session personal_report dock_reopen_shows_the_main_window
  hides_on_close_only_when_the_tray_is_on model_list_urls_follow_the_catalog_base`
  → 11/0 (902 filtered).
- `cargo test --locked -p a3s-code-core --lib -- fact_control permissions`
  → 311/0.
- `cargo test --locked -p a3s-code-acp --lib -- host_context research posture`
  → 15/0.
- `python3.13 -m unittest cua_guard_test window_runtime_test` → 30/30.
- `python3.13 tests/just_work.py` → 11 OK (1 skip);
  `python3.13 tests/workspace_dependencies.py` → 6 OK after dropping the
  retired apps/work paths (apps/work was never committed to this repo;
  specs/004 T014 retires it).

## Test repairs on pre-existing red

- `reviewAnchors.test.ts` expected the pre-afa2a468c author 风险; the
  committed contract authors imported comments as 合同审查. Aligned.
- `tests/workspace_dependencies.py` required apps/work fixture files that
  no longer exist anywhere in this repository's history; dropped from the
  required list.

## Environment finding (not claimed as code debt)

A broad renderer suite run shows 98 failures across settings/MCP and
other pages from a **dual React instance**: studio resolves
react@19.3.0 via its own pnpm store, while workspace-linked packages
(`@a3s-lab/ui` → root bun workspace) resolve react@19.3.1 and
react-hook-form@7.90.0 from the repository root's bun install
(`node_modules/.bun`, reinstalled recently — an `.old_modules-*` backup
sits beside it; a TypeScript server process holds ~292 handles there).
No dependency was changed by this landing; the targeted suites above do
not cross the poisoned resolution path. The root-workspace install state
is environment debt to repair separately (pin/lockfile the root bun
workspace or fence studio's resolver).

## Explicitly not claimed

- The dual-React resolution repair; the root node_modules was in active
  use by another process and was left untouched.
- Live `just dev` / `just dev:toyou` screenshots (specs/007 SC-003,
  owner-run).
- specs/001 T019–T021 (never started), specs/003 T006/T008/T010 and
  specs/004 T006/T014 verification gates (need real builds/interactive
  runs).
- `.workbuddy/` and `tests/T01/output/` stay untracked (tool memory and
  a test artifact).
- No pushes; every commit is local and unsigned-pushed nothing.
