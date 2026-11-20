---
name: loop
description: >-
  Execute a scoped engineering task through durable, bounded implementation
  and verification iterations. Use when the user explicitly asks to execute or
  resume a concrete task through /loop or persistent iterative work until
  acceptance or a finite stop condition. Discussing, creating or editing the
  loop skill does not authorize starting a task loop.
---

# loop

Project entry: when loaded from a global/factory location, read `<repo>/.kstudio/skills/loop/SKILL.md` once if present; when already reading project authority, continue below. If absent, report missing engineering tools/evidence and point to `/init`; continue authorized read-only analysis where possible without silently initializing the project.

Norm: `docs/task-engineering-loop.md` (P15/P20). This skill executes the current
task; it must not stop after a plan or dispatch note while authorized work remains.
Creating or explaining this capability does not authorize starting a target loop.

## Establish one task and finite budget

Use `.kstudio/skills/task/SKILL.md` to select only this task's necessary roles,
write paths, machine, acceptance and existing authorization. Preserve the distinction
from `/plan`: no full-role planning or hold list for unrelated roles.
Read actual source, recent failures, lineage and existing run state before acting.
O remains orchestration-only; send implementation to the relevant Implementer.
Use available task-specific execution channels; report blocked if a necessary channel
or platform is unavailable instead of pretending a copy block executed the task.

Define a `kstudio.loop-spec.v1` JSON file, using the actual task and review check IDs:

```json
{
  "schema": "kstudio.loop-spec.v1",
  "task_id": "task-example",
  "goal": "The user's concrete requested result",
  "roles": ["B"],
  "write_paths": ["src"],
  "acceptance": {
    "description": "Observable acceptance for this task",
    "check_ids": ["an-existing-review-check-id"]
  },
  "limits": {
    "max_iterations": 20,
    "max_seconds": 7200,
    "max_stagnant": 5,
    "max_same_failure": 5
  }
}
```

These are schema examples, not bindings or checks to invent. Use existing project
checks and the smallest sufficient write scope. Keep the spec in a task-specific
local path. Longer authorized work may use larger limits, all finite positive values;
missing usage/prices do not justify inventing dollar or token budgets.

## Start or resume, then perform the work

```bash
python3 .kstudio/workflow/loop-kstudio.py --root <repo> start --spec <task.json> --controller <controller-id>
python3 .kstudio/workflow/loop-kstudio.py --root <repo> status --run <task-id>
```

Use the same task ID/spec/controller when resuming. Read
`.kstudio/local/loops/<task-id>.json` and its evidence references; recover from those
records, not chat memory. Keep cumulative budgets across context compression, crashes
and host/session handoffs. Confirm a previous controller is not still active; do not
start a competing controller or create another task ID to evade the limit.

While the run is active, perform actual tool work:

1. Read `status` and remaining limits before each implementation, check or review
   action; obey a stopped/blocked state before invoking another external worker.
2. Advance one concrete task step through the relevant Implementer. Use a bounded
   timeout within remaining time; do not leave an unbounded child worker or wait.
3. Apply `/review`: run applicable declared checks, inspect source/callers and the
   actual failure output, then verify a fresh review receipt for this source state.
4. Prefer fixing a shared API/type/static constraint or adding a meaningful negative
   test. If checks miss a real semantic failure, make that gap explicit; do not weaken
   checks or turn missing environment evidence into a pass.
5. Record the iteration with its real receipt:

```bash
python3 .kstudio/workflow/loop-kstudio.py --root <repo> advance --run <task-id> --controller <same-id> --receipt <review-receipt.json>
```

6. Read the returned state and reason. In `running`, continue implementation; in
   `ready_for_review`, perform the applicable semantic/user-flow review below. An iteration
   that changed only source hashes, logs or prose is not verified progress. Do not
   run another internal implementation loop without recording its iteration.

