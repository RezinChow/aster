#!/usr/bin/env python3
"""READ-ONLY release readiness gate against docs/release-governance.md.

This script never modifies the repository. It only runs git queries, reads
version/evidence files, and executes the repository's own read-only unittest
suites. Every check maps to a specific governance clause.

Status values:
  PASS          - requirement verified satisfied
  FAIL          - requirement verified violated
  UNVERIFIABLE  - cannot be decided on this host (needs CI / macOS / Apple account)

Exit code: 0 only when every check is PASS; 1 otherwise.
"""
import json
import os
import platform
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path("D:/code/aster")
SUB = ROOT / "apps/studio"
EV = Path(__file__).resolve().parent
PY = sys.executable

CHECKS = []


def git(*args, cwd=ROOT, strip=True):
    try:
        p = subprocess.run(["git", "-C", str(cwd), *args],
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=60)
        out = p.stdout or ""
        err = p.stderr or ""
        # Porcelain rows carry their XY status in the first two columns, and
        # unstaged changes start with a leading space. A blanket .strip() on
        # the whole stdout destroys the FIRST row's prefix, which silently
        # drops ` M apps/studio` from the dirty count. Callers that need exact
        # porcelain rows must pass strip=False.
        return (p.returncode,
                out.strip() if strip else out,
                err.strip() if strip else err)
    except Exception as e:
        return -1, "", f"{type(e).__name__}: {e}"


