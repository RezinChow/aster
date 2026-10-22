# WorkBuddy local provider — outcome

**Status 2026-10-22 (later same day): REMOVED.** Commit `288e53a3b`
removed the whole integration — importer, login module, TUI hook,
spec 009 — after the desktop-first `f980979ec`/`a3358fd88` bumps. The
seamless-session design lives in history (`7da14b84b`, `90382ba70`) and
the measured endpoint/local-state survey in this file remains valid for
any future rebuild. The narrative below is the pre-removal record.

Date: 2026-10-22. Spec: `specs/009-workbuddy-local-provider/`. Product
regime. Placeholder counts; filled when the batteries land.

## Result

PLACEHOLDER.

## What landed

- TUI lane: `AccountImport::Workbuddy` (closed set), the
  `workbuddy_account` importer (fixed endpoint
  `https://copilot.tencent.com/v2`, the catalog measured from the
  WorkBuddy 5.8.3 CLI manifest, expiry skip, disable env, scope-keyed
  store read, disk state can never name the endpoint), the config
  dispatch, and the OpenAI factory arm.
- Login: `aster login-workbuddy` (`apps/aster/src/workbuddy_login.rs`) —
  measured device flow (state creation probed live 2026-10-22: HTTP 200
  `{code, data:{state, authUrl}}`; token poll route from the WorkBuddy
  CLI bundle), closed-candidate token fields with a named refusal
  printing the payload keys, best-effort account fetch, storage through
  the shared login writer (pub-widened `write_auth_json`, 0600 atomic),
  `~/.a3s/auth.json` scope `workbuddy` only.
- Desktop lane: derived provider in `providers.rs` (live entry gates the
  listing; credentials resolve at session launch with `X-User-Id`;
  edits refuse `workbuddy_derived`), `ProviderCredentials.headers`
  through the launcher's generated session ACL (`headers = { "K" = "V" }`,
  parser accepts `=`), and the picker entry while logged in.
- `.workbuddy/` (the WorkBuddy desktop agent's own memory) is gitignored;
  none of WorkBuddy's own stores is ever read.

## Validation

PLACEHOLDER.

## Explicitly not claimed

- The interactive approval (browser) is the user's step; the token
  payload's exact field name is unmeasured and the client refuses with
  the seen keys rather than guessing — the first real login pins it.
- No token refresh; re-login is the path for expiry.
- No live model-list fetch (static measured catalog; twins in acp and
  studio carry it).
- No moderation/false-positive probe of the backend; the first real
  session is that probe.
- The TUI import stays opt-in (`import_accounts`), not default-on.
