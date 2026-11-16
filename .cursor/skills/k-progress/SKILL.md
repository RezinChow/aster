---
name: k-progress
description: >-
  Estimates whole-project completion percentage toward GOALS.md overall goal and
  near-term hard goals, judged against real source/tests (not wave sitrep alone).
  Use when the user runs /k-progress, or asks for overall completion %, 完成度,
  百分比进度, how far the product is, or remaining work to the goal. Overall %
  is not Pass. Does not write business source.
---

# k-progress

Project entry: when loaded from a global/factory location, read `<repo>/.kstudio/skills/k-progress/SKILL.md` once if present; when already reading project authority, continue below. If absent, report missing engineering tools/evidence and point to `/k-init`; continue authorized read-only analysis where possible without silently initializing the project.

Slash: **`/k-progress`**  
Norm: product `docs/conductor-skills.md` (P15).

**不同于 `/k-status`：**  
- **k-progress** = 整仓相对 **目标（GOALS）+ 真实源码/测试** 的完成度 **百分比**。  
- **k-status** = 波次/席位/证据态势；**%≠Pass**。

军事口吻：先总体%与最大缺口；分项只列有证据的轴。不要抽象形容词。

## Steps (MUST)

1. At repo root:

```bash
test -f .kstudio/workflow/GOALS.md && cat .kstudio/workflow/GOALS.md
python3 .kstudio/workflow/progress-scan.py
python3 .kstudio/workflow/sitrep.py
```

2. Rubric from GOALS（Overall goal axes + Near-term hard goals）。Non-goals 不计欠账。  
3. 每轴看 **真实源码/测试**（证据为辅），0–100 + 短证据路径。  
4. Reply：

```text
总体  [████████████░░░░░░░░]  61%  ≠Pass  ≠sitrep

分项
  跨平台   [██████████░░░░░░░░░░]  50%  gap.md · windows-matrix
  Program  [█████████████░░░░░░░]  68%  D5 uncommitted
  …

缺口
  · <具体可核对项>
```

`python3 .kstudio/workflow/tty-fmt.py bar 61 --label 总体`

5. Honesty：总体%≠Pass；≠sitrep；缺证据写未知/低估；禁涂绿。  
6. Do **not** write business source.

## Not this skill

- Wave sitrep → **`/k-status`**  
- 派工 → **`/k-plan`** / **`/k-task`**  
- Set overall goals → **`/k-goal`**
