# Native user forms in Aster

`ask_user_form` now reaches the existing terminal `ElicitationView` through
`a3s/form/request`. ACP includes the session ID, and the terminal rejects
requests for a session without a matching local view. Submit preserves typed
values; cancel and renderer errors return explicit tool errors.

The adapter uses the existing ACL parser without evaluating expressions. It
maps literal OpenUI input, textarea, select, checkbox, and slider fields into
the existing native controls. Container layout becomes a terminal field list.
The existing 32-field and 64 KiB bounds apply. Charts, metrics, dynamic
expressions, ambiguous references, and unsupported components are rejected
explicitly. This is not a complete OpenUI renderer.

Required OpenUI inputs reject blank text and unchecked required checkboxes.
Ordinary MCP schema semantics remain unchanged. While a blocking card owns
the keyboard, the event loop preserves navigation keys instead of merging
them with bracketed paste into a field value.

## Executed checks

- Core form contracts: 5 passed (`core.log`).
- Native form components and ordinary MCP validation: 28 pager and 41 tool
  tests passed (`native-components.log`).
- ACP form exchange and product-boundary contracts: 4 passed; minimal-mode
  authentication rendering: 6 passed (`protocol-and-minimal.log`).
- Six focused routing/input contracts passed, including refusing a form for
  an unrelated session (`session-routing.log`).
- A3S Test drove the built `aster` and `a3s-code-acp` against a local model
  fixture (`shipped-tui.log`, `result.json`):
  - Submit and validation: passed in 22.143 seconds. Empty required fields and
    an out-of-range number stayed open; valid string/number/boolean values
    reached the agent. The exit hint used `aster --resume`.
  - Cancel: passed in 2.429 seconds without a submitted-values result.
  - Unsupported form: passed in 2.394 seconds with an explicit rejection.
  - All scenario cleanup completed without an error.

The bounded VT evidence totals 40,272 uncompressed bytes and is archived as `.vt.gz`. The prior failed validation run
is retained as `failed-validation.json`; it exposed the navigation/paste
coalescing bug fixed here. Earlier fixture attempts also used unsupported
BackTab/space spellings in the test driver; the suite now uses supported
Up/Right keys.

The live test is opt-in because it requires A3S Test and built executables;
it was explicitly selected and executed locally. It uses no real provider
credentials, grants no execution permissions, and does not bypass the sandbox.
Windows/Linux interactive validation and a release are still outstanding.
