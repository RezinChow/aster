---
name: k-plan
description: >-
  Conductor next-step planning from .kstudio: elevate on planning request,
  first-principles hard goals, read prior short reports for lessons (P19),
  full-seat utilization, sitrep, conflict check, paste 发给 blocks. Use when
  the user runs /k-plan, or asks for next steps, plan, or how to continue the
  wave. Does not write business source; never paste 发给 O.
---

# k-plan

Project entry: when loaded from a global/factory location, read `<repo>/.kstudio/skills/k-plan/SKILL.md` once if present; when already reading project authority, continue below. If absent, report missing engineering tools/evidence and point to `/k-init`; continue authorized read-only analysis where possible without silently initializing the project.

Slash: **`/k-plan`**  
Norm: `docs/conductor-skills.md` (P15) · P10e/P10f · P11 · P12 · P13 · P14 · **P18** · **P19** · P17.

军事口吻：简洁、明了、突出重点。不要线框、不要抽象。

Scope: whole-project or next-wave planning, including the P18 evaluation of all roles.
For one current task or specified roles, use `/k-task` and assign only relevant roles;
do not route a local task into this full-role workflow by default.

## Steps (MUST)

1. This session is (or elevates to) conductor when the user asks for a plan.  
2. Run:

```bash
python3 .kstudio/workflow/sitrep.py
```

3. **P19 — 读近期短报吸取教训：** 扫本波 `roles/*.md` 粘贴样例之外的真实短报来源——`timeline.jsonl` 近期事件、证据目录 `SUMMARY`/`handoff`、会话内已贴短报、HOLD 结论。提取代价 `$` / 浪费 / 省法 / 限制 / 需求。  
4. One-line hard goal + causal gap (lineage+evidence).  
5. 结论里写一句 **`教训：…`**（无短报则写「教训：尚无短报」）。同一浪费二次出现 → 必须改派法或拆小。  
6. Conflict check (write domain / branch / machine) — P13.  
7. **Seat utilization (P18):** for each of B/R/M/I/S/D, either paste a real `### 发给 X` or state **持守原因**. Prefer meaningful parallel work over idle seats. Do **not** invent busywork or violate P13.  
8. Paste short plain `### 发给 X`（机器 / 做 / 不要；可用 `tty-fmt.py task`）。约 4–6 行；提醒短报代价写 **约 `$… USD tokens`**。不要线框或「刀/禁」。P17：不要私开 branch/worktree。  
9. 可选：本波累计代价约 `$… USD tokens`。  
10. Do **not** paste 发给 O. Do **not** edit business source. MAY update `.kstudio` orchestration metadata.  
11. Do **not** privately create git branches/worktrees in this session (P17).
