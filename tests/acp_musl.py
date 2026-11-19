"""Verify that an ACP musl artifact is static and starts successfully."""

from __future__ import annotations

import argparse
import re
import struct
import subprocess
import sys
import tomllib
import unittest
from pathlib import Path

from musl_linker_flags import program_headers

ROOT = Path(__file__).resolve().parents[1]
MACHINES = {"x86_64": 62, "aarch64": 183}
PT_DYNAMIC = 2
PT_INTERP = 3
PT_GNU_STACK = 0x6474E551
PT_GNU_RELRO = 0x6474E552


def check_elf(data: bytes, machine: int) -> None:
    if len(data) < 64 or data[:6] != b"\x7fELF\x02\x01":
        raise ValueError("expected a little-endian ELF64 binary")
    elf_type, actual_machine = struct.unpack_from("<HH", data, 16)
    if elf_type != 2:
        raise ValueError(f"expected a static ET_EXEC binary, found ELF type {elf_type}")
    if actual_machine != machine:
        raise ValueError(f"expected ELF machine {machine}, found {actual_machine}")
    headers = program_headers(data)
    kinds = [kind for kind, _ in headers]
    if PT_INTERP in kinds:
        raise ValueError("static ACP must not require a PT_INTERP loader")
    if PT_DYNAMIC in kinds:
        raise ValueError("static ACP must not contain a dynamic dependency table")
    if PT_GNU_RELRO not in kinds:
        raise ValueError("PT_GNU_RELRO is missing")
    stacks = [flags for kind, flags in headers if kind == PT_GNU_STACK]
    if len(stacks) != 1 or stacks[0] & 1:
        raise ValueError("PT_GNU_STACK must exist and be non-executable")


def check_no_glibc(version_info: str) -> None:
    versions = sorted(set(re.findall(r"\bGLIBC_[A-Za-z0-9_.]+", version_info)))
    if versions:
        raise ValueError(f"glibc version references remain: {', '.join(versions)}")


def verify(binary: Path, machine: int, launch: bool) -> None:
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
    expected = tomllib.loads((ROOT / "crates/code/acp/Cargo.toml").read_text())[
        "package"
    ]["version"]
    version = subprocess.run(
        [str(binary), "--version"], capture_output=True, text=True, timeout=30
    )
    if version.returncode or version.stdout.strip() != expected:
        raise ValueError(
            f"--version failed: exit={version.returncode}, stdout={version.stdout!r}, "
            f"stderr={version.stderr!r}"
        )
    help_result = subprocess.run(
        [str(binary), "--help"], capture_output=True, text=True, timeout=30
    )
    if help_result.returncode or expected not in help_result.stderr:
        raise ValueError(
            f"--help failed: exit={help_result.returncode}, "
            f"stdout={help_result.stdout!r}, stderr={help_result.stderr!r}"
        )


class ElfContractTest(unittest.TestCase):
    def fixture(self) -> bytearray:
        data = bytearray(64 + 2 * 56)
        data[:6] = b"\x7fELF\x02\x01"
        struct.pack_into("<HH", data, 16, 2, 62)
        struct.pack_into("<Q", data, 32, 64)
        struct.pack_into("<HH", data, 54, 56, 2)
        struct.pack_into("<II", data, 64, PT_GNU_STACK, 6)
        struct.pack_into("<II", data, 120, PT_GNU_RELRO, 6)
        return data

    def test_static_hardened_elf_is_accepted(self):
        check_elf(self.fixture(), 62)

    def test_dynamic_loader_dependencies_and_executable_stacks_are_refused(self):
        for offset, kind in [(64, PT_INTERP), (64, PT_DYNAMIC)]:
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                data = self.fixture()
                struct.pack_into("<I", data, offset, kind)
                check_elf(data, 62)
        with self.assertRaises(ValueError):
            data = self.fixture()
            struct.pack_into("<I", data, 68, 7)
            check_elf(data, 62)

    def test_wrong_architecture_and_glibc_versions_are_refused(self):
        with self.assertRaises(ValueError):
            check_elf(self.fixture(), 183)
        check_no_glibc("No version information available in this file.")
        with self.assertRaisesRegex(ValueError, "GLIBC_2.34"):
            check_no_glibc("Name: GLIBC_2.34 Flags: none")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("binaries", nargs="*", type=Path)
    parser.add_argument("--machine", choices=MACHINES)
    parser.add_argument("--no-launch", action="store_true")
    arguments = parser.parse_args()
    if not arguments.binaries:
        unittest.main(argv=[sys.argv[0]])
    if not arguments.machine:
        parser.error("--machine is required when verifying binaries")
    try:
        for artifact in arguments.binaries:
            verify(
                artifact,
                MACHINES[arguments.machine] if arguments.machine else None,
                not arguments.no_launch,
            )
            print(f"verified static ACP: {artifact}")
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"ACP musl verification failed: {error}", file=sys.stderr)
        sys.exit(1)