def run(cmd, cwd=ROOT, timeout=180):
    try:
        p = subprocess.run(cmd, cwd=str(cwd), capture_output=True,
                           text=True, encoding="utf-8", errors="replace",
                           timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except Exception as e:
        return -1, f"{type(e).__name__}: {e}"


def add(cid, title, clause, status, detail, remediation, needs_user=False):
    CHECKS.append({
        "id": cid, "title": title, "clause": clause, "status": status,
        "detail": detail, "remediation": remediation,
        # A check that already passes needs no user decision; leaving the
        # flag set would print a misleading NOTE next to a PASS line.
        "needs_user_decision": needs_user and status != "PASS",
    })


def read(path):
    try:
        return (ROOT / path).read_text(encoding="utf-8")
    except Exception:
        return ""


def main():
    # G01 - parent worktree. Keep porcelain XY prefixes intact (strip=False).
    rc, out, err = git("status", "--porcelain=v1", "--untracked-files=normal",
                       strip=False)
    rows = out.splitlines() if rc == 0 else []
    deleted = [r for r in rows if "D" in r[:2]]
    tracked_mod = [r for r in rows if "M" in r[:2]]
    untracked = [r for r in rows if r[:2] == "??"]
    counted = set(deleted) | set(tracked_mod) | set(untracked)
    other = [r for r in rows if r not in counted]
    # Deterministic detail: .git/index mtime changes on every commit and
    # would make the committed report differ on each re-run. That mtime was
    # only a one-off clue for the historical 445 tracked deletions, which are
    # now resolved; it is retained in RELEASE-COMPLIANCE.md §2.1 instead.
    detail = (f"tracked deletions={len(deleted)}, tracked modifications={len(tracked_mod)}, "
              f"untracked={len(untracked)}, other={len(other)}")
    # Align with scripts/studio_land_guard.py::cmd_dirty, which treats ANY
    # non-empty `git status --porcelain` row (including ??) as dirty.
    fixes1 = []
    if deleted:
        fixes1.append(f"恢复 {len(deleted)} 个 tracked 文件")
    if tracked_mod:
        fixes1.append("提交或 stash 已修改的 tracked 文件（版本 bump / gitlink）")
    if untracked:
        fixes1.append("证据目录提交或 .gitignore 忽略")
    if other:
        fixes1.append("处置 rename/conflict 行")
    add("G01", "父仓工作树干净", "§构建边界 L44: 不得从有未提交修改的工作树发布",
        "PASS" if not rows else "FAIL", detail,
        "；".join(fixes1) if fixes1 else "—", True)

    # G02 - studio submodule dirty (land guard cmd_dirty)
    rc2, sub_status, _ = git("status", "--porcelain=v1", "--untracked-files=normal",
                             cwd=SUB, strip=False)
    sub_rows = [r for r in sub_status.splitlines() if r.strip()]
    if any("reasoning_effort" in r for r in sub_rows):
        fix2 = "提交或 stash 用户 WIP reasoning_effort.rs（39 行）"
    elif sub_rows:
        fix2 = "提交或 stash 子模块内的版本 bump 改动"
    else:
        fix2 = "—"
    add("G02", "子模块工作树干净", "§构建边界 L44 + studio_land_guard.cmd_dirty",
        "PASS" if not sub_rows else "FAIL",
        f"porcelain rows={sub_rows[:5]}", fix2, True)

    # G03 - full land guard
    rc3, lg = run(["just", "studio-land-check"], timeout=120)
    add("G03", "just studio-land-check 通过", "§发布顺序 + scripts/studio_land_guard.py",
        "PASS" if rc3 == 0 else "FAIL",
        f"exit={rc3}; {lg.strip().splitlines()[-2:] if lg.strip() else 'no output'}",
        "先让 G01/G02 转绿，再复核 pointer 与 delivery commits")

    # G04 - gitlink consistency
    _, tree, _ = git("ls-tree", "HEAD", "apps/studio")
    mtree = re.search(r"160000 commit ([0-9a-f]{40})", tree)
    parent_link = mtree.group(1) if mtree else "MISSING"
    _, sub_head, _ = git("rev-parse", "HEAD", cwd=SUB)
    add("G04", "gitlink 与子模块 HEAD 一致", "§构建边界 L44: 发布记录必须能定位准确源码提交",
        "PASS" if parent_link == sub_head else "FAIL",
        f"parent gitlink={parent_link[:12]}, submodule HEAD={sub_head[:12]}",
        "对齐子模块 checkout 到父仓 gitlink，或按发布流程 bump 父仓 pointer", True)

    # G05 - version consistency across 4 files
    lock = read("Cargo.lock")
    lm = re.search(r'name = "aster-studio"\s*\nversion = "([^"]+)"', lock)
    lock_v = lm.group(1) if lm else "MISSING"
    toml = read("apps/studio/src-tauri/Cargo.toml")
    tm = re.search(r'^version = "([^"]+)"', toml, re.M)
    cargo_v = tm.group(1) if tm else "MISSING"
    pkg = read("apps/studio/package.json")
    pm = re.search(r'"version"\s*:\s*"([^"]+)"', pkg)
    pkg_v = pm.group(1) if pm else "MISSING"
    conf = read("apps/studio/src-tauri/tauri.conf.json")
    cm = re.search(r'"version"\s*:\s*"([^"]+)"', conf)
    conf_v = cm.group(1) if cm else "MISSING"
    versions = {"Cargo.lock": lock_v, "Cargo.toml": cargo_v,
                "package.json": pkg_v, "tauri.conf.json": conf_v}
    same = len(set(versions.values())) == 1
    add("G05", "四处版本号一致（cargo build --locked）", "§构建边界 L38: 从仓库根用固定工具链和锁文件构建",
        "PASS" if same else "FAIL", json.dumps(versions, ensure_ascii=False),
        "同步四处版本；注意线上 v0.2.3 已发布，下一版应 >= 0.2.4", True)

    # G06 - remote sync
    _, ahead_behind, _ = git("rev-list", "--left-right", "--count", "origin/main...HEAD")
    parts = ahead_behind.split()
    behind, ahead = (int(parts[0]), int(parts[1])) if len(parts) == 2 else (-1, -1)
    _, unpushed, _ = git("log", "--oneline", "origin/main..HEAD")
    add("G06", "与 origin/main 同步", "§构建边界 L44 + CI 从远程 main 构建",
        "PASS" if behind == 0 and ahead == 0 else "FAIL",
        f"behind={behind}, ahead={ahead}; unpushed={unpushed.splitlines()[:3]}",
        f"推送 {ahead} 个未推送提交，或按用户决定保持现状", True)

    # G07 - diff --check
    rc7a, _, _ = git("diff", "--check")
    rc7b, _, _ = git("diff", "--check", cwd=SUB)
    add("G07", "git diff --check 通过（父仓 + 子模块）", "§发布顺序: 干净提交",
        "PASS" if rc7a == 0 and rc7b == 0 else "FAIL",
        f"parent_exit={rc7a}, submodule_exit={rc7b}", "修复空白/冲突标记错误")

    # G08 - runtime component locks unittest
    rc8, out8 = run([PY, "-m", "unittest", "tests.runtime_component_locks", "-q"])
    add("G08", "tests/runtime_component_locks.py 通过", "§运行时组件锁与打包链路 L110",
        "PASS" if rc8 == 0 else "FAIL",
        f"exit={rc8}; {out8.strip().splitlines()[-1:] if out8.strip() else ''}",
        "修复 lock 与 COMPONENTS 的一致性")

    # G09 - release governance unittest (environment-sensitive). The contract
    # itself is already wired into CI; what is missing on this host is a run
    # result, not the workflow step.
    rc9, out9 = run([PY, "-m", "unittest", "tests.release_governance", "-q"])
    env_markers = ("wsl.exe", "UnicodeDecodeError", "No module named",
                   "PROGRAM BLOCKED BY SECURITY POLICY")
    env_limited = any(m in out9 for m in env_markers)
    status9 = "PASS" if rc9 == 0 else ("UNVERIFIABLE" if env_limited else "FAIL")
    ci_contract = "tests/release_governance.py" in read(".github/workflows/ci.yml")
    cli_preflight = ("tests/release_governance.py"
                     in read(".github/workflows/release-aster-cli.yml"))
    add("G09", "tests/release_governance.py 通过", "§标签与 Latest L104: 主 CI 与 CLI 发布预检必须运行",
        status9,
        f"exit={rc9}; host={platform.system()}; env_limited={env_limited}; "
        f"ci_contract={ci_contract}; cli_preflight_contract={cli_preflight}",
        "推送后取 ci.yml 双矩阵 run 的绿色结果；本机 Windows + WSL 黑名单无法判定")

    # G10 - target platform verification
    host = platform.system()
    wf = read(".github/workflows/release-aster-desktop.yml")
    wm = re.search(r"runs-on:\s*(\S+)", wf)
    target = wm.group(1) if wm else "unknown"
    add("G10", "发布目标平台验证", "§构建边界 L42 + §桌面版 L80: 签名、公证和平台验证",
        "PASS" if host == "Darwin" else "UNVERIFIABLE",
        f"host={host}, workflow runs-on={target}; 四轮 E2E 均为 Windows",
        "在 macos-14 / Node 24.12 上跑 release-aster-desktop.yml 的构建与签名公证")

    # G11 - Apple notarization. The workflow now fails closed when the signing
    # identity or notary profile secret is missing, so an ad-hoc unnotarized
    # archive can no longer reach desktop-stable. That is a process fix, NOT
    # evidence that notarization happened: the gate stays UNVERIFIABLE.
    note = read("docs/evidence/studio/2026-11-13-desktop-0.2.3/OUTCOME.md")
    notary_blocked = "403" in note and "notarytool" in note
    dwf = read(".github/workflows/release-aster-desktop.yml")
    wf_notary = "ASTER_NOTARY_PROFILE" in dwf
    wf_identity = "ASTERSIGN_IDENTITY" in dwf
    wf_fail_closed = ("Require signing and notarization credentials" in dwf
                      and "Refusing to publish an unsigned" in dwf
                      and "exit 1" in dwf)
    add("G11", "签名 + 公证 + staple 完成", "§桌面版 L80 + 0.2.1/0.2.3 发布记录",
        "UNVERIFIABLE",
        f"11-13 记录 notarytool 403 协议级阻塞={notary_blocked}; "
        f"线上 v0.2.3 为知情未公证发布; "
        f"workflow_notary_env={wf_notary}; workflow_sign_identity={wf_identity}; "
        f"workflow_fail_closed={wf_fail_closed}; "
        f"本轮实测仓库 secrets 仅 STUDIO_READ_TOKEN，签名/公证凭证未配置",
        "workflow 已 fail-closed（缺凭证即拒绝发布）；仍需配置 ASTERSIGN_IDENTITY / "
        "ASTER_NOTARY_PROFILE，在 macos-14 导入 Developer ID 证书与 notarytool "
        "keychain profile，恢复 Apple 账号协议，并取得 notarytool/stapler/spctl 绿色证据")

    # G12 - known functional regression on the CURRENT release candidate.
    # The rerun FAIL is historical and belongs to the old user worktree
    # (07ffdfcf5, missing cc0a7bd09). This gate must reflect the current
    # aligned tree plus its fresh cold-start AX evidence, not a stale prose
    # string, while still disclosing the historical FAIL.
    rerun = read("docs/evidence/studio/2026-11-14-windows-agent-desktop-e2e-rerun/OUTCOME.md")
    f01_historic_fail = "2×FAIL" in rerun or "2xFAIL" in rerun
    try:
        f01_new = json.loads(
            (EV / "f01-rerun" / "f01-release-run.json").read_text(encoding="utf-8"))
    except Exception:
        f01_new = {}
    runs12 = f01_new.get("runs") or []
    ev_head = f01_new.get("submodule_head") or ""
    # After the local commits the candidate HEAD is a descendant of the
    # evidence baseline. The AX evidence stays applicable only when the
    # renderer tree did not change in between.
    if ev_head:
        _, renderer_diff, _ = git("diff", "--stat", ev_head, "HEAD",
                                  "--", "src/renderer", cwd=SUB)
        renderer_unchanged = renderer_diff.strip() == ""
    else:
        renderer_unchanged = False
    _, cur_head, _ = git("rev-parse", "HEAD", cwd=SUB)
    resolved = (
        f01_new.get("all_pass") is True
        and f01_new.get("submodule_head") == f01_new.get("parent_gitlink")
        and f01_new.get("runtime_unchanged") is True
        and len(runs12) == 2
        and all(r.get("verdict") == "PASS" and r.get("exit") == 0
                for r in runs12)
        and renderer_unchanged
    )
    status12 = "PASS" if resolved else ("FAIL" if f01_historic_fail else "UNVERIFIABLE")
    detail12 = (
        f"历史 rerun F01 2×FAIL={f01_historic_fail}（旧工作树 07ffdfcf5，缺 cc0a7bd09）；"
        f"证据基线 head={ev_head[:12] or 'MISSING'} "
        f"gitlink={f01_new.get('parent_gitlink', 'MISSING')[:12]}，"
        f"冷启动复跑 2×PASS={f01_new.get('all_pass')} "
        f"tokens={[r.get('token') for r in runs12]}，"
        f"runtime.tsx 未改动={f01_new.get('runtime_unchanged')}；"
        f"当前候选 head={cur_head.strip()[:12]}，"
        f"与证据基线 renderer 无差异={renderer_unchanged}")
    add("G12", "无已知功能回归", "§构建边界 L44（发布候选质量）",
        status12, detail12,
        "合入 cc0a7bd09 并在真实工作树复跑 F01，或登记为已知阻塞",
        not resolved)

    # G13 - internal coverage target. Gate A 100% is NOT a clause of
    # release-governance.md; it comes from MATRIX.md, and the uplift plan
    # documents a structural ceiling below 100% plus a pending P0 decision.
    # Keep this check FAIL (fail-closed) while making the attribution accurate.
    matrix = read("docs/evidence/studio/2026-11-12-business-function-coverage/MATRIX.md")
    gm = re.search(r"Gate A（\*\*6/7 config\*\*.*?\|\s*\*\*([\d.]+)%\*\*", matrix)
    gate_a = gm.group(1) if gm else "unknown"
    uplift = read("apps/studio/tests/e2e/COVERAGE_UPLIFT_PLAN.md")
    cap_894 = "89.4%" in uplift
    target_pending = "待你确认" in uplift
    add("G13", "契约门禁达标（Gate A 100%）",
        "MATRIX.md 内部质量目标（非 release-governance.md 条款）",
        "FAIL" if gate_a != "100" else "PASS",
        f"Gate A 正式配置={gate_a}%（目标 100%）；Gate B UNMEASURABLE；F 层严格达标 2/17；"
        f"不启用 toyou 时理论上限 89.4%={cap_894}，95% 目标待用户裁决={target_pending}",
        "P0 口径裁决（是否正式下调/挂起目标）+ P1 纳管 7 个 config；"
        "4 条结构不可达功能需产品级开发")

    report = {
        "generated_by": "release-readiness-check.py (read-only)",
        "authority": "docs/release-governance.md",
        "host": platform.system(),
        "summary": {
            "total": len(CHECKS),
            "pass": sum(1 for c in CHECKS if c["status"] == "PASS"),
            "fail": sum(1 for c in CHECKS if c["status"] == "FAIL"),
            "unverifiable": sum(1 for c in CHECKS if c["status"] == "UNVERIFIABLE"),
            "needs_user_decision": sum(1 for c in CHECKS if c["needs_user_decision"]),
        },
        "checks": CHECKS,
    }
    (EV / "readiness-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [f"=== release readiness (read-only) host={host} ===",
             f"PASS={report['summary']['pass']}  FAIL={report['summary']['fail']}  "
             f"UNVERIFIABLE={report['summary']['unverifiable']}  "
             f"TOTAL={report['summary']['total']}", ""]
    for c in CHECKS:
        lines.append(f"[{c['status']:<12}] {c['id']} {c['title']}")
        lines.append(f"    clause : {c['clause']}")
        lines.append(f"    detail : {c['detail']}")
        if c["status"] != "PASS":
            lines.append(f"    fix    : {c['remediation']}")
        if c["needs_user_decision"]:
            lines.append("    NOTE   : requires explicit user decision")
    lines += ["", "Verdict: " + (
        "READY" if report["summary"]["fail"] == 0
        and report["summary"]["unverifiable"] == 0
        else "NOT READY FOR RELEASE")]
    text = "\n".join(lines) + "\n"
    (EV / "readiness-report.txt").write_text(text, encoding="utf-8")
    print(text)
    return 0 if report["summary"]["fail"] == 0 and report["summary"]["unverifiable"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
