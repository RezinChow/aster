---
name: k-go
description: >-
  Run /k-plan once, then complete every dispatched task in order in the same
  session. Use when the user runs /k-go, or asks to plan and immediately finish
  the wave, 规划后自动做完, or 一口气干完. Discussing or creating this skill does
  not authorize a product campaign by itself.
---

# k-go

Project entry: when loaded from a global/factory location, read
`<repo>/.kstudio/skills/k-go/SKILL.md` once if present; when already reading
project authority, continue below. If absent, report missing engineering
tools/evidence and point to `/k-init`; continue authorized read-only analysis
where possible without silently initializing the project.

Slash: **`/k-go`**  
Norm: `docs/conductor-skills.md` (P15) · composes `/k-plan` → ordered execution  
Also: P10e · P11 · P12 · P13 · P14 · P17 · P18 · P19 · `/k-task` · `/k-loop` when needed.

军事口吻：简洁、明了、突出重点。不要线框、不要抽象。

Scope: one plan pass, then the same session finishes that plan's real work queue.
Not a substitute for `/k-loop` on a single durable task, and not a silent
replan engine. Whole-project planning rules still come from `/k-plan`; local
single-task dispatch without a full plan stays `/k-task` / `/k-loop`.

## Steps (MUST)

1. This session elevates for planning when `/k-go` is invoked. Creating or
   explaining this skill does **not** start a campaign; the user's `/k-go` (or
   an explicit “plan then finish it here”) does.
2. **Plan once:** Read and fully execute `.kstudio/skills/k-plan/SKILL.md`.
   Do not skip sitrep, P19 lessons, hard-goal/gap, conflict check, or P18 seat
   evaluation. Paste real `### 发给 X` blocks (or state **持守原因**).
3. **Build the queue:** Take each real `### 发给 X` in paste order. Skip seats
   marked **持守**. Do **not** invent busywork or extra seats. Announce the
   queue in one short list (seat · one-line goal).
4. **Same session — execute in order:** Do not wait for the user to paste each
   block into another chat. For each queued item:
   1. Scope with `/k-task` semantics for **that seat only** (machine, write
      paths, acceptance, existing authorization).
   2. Perform the work as that assignee in this session (or launch an
      Implementer subagent for product `src/` when B/R must write code). Plan
      phase stays orchestration-only; execution phase carries the assignee
      duty until acceptance or an honest stop.
   3. If the item needs durable implement→verify iterations, run `/k-loop` for
      **that one task** with finite persisted budgets; reach a true terminal
      state before starting the next queue item.
   4. Respect P13: serialize conflicting write domains / branches / machines;
      never privately create branches or worktrees (P17).
   5. Record evidence and short-report cost (**约 `$… USD tokens`**) when known.
5. **Stop conditions:** After the last queued task; on user cancel; or on a hard
   block that needs new user intent. Do **not** silently re-run `/k-plan` to
   expand scope. Do **not** recursively invoke `/k-go`. Do not promise offline
   continuation after host shutdown.
6. Existing explicit publication authorization remains valid for M after task
   acceptance; `/k-go` grants no extra push, machine, or branch rights.
7. Final brief: what ran, what passed, what blocked, evidence paths, optional
   wave cost. Do **not** paste `发给 O`. MAY update `.kstudio` orchestration
   metadata and wiki Tasks when the campaign completes.
