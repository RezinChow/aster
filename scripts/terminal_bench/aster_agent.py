"""Harbor installed-agent adapter for Aster Code's terminal_bench_runner.

Harbor owns the task image, instruction delivery, time limits, artifacts, and
verifier. This adapter only uploads the static runner + ACL into the task
container and launches the runner against the graded workspace.
"""

from __future__ import annotations

import json
import os
import shlex
from pathlib import Path
from typing import Any

from harbor.agents.installed.base import BaseInstalledAgent, with_prompt_template
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

_REMOTE_ROOT = Path("/run/aster")
_REMOTE_BIN = _REMOTE_ROOT / "terminal_bench_runner"
_REMOTE_CONFIG = _REMOTE_ROOT / "config.acl"
_REMOTE_INSTRUCTION = _REMOTE_ROOT / "instruction.md"
_REMOTE_AUTH = _REMOTE_ROOT / "codex-auth.json"
_REMOTE_RESULT = Path("/logs/agent/aster.result.json")
_DEFAULT_WORKSPACE = "/root"


class AsterCodeAgent(BaseInstalledAgent):
    """Native Aster Code runner for Terminal-Bench / Harbor."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._uploaded_codex_auth = False

    @staticmethod
    def name() -> str:
        return "aster-code"

    def version(self) -> str | None:
        return os.environ.get("ASTER_TERMINAL_BENCH_VERSION")

    async def install(self, environment: BaseEnvironment) -> None:
        # Runner and ACL are uploaded per trial in configure(); nothing to bake.
        del environment

    async def configure(self, environment: BaseEnvironment) -> None:
        binary = self._require_host_file(
            "ASTER_TERMINAL_BENCH_BINARY",
            "path to the musl terminal_bench_runner binary",
        )
        config = self._require_host_file(
            "ASTER_CONFIG",
            "path to the evaluation ACL",
        )

        await self.exec_as_root(
            environment,
            command=(
                f"mkdir -p {shlex.quote(str(_REMOTE_ROOT))} /logs/agent && "
                # rewardkit Worker trusts only a non-other-writable /logs parent.
                "chmod 755 /logs 2>/dev/null || true"
            ),
        )
        await environment.upload_file(str(binary), str(_REMOTE_BIN))
        await environment.upload_file(str(config), str(_REMOTE_CONFIG))
        await self.exec_as_root(
            environment,
            command=(
                f"chmod 755 {shlex.quote(str(_REMOTE_BIN))} && "
                f"chmod 644 {shlex.quote(str(_REMOTE_CONFIG))}"
            ),
        )

        self._uploaded_codex_auth = False
        auth = os.environ.get("ASTERX_AUTH_FILE") or os.environ.get("CODEX_AUTH_FILE")
        if auth:
            auth_path = Path(auth).expanduser()
            if not auth_path.is_file():
                raise FileNotFoundError(f"ASTERX_AUTH_FILE not found: {auth_path}")
            await environment.upload_file(str(auth_path), str(_REMOTE_AUTH))
            await self.exec_as_root(
                environment,
                command=f"chmod 600 {shlex.quote(str(_REMOTE_AUTH))}",
            )
            self._uploaded_codex_auth = True

        skills = os.environ.get("ASTER_SKILLS_DIR")
        if skills:
            skills_path = Path(skills).expanduser()
            if not skills_path.is_dir():
                raise FileNotFoundError(f"ASTER_SKILLS_DIR not found: {skills_path}")
            remote_skills = _REMOTE_ROOT / "skills"
            await environment.upload_dir(str(skills_path), str(remote_skills))
        factory = os.environ.get("ASTER_KBURN_FACTORY_DIR")
        if factory:
            factory_path = Path(factory).expanduser()
            if not factory_path.is_dir():
                raise FileNotFoundError(f"ASTER_KBURN_FACTORY_DIR not found: {factory_path}")
            await environment.upload_dir(str(factory_path), str(_REMOTE_ROOT / "factory"))
        overlay = os.environ.get("ASTER_EVALBENCH_OVERLAY_DIR")
        if overlay:
            overlay_path = Path(overlay).expanduser()
            if not overlay_path.is_dir():
                raise FileNotFoundError(f"ASTER_EVALBENCH_OVERLAY_DIR not found: {overlay_path}")
            await environment.upload_dir(str(overlay_path), str(_REMOTE_ROOT / "evalbench-overlay"))

    @with_prompt_template
    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        del context
        workspace = await self._workspace(environment)
        kburn = os.environ.get("ASTER_KBURN", "").strip().lower()
        if kburn not in {"", "0", "1"}:
            raise RuntimeError("ASTER_KBURN must be 0, 1, or unset")
        factory = os.environ.get("ASTER_KBURN_FACTORY_DIR")
        overlay = os.environ.get("ASTER_EVALBENCH_OVERLAY_DIR")
        (self.logs_dir / "kburn-mode.txt").write_text(
            f"mode={kburn or 'auto'}\nskills_dir_configured={bool(os.environ.get('ASTER_SKILLS_DIR'))}\n"
            f"factory_dir_configured={bool(factory)}\ncontinuation_overlay={bool(overlay)}\n",
            encoding="utf-8",
        )
        if kburn == "1" and factory:
            # Full factory gives conductor skills their expected project root.
            await self.exec_as_agent(
                environment,
                command=(
                    "test ! -e .kstudio && "
                    f"cp -a {shlex.quote(str(_REMOTE_ROOT / 'factory'))} .kstudio"
                ),
                cwd=workspace,
            )
        elif kburn == "1" and os.environ.get("ASTER_SKILLS_DIR"):
            # The enabled comparison arm gets the same packaged conductor skills
            # in the graded workspace. Never replace a task-provided directory.
            await self.exec_as_agent(
                environment,
                command=(
                    "mkdir -p .aster && test ! -e .aster/skills && "
                    f"cp -a {shlex.quote(str(_REMOTE_ROOT / 'skills'))} .aster/skills"
                ),
                cwd=workspace,
            )
        if overlay:
            # Explicit repair continuation only: start from the prior best artifact.
            await self.exec_as_agent(
                environment,
                command=f"cp -a {shlex.quote(str(_REMOTE_ROOT / 'evalbench-overlay'))}/. /app/evalbench/",
                cwd=workspace,
            )

        repair_scope = os.environ.get("ASTER_REPAIR_SCOPE", "").strip().lower()
        if repair_scope not in {"", "generation"}:
            raise RuntimeError("ASTER_REPAIR_SCOPE must be generation or unset")
        if repair_scope == "generation":
            instruction += (
                "\n\nContinuation constraint: edit only `evalbench/generation.py`; "
                "every other module must remain byte-for-byte unchanged. Preserve the "
                "existing full-prefix scoring implementation. Fix early EOS handling "
                "without advancing the causal state, and prove the prior failing case."
            )

        instruction_host = self.logs_dir / "instruction.md"
        instruction_host.write_text(instruction, encoding="utf-8")
        await environment.upload_file(str(instruction_host), str(_REMOTE_INSTRUCTION))
        await self.exec_as_root(
            environment,
            command=f"chmod 644 {shlex.quote(str(_REMOTE_INSTRUCTION))}",
        )

        cmd = [
            str(_REMOTE_BIN),
            "--config",
            str(_REMOTE_CONFIG),
            "--workspace",
            workspace,
            "--prompt-file",
            str(_REMOTE_INSTRUCTION),
            "--result-file",
            str(_REMOTE_RESULT),
        ]
        if kburn == "1":
            cmd.append("--kburn")
        elif kburn == "0":
            cmd.append("--no-kburn")

        # Prefer explicit env; otherwise use an 8h TB-safe default so Harbor
        # long tasks are not silently clipped by the runner's 840s diagnostic
        # budget (see DEFAULT_EXECUTION_BUDGET_MS in terminal_bench_runner).
        max_ms = os.environ.get("ASTER_TERMINAL_BENCH_MAX_EXECUTION_MS") or "28800000"
        cmd.extend(["--max-execution-time-ms", max_ms])

        for required in await self._required_paths(environment, instruction):
            cmd.extend(["--require-path", required])

        if self._uploaded_codex_auth:
            cmd.extend(["--codex-auth", str(_REMOTE_AUTH)])
            model = os.environ.get("ASTERX_MODEL")
            if model:
                cmd.extend(["--codex-model", model])
            effort = os.environ.get("ASTERX_REASONING_EFFORT", "max")
            cmd.extend(["--codex-reasoning-effort", effort])

        env = {
            "ASTER_ALLOW_PROCESS_HOST_SANDBOX": "1",
            "ASTER_CONFIG": str(_REMOTE_CONFIG),
        }
        for key in (
            "ASTER_LLM_STREAM_IDLE_TIMEOUT_MS",
            "ASTER_TB_DEFAULT_MODEL",
            "ASTER_TB_REQUIRED_PATHS",
            "DEEPSEEK_API_KEY",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "HTTPS_PROXY",
            "HTTP_PROXY",
            "NO_PROXY",
            "ALL_PROXY",
        ):
            value = os.environ.get(key)
            if value:
                env[key] = value

        quoted = " ".join(shlex.quote(part) for part in cmd)
        await self.exec_as_agent(
            environment,
            command=(
                f"set -o pipefail; {quoted} 2>&1 | "
                f"tee /logs/agent/aster.stdout.log; "
                f"status=${{PIPESTATUS[0]}}; "
                "if [ -d .kstudio/local/loops ]; then "
                "cp -a .kstudio/local/loops /logs/agent/kburn-loops; fi; "
                "if [ -d .kstudio/evidence/loop ]; then "
                "cp -a .kstudio/evidence/loop /logs/agent/kburn-evidence; fi; "
                "if [ -d .aster/local/loops ]; then "
                "cp -a .aster/local/loops /logs/agent/kburn-loops-aster; fi; "
                "if [ -d .aster/evidence/loop ]; then "
                "cp -a .aster/evidence/loop /logs/agent/kburn-evidence-aster; fi; "
                "exit $status"
            ),
            env=env,
            cwd=workspace,
        )

    def populate_context_post_run(self, context: AgentContext) -> None:
        result_path = self.logs_dir / "aster.result.json"
        if not result_path.is_file():
            # Harbor syncs /logs/agent into logs_dir; also accept nested paths.
            candidates = list(self.logs_dir.rglob("aster.result.json"))
            if not candidates:
                return
            result_path = candidates[0]
        try:
            payload: dict[str, Any] = json.loads(result_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        metadata = dict(context.metadata or {})
        metadata["aster.code.terminal-bench-result.v1"] = payload
        context.metadata = metadata

    async def _workspace(self, environment: BaseEnvironment) -> str:
        workdir = getattr(getattr(environment, "task_env_config", None), "workdir", None)
        if isinstance(workdir, str) and workdir.strip():
            return workdir.strip()
        # Prebuilt TB images often omit workdir in task.toml; probe the image.
        try:
            result = await self.exec_as_root(environment, command="pwd")
            probed = (result.stdout or "").strip()
            if probed.startswith("/") and probed != "/":
                return probed
        except Exception:
            pass
        return _DEFAULT_WORKSPACE

    async def _required_paths(
        self, environment: BaseEnvironment, instruction: str
    ) -> list[str]:
        """Graded output paths only — skip starter inputs already in the image.

        task.toml ``artifacts`` often lists the seed tree. Gating Finish on those
        paths makes the gate always green. Prefer paths that are still missing,
        including absolute deliverables named in the instruction (e.g. ``/app/dist/...``).
        """
        candidates: list[str] = []
        raw = os.environ.get("ASTER_TB_REQUIRED_PATHS")
        if raw:
            candidates.extend(
                part.strip()
                for part in raw.replace("\n", ":").split(":")
                if part.strip()
            )
        task_toml = self._task_toml_path(environment)
        if task_toml is not None:
            candidates.extend(self._artifacts_from_task_toml(task_toml))
        candidates.extend(self._paths_from_instruction(instruction))

        ordered = self._dedupe_paths(candidates)
        missing: list[str] = []
        for path in ordered:
            if not await self._remote_exists(environment, path):
                missing.append(path)
        if missing:
            return missing

        # Everything named already exists (seed inputs). Fall back to missing
        # instruction paths under a conventional publish dir.
        distish = [
            path
            for path in self._paths_from_instruction(instruction)
            if "/dist/" in path or path.rstrip("/").endswith("/dist")
        ]
        dist_missing: list[str] = []
        for path in self._dedupe_paths(distish):
            if not await self._remote_exists(environment, path):
                dist_missing.append(path)
        return dist_missing

    async def _remote_exists(self, environment: BaseEnvironment, path: str) -> bool:
        quoted = shlex.quote(path)
        try:
            result = await self.exec_as_root(
                environment,
                command=f"if [ -e {quoted} ]; then echo yes; else echo no; fi",
            )
        except Exception:
            return False
        lines = [line.strip() for line in (result.stdout or "").splitlines() if line.strip()]
        return bool(lines) and lines[-1] == "yes"

    @staticmethod
    def _dedupe_paths(paths: list[str]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for path in paths:
            if path not in seen:
                seen.add(path)
                ordered.append(path)
        return ordered

    @staticmethod
    def _paths_from_instruction(instruction: str) -> list[str]:
        """Absolute /app/... paths named in the prompt (deliverables or inputs)."""
        import re

        found = re.findall(r"(?<![\\w])/app/[A-Za-z0-9_./-]+", instruction)
        out: list[str] = []
        for raw in found:
            path = raw.rstrip("`'\".,;:)")
            if path.startswith("/app/") and path not in out:
                out.append(path)
        return out

    @staticmethod
    def _task_toml_path(environment: BaseEnvironment) -> Path | None:
        explicit = os.environ.get("ASTER_TB_TASK_TOML")
        if explicit:
            path = Path(explicit).expanduser()
            return path if path.is_file() else None
        env_dir = getattr(environment, "environment_dir", None)
        if env_dir is None:
            return None
        candidate = Path(env_dir).parent / "task.toml"
        return candidate if candidate.is_file() else None

    @staticmethod
    def _artifacts_from_task_toml(task_toml: Path) -> list[str]:
        try:
            import tomllib
        except ImportError:  # pragma: no cover - py<3.11
            try:
                import tomli as tomllib  # type: ignore
            except ImportError:
                return []
        try:
            data = tomllib.loads(task_toml.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return []
        artifacts = data.get("artifacts")
        if not isinstance(artifacts, list):
            return []
        out: list[str] = []
        for item in artifacts:
            if isinstance(item, str) and item.startswith("/"):
                out.append(item)
        return out

    @staticmethod
    def _require_host_file(env_name: str, purpose: str) -> Path:
        raw = os.environ.get(env_name)
        if not raw:
            raise RuntimeError(f"{env_name} is required ({purpose})")
        path = Path(raw).expanduser()
        if not path.is_file():
            raise FileNotFoundError(f"{env_name} not found: {path}")
        return path
