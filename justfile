# Build the TUI and its ACP companion into the same target directory.
[unix]
build:
    cargo build --locked

# Windows has no sh on PATH. powershell -File keeps the cargo exit code.
# An already-open terminal does not see a User PATH change, so point PROTOC
# at the installed compiler when `protoc` is not already resolvable.
[windows]
build:
    #!powershell.exe -File
    $knownProtoc = Join-Path $env:LOCALAPPDATA "protoc\bin\protoc.exe"
    $resolved = Get-Command protoc -ErrorAction SilentlyContinue
    if ($resolved) {
        $env:PROTOC = $resolved.Source
    } elseif (Test-Path -LiteralPath $knownProtoc) {
        $env:PROTOC = $knownProtoc
        $env:PATH = "$(Split-Path -Parent $knownProtoc);$env:PATH"
    }
    cargo build --locked
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Start the terminal, forwarding arguments without losing shell quoting.
[unix]
[positional-arguments]
code *args: build
    #!/usr/bin/env python3
    import json
    import os
    from pathlib import Path
    import subprocess
    import sys
    # A workspace .a3s/config.acl is untrusted unless the host names it.
    # Opt into that local file when the user has not already set A3S_CONFIG.
    if not os.environ.get("A3S_CONFIG"):
        acl = Path(r"{{justfile_directory()}}") / ".a3s" / "config.acl"
        if acl.is_file():
            os.environ["A3S_CONFIG"] = str(acl.resolve())
    metadata = json.loads(subprocess.check_output(["cargo", "metadata", "--locked", "--offline", "--no-deps", "--format-version", "1"]))
    executable = Path(metadata["target_directory"]) / "debug" / ("aster.exe" if os.name == "nt" else "aster")
    os.execv(str(executable), [str(executable), *sys.argv[1:]])

# powershell.exe -File is one shebang argument, so spaced arguments stay intact.
[windows]
[positional-arguments]
code *args: build
    #!powershell.exe -File
    $ErrorActionPreference = 'Stop'
    $metadataJson = & cargo metadata --locked --offline --no-deps --format-version 1 | Out-String
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $metadata = $metadataJson | ConvertFrom-Json
    $executable = Join-Path $metadata.target_directory 'debug\aster.exe'
    if (-not (Test-Path -LiteralPath $executable)) {
        [Console]::Error.WriteLine("Build did not produce $executable")
        exit 1
    }
    # A workspace .a3s/config.acl is untrusted unless the host names it.
    # Opt into that local file when the user has not already set A3S_CONFIG.
    if ([string]::IsNullOrWhiteSpace($env:A3S_CONFIG)) {
        $workspaceAcl = Join-Path "{{justfile_directory()}}" ".a3s\config.acl"
        if (Test-Path -LiteralPath $workspaceAcl -PathType Leaf) {
            $env:A3S_CONFIG = (Resolve-Path -LiteralPath $workspaceAcl).Path
        }
    }
    & $executable @args
    if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }

# Build the two companion executables shared by Studio from this workspace.
build-companions:
    cargo build --locked -p a3s-code-acp -p a3s-office-cli

# Build Studio with its ACP and Office companions in the shared target directory.
build-studio $slug=env_var_or_default('A3S_TENANT_SLUG', 'aster'):
    #!/usr/bin/env bash
    set -euo pipefail
    feature="$(python3 apps/studio/scripts/studio_product.py "$slug" feature)"
    export A3S_TENANT_SLUG="$slug"
    TAURI_CONFIG="$(python3 apps/studio/scripts/studio_product.py "$slug" tauri-config)"
    export TAURI_CONFIG
    cargo build --locked -p a3s-code-acp -p a3s-office-cli
    cargo build --locked -p a3s-studio --no-default-features --features "$feature"

