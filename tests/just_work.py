import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import textwrap
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
            executable.write_text(
                '#!/bin/sh\nprintf "%s\\n" "$@" > "$ASTER_OPEN_LOG"\n'
                'printf "%s" "${A3S_CONFIG-}" > "$ASTER_CONFIG_LOG"\n'
            )
            executable.chmod(0o755)
            log = root / "arguments.txt"
            config_log = root / "config.txt"
            env = dict(os.environ, PATH=f"{tools}:{os.environ['PATH']}",
                       ASTER_TEST_TARGET=str(target), ASTER_OPEN_LOG=str(log),
                       ASTER_CONFIG_LOG=str(config_log))
            env.pop("A3S_CONFIG", None)
            result = subprocess.run(["just", "code", "--cwd", "/tmp/aster project"],
                                    cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(log.read_text().splitlines(), ["--cwd", "/tmp/aster project"])
            self.assertEqual(config_log.read_text(), "")
            acl = root / ".a3s" / "config.acl"
            acl.parent.mkdir()
            acl.write_text('default_model = "fixture/local"\n')
            result = subprocess.run(["just", "code"], cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(Path(config_log.read_text()), acl.resolve())
            env["A3S_CONFIG"] = "/tmp/kept-by-user.acl"
            result = subprocess.run(["just", "code"], cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(config_log.read_text(), "/tmp/kept-by-user.acl")
            env.pop("A3S_CONFIG", None)
            log.unlink()
            env["ASTER_TEST_FAIL"] = "1"
            result = subprocess.run(["just", "code"], cwd=root, env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(log.exists(), "failed builds must not launch a stale executable")


@unittest.skipUnless(os.name == "nt", "Windows launcher uses powershell.exe")
class WindowsCodeLauncherTest(unittest.TestCase):
    def compile_probe(self, executable: Path) -> None:
        source = r"""
using System;
using System.IO;
public class AsterProbe {
    public static int Main(string[] args) {
        File.WriteAllLines(Environment.GetEnvironmentVariable("ASTER_OPEN_LOG"), args);
        var config = Environment.GetEnvironmentVariable("A3S_CONFIG") ?? "";
        File.WriteAllText(Environment.GetEnvironmentVariable("ASTER_CONFIG_LOG"), config, new System.Text.UTF8Encoding(false));
        return 0;
    }
}
"""
        script = (
            "$source = @'\n"
            + source.strip()
            + "\n'@\n"
            + f"Add-Type -TypeDefinition $source -OutputAssembly '{executable}' -OutputType ConsoleApplication\n"
        )
        result = subprocess.run(
            ["powershell.exe", "-NoLogo", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(executable.is_file(), result.stderr)

    def test_code_runs_the_built_binary_and_preserves_arguments(self):
        with tempfile.TemporaryDirectory(prefix="aster-code-win-") as directory:
            root = Path(directory)
            shutil.copy2(Path(__file__).resolve().parents[1] / "justfile", root / "justfile")
            tools = root / "bin"
            tools.mkdir()
            target = root / "custom target"
            executable = target / "debug" / "aster.exe"
            executable.parent.mkdir(parents=True)
            self.compile_probe(executable)
            target_arg = target.as_posix()
            (tools / "cargo.cmd").write_text(
                "@echo off\r\n"
                "if \"%~1\"==\"metadata\" (\r\n"
                "  echo {\"target_directory\":\"%ASTER_TEST_TARGET%\"}\r\n"
                "  exit /b 0\r\n"
                ")\r\n"
                "if \"%~1\"==\"build\" (\r\n"
                "  >\"%ASTER_PROTOC_LOG%\" echo %PROTOC%\r\n"
                "  exit /b %ASTER_TEST_FAIL%\r\n"
                ")\r\n"
                "echo unexpected Cargo command 1>&2\r\n"
                "exit /b 1\r\n",
                encoding="ascii",
            )
            log = root / "arguments.txt"
            config_log = root / "config.txt"
            protoc_log = root / "protoc.txt"
            project = root / "aster project"
            local_app = root / "localapp"
            known_protoc = local_app / "protoc" / "bin" / "protoc.exe"
            known_protoc.parent.mkdir(parents=True)
            known_protoc.write_bytes(b"")
            path_entries = [
                entry
                for entry in os.environ["PATH"].split(os.pathsep)
                if "protoc" not in entry.lower()
            ]
            env = dict(
                os.environ,
                PATH=f"{tools}{os.pathsep}{os.pathsep.join(path_entries)}",
                LOCALAPPDATA=str(local_app),
                ASTER_TEST_TARGET=target_arg,
                ASTER_OPEN_LOG=str(log),
                ASTER_CONFIG_LOG=str(config_log),
                ASTER_PROTOC_LOG=str(protoc_log),
                ASTER_TEST_FAIL="0",
            )
            env.pop("PROTOC", None)
            env.pop("A3S_CONFIG", None)
            result = subprocess.run(
                ["just", "code", "--cwd", str(project)],
                cwd=root,
                env=env,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(log.read_text().splitlines(), ["--cwd", str(project)])
            self.assertEqual(config_log.read_text(), "")
            self.assertEqual(protoc_log.read_text().strip(), str(known_protoc))
            acl = root / ".a3s" / "config.acl"
            acl.parent.mkdir()
            acl.write_text('default_model = "fixture/local"\n', encoding="ascii")
            result = subprocess.run(
                ["just", "code"],
                cwd=root,
                env=env,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(Path(config_log.read_text().strip()), acl.resolve())
            env["A3S_CONFIG"] = str(root / "kept-by-user.acl")
            result = subprocess.run(
                ["just", "code"],
                cwd=root,
                env=env,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(config_log.read_text().strip(), env["A3S_CONFIG"])
            env.pop("A3S_CONFIG", None)
            log.unlink()
            env["ASTER_TEST_FAIL"] = "1"
            result = subprocess.run(
                ["just", "code"],
                cwd=root,
                env=env,
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(log.exists(), "failed builds must not launch a stale executable")


@unittest.skipUnless(os.name == "posix", "Studio entry fixtures use POSIX scripts")
class StudioLauncherTest(unittest.TestCase):
    def test_removed_work_builds_are_not_distributed(self):
        root = Path(__file__).resolve().parents[1]
        result = subprocess.run(["just", "--summary"], cwd=root, check=True,
                                capture_output=True, text=True, timeout=5)
        recipes = result.stdout.split()
        self.assertNotIn("build-work", recipes)
        self.assertNotIn("build-work-release", recipes)

    def test_default_entrypoints_open_aster_studio_without_legacy_work_process_control(self):
        for recipe in ("studio", "dev", "work"):
            with self.subTest(recipe=recipe), tempfile.TemporaryDirectory(prefix="aster-studio-entry-") as directory:
                root, env, opened = self.fixture(directory)
                result = subprocess.run(["just", recipe], cwd=root, env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(opened.read_text().strip(), "aster 1")
                self.assertFalse((root / "cargo.txt").exists(), "the Studio shell owns its builds")

    def test_explicit_toyou_and_environment_selection_are_preserved(self):
        with tempfile.TemporaryDirectory(prefix="aster-studio-selection-") as directory:
            root, env, opened = self.fixture(directory)
            env["A3S_TENANT_SLUG"] = "aster"
            result = subprocess.run(["just", "studio", "toyou"], cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(opened.read_text().strip(), "toyou 1")
            env["A3S_TENANT_SLUG"] = "toyou"
            result = subprocess.run(["just", "studio"], cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(opened.read_text().strip(), "toyou 1")

    def test_product_build_selects_exactly_one_feature_without_default_product(self):
        for tenant in ("aster", "toyou"):
            with self.subTest(tenant=tenant), tempfile.TemporaryDirectory(prefix="aster-studio-build-") as directory:
                root, env, _ = self.fixture(directory)
                self.product_fixture(root, tenant)
                cargo = root / "bin/cargo"
                cargo.write_text('#!/usr/bin/env python3\nimport json,os,sys\nwith open(os.environ["ASTER_CARGO_LOG"],"a") as out: out.write(json.dumps(sys.argv[1:])+"\\n")\n')
                result = subprocess.run(["just", "build-studio", tenant], cwd=root, env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                import json
                calls = [json.loads(line) for line in (root / "cargo.txt").read_text().splitlines()]
                self.assertEqual(calls[0], ["build", "--locked", "-p", "a3s-code-acp", "-p", "a3s-office-cli"])
                self.assertEqual(calls[1], ["build", "--locked", "-p", "a3s-studio", "--no-default-features", "--features", f"tenant-{tenant}"])

    def test_invalid_brand_refuses_before_compiling_either_product(self):
        for tenant in ("aster", "toyou"):
            with self.subTest(tenant=tenant), tempfile.TemporaryDirectory(prefix="aster-studio-brand-") as directory:
                root, env, _ = self.fixture(directory)
                self.product_fixture(root, tenant)
                info = root / "apps/web/public/tenant" / tenant / "INFO.md"
                info.write_text(info.read_text().replace('product: "Aster"', 'product: "Wrong"').replace('product: "ToWork"', 'product: "Wrong"'))
                result = subprocess.run(["just", "build-studio", tenant], cwd=root, env=env,
                                        capture_output=True, text=True, timeout=10)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("brand", result.stderr)
                self.assertFalse((root / "cargo.txt").exists(), "invalid brand must refuse before a compiler starts")

    def product_fixture(self, root, tenant):
        source = Path(__file__).resolve().parents[1] / "apps/studio/scripts/studio_product.py"
        shutil.copy2(source, root / "apps/studio/scripts/studio_product.py")
        brand = root / "apps/web/public/tenant" / tenant
        brand.mkdir(parents=True)
        for name in ("icon.icns", "icon.png", "icon.ico", "logo-light.png", "mark-light.png"):
            (brand / name).write_bytes(b"fixture icon")
        product = "Aster" if tenant == "aster" else "ToWork"
        (brand / "INFO.md").write_text(f'---\nname:\n  en: "{product}"\nproduct: "{product}"\nlogos:\n  light_surface: logo-light.png\n---\n')

    def test_invalid_tenant_refuses_before_launch(self):
        for slug in ("", " ", "Bad", "../aster"):
            with self.subTest(slug=slug), tempfile.TemporaryDirectory(prefix="aster-studio-invalid-") as directory:
                root, env, opened = self.fixture(directory)
                result = subprocess.run(["just", "studio", slug], cwd=root, env=env, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("invalid tenant slug", result.stderr)
                self.assertFalse(opened.exists())

    def fixture(self, directory):
        root = Path(directory)
        shutil.copy2(Path(__file__).resolve().parents[1] / "justfile", root / "justfile")
        tools = root / "bin"
        tools.mkdir()
        for name, script in {
            "bun": '#!/bin/sh\nexit 0\n',
            "cargo": '#!/bin/sh\nprintf "unexpected cargo\\n" > "$ASTER_CARGO_LOG"\nexit 37\n',
        }.items():
            command = tools / name
            command.write_text(script)
            command.chmod(0o755)
        script = root / "apps/studio/scripts/studio-shell.sh"
        script.parent.mkdir(parents=True)
        script.write_text('#!/bin/sh\nprintf "%s %s\\n" "$A3S_TENANT_SLUG" "$STUDIO_RENDERER_DEV" > "$ASTER_OPEN_LOG"\n')
        script.chmod(0o755)
        opened = root / "opened.txt"
        env = dict(os.environ, PATH=f"{tools}:{os.environ['PATH']}", ASTER_OPEN_LOG=str(opened),
                   ASTER_CARGO_LOG=str(root / "cargo.txt"))
        env.pop("A3S_TENANT_SLUG", None)
        env.pop("STUDIO_RENDERER_DEV", None)
        return root, env, opened


@unittest.skipUnless(os.name == "posix", "Build entrypoints use Bash")
class BuildPreflightTest(unittest.TestCase):
    def test_ci_refuses_config_errors_before_cargo(self):
        root = Path(__file__).resolve().parents[1]
        source = (root / ".github/workflows/ci.yml").read_text()
        step = source.split("- name: Build and test desktop product identities\n", 1)[1]
        body = textwrap.dedent(step.split("run: |\n", 1)[1].split("\n      - name:", 1)[0])
        self.refuses_before_cargo(body)

    def test_kylin_build_refuses_config_errors_before_cargo(self):
        root = Path(__file__).resolve().parents[1]
        source = (root / "apps/studio/scripts/kylin-flatpak/build-host.sh").read_text()
        body = source.split("bash -euo pipefail -c '\n", 1)[1].rsplit("\n'", 1)[0]
        self.refuses_before_cargo(body)

    def refuses_before_cargo(self, body):
        with tempfile.TemporaryDirectory(prefix="aster-build-refusal-") as directory:
            marker = Path(directory) / "compiler-called"
            env = dict(os.environ, ASTER_COMPILER_MARKER=str(marker), A3S_TENANT_SLUG="toyou",
                       STUDIO_RENDERER_DIST="fixture-renderer")
            runner = '''
python3() { if [[ "${3:-}" == tauri-config ]]; then return 42; fi; printf 'tenant-%s\\n' "$A3S_TENANT_SLUG"; }
cargo() { printf called >"$ASTER_COMPILER_MARKER"; return 73; }
'''
            result = subprocess.run(["bash", "-euo", "pipefail", "-c", runner + body], env=env,
                                    capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 42, result.stderr)
            self.assertFalse(marker.exists(), "a failed config command must never reach Cargo")


if __name__ == "__main__":
    unittest.main()
