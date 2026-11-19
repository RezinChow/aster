"""Hermetic release-pair packaging and install fault injection; no user binaries."""
import hashlib
import io
import os
from pathlib import Path
import subprocess
import shutil
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
# Exercise the macOS archive on every Unix runner; Linux ELF checks are separate.
PLATFORM = "macos"
IDENTITY = "aster-cli-pair-v1:fixture-source:fixture-target"
NAMES = ("aster", "aster-acp")
EMBEDDING_MEMBERS = (
    "embedding/potion-code-16M-v2.safetensors",
    "embedding/potion-code-16M-v2.tokenizer.json",
    "embedding/potion-code-16M-v2.config.json",
)
EXPECTED_MEMBERS = {*NAMES, "BUILD_ID", "SHA256SUMS", *EMBEDDING_MEMBERS}


@unittest.skipUnless(os.name == "posix", "Unix installer requires a Unix host")
class PairDelivery(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="aster-pair-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bins = self.root / "bins"
        self.assets = self.root / "assets"
        self.prefix = self.root / "installed"
        self.commands = self.root / "commands"
        for path in (self.bins, self.assets, self.prefix, self.commands):
            path.mkdir()
        (self.commands / "uname").write_text("#!/bin/sh\nprintf 'Darwin\\n'\n")
        (self.commands / "uname").chmod(0o755)
        self.archive = self.assets / f"aster-cli-v0.1.2-{PLATFORM}.tar.gz"
        for name in NAMES:
            self.binary(name, IDENTITY)
            (self.prefix / name).write_text("old-" + name)

    def binary(self, name, identity):
        path = self.bins / name
        path.write_text(f"#!/bin/sh\nprintf '%s\\n' '{identity}'\n")
        path.chmod(0o755)

    def package(self):
        # Shell delivery fixtures use Unix packaging; Linux ELF checks have their own suite.
        result = subprocess.run(["bash", str(ROOT / "scripts/package-aster-cli.sh"),
            "macos", str(self.bins), str(self.archive)], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            self.write_manifest()
        return result

    def write_manifest(self):
        """The compact channel manifest the release workflow publishes."""
        digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        body = ('{"version":"0.1.2","tag":"aster-cli-v0.1.2","assets":'
                f'{{"macos":{{"name":"aster-cli-v0.1.2-macos.tar.gz","sha256":"{digest}"}},'
                f'"linux":{{"name":"aster-cli-v0.1.2-linux.tar.gz","sha256":"{digest}"}},'
                f'"windows":{{"name":"aster-cli-v0.1.2-windows.zip","sha256":"{digest}"}}}}}}\n')
        (self.assets / "latest.json").write_text(body)

    def install(self):
        env = dict(os.environ, ASTER_RELEASE_BASE=str(self.assets),
            PATH=str(self.commands) + os.pathsep + os.environ["PATH"])
        env.pop("ASTER_INSTALL_URL", None)
        env.pop("GROK_INSTALL_URL", None)
        return subprocess.run(["bash", str(ROOT / "scripts/install.sh"), "--prefix", str(self.prefix)],
            env=env, capture_output=True, text=True, timeout=10)

    def assert_old(self):
        for name in NAMES:
            self.assertEqual((self.prefix / name).read_text(), "old-" + name)

    def fault(self, command, stage_name):
        path = self.commands / command
        path.write_text(f'#!/bin/sh\nfor arg do\n case "$arg" in */{stage_name}) exit 73 ;; esac\ndone\nexec /bin/{command} "$@"\n')
        path.chmod(0o755)

    def rewrite_archive(self, change, linked=None, duplicate=False):
        with tarfile.open(self.archive) as package:
            entries = {name: package.extractfile(name).read() for name in package.getnames()}
        change(entries)
        with tarfile.open(self.archive, "w:gz") as package:
            for name, content in entries.items():
                entry = tarfile.TarInfo(name)
                entry.mode = 0o755
                entry.size = len(content)
                if linked and name == linked[0]:
                    entry.type = tarfile.SYMTYPE
                    entry.linkname = str(linked[1])
                    entry.size = 0
                    package.addfile(entry)
                else:
                    package.addfile(entry, io.BytesIO(content))
            if duplicate:
                entry = tarfile.TarInfo("aster")
                entry.size = len(entries["aster"])
                package.addfile(entry, io.BytesIO(entries["aster"]))
        # A consistent attacker controls the manifest too; the manifest stays
        # in sync so the deeper in-archive checks are what must refuse.
        self.write_manifest()

    def test_package_manifest_and_successful_install(self):
        self.assertEqual(self.package().returncode, 0)
        with tarfile.open(self.archive) as package:
            self.assertEqual(set(package.getnames()), EXPECTED_MEMBERS)
        result = self.install()
        self.assertEqual(result.returncode, 0, result.stderr)
        for name in NAMES:
            self.assertEqual((self.prefix / name).read_bytes(), (self.bins / name).read_bytes())

    def test_local_release_directory_name_does_not_classify_provenance(self):
        for name in ("local releases", "local upstream notes"):
            with self.subTest(directory=name):
                self.assets = self.root / name
                self.assets.mkdir()
                result = self.install()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("local release directory has no latest.json", result.stderr)
                self.assert_old()

    def test_package_refuses_different_source_identities(self):
        self.binary("aster-acp", IDENTITY + "-old")
        self.assertNotEqual(self.package().returncode, 0)
        self.assertFalse(self.archive.exists())

    def test_missing_binary_refuses_before_packaging(self):
        (self.bins / "aster-acp").unlink()
        self.assertNotEqual(self.package().returncode, 0)
        self.assertFalse(self.archive.exists())

    def test_staging_failure_preserves_pair(self):
        self.assertEqual(self.package().returncode, 0)
        self.fault("cp", "new-acp")
        self.assertEqual(self.install().returncode, 73)
        self.assert_old()

    def test_second_promotion_failure_rolls_back_first_binary(self):
        self.assertEqual(self.package().returncode, 0)
        self.fault("mv", "new-acp")
        self.assertEqual(self.install().returncode, 73)
        self.assert_old()
        self.assertFalse((self.prefix / ".aster-install.lock").exists())

    def test_failed_first_install_leaves_neither_binary(self):
        self.assertEqual(self.package().returncode, 0)
        for name in NAMES:
            (self.prefix / name).unlink()
        self.fault("mv", "new-acp")
        self.assertEqual(self.install().returncode, 73)
        self.assertFalse(any((self.prefix / name).exists() for name in NAMES))

    def test_rollback_preserves_original_symlink(self):
        self.assertEqual(self.package().returncode, 0)
        target = self.root / "old-target"
        target.write_text("old-aster")
        (self.prefix / "aster").unlink()
        (self.prefix / "aster").symlink_to(target)
        self.fault("mv", "new-acp")
        self.assertEqual(self.install().returncode, 73)
        self.assert_old()
        self.assertTrue((self.prefix / "aster").is_symlink())

    def test_checksum_tampering_never_replaces_a_binary(self):
        self.assertEqual(self.package().returncode, 0)
        self.rewrite_archive(lambda entries: entries.update(aster=b"corrupted"))
        result = self.install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("checksum mismatch", result.stderr)
        self.assert_old()

    def test_manifest_digest_mismatch_never_replaces_a_binary(self):
        self.assertEqual(self.package().returncode, 0)
        # Corrupt the archive without refreshing the manifest digest.
        with self.archive.open("ab") as handle:
            handle.write(b"tampered")
        result = self.install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("channel checksum mismatch", result.stderr)
        self.assert_old()

    def test_matching_checksums_do_not_allow_mixed_build_identity(self):
        self.assertEqual(self.package().returncode, 0)
        def mix(entries):
            entries["aster-acp"] = entries["aster-acp"].replace(b"fixture-source", b"older-source")
            entries["SHA256SUMS"] = "".join(
                f"{hashlib.sha256(entries[name]).hexdigest()}  {name}\n" for name in NAMES
            ).encode()
        self.rewrite_archive(mix)
        result = self.install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("source identity mismatch", result.stderr)
        self.assert_old()

    def test_unexpected_sandbox_members_are_refused(self):
        self.assertEqual(self.package().returncode, 0)
        def inject_sandbox(entries):
            entries["sandbox/aster-oci"] = b"unexpected companion"
        self.rewrite_archive(inject_sandbox)
        result = self.install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("archive member is not a release file", result.stderr)
        self.assert_old()

    def test_archive_links_are_refused_without_changing_the_foreign_file(self):
        self.assertEqual(self.package().returncode, 0)
        foreign = self.root / "foreign-file"
        foreign.write_bytes((self.bins / "aster").read_bytes())
        foreign.chmod(0o600)
        before = foreign.read_bytes()
        self.rewrite_archive(lambda _: None, linked=("aster", foreign))
        result = self.install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("regular files", result.stderr)
        self.assertEqual(foreign.read_bytes(), before)
        self.assertEqual(foreign.stat().st_mode & 0o777, 0o600)
        self.assert_old()

    def test_duplicate_archive_members_are_refused(self):
        self.assertEqual(self.package().returncode, 0)
        self.rewrite_archive(lambda _: None, duplicate=True)
        result = self.install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("duplicate archive member", result.stderr)
        self.assert_old()

    def test_foreign_archive_paths_cannot_write_outside_the_unpack_directory(self):
        self.assertEqual(self.package().returncode, 0)
        foreign = self.root / "foreign-file"
        foreign.write_bytes(b"keep this file")
        self.rewrite_archive(lambda entries: entries.update({str(foreign):b"overwritten"}))
        result = self.install()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(foreign.read_bytes(), b"keep this file")
        self.assert_old()


@unittest.skipUnless(os.name == "posix" and shutil.which("rustc"), "source stamp test requires rustc")
class SourceManifestIdentity(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="aster-source-stamp-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.files = {
            "apps/aster/main.rs": b"fn main() {}\n",
            "crates/code/lib.rs": b"pub fn pair() {}\n",
            "Cargo.toml": b"[workspace]\n",
        }
        for name, content in self.files.items():
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        harness = self.root / "pair-stamp.rs"
        harness.write_text((ROOT / "scripts/cli_pair_build.rs").read_text() + """
fn main() {
    let root = std::env::args_os().nth(1).expect("source root");
    stamp(std::path::Path::new(&root)).unwrap();
}
""")
        self.executable = self.root / "pair-stamp"
        subprocess.run(["rustc", "--edition=2024", str(harness), "-o", str(self.executable)],
            check=True, capture_output=True, text=True, timeout=30)
        self.commands = self.root / "commands"
        self.commands.mkdir()
        git = self.commands / "git"
        git.write_text(f"""#!/bin/sh
if [ "$1" = ls-files ]; then
  exit 99
fi
exec {shutil.which("git")} "$@"
""")
        git.chmod(0o755)

    def stamp(self, members):
        manifest = self.root / "sources.bin"
        manifest.write_bytes(b"".join(name.encode() + b"\0" for name in members))
        env = dict(os.environ, ASTER_CLI_PAIR_SOURCES=str(manifest), TARGET="fixture-target",
            PATH=str(self.commands) + os.pathsep + os.environ["PATH"])
        return subprocess.run([str(self.executable), str(self.source)], env=env,
            capture_output=True, text=True, timeout=10)

    def test_source_manifest_stamps_identity_without_a_git_checkout(self):
        result = self.stamp(self.files)
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = b""
        for name in sorted(self.files):
            content = self.files[name]
            payload += name.encode() + b"\0" + len(content).to_bytes(8, "little") + content
        digest = hashlib.sha1(b"blob " + str(len(payload)).encode() + b"\0" + payload).hexdigest()
        self.assertIn(f"ASTER_PAIR_BUILD_ID=aster-cli-pair-v1:{digest}:fixture-target", result.stdout)

    def test_source_manifest_refuses_parent_paths(self):
        result = self.stamp(["Cargo.toml", "../outside.rs"])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid CLI pair source path", result.stderr)

    def test_source_manifest_refuses_absolute_paths(self):
        result = self.stamp(["Cargo.toml", "/outside.rs"])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid CLI pair source path", result.stderr)

    def test_empty_source_manifest_is_refused(self):
        result = self.stamp([])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("empty CLI pair source list", result.stderr)


if __name__ == "__main__":
    unittest.main()
