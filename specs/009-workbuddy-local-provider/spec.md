# Feature Specification: WorkBuddy local provider (TUI + Desktop)

**Feature Branch**: none (main)

**Created**: 2026-10-22

**Status**: Draft (amended 2026-10-22: seamless one-click session; see research.md history)

**Input**: User description: "让 Aster Desktop 和 Aster TUI 都能直接加载和使用本机已经登录的 WorkBuddy 的模型"

**Gate context**: Product regime. `crates/code/core` + `crates/code/acp`
(TUI lane), `apps/aster` (login command), `apps/studio` (derived
provider), one visibility widening in the vendored `a3s-code-login`
storage and one subcommand variant in the vendored pager CLI enum.

## Prior research (2026-10-22, this repository's memory)

- WorkBuddy desktop tokens are `$wbEncrypted` and are never read
  (measured; rejected path).
- Backend: `https://copilot.tencent.com/v2` OpenAI chat-completions with
  native tools. Device flow (measured 2026-10-22):
  `POST /v2/plugin/auth/state?platform=CLI` → `{code, data:{state,
  authUrl}}` (live probe, HTTP 200); token poll
  `GET /v2/plugin/auth/token?state=` (route measured from the WorkBuddy
  5.8.3 CLI bundle); the token payload's field names are NOT measured —
  the client accepts the closed candidate set {access_token,
  accessToken, token} and refuses naming the payload keys it saw.
- Model catalog: measured from the WorkBuddy 5.8.3 CLI product manifest
  (chat models with declared token ceilings).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log in to WorkBuddy from aster (Priority: P1)

`aster login-workbuddy` creates a plugin auth state, prints the approval
URL, polls for the token, and stores the credential under the
`workbuddy` scope of `~/.a3s/auth.json` through the shared login storage
(0600, owner-only, other scopes untouched).

**Why this priority**: nothing works without a credential, and the
desktop's own store is not importable.

**Independent Test**: acp importer tests cover the store side
(scope/expiry/endpoint). The HTTP flow itself is interactive by design
(user approves in a browser); its parsing is fail-closed and prints the
payload keys when refusing, so the first real login pins the unmeasured
field names.

**Acceptance Scenarios**:

1. Given a live approval, the credential lands in auth.json with
   expiry, and repeated logins replace only the `workbuddy` scope.
2. Given an unrecognized token payload, the command refuses, prints the
   seen keys, and exits nonzero — no partial store.

### User Story 2 - TUI uses the models (Priority: P1)

A launch that opts in (`import_accounts = ["workbuddy"]`) gets provider
`workbuddy` with the measured model catalog against the fixed base URL;
`/models` lists them; `workbuddy/auto` is the default model.

**Why this priority**: the TUI is one of the two named surfaces.

**Independent Test**: `a3s-code-acp --lib workbuddy` — live entry
imports the catalog with the fixed endpoint, expired/missing entries
import nothing, the disable env works, disk state can never redirect the
endpoint.

**Acceptance Scenarios**:

1. Given a live login and the opt-in, `workbuddy/*` models appear and
   are selectable; requests go to `https://copilot.tencent.com/v2` with
   the bearer token.
2. Given no login or an expired one, the import is a no-op (never an
   error, never a stale provider).

### User Story 3 - Desktop uses the models (Priority: P1)

While a live login exists, the settings provider list shows a derived
`WorkBuddy` entry (no token persisted anywhere in providers.json); a
session selecting it resolves credentials at launch time — key, base
URL, and the `X-User-Id` header — into the generated session ACL.

**Why this priority**: the desktop is the other named surface.

**Independent Test**: studio lib tests — live entry lists the provider
and resolves credentials with the header; absent/expired lists nothing;
editing the derived provider refuses with `workbuddy_derived`; the
launcher renders the headers block.

**Acceptance Scenarios**:

1. Given a live login, `WorkBuddy` appears in 模型服务 with its models
   and can be selected; sessions run through the resolved credentials.
2. Given no live login, nothing appears and nothing breaks.
3. Given an attempt to edit/delete the entry in settings, the store
   refuses with the named reason.

## Edge Cases

- Expired credential: both surfaces fail closed to absent (TUI no-op
  import, desktop no listing) and the login command says so.
- Hostile auth.json entry naming a `base_url`: ignored — the endpoint is
  a constant on both surfaces.
- `A3S_DISABLE_WORKBUDDY_ACCOUNT=1`: TUI import off regardless of ACL.
- Concurrent login writes: the shared login storage's atomic 0600 write
  path is the only writer.

## Requirements *(mandatory)*

- **FR-001**: The login MUST store only under the `workbuddy` scope with
  an expiry, and MUST refuse an unrecognized token payload, printing the
  payload's keys, rather than guessing a field.
- **FR-002**: The TUI import MUST fix the endpoint to
  `https://copilot.tencent.com/v2`, MUST refuse expired credentials,
  and MUST NOT read any endpoint or model source from disk state.
- **FR-003**: The desktop MUST NOT persist the WorkBuddy token; the
  provider entry exists only while the login is live, credentials
  resolve at session launch, and edits refuse with `workbuddy_derived`.
- **FR-004**: The WorkBuddy desktop app's own stores MUST never be read
  (`$wbEncrypted` or otherwise).
- **FR-005**: `X-User-Id` rides the request headers when the login
  record carries a user id, through both the TUI provider headers and
  the desktop session ACL.

## House Checklist *(mandatory)*

- [x] New behavior has a small hermetic test in the owning package
      (acp `workbuddy_account`, studio `providers`/`launcher`)
- [x] Closed sets: `AccountImport::Workbuddy` extends the closed enum;
      the token-payload field set is a closed candidate list
- [x] No production `unwrap()`/`expect()` in the new modules
- [x] Internal `a3s-*` dependencies stay on paths in this repository
- [x] No new ACL configuration surface (reuses `import_accounts` and the
      session ACL provider block, both already `a3s-acl`-parsed)
- [x] Evidence target: `docs/evidence/desktop/2026-10-22-workbuddy-local-provider/OUTCOME.md`

## Success Criteria *(mandatory)*

- **SC-001**: `cargo test -p a3s-code-acp --lib -- workbuddy` green.
- **SC-002**: `cargo test -p a3s-studio --lib -- workbuddy render_config` green.
- **SC-003**: `cargo check -p aster` green with the new command.
- **SC-004**: The first interactive `aster login-workbuddy` run by the
  user completes and both surfaces list the models (recorded in the
  evidence; the interactive approval is the user's step).

## Assumptions

- The token payload field is one of the three candidates; if not, the
  named refusal reports the real keys and the constant list is pinned to
  the measured name in a one-line follow-up.
- The static catalog refreshes by editing the twins (acp + studio) when
  WorkBuddy ships new models; a live model-list fetch is deferred.
- TUI default-on is NOT claimed: `import_accounts` stays an explicit
  opt-in (host-trust boundary unchanged).

## Explicitly Not Claimed

- No refresh of an expired WorkBuddy token (re-login is the path).
- No WorkBuddy desktop-app state is read or imported.
- No live model-list endpoint integration; the catalog is the measured
  static seed.
- No moderation/false-positive probing of the backend (the memory's P0
  risk): the first real session is the probe.
