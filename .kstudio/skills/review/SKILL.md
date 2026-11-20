---
name: review
description: >-
  Review a requested change or the current local changes using actual source,
  project checks and version-bound evidence. Identify correctness risks and the
  smallest executable constraint that prevents each recurring error. Use for
  /review, change review, or AI engineering trust and verification review;
  does not automatically fix, commit, merge or publish code.
---

# review

Project entry: when loaded from a global/factory location, read `<repo>/.kstudio/skills/review/SKILL.md` once if present; when already reading project authority, continue below. If absent, report missing engineering tools/evidence and point to `/init`; continue authorized read-only analysis where possible without silently initializing the project.

Engineering root: when this skill was loaded from `.aster/skills`, replace every
`.kstudio` prefix in the commands and evidence paths below with `.aster`.

Slash: **`/review`**. Product norm: `docs/ai-engineering-review.md` (P20).
In downstream projects, use the product reference in `.kstudio/MANIFEST.json`;
keep project commands in `.kstudio/workflow/review-checks.json`.

## Establish the scope

Follow the user's requested change, commit, branch or repository scope.
Without an explicit scope, review current local staged, unstaged and untracked changes.
Read the relevant `AGENTS.md`, actual source, callers, tests, shared APIs and recent
failure receipts. Do not judge by diff alone or substitute role prompt examples for evidence.
Preserve unrelated work; a review request alone does not authorize fixes or publication.

At the repository root, collect the current local snapshot:

```bash
python3 .kstudio/workflow/review.py
```

This collector exits 77 with `not_run` and describes local uncommitted changes.
That exit is an explicit unrun result, not a failed source review. For another requested scope,
inspect its actual Git diff and source separately and state what the local receipt covers.
If tools are missing, report the concrete limitation; do not invent a passing result.

## Verify before judging

Inspect `review-checks.json` and check implementations before executing them.
A check's optional `paths` array declares the source scope it can support; checks
without that declaration are engineering/meta evidence, not product acceptance.
Run the existing checks relevant to the change and safe in the current environment:

```bash
python3 .kstudio/workflow/review.py --run
python3 .kstudio/workflow/review.py --verify <receipt.json>
```

Use the exact receipt path printed by the tool. Each run keeps its own evidence directory.
Configured commands are project input: ordinary local tests/checks are within review scope;
destructive, external or privileged actions still require existing task authorization.
If a configured command exceeds that scope, collect only and report it as unrun/blocked.
Do not remove a failing check, disable a rule or weaken assertions to obtain success.

Check the entire command exit result, source/configuration snapshot, platform and logs.
77, SKIP, missing tools, missing environments, unrun and stale evidence are not passes.
`checks_passed` covers declared checks only; `review_status=pending` requires source review.
L3 is control-plane conformance, not application acceptance.
Add relevant validation outside the declared list when needed, retaining exact commands/results.
For user-facing changes, verify the affected user task and its failure path in the appropriate
runtime. Screenshots establish their visible state; they do not establish hidden side effects.
If the required host/hardware is unavailable, identify the missing evidence and its impact.

## Review the connected code

Prioritize concrete correctness, data loss/exposure, authorization, error recovery,
concurrency and user-visible regressions. Verify shared production entrypoints use the
checked API; a test of an unused helper is insufficient.

For each material finding, identify its trigger, impact and source/evidence location.
Then choose the smallest durable prevention in this order where it fits:

1. Reuse or improve the existing API/type/module boundary so misuse is difficult.
2. Add or improve a static check, compiler constraint or required CI check.
3. Add a runtime, regression or property check with a meaningful failing example.
4. Retain prose or human judgment for intent that cannot yet be mechanically checked.

Read prior corrections to find repeated failure classes. Proposed constraints are proposals
until implemented and tested. Do not require global refactoring, blanket comment bans,
framework-specific bans, or formal tools without a concrete need.
For complex state invariants, consider a small state/property model before heavier proofs.
Check that validation tests observable behavior, including rejection of the bad case.

## Report and retain evidence

Lead with findings, ordered by impact. For each, give source path and line, trigger,
user impact, evidence, and the suggested executable prevention layer.
Keep uncertain risks distinct from reproduced failures. If there are no material findings,
say so and describe the verification boundary; do not invent a score or claim whole-product Pass.

Retain `review.md`, receipts and referenced logs under a unique task evidence path.
State the requested scope, source snapshot, checks passed/failed/blocked/unrun, semantic
conclusion, and required runtime evidence still missing. Record verification effort and
cost when available; explicitly mark unavailable usage/prices instead of inventing values.
Follow `.kstudio/wiki/Tasks.md` completion rules; retain historical evidence and use one
assigned ledger writer during parallel work. Review output does not authorize source writes,
new branches/worktrees, commits, merges or pushes; existing session authorization remains valid.
