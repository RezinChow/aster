# Implementation Plan: WorkBuddy local provider

**Branch**: none (main) | **Spec**: [`specs/009-workbuddy-local-provider/spec.md`](spec.md)

**Gate context**: product regime (`crates/code`, `apps/aster`,
`apps/studio`); two surgical touch-points in vendored terminal crates
(login storage visibility, pager CLI enum variant).

## Summary

Aster owns a WorkBuddy credential end to end (`aster login-workbuddy`
device flow → `~/.a3s/auth.json` scope `workbuddy`). The TUI imports the
measured catalog as provider `workbuddy` through the existing
account-import seam; the desktop derives the provider listing from the
live credential and resolves key/base-URL/X-User-Id into the session ACL
at launch through the existing launcher-credentials seam. No WorkBuddy
desktop state is read; no token is persisted on the desktop side.

## Constitution Check

| Principle | Status | Evidence in the plan |
| --- | --- | --- |
| I. Fail closed | PASS | Expired/missing ⇒ absent on both surfaces; unrecognized token payload refuses naming its keys; derived-provider edits refuse `workbuddy_derived`; endpoint is a constant |
| II. Evidence retained | PASS | `docs/evidence/desktop/2026-10-22-workbuddy-local-provider/OUTCOME.md` |
| III. Hermetic tests | PASS | acp importer tests + studio provider/launcher tests; the interactive approval is the only non-hermetic step and is the user's |
| IV. Closed sets | PASS | `AccountImport` stays closed; token field candidates are a closed list with named refusal |
| V. One workspace / published APIs | PASS | No new crates; vendored edits are one visibility widening + one enum variant |
| VI. Local schema changes | N-A | No database |
| VII. Shrink-only ratchets | N-A | |
| VIII. Replaceable transports | PASS | Rides the existing OpenAI client arm; no new engine |
| IX. One configuration language | PASS | Reuses `import_accounts` and the session ACL provider block (a3s-acl) |
| XIII. One repository | PASS | |
| XIV. Names are not guessed | PASS | Endpoints measured from the WorkBuddy CLI bundle + a live probe; the one unmeasured payload is refused-with-keys instead of guessed |
| XV. Meaning is not matched | N-A | |
| XVI. Pickers are drawn | N-A | |
| XVII. Dialogs stay in place | N-A | |

## Verification Plan

1. `cargo test -p a3s-code-acp --lib -- workbuddy`
2. `cargo test -p a3s-studio --lib -- workbuddy render_config`
3. `cargo check -p aster`
4. User's interactive `aster login-workbuddy` (recorded in evidence).

## Architecture decisions (recorded for review)

- Login flow lives in `apps/aster` (product binary owns vendor flows);
  the shared login crate gains only a pub widening of its existing
  atomic writer — no vendor specifics leak into shared crates.
- Desktop does NOT use `import_accounts` for this: the host supplies the
  provider through the existing per-session credentials seam
  (`execution_credentials` → generated ACL), which is the designed path
  for host-known providers; the sidecar import seam remains the TUI's
  opt-in path. Each surface uses its own existing extension point.
- The model catalog exists as two twins (acp runtime, studio listing)
  with cross-reference comments; the sidecar is a process boundary, and
  a shared crate for one constant table would cross it for no gain.
