# Tasks: WorkBuddy local provider (TUI + Desktop)

**Input**: Design documents from `specs/009-workbuddy-local-provider/`

**Prerequisites**: spec.md (required)

**House rule**: every task that changes behavior carries its hermetic
test in the same task.

## Phase 1: TUI lane

- [ ] T001 Closed set: `AccountImport::Workbuddy` (parse/as_str/ALL) in
      `crates/code/core/src/config/account_import.rs`.
- [ ] T002 Importer `crates/code/acp/src/workbuddy_account.rs` (fixed
      endpoint, static measured catalog, expiry skip, disable env,
      scope-keyed store read) + hermetic tests.
- [ ] T003 Dispatch: `config.rs` arm + `lib.rs` gated module.
- [ ] T004 Engine: `"workbuddy" | "codebuddy"` in the OpenAI arm of
      `crates/code/core/src/llm/factory.rs`.

## Phase 2: Login

- [ ] T005 `apps/aster/src/workbuddy_login.rs`: device flow (measured
      state creation; closed-candidate token fields with named refusal;
      account fetch best-effort; store via the shared login storage).
- [ ] T006 Widen `a3s-code-login` storage `write_auth_json` to pub (one
      writer implementation for every scope).
- [ ] T007 CLI surface: `LoginWorkbuddy` variant in the vendored pager
      enum + main.rs arm; `cargo check -p aster` green.

## Phase 3: Desktop lane

- [ ] T008 `providers.rs` workbuddy module: live-entry reader
      (A3S_WORKBUDDY_HOME seam), credentials with X-User-Id, synthesized
      list entry; execution_credentials arm; list() append; update
      refusal `workbuddy_derived`; hermetic tests.
- [ ] T009 `ProviderCredentials.headers` + launcher `render_config`
      headers emission (ACL object syntax, parser accepts `=`).
- [ ] T010 `.gitignore` gains `.workbuddy/` (the desktop agent's own
      memory dir at the repo root).

## Phase 4: Evidence and closure

- [ ] T011 `docs/evidence/desktop/2026-10-22-workbuddy-local-provider/OUTCOME.md`
      with commands, counts, and the honest interactive-login boundary.
- [ ] T012 Commits (root lane; the concurrent Codex lane's shared-file
      additions ride with attribution where unavoidable), spec status →
      Landed, memory updated.
