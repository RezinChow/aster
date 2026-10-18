# Build the TUI and its ACP companion into the same target directory.
build:
    cargo build --locked

# Start the terminal, forwarding arguments without losing shell quoting.
[positional-arguments]
code *args: build
    #!/usr/bin/env python3
    import json
    import os
    from pathlib import Path
    import subprocess
    import sys
    metadata = json.loads(subprocess.check_output(["cargo", "metadata", "--locked", "--offline", "--no-deps", "--format-version", "1"]))
    executable = Path(metadata["target_directory"]) / "debug" / ("aster.exe" if os.name == "nt" else "aster")
    os.execv(str(executable), [str(executable), *sys.argv[1:]])

# Build Work and the two companion executables from this workspace.
build-work:
    cargo build --locked -p a3s-code-acp -p a3s-office-cli
    cargo build --locked -p aster-dream

[macos]
build-work-release:
    cd apps/work && pnpm package:host

# Open the newest compiled Work app bundle on macOS.
[macos]
work:
    #!/usr/bin/env python3
    import os
    from pathlib import Path
    bundles = [
        (executable.stat().st_mtime, app)
        for target in [Path(os.environ.get("CARGO_TARGET_DIR", "target")), Path("apps/work/src-tauri/target")]
        for app in target.glob("*/bundle/macos/*.app")
        for executable in app.glob("Contents/MacOS/*")
        if executable.is_file() and os.access(executable, os.X_OK)
    ]
    if not bundles:
        raise SystemExit("No compiled Work app found under apps/work/src-tauri/target. Build the desktop bundle in apps/work first.")
    latest = max(bundles, key=lambda item: item[0])[1]
    os.execvp("open", ["open", "-n", str(latest)])
