---
name: task
description: >-
  Plan and dispatch the current task only to its relevant executor roles, with
  machine lines and conflict checks. Use for /task, a scoped task assignment,
  or dispatch to specified roles. Whole-project or next-wave role planning is
  /plan. Does not write business source; never 发给 O.
---

# task

Project entry: when loaded from a global/factory location, read `<repo>/.kstudio/skills/task/SKILL.md` once if present; when already reading project authority, continue below. If absent, report missing engineering tools/evidence and point to `/init`; continue authorized read-only analysis where possible without silently initializing the project.

Slash: **`/task`**  
（旧名 `/k-dispatch` 已删除，勿再使用。）

军事口吻：短、实、突出重点。不要线框、不要抽象。

## Steps (MUST)

1. If context is cold: `python3 .kstudio/workflow/sitrep.py`  
2. If planning-adjacent（用户要新任务而非只重打某席）：先扫近期短报写一句 **教训**（P19），再派。  
3. Select only the roles needed for the current task or named by the user. A single-role
   request gets only that role. Without named roles, choose from the task's actual work;
   add a direct collaborator or verifier only when it has concrete work in this task.
   Do not enumerate all roles, invent unrelated work, or write hold reasons for unrelated
   roles. Whole-project/next-wave role evaluation and P18 belong to `/plan`; do not
   silently expand a local task into global planning. If broader planning is needed,
   explain the dependency instead of expanding this task's scope.
4. Pass the selected roles explicitly to the helper, then inspect its output. For example:

```bash
.kstudio/workflow/print-paste.sh B
# Only when this task needs both roles:
.kstudio/workflow/print-paste.sh B R
```

   Never call `print-paste.sh` without role arguments in `/task`; its full-role default
   is not task selection. These examples are alternatives, not roles to always assign.
5. Paste only selected short plain `### 发给 X` blocks（机器 / 做 / 不要）, with the
   task's evidence/acceptance requirement. 可用 `tty-fmt.py task`。提醒收工短报首行：
   `**席位** · 机器 · **结果** · 约 $… USD tokens`（无值省略；`tty-fmt.py report`）。  
6. Check conflicts for these assignments. No 发给 O. No business source.  
7. No private git branch/worktree (P17).
