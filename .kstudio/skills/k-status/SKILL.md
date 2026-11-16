---
name: k-status
description: >-
  Summarizes real project AI-eng progress from .kstudio (HEAD, STATUS, lineage,
  HOLD, evidence ready). Use when the user runs /k-status, or asks for sitrep,
  battle picture, wave status, seat dispatch/hold, or how far the wave is.
  Not for whole-project completion %. Use /k-progress for that. % is not Pass.
  Does not write business source.
---

# k-status

Project entry: when loaded from a global/factory location, read `<repo>/.kstudio/skills/k-status/SKILL.md` once if present; when already reading project authority, continue below. If absent, report missing engineering tools/evidence and point to `/k-init`; continue authorized read-only analysis where possible without silently initializing the project.

Slash: **`/k-status`**  
Norm: product `docs/conductor-skills.md` (P15).

**不同于 `/k-progress`：** 本 skill 是波次/席位/证据 **态势**；整仓完成度% 用 **`/k-progress`**。

军事口吻：BLUF → 事实 → 现派/持守。不要线框、不要抽象「态势良好」。

## Steps (MUST)

1. At repo root:

```bash
python3 .kstudio/workflow/sitrep.py
```

2. Reply（短）：  
   - **结论**一句  
   - **缺口**条列（具体路径/sha）  
   - **席位**谁 · 阶段 · 证据  
   - **现派 / 持守**  
3. Truth: lineage + evidence/handoff > STATUS > chat.  
4. State **%≠Pass**. Do not write business source.

## Not this skill

- Whole-project completion % → **`/k-progress`**  
- Next-step planning → **`/k-plan`**  
- Paste dispatch only → **`/k-task`**
