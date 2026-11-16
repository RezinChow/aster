#!/usr/bin/env python3
"""Collect /k-review inputs and run declared checks without a shell.

Checks prove only their recorded results. They do not decide code quality or
product acceptance, and hashes detect drift rather than authenticate a runner.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import signal
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

CONFIG = ".kstudio/workflow/review-checks.json"
EXCLUDED = (".kstudio/evidence/", ".kstudio/wiki/site/")
SCHEMA = "kstudio.review-receipt.v1"
ID = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def within(root: Path, value: str) -> Path:
    path = Path(value)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"path must stay inside its root: {value}")
    result = (root / path).resolve()
    if not result.is_relative_to(root):
        raise ValueError(f"path escapes its root: {value}")
    return result


def load_config(root: Path) -> tuple[list[dict], str | None, list[str]]:
    config_hash = None
    try:
        path = within(root, CONFIG)
        raw = path.read_bytes()
        config_hash = digest(raw)
        config = json.loads(raw)
        if not isinstance(config, dict) or config.get("schema") != "kstudio.review-checks.v1":
            raise ValueError("expected schema kstudio.review-checks.v1")
        checks = config.get("checks")
        if not isinstance(checks, list) or not checks:
            raise ValueError("checks must be a nonempty list")
        seen = set()
        for row in checks:
            if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not ID.fullmatch(row["id"]):
                raise ValueError("each check needs a lowercase id")
            if row["id"] in seen:
                raise ValueError(f"duplicate check id: {row['id']}")
            seen.add(row["id"])
            argv = row.get("argv")
            if not isinstance(argv, list) or not argv or any(not isinstance(a, str) or not a or "\0" in a for a in argv):
                raise ValueError(f"{row['id']}: argv must be a nonempty string array")
            cwd = row.get("cwd", ".")
            if not isinstance(cwd, str) or not within(root, cwd).is_dir():
                raise ValueError(f"{row['id']}: cwd must be a repository directory")
            systems = row.get("platforms", ["darwin", "linux", "win32"])
            if not isinstance(systems, list) or not systems or any(s not in ("darwin", "linux", "win32") for s in systems):
                raise ValueError(f"{row['id']}: invalid platforms")
            timeout = row.get("timeout_seconds", 60)
            if type(timeout) not in (int, float) or not 0 < timeout <= 3600:
                raise ValueError(f"{row['id']}: timeout_seconds must be between 0 and 3600")
        return checks, config_hash, []
    except (OSError, ValueError, TypeError) as error:
        return [], config_hash, [f"{CONFIG}: {error}"]


def git(root: Path, *args: str) -> bytes:
    result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, check=True)
    return result.stdout


def snapshot(root: Path) -> dict:
    paths = [".", *(f":(exclude){p}**" for p in EXCLUDED)]
    names = set(git(root, "diff", "--name-only", "-z", "HEAD", "--", *paths).split(b"\0"))
    names.update(git(root, "diff", "--cached", "--name-only", "-z", "HEAD", "--", *paths).split(b"\0"))
    names.update(git(root, "ls-files", "--others", "--exclude-standard", "-z", "--", *paths).split(b"\0"))
    files = {}
    for raw in sorted(names - {b""}):
        name = os.fsdecode(raw)
        path = root / name
        if path.is_symlink():
            files[name] = {"kind": "symlink", "sha256": digest(os.fsencode(os.readlink(path)))}
        elif path.is_file():
            files[name] = {"kind": "file", "sha256": digest(path.read_bytes())}
        elif not path.exists():
            files[name] = {"kind": "deleted"}
        else:
            raise ValueError(f"cannot fingerprint changed directory/submodule: {name}")
    return {
        "head": git(root, "rev-parse", "HEAD").decode().strip(),
        "branch": git(root, "branch", "--show-current").decode().strip(),
        "index_sha256": digest(git(root, "diff", "--cached", "--binary", "HEAD", "--", *paths)),
        "diff_sha256": digest(git(root, "diff", "--binary", "HEAD", "--", *paths)),
        "dirty_files": files,
        "excluded_paths": list(EXCLUDED),
    }


def exit_status(code: int | None) -> str:
    if code is None or code == 77:
        return "blocked"
    return "passed" if code == 0 else "failed"


def aggregate(checks: list[dict], errors: list[str]) -> str:
    if errors or not checks:
        return "blocked"
    states = {row["status"] for row in checks}
    if "failed" in states:
        return "failed"
    if "blocked" in states:
        return "blocked"
    return "checks_passed" if states == {"passed"} else "not_run"


def code_for(status: str) -> int:
    return 0 if status == "checks_passed" else 77 if status in ("blocked", "not_run") else 1


def execute(root: Path, out: Path, check: dict, run: bool) -> dict:
    result = {
        "id": check["id"], "argv": check["argv"], "cwd": check.get("cwd", "."),
        "status": "not_run", "exit_code": None,
    }
    if not run:
        return result
    log = out / "logs" / f"{check['id']}.log"
    log.parent.mkdir(exist_ok=True)
    result["started_at"] = now()
    code = None
    with log.open("wb") as stream:
        try:
            if sys.platform not in check.get("platforms", ["darwin", "linux", "win32"]):
                stream.write(f"blocked: requires {check['platforms']}; actual {sys.platform}\n".encode())
            else:
                process = subprocess.Popen(
                    check["argv"], cwd=within(root, check.get("cwd", ".")),
                    stdin=subprocess.DEVNULL, stdout=stream, stderr=subprocess.STDOUT,
                    start_new_session=os.name != "nt",
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
                )
                try:
                    code = process.wait(timeout=check.get("timeout_seconds", 60))
                except subprocess.TimeoutExpired:
                    # Test runners spawn workers; killing only their parent leaves writes running.
                    if os.name == "nt":
                        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                                       stdout=stream, stderr=subprocess.STDOUT, timeout=10, check=True)
                    else:
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                    process.wait(timeout=10)
                    raise
        except (OSError, subprocess.TimeoutExpired, subprocess.CalledProcessError) as error:
            stream.write(f"\nblocked: {error}\n".encode(errors="replace"))
    result.update(status=exit_status(code), exit_code=code, finished_at=now(),
                  log=str(log.relative_to(out)), sha256=digest(log.read_bytes()))
    return result


def verify(root: Path, path: Path) -> tuple[dict, list[str]]:
    receipt = json.loads(path.read_text())
    if not isinstance(receipt, dict) or receipt.get("schema") != SCHEMA:
        raise ValueError(f"expected schema {SCHEMA}")
    checks, config_hash, errors = load_config(root)
    problems = []
    if receipt.get("snapshot") != snapshot(root):
        problems.append("source snapshot changed (HEAD, index or dirty files); rerun checks")
    if receipt.get("config_sha256") != config_hash or receipt.get("config_errors") != errors:
        problems.append("check configuration changed; rerun checks")
    if receipt.get("platform") != {"system": sys.platform, "machine": platform.machine()}:
        problems.append("receipt is from a different platform; verify on the matching platform")
    records = receipt.get("checks")
    if not isinstance(records, list) or len(records) != len(checks):
        raise ValueError("receipt check set does not match declared checks")
    for spec, record in zip(checks, records):
        if not isinstance(record, dict) or any(record.get(k) != v for k, v in {
            "id": spec["id"], "argv": spec["argv"], "cwd": spec.get("cwd", "."),
        }.items()):
            raise ValueError("receipt check identity does not match configuration")
        state = record.get("status")
        code = record.get("exit_code")
        if state == "not_run":
            if code is not None or "log" in record:
                raise ValueError("not_run check contains execution results")
            continue
        if code is not None and type(code) is not int:
            raise ValueError("invalid exit code")
        if state != exit_status(code):
            raise ValueError("check status disagrees with its full process exit code")
        if sys.platform not in spec.get("platforms", ["darwin", "linux", "win32"]) and state != "blocked":
            raise ValueError("check passed on an unsupported platform")
        log_name = record.get("log")
        if log_name != f"logs/{spec['id']}.log":
            raise ValueError("invalid check log path")
        log = within(path.parent.resolve(), log_name)
        if not log.is_file() or record.get("sha256") != digest(log.read_bytes()):
            problems.append(f"{spec['id']}: log is missing or changed")
    expected = aggregate(records, errors)
    if receipt.get("status") not in (expected, "stale") or receipt.get("review_status") != "pending":
        raise ValueError("receipt aggregate/review status is inconsistent")
    return receipt, problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--out", type=Path, help="new evidence directory (never overwritten)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--run", action="store_true", help="execute reviewed project check declarations")
    mode.add_argument("--verify", type=Path, help="verify an existing receipt against current inputs and logs")
    mode.add_argument("--check-config", action="store_true", help="validate declarations only (used by L3)")
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        if args.verify:
            receipt, errors = verify(root, args.verify.resolve())
            if errors:
                print("stale: " + "; ".join(errors), file=sys.stderr)
                return 1
            print(f"integrity_verified: {receipt['status']}; review pending; not product Pass")
            return code_for(receipt["status"])
        checks, config_hash, errors = load_config(root)
        if args.check_config:
            if errors:
                print("\n".join(errors), file=sys.stderr)
                return 2
            print(f"OK review configuration: {len(checks)} declared check(s)")
            return 0
        before = snapshot(root)
        out = args.out.resolve() if args.out else root / ".kstudio/evidence/k-review" / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:8])
        # Evidence is excluded from source fingerprints so capture cannot stale itself.
        if out.is_relative_to(root) and not any(out.is_relative_to(root / p) for p in EXCLUDED):
            raise ValueError("in-repository --out must be under .kstudio/evidence/ or .kstudio/wiki/site/")
        out.mkdir(parents=True, exist_ok=False)
        started_at = now()
        results = [execute(root, out, check, args.run) for check in checks]
        status = aggregate(results, errors)
        if snapshot(root) != before:
            status = "stale"
        receipt = {
            "schema": SCHEMA, "started_at": started_at, "finished_at": now(),
            "root": str(root), "platform": {"system": sys.platform, "machine": platform.machine()},
            "snapshot": before, "config_sha256": config_hash, "config_errors": errors,
            "status": status, "review_status": "pending", "checks": results,
        }
        path = out / "receipt.json"
        path.write_text(json.dumps(receipt, indent=2, ensure_ascii=True) + "\n")
        print(f"{status}: {path}")
        print("review pending; not product Pass")
        for error in errors:
            print(error, file=sys.stderr)
        return code_for(status)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"review error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
