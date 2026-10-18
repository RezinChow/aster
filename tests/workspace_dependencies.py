"""Prevent internal libraries from silently returning to remote releases."""

import json
import os
from pathlib import Path
import subprocess
import tomllib
import unittest


ROOT = Path(__file__).resolve().parents[1]


class WorkspaceDependenciesTest(unittest.TestCase):
    def test_desktop_sources_and_executable_fixtures_are_present(self):
        self.assertFalse((ROOT / "apps/work/.git").exists())
        self.assertFalse((ROOT / "apps/work/src-tauri/Cargo.lock").exists())
        for path in [
            "apps/work/vendor/packages/office/src/core.ts",
            "apps/work/vendor/packages/office/generated/office-kernel.wasm",
            "apps/work/resources/tenant/toyou/INFO.md",
        ]:
            self.assertTrue((ROOT / path).is_file(), path)
        for path in [
            "plugin-v3-package/package/tools/echo",
            "plugin-v3/package/tools/convert/bin/convert",
        ]:
            self.assertTrue(os.access(ROOT / "crates/use/extension/fixtures/packages" / path, os.X_OK))

    def test_internal_dependencies_are_local_and_unpublishable(self):
        output = subprocess.check_output([
            "cargo", "metadata", "--locked", "--offline", "--no-deps",
            "--format-version", "1",
        ], cwd=ROOT)
        metadata = json.loads(output)
        names = {package["name"] for package in metadata["packages"]}
        self.assertTrue({"aster", "aster-dream", "a3s-code-acp", "a3s-office-cli"} <= names)
        for package in metadata["packages"]:
            self.assertEqual(package["publish"], [], package["name"])
            for dependency in package["dependencies"]:
                if dependency["name"].startswith("a3s-"):
                    self.assertIsNone(dependency["source"], dependency["name"])
                    self.assertTrue(Path(dependency["path"]).resolve().is_relative_to(ROOT))
        lock = tomllib.loads((ROOT / "Cargo.lock").read_text())
        for package in lock["package"]:
            if package["name"].startswith("a3s-"):
                self.assertNotIn("source", package, package["name"])


if __name__ == "__main__":
    unittest.main()
