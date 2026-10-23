"""Hold the Kylin V10 CLI archive to its glibc 2.31 baseline.

The acceptance question in issue #10 is whether an archive labelled for Kylin
V10 SP1 actually starts there. glibc 2.31 is the ceiling on that system, so the
packaging path has to prove it rather than trust the build host.
"""

from __future__ import annotations

import hashlib
import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / "scripts/check-glibc-symbols.py"
PACKAGE = ROOT / "scripts/package-aster-cli.sh"
INSTALL = ROOT / "scripts/install.sh"
IDENTITY = "aster-cli-pair-v1:fixture-source:fixture-target"
NAMES = ("aster", "a3s-code-acp")
VERSION = "0.1.2"


def _load_check():
    spec = importlib.util.spec_from_file_location("check_glibc_symbols", CHECK)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


check = _load_check()

# Shaped like the version-needs section readelf prints for a dynamic binary.
DUMP_231 = """
Version needs section '.gnu.version_r' contains 2 entries:
  0x0000: Version: 1  File: libc.so.6  Cnt: 2
  0x0010:   Name: GLIBC_2.14  Flags: none  Version: 5
  0x0020:   Name: GLIBC_2.2.5  Flags: none  Version: 2
"""

DUMP_238 = """
Version needs section '.gnu.version_r' contains 2 entries:
  0x0000: Version: 1  File: libc.so.6  Cnt: 3
  0x0010:   Name: GLIBC_2.34  Flags: none  Version: 6
  0x0020:   Name: GLIBC_2.2.5  Flags: none  Version: 2
"""