# Start Studio with renderer hot reload on 127.0.0.1:4318.
# Default tenant is aster. `just studio toyou` starts the original ToWork product.
studio $slug=env_var_or_default('A3S_TENANT_SLUG', 'aster'):
    #!/usr/bin/env bash
    set -euo pipefail
    if ! [[ "${slug}" =~ ^[a-z][a-z0-9-]{0,31}$ ]]; then
      echo "invalid tenant slug: ${slug}" >&2
      exit 1
    fi
    # The toolchain (node, cargo, bun) lives under $HOME and is only on PATH
    # after the profile block runs, which a shell opened earlier never saw.
    # Add it here so `just studio` works from any shell, not just a fresh one.
    for dir in "${HOME}/.local/node24/bin" "${HOME}/.cargo/bin" "${HOME}/.bun/bin"; do
      if [ -d "${dir}" ] && [[ ":${PATH}:" != *":${dir}:"* ]]; then
        PATH="${dir}:${PATH}"
      fi
    done
    export PATH
    bun scripts/check-tenant.ts "${slug}" >/dev/null
    if [ "$(id -u)" -eq 0 ]; then
      echo "warning: Studio is starting as root; the fcitx immodule cannot commit composed text for a non-session uid, so IME input will not work. Start it as the session user." >&2
    fi
    export A3S_TENANT_SLUG="${slug}"
    export STUDIO_RENDERER_DEV="${STUDIO_RENDERER_DEV:-1}"
    cd apps/studio
    exec scripts/studio-shell.sh

# Start Studio through the X11/XIM input path.
# The host window is a GTK3 WebKitGTK webview that reaches the input method
# through the fcitx GTK immodule. That module is D-Bus bound to the session
# user, so the composed text only commits for the owner of the session bus;
# run any other way (for example as root) and the webview receives raw
# keystrokes, so typing "nihao" leaves "nihao" in the composer instead of
# "你好". The XIM bridge talks to the same input method over X11 instead, so
# it commits composed text for any client that can open the display.
# Measured on this host: fcitx module -> "nihao", XIM -> "你好".
studio-ime $slug=env_var_or_default('A3S_TENANT_SLUG', 'aster'):
    #!/usr/bin/env bash
    set -euo pipefail
    if ! [[ "${slug}" =~ ^[a-z][a-z0-9-]{0,31}$ ]]; then
      echo "invalid tenant slug: ${slug}" >&2
      exit 1
    fi
    python3 apps/studio/scripts/studio_product.py "$slug" feature >/dev/null
    root="$PWD"
    if [ "$(id -u)" -eq 0 ]; then
      echo "warning: Studio is starting as root; the XIM bridge still commits text, but the session input method is owned by another uid, so prefer the session user." >&2
    fi
    export A3S_TENANT_SLUG="${slug}"
    export STUDIO_RENDERER_DEV="${STUDIO_RENDERER_DEV:-1}"
    export GDK_BACKEND=x11
    export GTK_IM_MODULE=xim
    export XMODIFIERS="${XMODIFIERS:-@im=fcitx}"
    binary="$root/target/debug/Studio"
    renderer="http://127.0.0.1:${STUDIO_RENDERER_PORT:-4318}/windows/main/index.html"
    # A renderer left behind by an earlier session still serves this product, but
    # the ownership probe in scripts/studio-dev.mjs cannot attribute it once its
    # parent is gone and then refuses to reuse the port. Match the page instead.
    page="$(curl -fsS --max-time 2 "$renderer" 2>/dev/null | head -c 2000 || true)"
    if [[ -x "$binary" && "$page" == *data-a3s-product* ]]; then
      export TAURI_CONFIG="$(python3 apps/studio/scripts/studio_product.py "$slug" tauri-config)"
      export A3S_ACP_AGENT_BIN="${A3S_ACP_AGENT_BIN:-$root/target/debug/a3s-code-acp}"
      cd apps/studio
      exec "$binary"
    fi
    cd apps/studio
    exec scripts/studio-shell.sh

