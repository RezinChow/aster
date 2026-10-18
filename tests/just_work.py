import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


@unittest.skipUnless(os.name == "posix", "Launcher fixtures use POSIX scripts")
class CodeLauncherTest(unittest.TestCase):
    def test_code_runs_the_built_binary_and_preserves_arguments(self):
        with tempfile.TemporaryDirectory(prefix="aster-code-test-") as directory:
            root = Path(directory)
            shutil.copy2(Path(__file__).resolve().parents[1] / "justfile", root / "justfile")
            tools = root / "bin"
            tools.mkdir()
            cargo = tools / "cargo"
            cargo.write_text(
                '#!/usr/bin/env python3\nimport json, os, sys\n'
                'if sys.argv[1] == "metadata": print(json.dumps({"target_directory": os.environ["ASTER_TEST_TARGET"]}))\n'
                'elif sys.argv[1] == "build": raise SystemExit(int(os.environ.get("ASTER_TEST_FAIL", "0")))\n'
                'else: raise SystemExit("unexpected Cargo command")\n'
            )
            cargo.chmod(0o755)
            target = root / "custom target"
            executable = target / "debug/aster"
            executable.parent.mkdir(parents=True)
            executable.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$ASTER_OPEN_LOG"\n')
            executable.chmod(0o755)
            log = root / "arguments.txt"
            env = dict(os.environ, PATH=f"{tools}:{os.environ['PATH']}",
                       ASTER_TEST_TARGET=str(target), ASTER_OPEN_LOG=str(log))
            result = subprocess.run(["just", "code", "--cwd", "/tmp/aster project"],
                                    cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(log.read_text().splitlines(), ["--cwd", "/tmp/aster project"])
            log.unlink()
            env["ASTER_TEST_FAIL"] = "1"
            result = subprocess.run(["just", "code"], cwd=root, env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(log.exists(), "failed builds must not launch a stale executable")


@unittest.skipUnless(sys.platform == "darwin", "Work bundle launcher uses macOS open")
class WorkLauncherTest(unittest.TestCase):
    def test_newest_executable_wins_and_spaces_are_preserved(self):
        with tempfile.TemporaryDirectory(prefix="aster-work-test-") as directory:
            root = Path(directory)
            shutil.copy2(Path(__file__).resolve().parents[1] / "justfile", root / "justfile")
            for profile, name, modified in [("apps/work/src-tauri/target/release", "Older App", 100), ("target/debug", "New App", 200)]:
                binary = root / f"{profile}/bundle/macos/{name}.app/Contents/MacOS/work"
                binary.parent.mkdir(parents=True)
                binary.write_text("fixture")
                binary.chmod(0o755)
                os.utime(binary, (modified, modified))
                note = binary.parent / "README"
                note.write_text("not a compiled executable")
                os.utime(note, (300, 300))
            tools = root / "bin"
            tools.mkdir()
            opener = tools / "open"
            opener.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$ASTER_OPEN_LOG"\n')
            opener.chmod(0o755)
            log = root / "opened.txt"
            env = dict(os.environ, PATH=f"{tools}:{os.environ['PATH']}", ASTER_OPEN_LOG=str(log), CARGO_TARGET_DIR="target")
            result = subprocess.run(["just", "work"], cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(log.read_text().splitlines(), [
                "-n", "target/debug/bundle/macos/New App.app",
            ])

    def test_missing_build_has_an_actionable_error(self):
        with tempfile.TemporaryDirectory(prefix="aster-work-missing-") as directory:
            root = Path(directory)
            shutil.copy2(Path(__file__).resolve().parents[1] / "justfile", root / "justfile")
            result = subprocess.run(["just", "work"], cwd=root, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Build the desktop bundle in apps/work first", result.stderr)


if __name__ == "__main__":
    unittest.main()
