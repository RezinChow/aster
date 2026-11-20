---
name: goal
description: >-
  Staff-mode (S) overall-goal analysis: clarify goals inside the existing
  product boundary via turtle-soup (海龟汤) yes/no probing one native user form
  per turn, then update .kstudio/workflow/GOALS.md. Use when the user runs
  /goal, or asks to set/revise goals, 总体目标, 愿景, or hard goals. Does not
  write business source. Does not invent new product surfaces.
---

# goal

Project entry: when loaded from a global/factory location, read `<repo>/.kstudio/skills/goal/SKILL.md` once if present; when already reading project authority, continue below. If absent, report missing engineering tools/evidence and point to `/init`; continue authorized read-only analysis where possible without silently initializing the project.

Slash: **`/goal`**  
Norm: `docs/conductor-skills.md` (P15) · seat **S**（参谋长：目标/复盘）· P14.  
Method: **海龟汤（Turtle Soup）** yes/no probing · **一题一原生表单**.

军事口吻：短、实。对用户说话用「总体目标 / 硬目标」；**禁止**对用户说「北辰」。

## Stance (MUST)

1. Act as **S** for this turn: clarify goals; O still does not write business source.  
2. **Stay inside the product boundary.** User wording defines the product surface. MUST NOT invent adjacent products, platforms, fleets, or “any-repo orchestration” as the overall goal when the user asked for an app / platform already in scope.  
3. **Raise the bar of definition, not the surface.** You MAY sharpen what “生产可用” means (evidence, machines, Pass rules) inside that boundary. MUST NOT enlarge the product.  
4. Separate **real constraints** (physics, law, budget, missing machine, explicit backend hold) from **self-efficacy talk**.  
5. Do **not** invent fake Pass. Do **not** edit `src/` or product app code. MAY update `.kstudio/**` goal/orchestration files.

## Turtle soup (海龟汤) — MUST run before locking goals

Hold a clearer end-state **inside** the user’s product ask (the “汤底”). Peel with **yes/no** (or A/B). Prefer ≤7 questions; stop early when clear.

### Form UX (MUST) — one native form per turn

**禁止**同回复甩一整串题。  
**禁止**把 JSON / `json-render` 围栏贴进聊天当「表单」。那不是用户表单。

1. Read host skill **`ask-form`** when available.  
2. For each unknown probe: invoke the host **form tool** with **exactly one** yes/no or A/B question:  
   - Prefer tool **`ask_user_form`** (argument = full JSON Render document string; **tool call only**).  
   - Else if host has **`AskQuestion`** (or equivalent native questionnaire tool): use that.  
3. Wait for submit → record in `GOALS.md` Open turtle-soup → next single form the same way.  
4. If **no** form/questionnaire tool exists in this host: ask **one** plain-language yes/no in chat and wait. Still never batch. Still never dump form JSON into the reply.  
5. Only after enough answers (or user says「按我说的直接写」) lock overall goal / update full `GOALS.md`.

Probe for (ask **one at a time**; stay in product):

| Ask about | Example yes/no |
| --- | --- |
| Production meaning | 「『生产可用』是指真实用户日常可装可用，还是 accept/门禁绿即可？」 |
| Constraint vs doubt | 「你划掉的后端/平台是机器或产品硬限制，还是怕做大？」 |
| Same product, sharper bar | 「成功标准要不要写成：双端同一产品门禁可复跑，且 77≠Pass？」 |
| Explicit hold | 「Windows 不做 libkrun —— 是本阶段硬约束吗？」 |

Rules:

- Prefer **yes/no**; if the user hedges, re-ask once as pure yes/no (**still one form**).  
- After answers: state the **汤底** in ≤5 lines using **总体目标** wording, then confirm.  
- If user insists on a smaller *delivery* knife: keep overall goal = their product ask; put the knife under **Near-term hard goals** / `/plan`. Do not invent a larger product.

## Steps (MUST)

1. Read current goals + sitrep:

```bash
python3 .kstudio/workflow/sitrep.py
test -f .kstudio/workflow/GOALS.md && head -n 80 .kstudio/workflow/GOALS.md
```

2. Ingest user input (this message + any pasted intent).  
3. If anything material is unknown: 海龟汤 with **one native form per turn**. Do not batch. Do not paste JSON forms.  
4. After enough answers (or「按我说的直接写」), update:

**`.kstudio/workflow/GOALS.md`** (create if missing) with at least:

```markdown
# Overall goals (goal · S)

Updated: <ISO date> · by: S via /goal

## Overall goal
<product-shaped end-state inside user boundary; not a single ticket>

## Stretch (within product)
<sharper quality bar for the same product; not a new product>

## Near-term hard goals
1. <verifiable>
2. …

## Non-goals
- …

## Real constraints (not self-doubt)
- …

## Open turtle-soup
- Q: … → A: yes/no/unknown

## Sources
- user input / sitrep / prior GOALS.md
```

5. Reply TTY-style:  
   - 总体目标（汤底）  
   - what changed vs previous GOALS  
   - remaining yes/no (if any)  
   - next: offer `/plan` for knives; do **not** paste 发给 O  
   - **禁止**对用户使用「北辰」一词  
6. Optional: long retro → paste **发给 S**; else this session *is* S for goals.

## Not this skill

- Wave knives / dispatch → `/plan` · `/task`  
- Wave sitrep → `/status`  
- Whole-project completion % → `/progress`  
- Hard-case debug → seat **I**