The helper enforces finite iterations, total time, consecutive stagnation, repeated
failures, receipt replay and A/B oscillation. It only manages state/evidence; you must
execute the actual task and verification. Do not recursively invoke `/loop`.
`status` exposes iterations, elapsed/remaining seconds and the next action; reading it
also checks expiry. Time limits are enforced at control points, not by a daemon that
can kill arbitrary external model sessions. If the execution channel cannot supply a
bounded timeout/cancellation within the remaining budget, record blocked.
During ongoing tool work, give a meaningful progress update within each 60 seconds;
use bounded waits for long operations and report concrete changes or unresolved facts.

## Review the checkpoint, then accept or continue

`ready_for_review` means declared checks are green, not that the product or semantic
goal passed, and is not terminal. Automatically perform applicable source/user-flow
review instead of leaving a green diff for the user to drive. A concrete finding within
authorized scope must feed source-bound rejection into this same run and return to
implementation with its original cumulative budgets and evidence history.
Save the actual review in an independent report under `.kstudio/evidence/`, then submit a
`kstudio.loop-feedback.v1` JSON file with these fields:

| Field | Value |
| --- | --- |
| `task_id`, `decision` | This task ID; `reject` for concrete findings or `accept` when applicable acceptance is verified |
| `receipt_sha256`, `source_sha256` | Current checkpoint's `last_receipt_sha256` and `last_source`; use real values, not recomputed claims |
| `review_path`, `review_sha256`, `reviewed_at` | Project-relative evidence report path, its content hash, and actual ISO timestamp with timezone, at or after `last_receipt_finished` (epoch seconds) |
| `findings` | On rejection: `[{"id":"stable-finding-id","check_id":"an-original-acceptance-check-id","description":"the observed defect"}]`; on acceptance: `[]` |

```bash
python3 .kstudio/workflow/loop-kstudio.py --root <repo> feedback --run <task-id> --controller <same-id> --feedback <review-feedback.json>
```

Both decisions are valid only at `ready_for_review`; read status before submitting.
`reject` returns to `running`. Establish the finding's failing negative case in its
original selected check, record that real failed receipt, then repair the root cause
and record a fresh passed receipt. Otherwise the run cannot become review-ready again.
If the necessary failure cannot be verified, report the missing prerequisite honestly.
`accept` records `task_accepted`, limited to this task's reviewed acceptance.
Feedback consumes the same finite iteration budget; report edits, repeated findings
or receipt replay cannot reset it. Do not invent evidence or create another run.
Record blocked only for a real missing prerequisite or necessary user decision,
not merely because review found an actionable defect.

## Stop honestly and retain the checkpoint

On missing prerequisites, exit 77, or a known external dependency with no productive
action, record blocked instead of blind retries. On user cancellation, record cancelled:

```bash
python3 .kstudio/workflow/loop-kstudio.py --root <repo> stop --run <task-id> --controller <same-id> --reason blocked --detail <specific-cause>
# Use --reason cancelled when the user cancels.
```

Respect every true terminal state: `task_accepted`, blocked, exhausted budget,
stagnation/oscillation or cancellation. Never reset counters, delete failing gates,
silently expand scope, or start a cron/daemon/infinite background agent to continue.
Use host-native continuation only when it actually exists and fits the same authorized
task and limits. Otherwise continue this invocation and retain the checkpoint for later
resume; do not promise unattended execution after host shutdown or power loss.
Do not create a host-native goal for an ordinary task unless the user explicitly asks.

The loop does not itself publish Git or commit each round. Existing explicit task
publication authorization remains valid: after semantic acceptance, M may carry out
that authorized final publish without asking again. It grants no extra write scope,
machine permissions or branch/worktree creation rights.

Report concrete work, verified improvements, stop reason, remaining acceptance gaps,
checkpoint/evidence paths and actual cost when available. Keep each task's evidence;
follow Tasks ledger single-writer rules and preserve earlier receipts.
