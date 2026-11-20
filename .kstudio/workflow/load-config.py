#!/usr/bin/env python3
"""Load .kstudio/project.acl (+ optional project.local.acl) → JSON.

Minimal Kense-KCL subset parser for kstudio.project-config.v1 (P16).
Does not require the Rust kcl crate. Unknown blocks are kept as raw attrs.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

def _resolve_eng() -> tuple[Path, Path]:
    here = Path(__file__).resolve()
    root = here.parents[2]
    aster = root / ".aster"
    legacy = root / ".kstudio"

    def present(p: Path) -> bool:
        return (
            (p / "MANIFEST.json").is_file()
            or (p / "workflow").is_dir()
            or (p / "project.acl").is_file()
            or (p / "project.acl.example").is_file()
        )

    if present(aster) and (
        (aster / "project.acl").is_file()
        or (aster / "project.acl.example").is_file()
        or (aster / "MANIFEST.json").is_file()
        or (aster / "workflow").is_dir()
    ):
        # Prefer .aster only when it holds eng config/layout — not bare product config.acl alone.
        if (aster / "project.acl").is_file() or (aster / "MANIFEST.json").is_file() or (aster / "workflow").is_dir():
            return root, aster
    if legacy.exists():
        return root, legacy
    return root, here.parents[1]


ROOT, KSTUDIO = _resolve_eng()
SCHEMA = "kstudio.project-config.v1"

STR_RE = re.compile(r'^"(?:\\.|[^"\\])*"$')
IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_-]*$")


def tokenize(src: str) -> list[str]:
    # strip # comments
    lines = []
    for line in src.splitlines():
        if "#" in line:
            in_str = False
            out = []
            for i, ch in enumerate(line):
                if ch == '"' and (i == 0 or line[i - 1] != "\\"):
                    in_str = not in_str
                if ch == "#" and not in_str:
                    line = "".join(out)
                    break
                out.append(ch)
        lines.append(line)
    text = "\n".join(lines)
    tokens: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c.isspace():
            i += 1
            continue
        if c in "{}=[]=,":
            tokens.append(c)
            i += 1
            continue
        if c == '"':
            j = i + 1
            while j < n:
                if text[j] == "\\" and j + 1 < n:
                    j += 2
                    continue
                if text[j] == '"':
                    j += 1
                    break
                j += 1
            tokens.append(text[i:j])
            i = j
            continue
        j = i
        while j < n and not text[j].isspace() and text[j] not in "{}=[]=,":
            j += 1
        tokens.append(text[i:j])
        i = j
    return tokens


def parse_value(tokens: list[str], i: int) -> tuple[object, int]:
    if i >= len(tokens):
        raise ValueError("unexpected eof in value")
    t = tokens[i]
    if t == "[":
        arr = []
        i += 1
        while i < len(tokens) and tokens[i] != "]":
            if tokens[i] == ",":
                i += 1
                continue
            v, i = parse_value(tokens, i)
            arr.append(v)
        return arr, i + 1
    if t == "{":
        obj, i = parse_object_body(tokens, i + 1)
        return obj, i
    if STR_RE.match(t):
        return json.loads(t), i + 1
    if t in ("true", "false"):
        return t == "true", i + 1
    if t == "null":
        return None, i + 1
    if re.fullmatch(r"-?\d+(\.\d+)?", t):
        return float(t) if "." in t else int(t), i + 1
    if t.startswith("env(") or (t == "env" and i + 1 < len(tokens) and tokens[i + 1] == "("):
        # env("VAR") possibly split
        if t.startswith("env("):
            inner = t[4:]
            buf = inner
            i += 1
            while buf.count(")") < 1 and i < len(tokens):
                buf += tokens[i]
                i += 1
            m = re.search(r'env\(\s*"([^"]+)"\s*\)', "env(" + buf)
            if not m:
                raise ValueError(f"bad env() call near {t}")
            import os

            return os.environ.get(m.group(1)), i
        # env ( "VAR" )
        if tokens[i + 1] != "(":
            raise ValueError("expected ( after env")
        i += 2
        if i >= len(tokens) or not STR_RE.match(tokens[i]):
            raise ValueError("env() needs string")
        key = json.loads(tokens[i])
        i += 1
        if i >= len(tokens) or tokens[i] != ")":
            raise ValueError("expected ) after env")
        import os

        return os.environ.get(key), i + 1
    if IDENT_RE.match(t):
        return t, i + 1
    raise ValueError(f"bad value token: {t}")


def parse_object_body(tokens: list[str], i: int) -> tuple[dict, int]:
    obj: dict = {}
    while i < len(tokens) and tokens[i] != "}":
        key = tokens[i]
        i += 1
        if i < len(tokens) and STR_RE.match(tokens[i]):
            # labeled block: machine "id" {
            label = json.loads(tokens[i])
            i += 1
            if i >= len(tokens) or tokens[i] != "{":
                raise ValueError(f"expected {{ after {key} label")
            body, i = parse_object_body(tokens, i + 1)
            obj.setdefault(key, {})
            if not isinstance(obj[key], dict):
                raise ValueError(f"block {key} collision")
            obj[key][label] = body
            continue
        if i < len(tokens) and tokens[i] == "{":
            body, i = parse_object_body(tokens, i + 1)
            obj[key] = body
            continue
        if i >= len(tokens) or tokens[i] != "=":
            raise ValueError(f"expected = after {key}")
        i += 1
        val, i = parse_value(tokens, i)
        obj[key] = val
    if i >= len(tokens) or tokens[i] != "}":
        raise ValueError("unclosed {")
    return obj, i + 1


def parse_document(src: str) -> dict:
    tokens = tokenize(src)
    doc: dict = {}
    i = 0
    while i < len(tokens):
        key = tokens[i]
        i += 1
        if i < len(tokens) and STR_RE.match(tokens[i]):
            label = json.loads(tokens[i])
            i += 1
            if tokens[i] != "{":
                raise ValueError("expected {")
            body, i = parse_object_body(tokens, i + 1)
            doc.setdefault(key, {})
            doc[key][label] = body
            continue
        if i < len(tokens) and tokens[i] == "{":
            body, i = parse_object_body(tokens, i + 1)
            doc[key] = body
            continue
        if i < len(tokens) and tokens[i] == "=":
            i += 1
            val, i = parse_value(tokens, i)
            doc[key] = val
            continue
        raise ValueError(f"unexpected token near {key}")
    return doc


def deep_merge(a: dict, b: dict) -> dict:
    out = dict(a)
    for k, v in b.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_paths(paths: list[Path]) -> dict:
    merged: dict = {"schema": SCHEMA}
    for p in paths:
        if not p.is_file():
            continue
        doc = parse_document(p.read_text(encoding="utf-8"))
        merged = deep_merge(merged, doc)
    if merged.get("schema") and merged["schema"] != SCHEMA:
        # allow missing schema in empty merge
        pass
    return merged


def default_paths() -> list[Path]:
    return [
        KSTUDIO / "project.acl.example",
        KSTUDIO / "project.acl",
        KSTUDIO / "project.local.acl",
    ]


def machine_entry(cfg: dict, machine_id: str | None) -> dict:
    if not machine_id:
        return {}
    fleet = (cfg.get("fleet") or {}).get("machine") or {}
    m = fleet.get(machine_id)
    return dict(m) if isinstance(m, dict) else {}


def machine_label(cfg: dict, machine_id: str | None) -> str | None:
    if not machine_id:
        return None
    m = machine_entry(cfg, machine_id)
    return m.get("label") or machine_id


def machine_card(cfg: dict, machine_id: str | None) -> dict | None:
    """Human-facing connect/use card for paste and sitrep."""
    if not machine_id:
        return None
    m = machine_entry(cfg, machine_id)
    if not m:
        return {"id": machine_id, "label": machine_id}
    connect = m.get("connect") if isinstance(m.get("connect"), dict) else {}
    use = m.get("use") if isinstance(m.get("use"), dict) else {}
    return {
        "id": machine_id,
        "class": m.get("class"),
        "label": m.get("label") or machine_id,
        "notes": m.get("notes"),
        "connect": {
            "via": connect.get("via"),
            "host": connect.get("host"),
            "user": connect.get("user"),
            "port": connect.get("port"),
            "command": connect.get("command"),
            "workdir": connect.get("workdir"),
        },
        "use": {
            "summary": use.get("summary"),
            "open_session": use.get("open_session"),
            "typical": use.get("typical"),
            "verify": use.get("verify"),
            "dont": use.get("dont"),
        },
    }


def prefer_for_role(cfg: dict, role: str) -> dict:
    prefs = (cfg.get("prefs") or {}).get("role") or {}
    return dict(prefs.get(role) or {})


def main() -> int:
    ap = argparse.ArgumentParser(description="Load .kstudio project.acl (P16)")
    ap.add_argument("--json", action="store_true", default=True)
    ap.add_argument("--role", help="print prefer_* + machine card for RoleID")
    ap.add_argument("--machine", help="print connect/use card for machine id")
    ap.add_argument("--no-example", action="store_true", help="skip project.acl.example")
    args = ap.parse_args()
    paths = default_paths()
    if args.no_example:
        paths = [p for p in paths if p.name != "project.acl.example"]
    # Prefer real config over example: load example only if project.acl missing
    if (KSTUDIO / "project.acl").is_file():
        paths = [p for p in paths if p.name != "project.acl.example"]
    try:
        cfg = load_paths(paths)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    if args.machine:
        card = machine_card(cfg, args.machine)
        if not card or (
            card.get("id") == args.machine
            and card.get("label") == args.machine
            and not machine_entry(cfg, args.machine)
        ):
            print(f"error: unknown machine {args.machine!r}", file=sys.stderr)
            return 2
        print(json.dumps(card, ensure_ascii=False, indent=2))
        return 0
    if args.role:
        pref = prefer_for_role(cfg, args.role)
        mid = pref.get("prefer_machine")
        mid_s = mid if isinstance(mid, str) else None
        card = machine_card(cfg, mid_s)
        print(
            json.dumps(
                {
                    "role": args.role,
                    "prefer": pref,
                    "machine_label": machine_label(cfg, mid_s),
                    "machine": card,
                    "connect_command": (card or {}).get("connect", {}).get("command")
                    if card
                    else None,
                    "use_summary": (card or {}).get("use", {}).get("summary")
                    if card
                    else None,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    json.dump(cfg, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
