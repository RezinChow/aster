"""Drive the shipped Aster TUI visibly inside a Harbor Docker task.

The TUI and its ACP companion run inside the graded container. A macOS Terminal
window attaches through ``docker exec -it``; agent-desktop and the existing
visual harness provide window binding, focus, input and PNG evidence. Harbor's
native verifier remains the only task-pass authority.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from harbor.agents.installed.base import with_prompt_template
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from aster_agent import AsterCodeAgent, _REMOTE_CONFIG, _REMOTE_ROOT


_REMOTE_BIN_DIR = _REMOTE_ROOT / "bin"
_REMOTE_TUI = _REMOTE_BIN_DIR / "aster"
_REMOTE_ACP = _REMOTE_BIN_DIR / "aster-acp"
_REMOTE_HOME = _REMOTE_ROOT / "home"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _compose_project(session_id: str) -> str:
    name = session_id.lower()
    if not re.match(r"^[a-z0-9]", name):
        name = "0" + name
    return re.sub(r"[^a-z0-9_-]", "-", name)


def _visual_helpers():
    harness = (
        Path(__file__).resolve().parents[2]
        / "apps"
        / "aster"
        / "tests"
        / "visual_tui_harness"
    )
    sys.path.insert(0, str(harness))
    import drive_shop_multiturn as visual

    return visual


class AsterCodeVisualTuiAgent(AsterCodeAgent):
    """Aster TUI + ACP driven through an agent-desktop-visible Terminal."""

    @staticmethod
    def name() -> str:
        return "aster-code-visual-tui"

    async def configure(self, environment: BaseEnvironment) -> None:
        if sys.platform != "darwin":
            raise RuntimeError("the visual TUI adapter requires a macOS host")
        for tool in ("agent-desktop", "docker", "osascript", "screencapture"):
            if shutil.which(tool) is None:
                raise RuntimeError(f"visual TUI prerequisite is missing: {tool}")

        tui = self._require_host_file("ASTER_TUI_BINARY", "Linux Aster TUI binary")
        acp = self._require_host_file("ASTER_ACP_BINARY", "Linux Aster ACP binary")
        config = self._require_host_file("ASTER_CONFIG", "path to the evaluation ACL")
        self._binary_facts = {
            "aster_sha256": _sha256(tui),
            "aster_acp_sha256": _sha256(acp),
        }

        await self.exec_as_root(
            environment,
            command=(
                f"mkdir -p {shlex.quote(str(_REMOTE_BIN_DIR))} "
                f"{shlex.quote(str(_REMOTE_HOME))} /logs/agent && chmod 755 /logs"
            ),
        )
        for source, target in ((tui, _REMOTE_TUI), (acp, _REMOTE_ACP), (config, _REMOTE_CONFIG)):
            await environment.upload_file(str(source), str(target))
        await self.exec_as_root(
            environment,
            command=(
                f"chmod 755 {shlex.quote(str(_REMOTE_TUI))} "
                f"{shlex.quote(str(_REMOTE_ACP))} && "
                f"chmod 644 {shlex.quote(str(_REMOTE_CONFIG))}"
            ),
        )
        architecture = await self.exec_as_root(environment, command="uname -m")
        arch = (architecture.stdout or "").strip()
        if arch != "x86_64":
            raise RuntimeError(f"visual pair targets x86_64, but task container is {arch!r}")
        tui_id = await self.exec_as_root(
            environment, command=f"{shlex.quote(str(_REMOTE_TUI))} --build-id"
        )
        acp_id = await self.exec_as_root(
            environment, command=f"{shlex.quote(str(_REMOTE_ACP))} --build-id"
        )
        self._tui_build_id = (tui_id.stdout or "").strip()
        self._acp_build_id = (acp_id.stdout or "").strip()
        if not self._tui_build_id or self._tui_build_id != self._acp_build_id:
            raise RuntimeError(
                "Aster TUI and ACP build identities differ: "
                f"{self._tui_build_id!r} != {self._acp_build_id!r}"
            )

    @with_prompt_template
    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        del context
        visual = _visual_helpers()
        evidence = self.logs_dir
        evidence.mkdir(parents=True, exist_ok=True)
        (evidence / "instruction.md").write_text(instruction, encoding="utf-8")
        workspace = await self._workspace(environment)
        container = self._container_id(environment)
        model = os.environ.get("ASTER_TB_DEFAULT_MODEL", "kimi/k3.1-pro")
        title_tag = f"ASTER-TB4-VISUAL-{int(time.time())}"
        exit_file = evidence / "tui.exit"
        launch = evidence / "launch_visual_tui.sh"
        remote_env = {
            "TERM": "xterm-256color",
            "HOME": str(_REMOTE_HOME),
            "GROK_HOME": str(_REMOTE_HOME / "grok"),
            "ASTER_CONFIG": str(_REMOTE_CONFIG),
            "ASTER_ALLOW_PROCESS_HOST_SANDBOX": "1",
            "ASTER_DISABLE_GROK_ACCOUNT": "1",
            "ASTER_DISABLE_CURSOR_ACCOUNT": "1",
        }
        env_args = " ".join(
            f"{key}={shlex.quote(value)}" for key, value in remote_env.items()
        )
        command = (
            f"docker exec -it {shlex.quote(container)} env {env_args} "
            f"{shlex.quote(str(_REMOTE_TUI))} --cwd {shlex.quote(workspace)} "
            f"--model {shlex.quote(model)} --no-plan --fullscreen"
        )
        launch.write_text(
            "#!/bin/bash\nset -u\n"
            f"printf '\\033]0;{title_tag}\\007'\n"
            f"{command}\n"
            "status=$?\n"
            f"printf '%s\\n' \"$status\" > {shlex.quote(str(exit_file))}\n"
            f"printf '\\nAster TUI exited with status %s\\n' \"$status\"\n",
            encoding="utf-8",
        )
        launch.chmod(0o755)

        before_ids = {w["id"] for w in visual.list_aster_terminal_windows()}
        subprocess.run(["open", "-a", "Terminal", str(launch)], check=True)
        wid = visual.find_wid(container, title_tag=title_tag, before_ids=before_ids)
        (evidence / "window-id.txt").write_text(wid + "\n", encoding="utf-8")
        visual.sh(
            ["agent-desktop", "focus-window", "--app", "终端", "--window-id", wid],
            check=False,
        )
        await asyncio.sleep(3)
        visual.capture(evidence, wid, "001-launched")
        visual.paste_submit(instruction)
        (evidence / "prompt-submitted.txt").write_text(
            "The official task instruction was pasted into the visible TUI once.\n",
            encoding="utf-8",
        )

        budget_ms = int(os.environ.get("ASTER_TERMINAL_BENCH_MAX_EXECUTION_MS", "28800000"))
        deadline = time.monotonic() + budget_ms / 1000
        started = time.monotonic()
        stable_since: float | None = None
        captures = 1
        last_periodic = time.monotonic()
        permission_answers = 0
        trust_answers = 0
        turn_completed = False
        failure_text = ""
        final_history = ""

        while time.monotonic() < deadline:
            if exit_file.is_file():
                failure_text = "TUI exited before the driver could settle the turn"
                break
            history = visual.terminal_history()
            final_history = history
            tail = "\n".join(history.splitlines()[-100:])
            if "Do you trust the contents of this directory" in tail:
                visual.keystroke_raw('  keystroke "y"\n')
                trust_answers += 1
                await asyncio.sleep(1)
                continue
            if "Yes, proceed" in tail and "Ctrl+o:yolo" in tail.lower():
                visual.keystroke_raw('  keystroke "1"\n')
                permission_answers += 1
                await asyncio.sleep(1)
                continue
            if time.monotonic() - last_periodic >= 60:
                captures += 1
                visual.capture(evidence, wid, f"{captures:03d}-progress")
                last_periodic = time.monotonic()
            completed = "Worked for" in history or "Turn failed" in history
            if completed and visual.settled(history):
                turn_completed = True
                stable_since = stable_since or time.monotonic()
                if time.monotonic() - stable_since >= 15:
                    break
            else:
                stable_since = None
            await asyncio.sleep(2)
        else:
            failure_text = f"visual TUI did not settle within {budget_ms} ms"

        captures += 1
        visual.capture(evidence, wid, f"{captures:03d}-settled")
        (evidence / "final-terminal-history.txt").write_text(final_history, encoding="utf-8")
        if turn_completed:
            visual.paste_submit("/quit")
            for _ in range(30):
                if exit_file.is_file():
                    break
                await asyncio.sleep(1)
        exit_status = exit_file.read_text(encoding="utf-8").strip() if exit_file.is_file() else "missing"
        result = {
            "schema": "aster.code.terminal-bench-visual-tui-result.v1",
            "model": model,
            "workspace": workspace,
            "container": container,
            "pair_build_id": self._tui_build_id,
            **self._binary_facts,
            "window_id": wid,
            "prompt_submissions": 1,
            "turn_completed": turn_completed,
            "trust_answers": trust_answers,
            "permission_answers": permission_answers,
            "screenshots": captures,
            "elapsed_seconds": round(time.monotonic() - started, 3),
            "tui_exit_status": exit_status,
            "driver_failure": failure_text,
            "official_verifier": "Harbor native verifier; not run by this driver",
        }
        (evidence / "visual-tui-result.json").write_text(
            json.dumps(result, indent=2) + "\n", encoding="utf-8"
        )
        if failure_text or not turn_completed or exit_status != "0":
            raise RuntimeError(f"visual TUI evaluation failed: {json.dumps(result)}")

    def populate_context_post_run(self, context: AgentContext) -> None:
        result_path = self.logs_dir / "visual-tui-result.json"
        if not result_path.is_file():
            candidates = list(self.logs_dir.rglob("visual-tui-result.json"))
            if not candidates:
                return
            result_path = candidates[0]
        try:
            payload: dict[str, Any] = json.loads(result_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        metadata = dict(context.metadata or {})
        metadata[payload["schema"]] = payload
        context.metadata = metadata

    @staticmethod
    def _container_id(environment: BaseEnvironment) -> str:
        session_id = getattr(environment, "session_id", "")
        if not session_id:
            raise RuntimeError("visual TUI requires a Docker environment session id")
        project = _compose_project(session_id)
        proc = subprocess.run(
            [
                "docker",
                "ps",
                "--filter",
                f"label=com.docker.compose.project={project}",
                "--filter",
                "label=com.docker.compose.service=main",
                "--format",
                "{{.ID}}",
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        containers = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        if len(containers) != 1:
            raise RuntimeError(
                f"expected one Harbor main container for {project}, got {containers}"
            )
        return containers[0]
