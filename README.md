# Aster

A Rust terminal coding tool built on the A3S Code harness. Run `aster` to
open the terminal interface; the accompanying `a3s-code-acp` process hosts
the agent loop, tools, permissions, memory, and model adapters.

## Build and run

Install Rust through rustup, a C/C++ build toolchain, CMake, and Protocol
Buffers (`protoc`). On macOS, install the Xcode command line tools. The
repository pins Rust 1.97.1 in `rust-toolchain.toml`.

```sh
cargo build --locked
./target/debug/aster --help
./target/debug/aster
```

With [just](https://github.com/casey/just) installed, build both binaries and
start the terminal in one command:

```sh
just code
just code --cwd /path/to/project
```

On macOS, `just work` opens the most recently compiled `.app` under
the workspace target directory, comparing executable modification times
across debug and release bundles in the root `target` directory and older desktop build directories. Build Work through its own packaging
workflow first. Work is a member of the same Rust workspace and shares its lockfile and build directory.

The welcome screen uses the Aster star-and-orbit logo as cached ASCII
animation frames, with compact artwork for smaller terminals.

The default workspace members build **both** executables into the same
directory. `cargo run -p aster` alone does not build the ACP companion;
run `cargo build --locked` first. A custom `CARGO_TARGET_DIR` also works.

```sh
cargo build --release --locked
./target/release/aster --cwd /path/to/project
```

To install from this checkout:

```sh
cargo install --locked --path crates/code/acp
cargo install --locked --path apps/aster
aster
```

Both binaries must be installed in the same directory. An explicit
`A3S_ACP_AGENT_BIN` can select another ACP executable.

## Work development

All A3S Rust libraries, including optional integrations, live in this checkout
and have `publish = false`. Work's Rust host is `apps/work/src-tauri`; its
frontend remains a pnpm workspace under `apps/work`. The patched OpenAI client
and Work PTY adapter are also in-tree. No sibling A3S checkout is required.

Linux Work builds also need the WebKitGTK, GTK, AppIndicator, librsvg, and
libxdo development packages listed in [CI](.github/workflows/ci.yml).
Install Node (the version range is in `apps/work/package.json`) and pnpm 12.6.0:

```sh
cd apps/work
pnpm install --frozen-lockfile
cd ../..
just build-work
```

`just build-work` builds ACP and Office before Work and bundles their current
executables into the desktop resources. To run the development window with
frontend hot reload, run `pnpm dev` in `apps/work`. On macOS,
`just build-work-release` runs Work's complete frontend and installer build;
`just work` opens the newest compiled app bundle.

Office's editor source is under `apps/work/vendor/packages/office`, with its
Rust engine under `crates/office`. The checked-in WASM kernel supports frontend
builds without a separate WASM compiler setup. To change the kernel, install
`wasm32-unknown-unknown` and run `pnpm --filter @a3s-lab/office kernel:build`
from `apps/work` before rebuilding Office.

## Models and configuration

Aster retains the existing ACL configuration and state paths for
compatibility. Configure a provider in `~/.a3s/config.acl` or point
`A3S_CONFIG` at an explicit ACL file. See
[`agent.example.acl`](crates/code/agent.example.acl). Credentials and
sessions are not copied from the source repository.

```acl
providers "openai" {
  base_url = "https://api.openai.com/v1"
  api_key = env("OPENAI_API_KEY")
  models "gpt-4.1" {}
}
default_model = "openai/gpt-4.1"
```

Provider credentials belong in the user configuration. Repository
configuration is untrusted and cannot override host security settings.
Use `/config` in the terminal to configure models. Source builds update
by rebuilding this workspace; the upstream binary updater is disabled.

The imported Core currently refuses native shell tools on macOS with
`native_process_lifetime_unqualified`. This upstream process-lifetime guard
is preserved. The terminal, model chat, and file tools can run; workflows
that need local shell commands require the native execution qualification.
See [validation results and limitations](docs/validation.md).

## Workspace

| Path | Role |
| --- | --- |
| `apps/aster` | Product CLI and terminal entry point |
| `apps/work/src-tauri` | Work desktop host |
| `crates/code/core` | Rust SDK, agent loop, tools, policy, harness composition |
| `crates/code/acp` | Standard ACP process boundary |
| `crates/terminal` | Pager, terminal rendering, and supporting Rust crates |
| `crates/effect` | Durable fact log and actor transitions |
| `crates/acl`, `crates/sandbox` | Configuration parser and native isolation |
| `crates/memory`, `crates/vec` | Durable memory and workspace retrieval |
| `crates/search`, `crates/browser` | Search adapters and browser contracts |
| `crates/use`, `crates/okf` | Extension reconciliation and knowledge contracts |
| `crates/flow`, `crates/flow-v2` | Compatible in-tree Flow engines for Code and Work |
| `crates/boot`, `crates/event`, `crates/orm` | Local service and persistence integrations |
| `crates/office`, `crates/ocr` | Office tools and local OCR |
| `crates/apofasi` | Typed decisions |

All members share one lockfile, resolver, and build directory. Internal
crate names retain `a3s-*` to preserve Rust API compatibility. Code's
Node/Python/Go SDKs and their release pipelines are absent. Python and
TypeScript files used as tool fixtures or test helpers are not SDKs.

## Development

The dependency-boundary check requires Python 3.11 or newer.

```sh
python3 tests/workspace_dependencies.py
cargo fmt --all -- --check
cargo check --locked --workspace --all-targets
cargo test --locked -p a3s-acl -p a3s-effect
cargo test --locked -p aster
cargo test --locked -p a3s-code-acp --test v912_seam
cargo check --locked -p a3s-code-core --features advanced-harness,deep-live
```

Real-provider and platform-specific qualification suites remain opt-in.
See [migration decisions and provenance](docs/migration.md). Upstream
manuals under `crates/code/manual` are retained as historical harness
references; their release and SDK distribution instructions do not apply
to Aster.