[macos]
build-studio-release $slug=env_var_or_default('A3S_TENANT_SLUG', 'aster'):
    #!/usr/bin/env bash
    set -euo pipefail
    export A3S_TENANT_SLUG="$slug"
    cd apps/studio
    exec pnpm package:host

# Regenerate the Aster app icons: the three SVG sources, the size ladder, and
# the .ico/.icns containers. Sources live in apps/web/public/tenant/aster.
app-icons:
    python3 scripts/app-icon.py
    python3 scripts/app-icon-assets.py

# Install this checkout as a desktop application: a launcher entry plus the
# hicolor icon ladder under $XDG_DATA_HOME. Without it a dock has no entry to
# match the window against and paints a generic gear instead of the icon.
# `just studio-desktop remove` undoes it.
studio-desktop action='install':
    python3 apps/studio/scripts/studio-desktop.py {{action}}

# Documented desktop host build. Same result as the shared host recipe.
build-desktop $slug=env_var_or_default('A3S_TENANT_SLUG', 'aster'):
    just build-studio {{slug}}

[macos]
build-desktop-release $slug=env_var_or_default('A3S_TENANT_SLUG', 'aster'):
    just build-studio-release {{slug}}

# Start Aster Studio with renderer hot reload. `just dev:toyou` selects that tenant.
dev $slug=env_var_or_default('A3S_TENANT_SLUG', 'aster'): (studio slug)

# Start Aster Studio for this tenant. `just work:toyou` selects that tenant.
work $slug=env_var_or_default('A3S_TENANT_SLUG', 'aster'): (studio slug)

# Middleware plus the host processes that exist in this tree.
# Default tenant is a3s. `just up toyou` selects another public tenant.
up $slug='a3s':
    #!/usr/bin/env bash
    set -euo pipefail
    if ! [[ "${slug}" =~ ^[a-z][a-z0-9-]{0,31}$ ]]; then
      echo "invalid tenant slug: ${slug}" >&2
      exit 1
    fi
    bun scripts/check-tenant.ts "${slug}" >/dev/null
    if ! command -v tilt >/dev/null 2>&1; then
      echo "tilt not found — install from https://docs.tilt.dev/install.html" >&2
      echo "  macOS: brew install tilt" >&2
      exit 1
    fi
    export A3S_TENANT_SLUG="${slug}"
    tilt up

# Non-interactive spine boot. Same tenant parameter as `just up`.
up-ci $slug='a3s':
    #!/usr/bin/env bash
    set -euo pipefail
    if ! [[ "${slug}" =~ ^[a-z][a-z0-9-]{0,31}$ ]]; then
      echo "invalid tenant slug: ${slug}" >&2
      exit 1
    fi
    bun scripts/check-tenant.ts "${slug}" >/dev/null
    if ! command -v tilt >/dev/null 2>&1; then
      echo "tilt not found — install from https://docs.tilt.dev/install.html" >&2
      exit 1
    fi
    export A3S_TENANT_SLUG="${slug}"
    tilt ci

# Stop everything started by `just up`. Leaves Postgres volumes in place.
down:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v tilt >/dev/null 2>&1; then
      tilt down || true
    fi
    bash scripts/stop-web.sh || true
    bash scripts/stop-billing.sh || true
    bash scripts/stop-auth.sh || true
    bash scripts/stop-cloud-containers.sh || true
    bash scripts/stop-search.sh || true
    bash scripts/stop-config.sh || true
    docker compose down || true

# Middleware only (Postgres, Redis, RustFS, Iggy, etcd) from the OS compose.
middleware-up:
    docker compose up -d

# Run the layered backend test suites (hermetic members in parallel,
# Postgres/S3 campaigns serially). Requires the middleware for campaigns.
backend-test:
    cargo test --locked -p a3s-gateway -p a3s-gateway-runtime -p a3s-runner -p a3s-vec
