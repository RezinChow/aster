
## Amendment 2026-10-22 (architecture directive: 用户无感)

- BYOK wording superseded: WorkBuddy issues no API keys (user-confirmed), so
  the seamless design is aster's OWN plugin-lane session via the sanctioned
  device flow: TUI startup (when `import_accounts` opts in) reads the shared
  `workbuddy` scope, silently refreshes via `POST /v2/auth/token/refresh`
  (X-Refresh-Token + X-Auth-Refresh-Source: plugin — route measured from the
  WorkBuddy CLI bundle), and only on first use opens the approval URL for the
  user's single consent click. The credential is issued TO aster; WorkBuddy's
  encrypted stores stay untouched.
- Desktop and TUI share the store, so both surfaces are usable the moment
  the session exists. A desktop-first trigger twin (studio-side ensure) is
  the one open follow-up for users who never launch the TUI.
- Measured local-state survey (masked, no values read): desktop
  `workbuddy-desktop.info` keeps access/refresh in `$wbEncrypted` envelopes
  (3248/1408 chars); `~/.workbuddy/keyblob` is a wrapped-key structure
  (`slots[].wrapped` 216 chars, protector elsewhere); `workbuddy.db` has no
  credential table. Confirmed: no plaintext local login state to reuse —
  which is why the own-session design is the only seamless path.
