# Main-branch submission — 2026-10-21

## Result

The user explicitly requested committing, merging and pushing the completed
serving work to remote `main`. The Gateway feature commit is
`1c0a48df`; it was merged without conflicts with Aster `origin/main`
`db176434c4956e0f115a916791eaf4f856265cfc` in `cfc9b9d4`.
This follow-up pins the Power submodule to its actual compatibility commit,
so the source is available as code rather than only retained deployment patches.

Power commit `d9f6acfba5221f1db3fde378b4b6fd26ec7fbf50` was pushed normally to
`A3S-Lab/Power` `main` and verified using `git ls-remote`. It combines the
initial three-field adapter and final twelve-field correction on the existing
Power main-line base `dd3fc72`, preserving strict unknown-field, duplicate,
tool-history and accounting behavior. Aster publication uses a normal
fast-forward push after the merge; no force push is needed.

The earlier qualification pages remain historical records of their uncommitted
deployment state. This submission does not rebuild or restart production.

## Verification

- Power: `cargo test --locked --no-default-features --features server --lib`
  on the committed main-line candidate: **1966 passed,0 failed**.
  [Full log](power-main-submit-tests.log).
- Gateway after merging the latest Aster main:
  `cargo test --locked -p a3s-gateway --lib prefix_ -- --test-threads=8`:
  **42 passed,0 failed**. [Log](gateway-main-submit-tests.log).
- Owner formatting and source whitespace checks passed. Existing global
  format/full-library baseline failures remain recorded in the
  [serving acceptance](../2026-10-21-cost-scheduling/OUTCOME.md).
- Actual Gateway/Power process secrets were checked in memory against the
  staged files. Retained evidence hashes were also checked against Git's index.
  The Gateway evidence directory now preserves bytes across platforms, matching
  the existing Power evidence convention; raw patches and logs were not rewritten
  to satisfy source whitespace rules.
- Main-worktree staged and unrelated edits remain intact. Power's unrelated
  local planning commit was not included in the compatibility submission.
  Git's shared Studio `core.worktree` update during submodule checkout was
  repaired with separate per-worktree configuration; both Studio directories
  and the original dirty main-worktree state were verified afterward.

## Explicitly not claimed

An all-green global workspace; a new deployment; inclusion of unrelated staged
work; complete DeepInfer/native KV-transfer support; or modifications to private
Studio, API or Cloud source. Their existing published submodule revisions are
preserved from remote main.
