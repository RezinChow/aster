#!/usr/bin/env bash
# Print human-readable copy blocks for the HEAD wave.
# Usage: print-paste.sh [--report] [O|B|R|M|I|S|D|H ...]
set -eu
ROOT="$(cd "$(dirname "$0")" && pwd)"
export KSTUDIO_PRINT_ROOT="$ROOT"
export KSTUDIO_PRINT_ARGS="$*"
python3 - <<'PY'
import os
import re
from pathlib import Path

root = Path(os.environ["KSTUDIO_PRINT_ROOT"])
w = (root / "HEAD").read_text().strip()
wave = root / "waves" / w
if not wave.is_dir():
    raise SystemExit(f"error: HEAD={w} but missing {wave}")

titles = {
    "O": "指挥",
    "B": "主攻",
    "R": "侧翼",
    "M": "会合",
    "I": "研究员",
    "S": "参谋长",
    "D": "史政",
    "H": "特遣(别名→I)",
}

args = os.environ.get("KSTUDIO_PRINT_ARGS", "").split()
mode = "assign"
seats = []
for a in args:
    if a in ("--report", "-r"):
        mode = "report"
    elif a in ("--assign", "-a"):
        mode = "assign"
    elif a in titles:
        seats.append(a)
    elif a in ("-h", "--help"):
        print("Usage: print-paste.sh [--assign|--report] [O|B|R|M|I|S|D|H ...]")
        raise SystemExit(0)
    elif a:
        raise SystemExit(f"error: unknown arg: {a}")
if not seats:
    seats = ["B", "R", "M", "I", "S", "D"]  # default: no O (P10d/P10e); H omitted (alias of I)

print(f"# 波次：{w} · 复制一块粘到执行会话 · 默认不含 O")
print()

env_re = re.compile(r"<!--\s*environment:\s*(.+?)\s*-->", re.I)

def config_machine_hint(role_id: str):
    """P16: prefs → label + connect/use (hint only; not silent binding)."""
    import json
    import subprocess
    load = root / "load-config.py"
    if not load.is_file():
        return None
    try:
        out = subprocess.check_output(
            [os.environ.get("PYTHON", "python3"), str(load), "--role", role_id],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        return json.loads(out)
    except Exception:
        return None

for r in seats:
    role = wave / "roles" / f"{r}.md"
    if not role.is_file():
        continue
    text = role.read_text(encoding="utf-8")
    m = env_re.search(text)
    env = m.group(1).strip() if m else None
    hint = config_machine_hint(r)
    if not env and hint:
        env = hint.get("machine_label")
    connect_cmd = None
    use_sum = None
    open_session = None
    if hint and isinstance(hint.get("machine"), dict):
        machine = hint["machine"]
        connect_cmd = (machine.get("connect") or {}).get("command")
        use_sum = (machine.get("use") or {}).get("summary")
        open_session = (machine.get("use") or {}).get("open_session")
    eng = root.parent.name
    rel = f"{eng}/workflow/waves/{w}/roles/{r}.md"
    name = titles[r]
    if mode == "assign":
        print(f"### 发给 {r}（{name}）")
        print("```text")
        mid = None
        if hint:
            mid = (hint.get("machine") or {}).get("id") or (hint.get("prefer") or {}).get(
                "prefer_machine"
            )
        if mid and connect_cmd and str(connect_cmd).startswith("ssh"):
            machine = f"{mid}（{connect_cmd}）"
        elif mid:
            machine = mid
        elif env:
            machine = env
        else:
            machine = "?"
        print(f"按 {rel} 执行。")
        print(f"机器：{machine}")
        if r == "O":
            print("做：只编排；按席贴发给 X")
            print("不要：改业务源码")
        else:
            print("做：<一句话>")
            print("不要：私开分支；无口令推 main")
            print("做完贴短报（代价：约 $… USD tokens）。")
        print("```")
        print()
    else:
        print("### 短报")
        print("```text")
        print(f"**{r}** · <machine-id> · **完成|受阻|升级** · 约 $… USD tokens")
        print("做了：<有值才写>")
        print("验了：<有值才写>")
        print("产物：<有值才写>")
        print("```")
        print("# 首行 MUST 席位+机器+结果+代价；其余无值整行省略；重点 **加粗**")
        print()
PY
