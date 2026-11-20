#!/usr/bin/env python3
"""Idempotent local Harbor patch: keep /logs mode 755 for rewardkit Worker.

rewardkit secures /logs/verifier with trusted parents. A 777 /logs parent
raises ``Untrusted parent directory of /logs/verifier`` and Harbor then fails
with RewardFileNotFoundError (seen on TB4 biped-contact-dynamics).

Applies to the Harbor package that ``harbor`` resolves. Safe to re-run.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def _harbor_root() -> Path:
    spec = importlib.util.find_spec("harbor")
    if spec is not None and spec.origin:
        return Path(spec.origin).resolve().parent
    # Prefer the same Harbor the `harbor` CLI resolves when system python
    # does not see the uv tool env.
    for candidate in (
        Path.home() / ".local/share/uv/tools/harbor/lib",
        Path.home() / ".local/pipx/venvs/harbor/lib",
    ):
        if not candidate.is_dir():
            continue
        matches = sorted(candidate.glob("python*/site-packages/harbor/__init__.py"))
        if matches:
            return matches[-1].resolve().parent
    raise SystemExit("harbor package not importable; install Harbor first")


def _patch_file(path: Path, old: str, new: str, label: str) -> bool:
    text = path.read_text(encoding="utf-8")
    if "chmod 755 /logs 2>/dev/null || true" in text and label in text:
        print(f"ok: already patched ({label}) {path}")
        return False
    if old not in text:
        raise SystemExit(f"patch site missing in {path} ({label})")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched ({label}): {path}")
    return True


def main() -> int:
    root = _harbor_root()
    base = root / "environments" / "base.py"
    trial = root / "trial" / "trial.py"

    ensure_old = '''        create_args = " ".join(q(path) for path in dirs)
        command = f"mkdir -p {create_args}"
        if chmod:
            command += f" && chmod 777 {create_args}"
        return command'''
    ensure_new = '''        create_args = " ".join(q(path) for path in dirs)
        command = f"mkdir -p {create_args}"
        if chmod:
            command += f" && chmod 777 {create_args}"
            # rewardkit Worker requires /logs root-owned and not other-writable.
            if any(
                str(path).rstrip("/") == "/logs" or str(path).startswith("/logs/")
                for path in dirs
            ):
                command += " && chmod 755 /logs 2>/dev/null || true"
        return command'''
    _patch_file(base, ensure_old, ensure_new, "ensure_dirs")

    empty_old = '''            if chmod:
                commands.append(f"chmod 777 {quoted}")
        return " && ".join(commands)'''
    empty_new = '''            if chmod:
                commands.append(f"chmod 777 {quoted}")
        command = " && ".join(commands)
        # Keep /logs trusted for rewardkit private_paths (/logs/verifier).
        if chmod and any(
            str(path).rstrip("/") == "/logs" or str(path).startswith("/logs/")
            for path in dirs
        ):
            command += " && chmod 755 /logs 2>/dev/null || true"
        return command'''
    _patch_file(base, empty_old, empty_new, "empty_dirs")

    trial_old = '''                await target_env.empty_dirs([env_paths.verifier_dir], chmod=True)

                await self._artifact_handler.upload_artifacts(
                    target_env,
                    artifacts_dir=artifacts_dir,
                    source_artifacts_dir=self.agent_env_paths.artifacts_dir,
                    target_artifacts_dir=env_paths.artifacts_dir,
                    artifacts=artifacts,
                )

                verifier = VerifierFactory.create_verifier_from_config('''
    trial_new = '''                await target_env.empty_dirs([env_paths.verifier_dir], chmod=True)

                await self._artifact_handler.upload_artifacts(
                    target_env,
                    artifacts_dir=artifacts_dir,
                    source_artifacts_dir=self.agent_env_paths.artifacts_dir,
                    target_artifacts_dir=env_paths.artifacts_dir,
                    artifacts=artifacts,
                )
                # rewardkit Worker.private_paths includes /logs/verifier; a 777
                # /logs parent fails with Untrusted parent directory.
                await target_env.exec(
                    "chmod 755 /logs 2>/dev/null || true",
                    user="root",
                )

                verifier = VerifierFactory.create_verifier_from_config('''
    _patch_file(trial, trial_old, trial_new, "separate_verifier")
    print(f"harbor root: {root}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
