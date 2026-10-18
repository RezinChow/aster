"""Run the welcome regression with isolated state and a local-only provider."""

import os
from pathlib import Path
import subprocess
import tempfile


root = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="aster-terminal-") as directory:
    env = dict(os.environ)
    env.update({
        "HOME": directory,
        "GROK_HOME": str(Path(directory) / "grok"),
        "A3S_CONFIG": str(root / "tests/fixtures/terminal/config.acl"),
        "A3S_DISABLE_CC_SWITCH": "1",
        "A3S_DISABLE_GROK_ACCOUNT": "1",
        "A3S_DISABLE_CURSOR_ACCOUNT": "1",
        "TERM": "xterm-256color",
    })
    raise SystemExit(subprocess.call([
        "a3s-test", "run", "tests/e2e/startup.acl",
        "--tui-executable", str(root / "target/debug/aster"),
        "--tui-working-directory", directory,
        "--tui-columns", "120", "--tui-rows", "40", "--json",
    ], cwd=root, env=env))
