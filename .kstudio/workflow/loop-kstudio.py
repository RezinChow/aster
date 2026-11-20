#!/usr/bin/env python3
"""Persistent, bounded /task controller. Consumes evidence; never launches agents."""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import importlib.util
import json
import math
import os
import re
import sys
import tempfile
import time
import uuid
from datetime import datetime
from pathlib import Path

LIMITS = {"max_iterations": 20, "max_seconds": 7200, "max_stagnant": 5, "max_same_failure": 5}
STATES = {"running", "ready_for_review", "task_accepted", "blocked", "stopped"}
IDENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
SHA = re.compile(r"^[a-f0-9]{64}$")
ENG_ROOT = Path(__file__).resolve().parents[1].name
BASE = f"{ENG_ROOT}/local/loops"
AUDIT = f"{ENG_ROOT}/evidence/loop"


def load_review():
    spec = importlib.util.spec_from_file_location("kstudio_loop_review", Path(__file__).with_name("review.py"))
    module = importlib.util.module_from_spec(spec)
    before = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = before
    return module


review = load_review()


def fail(message: str):
    raise ValueError(message)


def read_json(path: Path):
    def bad(value):
        fail(f"non-finite JSON number: {value}")
    return json.loads(path.read_text(), parse_constant=bad)


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def safe(root: Path, value: str) -> Path:
    path = Path(value)
    if path.is_absolute() or ".." in path.parts:
        fail("path must stay inside project: " + value)
    current = root
    for part in path.parts:
        current /= part
        if current.is_symlink():
            fail("symlink is not a controller path: " + value)
        if current != root / path and current.exists() and not current.is_dir():
            fail("parent is not a directory: " + value)
    return current


def finite(value) -> bool:
    try:
        return type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        return False


def timestamp(value: str) -> float:
    if not isinstance(value, str):
        fail("timestamps require ISO text with an explicit timezone")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        fail("timestamps require an explicit timezone")
    return parsed.timestamp()


def validate_spec(value: dict) -> dict:
    if not isinstance(value, dict) or value.get("schema") != "kstudio.loop-spec.v1":
        fail("expected kstudio.loop-spec.v1 object")
    if not isinstance(value.get("task_id"), str) or not IDENT.fullmatch(value["task_id"]):
        fail("task_id must be a stable safe identifier from /task")
    if not isinstance(value.get("goal"), str) or not value["goal"].strip():
        fail("a concrete goal is required")
    roles = value.get("roles")
    if not isinstance(roles, list) or any(not isinstance(r, str) or not re.fullmatch("[A-Z]", r) for r in roles) or len(set(roles)) != len(roles):
        fail("roles must be distinct selected RoleIDs")
    paths = value.get("write_paths")
    if not isinstance(paths, list) or not paths:
        fail("write_paths must explicitly scope this task")
    for name in paths:
        if not isinstance(name, str) or not name or name == "." or any(c in name for c in "*?[]:\\\0") or Path(name).is_absolute() or ".." in Path(name).parts:
            fail("write_paths need explicit project-relative files/directories, not root/globs")
        if name.startswith((".git/", f"{ENG_ROOT}/local", f"{ENG_ROOT}/evidence", f"{ENG_ROOT}/wiki/site")) or name == ".git":
            fail("generated state/evidence and Git internals cannot be progress inputs")
    acceptance = value.get("acceptance")
    if not isinstance(acceptance, dict) or not isinstance(acceptance.get("description"), str) or not acceptance["description"].strip():
        fail("acceptance.description is required")
    ids = acceptance.get("check_ids")
    if not isinstance(ids, list) or not ids or any(not isinstance(i, str) or not review.ID.fullmatch(i) for i in ids) or len(set(ids)) != len(ids):
        fail("acceptance.check_ids must select distinct declared checks")
    configured = value.get("limits", {})
    if not isinstance(configured, dict) or set(configured) - set(LIMITS):
        fail("unknown loop limits")
    limits = dict(LIMITS, **configured)
    for key, limit in limits.items():
        if not finite(limit) or limit <= 0 or key != "max_seconds" and type(limit) is not int:
            fail("limits must be finite positive numbers; counters must be integers")
    return dict(value, write_paths=sorted(set(paths)), limits=limits)


