# T2026-11-19-studio-dsh-removal

Removed Studio's existing DSH Agent runtime and DeepSeek Harness Code CLI
support: schemas, capabilities, controllers, config, resources, cache, presets,
launchpad, tests, and regression cases. No helper deletion was applied because
`clean-plan.json` contained an empty delete set.

Verification: focused suites 82/82; launchpad remainder 12/12; i18n 25,266
passed; `cargo check -p aster-studio` passed; targeted format and diff checks
passed. The other 8 launchpad failures also occurred on the original code and
are pre-existing. Full TypeScript/build/product acceptance is not claimed.
Review collector could not fingerprint the dirty Studio submodule.

Full record: `docs/evidence/code/2026-11-19-studio-dsh-removal/OUTCOME.md`.
Token/USD usage unavailable.
