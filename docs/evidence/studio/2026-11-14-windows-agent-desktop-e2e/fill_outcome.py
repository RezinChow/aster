#!/usr/bin/env python3
"""Render OUTCOME.md placeholders from the final phase1 result JSON files."""
import json
import re
from pathlib import Path

EV = Path(__file__).resolve().parent
OUT = EV / "OUTCOME.md"

LABELS = {
    "F01": "草稿跨页导航保持", "F02": "composer 中文输入与控件",
    "F03": "流式消息/工具披露/引用", "F04": "消息虚拟列表与滚动记忆",
    "F05": "模型选择", "F06": "（结构不可达）",
    "F07": "真实 ACP turn / MCP", "F08": "侧栏状态跨进程持久化",
    "F09": "（结构不可达）", "F10": "设置搜索",
    "F11": "偏好跨进程持久化", "F12": "（结构不可达）",
    "F13": "首次运行/运行时组件/系统权限", "F14": "单实例/二次启动抽样",
    "F15": "（结构不可达）", "F16": "（不在本轮范围）",
    "F17": "窄窗口溢出抽样",
}
NOT_EXECUTED = {
    "F03": ("SKIP", "Phase 2 无安全 synthetic model/MCP fixture"),
    "F04": ("SKIP", "Phase 2 无安全 fixture"),
    "F06": ("NOT TESTED", "结构不可达，按硬规则不测"),
    "F07": ("SKIP", "Phase 2 无安全 fixture"),
    "F09": ("NOT TESTED", "结构不可达，按硬规则不测"),
    "F12": ("NOT TESTED", "结构不可达，按硬规则不测"),
    "F13": ("NOT TESTED", "严格达标不承诺，最多 PARTIAL"),
    "F15": ("NOT TESTED", "结构不可达，按硬规则不测"),
    "F16": ("NOT TESTED", "不在本轮执行清单"),
}
ORDER = ["F%02d" % i for i in range(1, 18)]


def load():
    res = {}
    for p in EV.glob("phase1-*.json"):
        m = re.fullmatch(r"phase1-(F\d\d)-run(\d)\.json", p.name)
        if not m:
            continue
        res[(m.group(1), int(m.group(2)))] = json.loads(p.read_text(encoding="utf-8"))
    return res


def detail_of(j):
    if not j:
        return ""
    ds = [e["detail"] for e in j.get("evidence", [])
          if e.get("detail") and "restart identity" not in e.get("label", "")]
    return "; ".join(ds[-2:])[:150]


def case_table(res):
    lines = ["| 用例 | 功能 | run 1 | run 2 | 结论 | 关键 AX 摘要 |",
             "|---|---|---|---|---|---|"]
    for c in ORDER:
        r1, r2 = res.get((c, 1)), res.get((c, 2))
        v1 = r1["verdict"] if r1 else "-"
        v2 = r2["verdict"] if r2 else "-"
        if r1 and r2:
            if v1 == v2 == "PASS":
                concl = "**2x PASS（计入覆盖）**"
            elif v1 == v2 == "BLOCKED":
                concl = "BLOCKED（不计入）"
            elif v1 == v2 == "PARTIAL":
                concl = "PARTIAL（不计入）"
            else:
                concl = "**FAIL / 不一致（不计入）**"
        elif r1 and r1["verdict"] == "PARTIAL":
            concl = "PARTIAL（单次抽样，不计入）"
        elif r1 and r1["verdict"] == "BLOCKED":
            concl = "BLOCKED（不计入）"
        elif c in NOT_EXECUTED:
            concl = "%s（不计入）" % NOT_EXECUTED[c][0]
        else:
            concl = "NOT EXECUTED"
        detail = detail_of(r2) or detail_of(r1)
        if c == "F14":
            detail = "current_windows=1；4 次重启均 windows_after=1（详见 §6）"
        if not detail and c in NOT_EXECUTED:
            detail = NOT_EXECUTED[c][1]
        lines.append("| %s | %s | %s | %s | %s | %s |" % (c, LABELS[c], v1, v2, concl, detail))
    return "\n".join(lines)


def verdict_line(res):
    passed, blocked, partial, failed = [], [], [], []
    for c in ORDER:
        r1, r2 = res.get((c, 1)), res.get((c, 2))
        if not r1 and not r2:
            continue
        v1 = r1["verdict"] if r1 else "-"
        v2 = r2["verdict"] if r2 else "-"
        if v1 == v2 == "PASS":
            passed.append(c)
        elif v1 == v2 == "BLOCKED":
            blocked.append(c)
        elif v1 == "PARTIAL" and v2 in ("PARTIAL", "-"):
            partial.append(c)
        else:
            failed.append("%s(%s/%s)" % (c, v1, v2))
    parts = []
    if passed:
        parts.append("**%s 各 2 次独立 PASS，计入覆盖（%d 条）**" % ("、".join(passed), len(passed)))
    if blocked:
        parts.append("%s = BLOCKED" % "、".join(blocked))
    if partial:
        parts.append("%s = PARTIAL" % "、".join(partial))
    if failed:
        parts.append("%s = FAIL/不一致" % "、".join(failed))
    parts.append("F03/F04/F07 = SKIP；F06/F09/F12/F13/F15 = 按要求不测或不做严格达标承诺")
    return "- 最终结论：" + "；".join(parts) + "。"


def window_table(res):
    lines = ["| 阶段 | window-id | pid | 证据 |", "|---|---|---|---|",
             "| 首次启动 / Phase 0 | `w-85395480` | `37164` | `phase0-S1-window.json` |"]
    for (c, r), j in sorted(res.items()):
        restart_ev = [e for e in j.get("evidence", [])
                      if "restart identity" in e.get("label", "")]
        wid = j.get("window_id")
        if wid:
            pid_cell = "（见下方重启行）" if restart_ev else "`37164`（首次实例）"
            lines.append("| %s run%d 用例结束时 | `%s` | %s | `phase1-%s-run%d.json` |"
                         % (c, r, wid, pid_cell, c, r))
        for e in restart_ev:
            det = e.get("detail", "")
            m = re.search(r"after=\('?(w-[0-9a-z]+)'?\s*,\s*(\d+)\s*\)", det)
            if m:
                lines.append("| %s run%d 重启后新主窗 | `%s` | `%s` | `%s` |"
                             % (c, r, m.group(1), m.group(2), det[:110]))
            else:
                lines.append("| %s run%d 重启 | （见 detail） | - | `%s` |" % (c, r, det[:110]))
    return "\n".join(lines)


def main():
    res = load()
    text = (EV / "OUTCOME.template.md").read_text(encoding="utf-8")
    text = text.replace("<!--FINAL_VERDICT_LINE-->", verdict_line(res))
    text = text.replace("<!--CASE_RESULT_TABLE-->", case_table(res))
    text = text.replace("<!--RESTART_WINDOW_TABLE-->", window_table(res))
    OUT.write_text(text, encoding="utf-8")
    print("filled; results loaded:", len(res))
    print(verdict_line(res))


if __name__ == "__main__":
    main()