def validate_state(state, task_id: str, root: Path):
    if not isinstance(state, dict) or state.get("schema") != "kstudio.loop-state.v1" or state.get("root") != str(root):
        fail("invalid loop state/root; do not recreate or reset it")
    spec = validate_spec(state.get("spec"))
    if spec != state["spec"] or spec["task_id"] != task_id or state.get("spec_sha256") != digest(spec):
        fail("loop specification changed or does not match task")
    if state.get("status") not in STATES or not isinstance(state.get("controller"), str) or not IDENT.fullmatch(state["controller"]):
        fail("invalid controller/status")
    for key in ("started_at", "last_observed_at", "elapsed_seconds", "last_receipt_finished"):
        if not finite(state.get(key)) or state[key] < 0:
            fail("invalid persistent clock/budget state")
    for key in ("iterations", "stagnant", "same_failure", "sequence", "review_epoch"):
        if type(state.get(key)) is not int or state[key] < 0:
            fail("invalid cumulative loop counter")
    if state["iterations"] > spec["limits"]["max_iterations"] or state["stagnant"] > state["iterations"] or state["same_failure"] > state["iterations"]:
        fail("inconsistent cumulative loop counters")
    for key in ("seen_sources", "seen_outcomes", "seen_receipts", "seen_feedback"):
        items = state.get(key)
        if not isinstance(items, list) or len(set(items)) != len(items) or any(not isinstance(v, str) or not SHA.fullmatch(v) for v in items):
            fail("invalid persistent seen signatures")
    if not state["seen_sources"] or state.get("last_source") not in state["seen_sources"] or len(state["seen_receipts"]) > state["iterations"]:
        fail("inconsistent persistent signatures")
    if not isinstance(state.get("best_passed"), list) or not set(state["best_passed"]).issubset(spec["acceptance"]["check_ids"]):
        fail("invalid criterion progress")
    for key in ("pending_checks", "reproduced_checks"):
        if not isinstance(state.get(key), list) or not set(state[key]).issubset(spec["acceptance"]["check_ids"]):
            fail("invalid semantic regression obligations")
    if not isinstance(state.get("seen_findings"), list) or any(not isinstance(v, str) or not IDENT.fullmatch(v) for v in state["seen_findings"]):
        fail("invalid semantic finding history")
    history = state.get("history")
    if not isinstance(history, list) or len(history) != state["sequence"] or any(not isinstance(e, dict) for e in history):
        fail("invalid persistent history")
    if not history or any(e.get("sequence") != i + 1 or e.get("status") not in STATES or type(e.get("iterations")) is not int for i, e in enumerate(history)) or history[-1]["iterations"] != state["iterations"] or history[-1]["status"] != state["status"]:
        fail("checkpoint history does not match cumulative state")
    if not 0 <= state["review_epoch"] <= len(state["seen_feedback"]):
        fail("invalid review generation")
    if not isinstance(state.get("evidence_dir"), str) or not state["evidence_dir"].startswith(AUDIT + "/"):
        fail("invalid evidence root")
    safe(root, state["evidence_dir"])
    return state


