# Aster CLI command names

The terminal product uses `aster`. Exit/resume hints, screen-mode recovery,
startup diagnostics, configuration-save hints, CLI help, and remediation
commands now use that executable. Bash, zsh, and fish completion scripts
register `aster`. The model's outcome-boundary example now names the existing
`aster sessions list` command instead of an unavailable skill-install command.

Internal package names, configuration paths, environment variables, and the
ownership markers for existing Doctor-managed configuration are preserved.

## Local verification

- Selected pager contracts: 124 passed, including parsing printed resume
  commands back through the CLI and preserving the session ID and screen mode.
- Command surfaces and diagnostics: 725 passed; see `commands.log`.
- Actual executable: eight help/completion checks passed; see `cli-smoke.json`.
  Bash and zsh completion output also passed their shell syntax checks.
- Thirteen isolated Doctor/wrap process contracts passed; see `doctor-process.log`.
- The actual TUI printed `aster --resume …` after a completed turn and `/quit`;
  see `resume.vt.gz`.
- Scoped formatting and `git diff --check` passed.

The affected CLI runtime sources contain no `a3s code` command text. Historical
upstream manuals and internal A3S identifiers have not been renamed.

This is local macOS validation. No release or cross-platform upgrade has been
qualified by this change.