class GlibcCeilingTest(unittest.TestCase):
    def test_versions_are_compared_numerically_not_lexically(self):
        # "2.9" sorts after "2.31" as text and is genuinely older as a version.
        self.assertEqual(check.evaluate({"GLIBC_2.9"}, "2.31"), [])
        self.assertEqual(check.evaluate({"GLIBC_2.30"}, "2.31"), [])
        self.assertEqual(check.evaluate({"GLIBC_2.31"}, "2.31"), [])

    def test_a_newer_requirement_fails_the_ceiling(self):
        self.assertEqual(check.evaluate({"GLIBC_2.34"}, "2.31"), ["GLIBC_2.34"])
        self.assertEqual(
            check.evaluate({"GLIBC_2.17", "GLIBC_2.34", "GLIBC_2.2.5"}, "2.31"),
            ["GLIBC_2.34"],
        )

    def test_unprovable_labels_fail_instead_of_passing_silently(self):
        self.assertEqual(check.evaluate({"GLIBC_ABI_DT_RELR"}, "2.31"), ["GLIBC_ABI_DT_RELR"])
        self.assertEqual(check.evaluate({"GLIBC_FUTURE"}, "2.31"), ["GLIBC_FUTURE"])
        # Internal to glibc, never a loader requirement of an ordinary program.
        self.assertEqual(check.evaluate({"GLIBC_PRIVATE"}, "2.31"), [])

    def test_dump_parsing_reads_the_version_needs_section(self):
        self.assertEqual(
            check.parse_versions(DUMP_231), {"GLIBC_2.14", "GLIBC_2.2.5"}
        )
        self.assertEqual(
            check.parse_versions(DUMP_238), {"GLIBC_2.34", "GLIBC_2.2.5"}
        )

    def test_cli_reports_a_violation_as_a_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            dump = Path(directory) / "needs.txt"
            dump.write_text(DUMP_238)
            completed = subprocess.run(
                [sys.executable, str(CHECK), "--max", "2.31", "--dump", str(dump)],
                capture_output=True,
                text=True,
            )
        self.assertEqual(completed.returncode, 1, completed.stdout)
        self.assertIn("GLIBC_2.34", completed.stderr)

    def test_cli_passes_a_dump_within_the_ceiling(self):
        with tempfile.TemporaryDirectory() as directory:
            dump = Path(directory) / "needs.txt"
            dump.write_text(DUMP_231)
            completed = subprocess.run(
                [sys.executable, str(CHECK), "--max", "2.31", "--dump", str(dump)],
                capture_output=True,
                text=True,
            )
        self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_an_unreadable_ceiling_is_an_error_not_a_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            dump = Path(directory) / "needs.txt"
            dump.write_text(DUMP_231)
            completed = subprocess.run(
                [sys.executable, str(CHECK), "--max", "kylin", "--dump", str(dump)],
                capture_output=True,
                text=True,
            )
        self.assertEqual(completed.returncode, 2, completed.stdout)

    def test_a_missing_binary_is_an_error_not_a_pass(self):
        completed = subprocess.run(
            [sys.executable, str(CHECK), "--max", "2.31", "/nonexistent/aster"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 2, completed.stdout)


class KylinPackagingTest(unittest.TestCase):
    def test_packaging_accepts_the_kylin_platform(self):
        source = PACKAGE.read_text()
        self.assertIn("kylin", source)
        # The baseline must be enforced by the kylin branch, not only documented.
        self.assertIn('max_glibc="2.31"', source)
        self.assertIn("check-glibc-symbols.py", source)

    def test_packaging_still_rejects_an_unknown_platform(self):
        completed = subprocess.run(
            ["bash", str(PACKAGE), "plan9", "/tmp", "/tmp/out.tar.gz"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 1, completed.stdout)
        self.assertIn("unsupported platform", completed.stderr)


class KylinChannelSelectionTest(unittest.TestCase):
    """install.sh must ask for the archive the host's loader can start.

    Issues #10 and #16 are one report seen from two sides: the generic linux
    archive needs glibc 2.32, so a Kylin V10 SP1 host (glibc 2.31) downloaded a
    binary that could not start. The installer reads the host's glibc and asks the
    manifest for the kylin archive instead.

    The probe stops at the archive lookup on purpose: what is under test is which
    asset the installer names. Extraction and promotion are covered by
    tests/cli_pair_delivery.py.
    """

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="aster-kylin-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.assets = self.root / "assets"
        self.prefix = self.root / "prefix"
        self.fake = self.root / "fake"
        for path in (self.assets, self.prefix, self.fake):
            path.mkdir()
        digest = "0" * 64
        entries = ",".join(
            f'"{platform}":{{"name":"aster-cli-v{VERSION}-{platform}.tar.gz","sha256":"{digest}"}}'
            for platform in ("linux", "kylin")
        )
        (self.assets / "latest.json").write_text(
            f'{{"version":"{VERSION}","tag":"aster-cli-v{VERSION}","assets":{{{entries}}}}}\n'
        )

    def fake_tool(self, name, body):
        path = self.fake / name
        path.write_text("#!/bin/sh\n" + body + "\n")
        path.chmod(0o755)

    def select(self):
        environment = dict(
            os.environ,
            ASTER_RELEASE_BASE=str(self.assets),
            PATH=str(self.fake) + os.pathsep + os.environ["PATH"],
        )
        environment.pop("ASTER_INSTALL_URL", None)
        environment.pop("GROK_INSTALL_URL", None)
        return subprocess.run(
            ["bash", str(INSTALL), "--prefix", str(self.prefix)],
            env=environment,
            capture_output=True,
            text=True,
            timeout=30,
        )

    def missing_asset(self, completed):
        self.assertIn("local release is missing", completed.stderr)
        return completed.stderr.split("local release is missing ", 1)[1].split()[0]

    def test_a_glibc_2_31_host_asks_for_the_kylin_archive(self):
        self.fake_tool("getconf", 'printf "%s\\n" "glibc 2.31"')
        completed = self.select()
        self.assertEqual(
            self.missing_asset(completed), f"aster-cli-v{VERSION}-kylin.tar.gz"
        )

    def test_a_glibc_2_27_host_also_asks_for_the_kylin_archive(self):
        self.fake_tool("getconf", 'printf "%s\\n" "glibc 2.27"')
        completed = self.select()
        self.assertEqual(
            self.missing_asset(completed), f"aster-cli-v{VERSION}-kylin.tar.gz"
        )

    def test_a_current_glibc_host_asks_for_the_generic_archive(self):
        self.fake_tool("getconf", 'printf "%s\\n" "glibc 2.39"')
        completed = self.select()
        self.assertEqual(
            self.missing_asset(completed), f"aster-cli-v{VERSION}-linux.tar.gz"
        )

    def test_a_kylin_ldd_line_is_read_when_getconf_is_silent(self):
        # Kylin's own loader prints "ldd (Ubuntu GLIBC 2.31-0kylin9.1k22.0) 2.31".
        # The trailing token is the version; the numbers inside the parenthesis are
        # part of the distribution suffix, so a first-match read would pick 2.31
        # twice and a greedy one would land on 0.0.
        self.fake_tool("getconf", "exit 1")
        self.fake_tool("ldd", 'printf "%s\\n" "ldd (Ubuntu GLIBC 2.31-0kylin9.1k22.0) 2.31"')
        completed = self.select()
        self.assertEqual(
            self.missing_asset(completed), f"aster-cli-v{VERSION}-kylin.tar.gz"
        )

    def test_an_unknown_glibc_keeps_the_generic_archive(self):
        self.fake_tool("getconf", "exit 1")
        self.fake_tool("ldd", "exit 1")
        completed = self.select()
        self.assertEqual(
            self.missing_asset(completed), f"aster-cli-v{VERSION}-linux.tar.gz"
        )

    def test_the_installer_accepts_a_kylin_archive_url(self):
        source = INSTALL.read_text()
        self.assertIn("(macos|linux|kylin|windows)", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