@contextlib.contextmanager
def locked(root: Path, task_id: str):
    if not IDENT.fullmatch(task_id):
        fail("invalid run id")
    path = safe(root, f"{BASE}/{task_id}.lock")
    path.parent.mkdir(parents=True, exist_ok=True)
    safe(root, f"{BASE}/{task_id}.lock")
    with path.open("a+b") as handle:
        try:
            if os.name == "nt":
                import msvcrt
                if handle.tell() == 0:
                    handle.write(b"\0")
                    handle.flush()
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            fail("controller busy; no state was overwritten")
        try:
            yield
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def save(root: Path, state: dict, kind: str, detail: str = ""):
    state["sequence"] += 1
    event = {"sequence": state["sequence"], "kind": kind, "at": time.time(), "status": state["status"], "stop_reason": state["stop_reason"], "iterations": state["iterations"], "detail": detail}
    state["history"].append(event)
    evidence = safe(root, state["evidence_dir"])
    evidence.mkdir(parents=True, exist_ok=True)
    with (evidence / f"event-{state['sequence']:04d}-{uuid.uuid4().hex}.json").open("x") as stream:
        json.dump(event, stream, indent=2)
    path = safe(root, f"{BASE}/{state['spec']['task_id']}.json")
    fd, temp = tempfile.mkstemp(prefix=".loop-state-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(state, stream, indent=2, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        safe(root, f"{BASE}/{state['spec']['task_id']}.json")
        os.replace(temp, path)
    finally:
        Path(temp).unlink(missing_ok=True)


def in_scope(name: str, paths: list[str]) -> bool:
    return any(p == "." or name == p or name.startswith(p.rstrip("/") + "/") for p in paths)


def uncovered_write_paths(spec: dict, checks: list[dict]) -> list[str]:
    selected = {row["id"]: row.get("paths", []) for row in checks if row["id"] in spec["acceptance"]["check_ids"]}
    return [name for name in spec["write_paths"] if not any(in_scope(name, paths) for paths in selected.values())]


def source_map(root: Path, paths: list[str], head: str | None = None, dirty: dict | None = None) -> dict:
    if head is None:
        raw = review.git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", *paths)
    else:
        raw = review.git(root, "ls-tree", "-r", "--name-only", "-z", head, "--", *paths)
    names = {os.fsdecode(n) for n in raw.split(b"\0") if n}
    if dirty is not None:
        names.update(name for name in dirty if in_scope(name, paths))
    else:
        names.update(name for name in paths if safe(root, name).is_file())
    result = {}
    for name in sorted(names):
        if not in_scope(name, paths):
            continue
        if head is not None:
            record = dirty.get(name)
            if record is None:
                data = review.git(root, "show", f"{head}:{name}")
                result[name] = {"kind": "file", "sha256": review.digest(data)}
            elif record.get("kind") != "deleted":
                result[name] = record
        else:
            path = safe(root, name)
            if path.is_file():
                result[name] = {"kind": "file", "sha256": review.digest(path.read_bytes())}
            elif path.exists():
                fail("changed submodule/directory cannot be scoped evidence: " + name)
    return result


def guard(state: dict, after_action: bool = False) -> bool:
    if state["status"] not in ("running", "ready_for_review") and not (after_action and state["status"] == "task_accepted"):
        return False
    now = time.time()
    if not finite(now) or now < state["last_observed_at"]:
        state.update(status="blocked", stop_reason="clock_regressed")
        return True
    state["elapsed_seconds"] = max(state["elapsed_seconds"], now - state["started_at"])
    state["last_observed_at"] = now
    reason = "time_budget" if state["elapsed_seconds"] >= state["spec"]["limits"]["max_seconds"] else "iteration_budget" if state["iterations"] >= state["spec"]["limits"]["max_iterations"] and (not after_action or state["status"] == "running") else None
    if reason:
        state.update(status="stopped", stop_reason=reason)
        return True
    return False


def verify_receipt(root: Path, state: dict, path: Path, fresh: bool = True):
    raw = path.read_bytes()
    receipt, errors = review.verify(root, path)
    if path.read_bytes() != raw:
        fail("receipt changed during validation")
    if receipt.get("status") == "stale":
        fail("a stale execution receipt cannot prove this task")
    errors = [e for e in errors if not e.startswith("source snapshot changed")]
    if errors:
        fail("; ".join(errors))
    _, cfg_hash, cfg_errors = review.load_config(root)
    if cfg_errors or cfg_hash != state["config_sha256"]:
        fail("task check configuration changed; do not redefine acceptance inside a run")
    if receipt.get("root") != str(root) or receipt["snapshot"]["head"] != review.git(root, "rev-parse", "HEAD").decode().strip():
        fail("receipt belongs to another project/version")
    paths = [".", *(f":(exclude){p}**" for p in review.EXCLUDED)]
    current_index = review.digest(review.git(root, "diff", "--cached", "--binary", "HEAD", "--", *paths))
    if receipt["snapshot"].get("index_sha256") != current_index:
        fail("Git index changed after verification; rerun checks")
    start = timestamp(receipt["started_at"])
    finish = timestamp(receipt["finished_at"])
    if not finite(start) or not finite(finish) or fresh and (start < state["last_receipt_finished"] or finish <= state["last_receipt_finished"]) or start > finish or finish > time.time() + 1:
        fail("receipt is old, out of order or from the future")
    current = source_map(root, state["spec"]["write_paths"])
    expected = source_map(root, state["spec"]["write_paths"], receipt["snapshot"]["head"], receipt["snapshot"]["dirty_files"])
    if current != expected:
        fail("task-scoped source changed after verification")
    fingerprint = review.digest(raw)
    if fresh and fingerprint in state["seen_receipts"]:
        fail("receipt was already consumed")
    if not fresh and (fingerprint != state["last_receipt_sha256"] or finish != state["last_receipt_finished"]):
        fail("review checkpoint receipt changed")
    return receipt, current, fingerprint, finish


def advance(root: Path, state: dict, path: Path):
    state["iterations"] += 1
    try:
        receipt, current, receipt_hash, finish = verify_receipt(root, state, path)
        selected = {r["id"]: r for r in receipt["checks"] if r["id"] in state["spec"]["acceptance"]["check_ids"]}
        if set(selected) != set(state["spec"]["acceptance"]["check_ids"]):
            fail("missing acceptance check")
        source_sig = digest(current)
        outcomes = [(name, row["status"], row["exit_code"]) for name, row in sorted(selected.items())]
        outcome_sig = digest([state["review_epoch"], outcomes])
        failure_sig = digest([row for row in outcomes if row[1] != "passed"])
        passed = {name for name, row in selected.items() if row["status"] == "passed"}
        reproduced = set(state["reproduced_checks"])
        reproduced.update(name for name, row in selected.items() if name in state["pending_checks"] and row["status"] == "failed")
        eligible = passed - (set(state["pending_checks"]) - reproduced)
        checks_improved = set(state["best_passed"]) < eligible
        progressed = checks_improved or set(state["reproduced_checks"]) < reproduced
        state["reproduced_checks"] = sorted(reproduced)
        state["stagnant"] = 0 if progressed else state["stagnant"] + 1
        if checks_improved:
            state["best_passed"] = sorted(eligible)
        state["same_failure"] = state["same_failure"] + 1 if state["last_failure"] == failure_sig else 1
        state["last_failure"] = failure_sig
        blocked = any(row["status"] in ("blocked", "not_run") for row in selected.values())
        source_cycle = source_sig != state["last_source"] and source_sig in state["seen_sources"]
        outcome_cycle = not progressed and outcome_sig != state["last_outcome"] and outcome_sig in state["seen_outcomes"]
        reason = "check_blocked" if blocked else "source_cycle" if source_cycle else "outcome_cycle" if outcome_cycle else ""
        state["status"] = "blocked" if blocked else "stopped" if reason else "running"
        state["stop_reason"] = reason
        for key, value in (("seen_receipts", receipt_hash), ("seen_sources", source_sig), ("seen_outcomes", outcome_sig)):
            if value not in state[key]:
                state[key].append(value)
        state.update(last_source=source_sig, last_outcome=outcome_sig, last_receipt_finished=finish, last_receipt_sha256=receipt_hash)
        archive = safe(root, state["evidence_dir"]) / f"round-{state['iterations']:04d}-{uuid.uuid4().hex}"
        archive.mkdir()
        (archive / "receipt.json").write_bytes(path.read_bytes())
        (archive / "logs").mkdir()
        for row in receipt["checks"]:
            if row.get("log"):
                data = review.within(path.parent.resolve(), row["log"]).read_bytes()
                if review.digest(data) != row["sha256"]:
                    fail("check log changed while archiving")
                (archive / row["log"]).write_bytes(data)
        state["last_receipt"] = str((archive / "receipt.json").relative_to(root))
        state["last_summary"] = {"passed": sorted(passed), "progressed": progressed, "outcomes": outcomes, "unrelated_changes_are_progress": False}
        if state["status"] == "running":
            limits = state["spec"]["limits"]
            if len(passed) == len(selected) and set(state["pending_checks"]).issubset(reproduced):
                state.update(status="ready_for_review", stop_reason="checks_passed_semantic_review_required")
            elif state["stagnant"] >= limits["max_stagnant"]:
                state.update(status="stopped", stop_reason="no_evidence_progress")
            elif state["same_failure"] >= limits["max_same_failure"]:
                state.update(status="stopped", stop_reason="same_failure_limit")
            else:
                guard(state)
    except (OSError, ValueError, TypeError, KeyError, AttributeError, review.subprocess.CalledProcessError) as error:
        state.update(status="blocked", stop_reason="invalid_evidence", last_summary={"error": str(error)})


def feedback(root: Path, state: dict, path: Path):
    state["iterations"] += 1
    try:
        raw = path.read_bytes()
        value = json.loads(raw, parse_constant=lambda v: fail("non-finite feedback number: " + v))
        verify_receipt(root, state, safe(root, state["last_receipt"]), fresh=False)
        if not isinstance(value, dict) or value.get("schema") != "kstudio.loop-feedback.v1" or value.get("task_id") != state["spec"]["task_id"]:
            fail("expected feedback for this task")
        fingerprint = review.digest(raw)
        if fingerprint in state["seen_feedback"]:
            fail("feedback already consumed")
        if value.get("receipt_sha256") != state["seen_receipts"][-1] or value.get("source_sha256") != state["last_source"]:
            fail("feedback must bind the latest receipt and scoped source")
        if digest(source_map(root, state["spec"]["write_paths"])) != state["last_source"]:
            fail("task source changed after the review checkpoint")
        reviewed_at = timestamp(value["reviewed_at"])
        if not finite(reviewed_at) or not state["last_receipt_finished"] <= reviewed_at <= time.time() + 1:
            fail("review feedback is old or from the future")
        report_name = value.get("review_path")
        if not isinstance(report_name, str) or not report_name.startswith(f"{ENG_ROOT}/evidence/"):
            fail("review_path must identify a retained project evidence report")
        report = safe(root, report_name)
        report_data = report.read_bytes() if report.is_file() else None
        if report_data is None or review.digest(report_data) != value.get("review_sha256"):
            fail("review report is missing or changed")
        findings = value.get("findings")
        if value.get("decision") not in ("accept", "reject") or not isinstance(findings, list):
            fail("feedback needs accept/reject and a findings list")
        ids = []
        for row in findings:
            if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not IDENT.fullmatch(row["id"]) or row.get("check_id") not in state["spec"]["acceptance"]["check_ids"] or not isinstance(row.get("description"), str) or not row["description"].strip():
                fail("findings require a stable id, existing check_id and real description")
            ids.append(row["id"])
        if len(set(ids)) != len(ids) or set(ids).intersection(state["seen_findings"]):
            fail("repeated semantic findings cannot create fresh progress")
        if value["decision"] == "accept" and findings or value["decision"] == "reject" and not findings:
            fail("accept must have no unresolved findings; reject must identify one")
        archive = safe(root, state["evidence_dir"]) / f"feedback-{state['iterations']:04d}-{uuid.uuid4().hex}"
        archive.mkdir()
        (archive / "feedback.json").write_bytes(raw)
        (archive / "review.md").write_bytes(report_data)
        state["seen_feedback"].append(fingerprint)
        state["seen_findings"].extend(ids)
        state["last_summary"] = {"review_decision": value["decision"], "findings": findings}
        if value["decision"] == "accept":
            state.update(status="task_accepted", stop_reason="task_review_accepted_not_product_pass")
        else:
            state["review_epoch"] += 1
            state["pending_checks"] = sorted({row["check_id"] for row in findings})
            state["reproduced_checks"] = []
            state["best_passed"] = sorted(set(state["best_passed"]) - set(state["pending_checks"]))
            state.update(status="running", stop_reason="")
            guard(state)
    except (OSError, ValueError, TypeError, KeyError, IndexError, AttributeError, review.subprocess.CalledProcessError) as error:
        state.update(status="blocked", stop_reason="invalid_review_feedback", last_summary={"error": str(error)})


def start(root: Path, spec: dict, controller: str) -> dict:
    checks, cfg_hash, errors = review.load_config(root)
    now = time.time()
    current = source_map(root, spec["write_paths"])
    sha = digest(current)
    state = {"schema": "kstudio.loop-state.v1", "root": str(root), "spec": spec, "spec_sha256": digest(spec), "controller": controller, "status": "running", "stop_reason": "", "started_at": now, "last_observed_at": now, "elapsed_seconds": 0, "iterations": 0, "stagnant": 0, "same_failure": 0, "sequence": 0, "history": [], "initial_source": current, "last_source": sha, "seen_sources": [sha], "seen_outcomes": [], "seen_receipts": [], "seen_feedback": [], "seen_findings": [], "review_epoch": 0, "pending_checks": [], "reproduced_checks": [], "last_outcome": None, "last_failure": None, "best_passed": [], "last_receipt_finished": now, "last_receipt_sha256": None, "last_summary": {}, "config_sha256": cfg_hash, "evidence_dir": f"{AUDIT}/{spec['task_id']}-{uuid.uuid4().hex}"}
    billets = read_json(safe(root, f"{ENG_ROOT}/workflow/billets.json"))
    rows = billets.get("billets") if isinstance(billets, dict) else None
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        fail("project billets must contain a role array")
    known = {row.get("id"): row for row in rows}
    executors = [r for r in spec["roles"] if r != "O" and r in known and known[r].get("write_policy") in ("code_ok", "docs_ok", "docs_only", "glue_ok") and isinstance(known[r].get("duty"), str) and known[r]["duty"] not in ("orchestrate", "after_action_review")]
    if not executors or any(r not in known for r in spec["roles"]):
        state.update(status="blocked", stop_reason="no_executable_role")
    elif errors or not set(spec["acceptance"]["check_ids"]).issubset(row["id"] for row in checks):
        state.update(status="blocked", stop_reason="invalid_check_configuration", last_summary={"errors": errors})
    elif uncovered := uncovered_write_paths(spec, checks):
        state.update(status="blocked", stop_reason="uncovered_acceptance_scope", last_summary={"uncovered_write_paths": uncovered})
    save(root, state, "start")
    return state


def view(state: dict) -> dict:
    return dict(state, remaining_seconds=max(0, state["spec"]["limits"]["max_seconds"] - state["elapsed_seconds"]), next_action="implement_then_verify" if state["status"] == "running" else "semantic_review" if state["status"] == "ready_for_review" else "halt")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    sub = parser.add_subparsers(dest="command", required=True)
    begin = sub.add_parser("start")
    begin.add_argument("--spec", type=Path, required=True)
    begin.add_argument("--controller", required=True)
    for command in ("status", "advance", "feedback", "stop"):
        item = sub.add_parser(command)
        item.add_argument("--run", required=True)
        if command != "status":
            item.add_argument("--controller", required=True)
        if command == "advance":
            item.add_argument("--receipt", type=Path, required=True)
        if command == "feedback":
            item.add_argument("--feedback", type=Path, required=True)
        if command == "stop":
            item.add_argument("--reason", choices=("cancelled", "blocked"), required=True)
            item.add_argument("--detail", required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        if args.command != "status" and not IDENT.fullmatch(args.controller):
            fail("controller must be a stable safe session identifier")
        spec = validate_spec(read_json(args.spec)) if args.command == "start" else None
        task_id = spec["task_id"] if spec else args.run
        with locked(root, task_id):
            path = safe(root, f"{BASE}/{task_id}.json")
            if not path.exists():
                if spec is None:
                    fail("run does not exist; do not silently create one")
                state = start(root, spec, args.controller)
            else:
                state = validate_state(read_json(path), task_id, root)
                if args.command != "status" and args.controller != state["controller"]:
                    fail("another controller owns this run")
                if spec and spec != state["spec"]:
                    fail("run already exists; specification and cumulative budgets are immutable")
                changed = guard(state)
                if args.command == "stop":
                    state.update(status="blocked" if args.reason == "blocked" else "stopped", stop_reason=args.reason)
                    save(root, state, "stop", args.detail)
                elif args.command == "advance" and state["status"] == "running":
                    advance(root, state, args.receipt.resolve())
                    guard(state, after_action=True)
                    save(root, state, "advance")
                elif args.command == "feedback" and state["status"] == "ready_for_review":
                    feedback(root, state, args.feedback.resolve())
                    guard(state, after_action=True)
                    save(root, state, "feedback")
                elif args.command in ("advance", "feedback") and state["status"] in ("running", "ready_for_review"):
                    state["iterations"] += 1
                    state.update(status="blocked", stop_reason="invalid_transition")
                    save(root, state, "invalid_transition")
                elif changed:
                    save(root, state, "guard")
                elif args.command in ("status", "start") and state["status"] in ("running", "ready_for_review"):
                    save(root, state, "observe" if args.command == "status" else "resume")
            print(json.dumps(view(state), indent=2, allow_nan=False))
            return 77 if state["status"] == "blocked" else 1 if state["status"] == "stopped" else 0
    except (OSError, ValueError, TypeError, KeyError, review.subprocess.CalledProcessError) as error:
        print(json.dumps({"status": "blocked", "error": str(error)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
