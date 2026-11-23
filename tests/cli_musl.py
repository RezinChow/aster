"""Verify that a released aster + aster-acp pair is static and starts."""

from __future__ import annotations

import argparse
import os
import re
import struct
import subprocess
import sys
import tempfile
import tomllib
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    from .acp_musl import (
        MACHINES, PT_DYNAMIC, PT_GNU_RELRO, PT_GNU_STACK, PT_INTERP,
        check_elf, check_no_glibc,
    )
except ImportError:  # executed directly as `python3 tests/cli_musl.py`
    from acp_musl import (
        MACHINES, PT_DYNAMIC, PT_GNU_RELRO, PT_GNU_STACK, PT_INTERP,
        check_elf, check_no_glibc,
    )

ROOT = Path(__file__).resolve().parents[1]
PAIR_NAMES = ("aster", "aster-acp")
VERSION_SOURCES = {
    "aster": ROOT / "apps/aster/Cargo.toml",
    "aster-acp": ROOT / "crates/code/acp/Cargo.toml",
}


def expected_versions() -> dict[str, str]:
    """Release versions come from the same manifests that stamp the pair build ID."""
    return {
        name: tomllib.loads(path.read_text())["package"]["version"]
        for name, path in VERSION_SOURCES.items()
    }


def verify_binary(binary: Path, machine: int, version: str, launch: bool) -> None:
    check_elf(binary.read_bytes(), machine)
    version_info = subprocess.run(
        ["readelf", "--version-info", str(binary)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    check_no_glibc(version_info)
    if not launch:
        return
    reported = subprocess.run(
        [str(binary), "--version"], capture_output=True, text=True, timeout=30
    )
    output = reported.stdout + reported.stderr
    if reported.returncode or version not in output:
        raise ValueError(
            f"{binary.name} --version failed: exit={reported.returncode}, "
            f"expected {version}, output={output!r}"
        )
    help_result = subprocess.run(
        [str(binary), "--help"], capture_output=True, text=True, timeout=30
    )
    if help_result.returncode or not (help_result.stdout + help_result.stderr).strip():
        raise ValueError(
            f"{binary.name} --help failed: exit={help_result.returncode}, "
            f"stdout={help_result.stdout!r}, stderr={help_result.stderr!r}"
        )


def verify_pair(bin_dir: Path, machine: int, launch: bool = True) -> None:
    versions = expected_versions()
    for name in PAIR_NAMES:
        verify_binary(bin_dir / name, machine, versions[name], launch)


class CliMuslContractTest(unittest.TestCase):
    def static_elf(self) -> bytes:
        data = bytearray(64 + 2 * 56)
        data[:6] = b"\x7fELF\x02\x01"
        struct.pack_into("<HH", data, 16, 2, 62)
        struct.pack_into("<Q", data, 32, 64)
        struct.pack_into("<HH", data, 54, 56, 2)
        struct.pack_into("<II", data, 64, PT_GNU_STACK, 6)
        struct.pack_into("<II", data, 120, PT_GNU_RELRO, 6)
        return bytes(data)

    def fake_readelf(self, directory: Path, dump: str) -> None:
        tool = directory / "readelf"
        tool.write_text(f'#!/bin/sh\nprintf "%s\\n" {dump!r}\n')
        tool.chmod(0o755)

    def test_manifest_versions_are_release_triples(self):
        versions = expected_versions()
        self.assertEqual(set(versions), set(PAIR_NAMES))
        for version in versions.values():
            self.assertIsNotNone(re.fullmatch(r"\d+\.\d+\.\d+", version), version)

    def test_static_pair_is_accepted_and_dynamic_or_glibc_is_refused(self):
        with tempfile.TemporaryDirectory(prefix="aster-cli-musl-") as directory:
            root = Path(directory)
            for name in PAIR_NAMES:
                (root / name).write_bytes(self.static_elf())
            commands = root / "commands"
            commands.mkdir()
            self.fake_readelf(commands, "No version information available in this file.")
            env = dict(os.environ, PATH=str(commands) + os.pathsep + os.environ["PATH"])
            with patch.dict(os.environ, env):
                verify_pair(root, MACHINES["x86_64"], launch=False)

            self.fake_readelf(commands, "Name: GLIBC_2.34 Flags: none")
            with patch.dict(os.environ, env), self.assertRaisesRegex(ValueError, "GLIBC_2.34"):
                verify_pair(root, MACHINES["x86_64"], launch=False)

            self.fake_readelf(commands, "No version information available in this file.")
            for kind, message in ((PT_DYNAMIC, "dynamic dependency"), (PT_INTERP, "PT_INTERP")):
                with self.subTest(kind=kind):
                    dynamic = bytearray(self.static_elf())
                    struct.pack_into("<I", dynamic, 64, kind)
                    (root / "aster").write_bytes(dynamic)
                    with patch.dict(os.environ, env), self.assertRaisesRegex(ValueError, message):
                        verify_pair(root, MACHINES["x86_64"], launch=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("binaries", nargs="*", type=Path)
    parser.add_argument("--machine", choices=MACHINES)
    parser.add_argument("--no-launch", action="store_true")
    arguments = parser.parse_args()
    if not arguments.binaries:
        unittest.main(argv=[sys.argv[0]])
        sys.exit(0)
    if not arguments.machine:
        parser.error("--machine is required when verifying binaries")
    if tuple(path.name for path in arguments.binaries) != PAIR_NAMES:
        parser.error(f"expected exactly {' and '.join(PAIR_NAMES)}")
    try:
        versions = expected_versions()
        for path in arguments.binaries:
            verify_binary(
                path,
                MACHINES[arguments.machine],
                versions[path.name],
                not arguments.no_launch,
            )
            print(f"verified static CLI binary: {path}")
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"CLI musl verification failed: {error}", file=sys.stderr)
        sys.exit(1)
