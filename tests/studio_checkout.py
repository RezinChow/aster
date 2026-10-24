"""The pinned Studio resolver trusts only the declared checkout, even in a container."""
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]


class StudioCheckout(unittest.TestCase):
    def test_revision_step_handles_a_different_owner_without_global_trust(self):
        lines = (ROOT / ".github/actions/checkout-studio/action.yml").read_text().splitlines()
        start = lines.index("      id: revision")
        start = lines.index("      run: |", start) + 1
        end = start
        while end < len(lines) and lines[end].startswith("        "):
            end += 1
        script = textwrap.dedent("\n".join(lines[start:end]))
        self.assertTrue(script)
        (ROOT / "target").mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / "target", prefix="studio-checkout-") as directory:
            temporary = Path(directory)
            config = temporary / "global.gitconfig"
            original = "[safe]\n\tdirectory = /unrelated-checkout\n"
            config.write_text(original)
            env = {
                "PATH": os.environ["PATH"], "HOME": directory,
                "GIT_CONFIG_GLOBAL": str(config), "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_TEST_ASSUME_DIFFERENT_OWNER": "1",
                "GITHUB_WORKSPACE": str(ROOT), "GITHUB_OUTPUT": str(temporary / "output"),
            }
            refused = subprocess.run(["git", "ls-tree", "HEAD", "apps/studio"], cwd=ROOT, env=env, text=True, capture_output=True, timeout=10)
            self.assertNotEqual(refused.returncode, 0)
            self.assertIn("dubious ownership", refused.stderr)
            accepted = subprocess.run(["bash", "-euo", "pipefail", "-c", script], cwd=ROOT, env=env, text=True, capture_output=True, timeout=10)
            self.assertEqual(accepted.returncode, 0, accepted.stderr)
            self.assertRegex((temporary / "output").read_text(), r"\Asha=[0-9a-f]{40}\n\Z")
            env["GITHUB_WORKSPACE"] = str(temporary)
            wrong_checkout = subprocess.run(["bash", "-euo", "pipefail", "-c", script], cwd=ROOT, env=env, text=True, capture_output=True, timeout=10)
            self.assertNotEqual(wrong_checkout.returncode, 0)
            self.assertIn("dubious ownership", wrong_checkout.stderr)
            self.assertEqual(config.read_text(), original)


if __name__ == "__main__":
    unittest.main()
