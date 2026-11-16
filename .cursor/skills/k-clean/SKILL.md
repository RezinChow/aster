---
name: k-clean
description: >-
  Clean proven code defects, redundant implementations, dead code, temporary
  patches and confirmed junk using source review and verification evidence.
  Use for /k-clean, cleaning AI-generated code or repository clutter. Default
  to a concrete dry-run plan; apply only within the user's authorized scope,
  preserve user work and historical evidence, then re-verify affected behavior.
---

# k-clean

Project entry: when loaded from a global/factory location, read `<repo>/.kstudio/skills/k-clean/SKILL.md` once if present; when already reading project authority, continue below. If absent, report missing engineering tools/evidence and point to `/k-init`; continue authorized read-only analysis where possible without silently initializing the project.

Slash: **`/k-clean`**. Norm: `docs/conductor-skills.md` (P15) and
`docs/ai-engineering-review.md` (P20). **M** organizes cleanup and verification;
**B/R/I** implement product-code corrections. A current **O** remains
`orchestrate_only` and delegates source changes.

## Inspect and plan

Use `.kstudio/skills/k-review/SKILL.md` to inspect the requested scope, actual
source/callers, prior corrections and applicable checks before selecting cleanup.
Run `sitrep.py` when planning roles; preserve the existing wave and unrelated work.

Separate reproduced bugs and confirmed redundancy from candidates that need investigation.
Check dynamic loading, reflection, generated files, build/configuration references and
public interfaces before calling code unused. AI authorship, many comments, file size,
or no `rg` match alone do not establish that code is wrong or safe to remove.

For each proposed change, list its exact path, risk, evidence, reason, intended behavior
and verification. Prefer correcting the root cause through an existing API/type/shared
check; keep validation and data-loss prevention when merging or removing code.
A small regression/negative test should reject the demonstrated bad case.
Proposing another Markdown rule alone does not fix broken code.

Inventory tool-owned stale files and generated junk with the helper:

```bash
python3 .kstudio/workflow/clean-kstudio.py
# Optional: choose a new plan path for this task.
python3 .kstudio/workflow/clean-kstudio.py --plan <new-plan.json>
```

The helper inventories safe file candidates; it does not determine semantic dead code
or automatically repair application logic. Retain its exact plan alongside the code
cleanup findings. Default to dry-run. If the user has already authorized execution,
continue within that authorization without asking for it again.

## Apply the reviewed scope

For authorized helper deletions, consume the exact reviewed plan:

```bash
python3 .kstudio/workflow/clean-kstudio.py --apply --plan <reviewed-plan.json>
```

Do not substitute a new scan or expand the deletion set during apply. The helper
rechecks the plan's files/content, Git status and safety boundaries; failures must be
reported, not suppressed. Stale plans require a new review.
Product-code cleanup goes to the assigned B/R/I executor, with paths, evidence and
acceptance checks. Reuse session authorization; respect existing role/branch boundaries.
If the user requested only a proposal, present the concrete plan before requesting
execution approval, and explain that this skill defaults to dry-run.

Preserve historical evidence and its references, lineage/timeline, `GOALS.md`, secrets,
third-party source, and unrelated or uncommitted user work. Do not rewrite history,
force-push, privately create branches/worktrees, or change product boundaries.
An old-looking HOLD, migration or stub is a candidate until its references and purpose
are checked. Treat uncertain files as keep/inspect, not an automatic delete.

## Verify and retain the result

Run checks that exercise affected behavior, including the reproduced failure case.
When engineering skills/rules changed, also run:

```bash
python3 .kstudio/workflow/sync-k-skills.py
python3 .kstudio/workflow/verify-ai-eng.py --level L3
```

After those writes/checks settle, use `/k-review` again and retain a fresh, verified receipt:

```bash
python3 .kstudio/workflow/review.py --run
python3 .kstudio/workflow/review.py --verify <receipt.json>
```

Record exact changes, kept candidates, commands/results, cost when available and
remaining runtime/platform limits in a unique task evidence path. Follow Tasks ledger
rules with one assigned writer. `checks_passed` and L3 do not establish whole-product
acceptance. End with a short result and meaningful unchecked items; no self-assigned
next task or invented savings.
