"""Hermetic contract tests for the desktop update channel manifest.

Drives scripts/desktop_release_manifest.py on temp fixtures: generation
digests the archive, regression is refused, and `check` pins the exact
schema the studio host updater parses.
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SCRIPT = REPO / "scripts" / "desktop_release_manifest.py"


class ManifestContractTests(unittest.TestCase):
    def run_script(self, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            capture_output=True,
            text=True,
            timeout=30,
        )

    def make_archive(self, directory, name="Aster-darwin-aarch64-v0.2.0.zip", payload=b"bundle"):
        path = Path(directory) / name
        path.write_bytes(payload)
        return path

    def generate(self, directory, version="0.2.0", existing=None, force=False):
        archive = self.make_archive(directory)
        out = Path(directory) / "desktop-latest.json"
        args = [
            "generate",
            "--zip",
            str(archive),
            "--asset",
            archive.name,
            "--version",
            version,
            "--out",
            str(out),
        ]
        if existing:
            args += ["--existing", str(existing)]
        if force:
            args += ["--force"]
        result = self.run_script(*args)
        return result, out

    def test_generate_digests_the_archive_into_the_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            import hashlib

            archive = self.make_archive(directory)
            result, out = self.generate(directory)
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads(out.read_text())
            self.assertEqual(manifest["product"], "aster")
            self.assertEqual(manifest["channel"], "stable")
            self.assertEqual(manifest["version"], "0.2.0")
            entry = manifest["platforms"]["darwin-aarch64"]
            self.assertEqual(
                entry["sha256"], hashlib.sha256(archive.read_bytes()).hexdigest()
            )
            self.assertEqual(entry["size"], archive.stat().st_size)
            self.assertEqual(
                entry["url"],
                "https://github.com/aster-ai-lab/aster/releases/download/desktop-stable/"
                + archive.name,
            )
            self.assertTrue(manifest["published_at"].startswith("20"))

    def test_generate_refuses_version_regressions(self):
        with tempfile.TemporaryDirectory() as directory:
            _, first = self.generate(directory, version="0.3.0")
            result, _ = self.generate(directory, version="0.2.0", existing=first)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("refusing", result.stderr)
            equal, _ = self.generate(directory, version="0.3.0", existing=first)
            self.assertIn("refusing", equal.stderr)
            forced, out = self.generate(directory, version="0.3.0", existing=first, force=True)
            self.assertEqual(forced.returncode, 0, forced.stderr)
            self.assertEqual(json.loads(out.read_text())["version"], "0.3.0")

    def test_check_accepts_a_generated_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            _, out = self.generate(directory)
            result = self.run_script("check", "--manifest", str(out))
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_check_names_every_refusal(self):
        base = {
            "product": "aster",
            "channel": "stable",
            "version": "0.2.0",
            "published_at": "2026-10-22T00:00:00Z",
            "notes": "",
            "platforms": {
                "darwin-aarch64": {
                    "url": "https://github.com/aster-ai-lab/aster/releases/download/desktop-stable/a.zip",
                    "sha256": "ab" * 32,
                    "size": 4,
                }
            },
        }
        cases = {
            "wrong product": {"product": "toyou"},
            "wrong channel": {"channel": "beta"},
            "bad version": {"version": "0.2"},
            "missing published_at": {"published_at": ""},
            "empty platforms": {"platforms": {}},
            "digest not hex": {
                "platforms": {"darwin-aarch64": {**base["platforms"]["darwin-aarch64"], "sha256": "zz" * 32}}
            },
            "digest uppercase": {
                "platforms": {"darwin-aarch64": {**base["platforms"]["darwin-aarch64"], "sha256": "AB" * 32}}
            },
            "url off channel": {
                "platforms": {"darwin-aarch64": {**base["platforms"]["darwin-aarch64"], "url": "https://example.test/a.zip"}}
            },
            "size zero": {
                "platforms": {"darwin-aarch64": {**base["platforms"]["darwin-aarch64"], "size": 0}}
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            for name, override in cases.items():
                manifest = {**base, **override}
                path = Path(directory) / "m.json"
                path.write_text(json.dumps(manifest))
                result = self.run_script("check", "--manifest", str(path))
                self.assertNotEqual(result.returncode, 0, name)
                self.assertTrue(result.stderr.strip(), name)


if __name__ == "__main__":
    unittest.main()
