---
name: yolo
description: >-
  Unattended goal-driven campaign: plan from GOALS.md, prefer quick wins,
  freely compose other conductor skills, and keep working until the overall goal (or named
  YOLO scope) is done. Slice hard-blocks park and switch paths — they are not
  campaign stop. Use when the user runs /yolo, or asks for 全自动、无人值守、
  不完成不要停, YOLO mode, or autonomous finish against overall goals.
  Discussing or creating this skill does not authorize a campaign by itself.
---

# yolo

Project entry: when loaded from a global/factory location, read
`<repo>/.kstudio/skills/yolo/SKILL.md` once if present; when already reading
project authority, continue below. If absent, report missing engineering
tools/evidence and point to `/init`; continue authorized read-only analysis
where possible without silently initializing the project.

Slash: **`/yolo`**  
Norm: `docs/conductor-skills.md` (P15) · goal-driven autonomous composition of conductor skills  
Also: P10e · P11 · P12 · P13 · P14 · P17 · P18 · P19 · P20 · GOALS.md.

军事口吻：简洁、明了、突出重点。不要线框、不要抽象。

Scope: unattended progress toward `.kstudio/workflow/GOALS.md` **overall goal**
(and near-term hard goals as knives toward it), inside the existing product
boundary. Prefer **quick wins** that move measurable completion. Freely Read and
execute other project conductor skills skills as tools. Not a license to expand the product
surface, invent unrelated busywork, privately create branches/worktrees, or
promise work after the host is gone.

## Authorization

1. Creating or explaining this skill does **not** start a campaign.
2. The user's `/yolo` (or an explicit “全自动 / 无人值守 / 不完成不要停”)
   authorizes continuous plan→act→verify cycles in **this session** against
   current GOALS overall goal / hard goals / named task scope.
3. `/yolo` does **not** grant extra push, cloud spend, machine destroy, or
   secret exfiltration rights. Destructive or irreversible actions still obey the
   underlying skill/tool confirmation rules unless the user already gave that
   exact authorization.

## Target of record (MUST)

| Target | Rule |
| --- | --- |
| **Primary** | `GOALS.md` **overall goal**, unless the user named a narrower YOLO scope in this turn |
| **Near-term hard goals** | Knives that raise overall completion — **not** campaign Done by themselves |
| **Wave / slice** | Local acceptance only; finishing a wave or one hard-block path ≠ overall Done |

**Done** means: overall goal (or the user-named YOLO scope) met with real
evidence. Near-term HG green, L3 green, high progress %, or a shipped slice is
**not** Done while the overall goal remains unmet. **%≠Pass.**

## Loop (MUST) — do not idle while the overall goal remains unmet

While the primary target above remains incomplete:

1. **Sense:** Run `/status` and `/progress`. Read `GOALS.md`, lineage,
   recent evidence, and P19 short-report lessons. Name the causal gap to the
   **overall goal** in one line (not only the last wave).
2. **Pick quick wins first:** Rank the next slice by (a) unlocks downstream
   work toward overall, (b) small verified delta, (c) clear acceptance. Prefer a
   shippable slice over a perfect mega-plan. If the preferred path is blocked,
   pick the next productive overall-goal slice — do not idle-stop.
3. **Plan as needed:** Use `/plan` when the wave needs full-seat evaluation,
   or `/task` when only the current slice matters. Replanning is allowed when
   the queue is empty, blocked, or stale **and** the overall goal (or named
   scope) is still unmet — that is the difference from `/go`'s single plan
   pass.
4. **Act with other conductor skills freely:** Compose `/go`, `/loop`, `/review`,
   `/clean`, `/wiki`, `/init` (facts-only repair), etc., by Reading their
   SKILL.md and executing. Same session; do not wait for the user to paste seats
   elsewhere. Use Implementer subagents for product `src/` when needed.
5. **Verify:** Prefer `/review` and project checks. Green checks ≠ product
   Pass; close the slice only on observed acceptance for that slice.
6. **Record:** Evidence under `.kstudio/evidence/`; short-report cost
   **约 `$… USD tokens`** when known; update wiki Tasks when a slice completes.
7. **Continue (hard):** If the overall goal (or user-named YOLO scope) is still
   unmet, **immediately** start the next sense→plan→act→verify cycle.
   **Do not stop** for politeness, “awaiting confirmation,” empty paste queue,
   “near-term done,” “next knife deferred,” host fatigue, or a single-slice
   hard block while another productive overall-goal path remains.

## Hard block = slice-local first (MUST)

A missing secret, notarize profile, paid cloud action, push, or irreversible op
that still needs explicit user intent:

1. **Park that slice** with a resume checkpoint (what blocked, exact missing
   intent, evidence path).
2. **Re-sense** overall-goal gap; pick the next unblocked productive slice
   (docs, tests, UI, workflow gates, factory sync, other platforms, cleanup with
   evidence, wiki — anything inside GOALS / product boundary that raises
   completion).
3. **Campaign Hard block** is allowed **only** after every productive
   alternative toward the overall goal (or named scope) has been tried or is
   itself hard-blocked — not when the first preferred path fails.

Same-failure spinning on one slice: change approach (review root cause, clean,
shrink slice, hard-case researcher path). Do **not** idle-stop the campaign and
do **not** reset evidence to fake progress.

## Stop only when

Stop the **campaign** only for one of:

| Reason | Rule |
| --- | --- |
| **Done** | **Overall** GOALS goal (or user-named YOLO scope) met with real evidence — not % alone; near-term-only ≠ Done |
| **Cancel** | User cancels |
| **Hard block** | Missing secret / paid cloud / irreversible op still needs explicit user intent **and** no remaining productive alternative toward overall/named scope |
| **Host limit** | Session/host cannot continue; leave a resume checkpoint — do **not** promise offline continuation after shutdown |

### Forbidden premature stops (MUST NOT)

Do **not** end `/yolo` solely because:

- near-term hard goals look done while overall goal is unmet
- notarize / push / cloud / secret blocked **one** slice
- a wave finished and the brief says “next knife deferred”
- progress % is high, L3 PASS, or checks are green (%≠Pass)
- the paste queue is empty (replan from GOALS instead)
- politeness or “awaiting user confirmation” without a true campaign Hard block

Do **not** recursively invoke `/yolo`. Nested work uses `/go` / `/loop` /
`/task` / other non-yolo skills.

## Hard limits (still apply)

- P17: never privately create git branches/worktrees.
- P13: serialize conflicting write domains / branches / machines.
- Do not expand product boundary beyond GOALS / user-stated surface.
- Do not weaken checks or invent Pass.
- MAY update `.kstudio` orchestration metadata; final publish only with existing
  authorization.

## Final brief

When stopping: done vs blocked, slices shipped, evidence paths, **remaining
overall-goal gap**, parked hard-blocked slices (if any), optional cumulative
**约 `$… USD tokens`**. Do **not** paste `发给 O`.
