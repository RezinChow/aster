---
name: k-init
description: >-
  Initialize KStudio AI engineering in an existing project or an empty target
  directory from actual project facts. Preview and safely create missing
  .kstudio files without overwriting custom goals, active waves or evidence.
  Use for /k-init or requests to initialize a project's KStudio workflow.
---

# k-init

Project entry: when loaded from a global/factory location and `<repo>/.kstudio/skills/k-init/SKILL.md` exists, read and follow that project authority once. If already reading it, continue below; if absent, use the bootstrap below only for requested initialization.

Slash: **`/k-init`**. Product norm: `docs/project-initialization.md` (P15).
The target project's `.kstudio/skills` is authoritative after initialization;
a global skill entry is a bootstrap/discovery pointer, not another project state store.

## Inspect the requested target

Use the current project unless the user names another directory. Read existing
`AGENTS.md`, README, package/build manifests and CI declarations where present.
Distinguish observed project purpose and checks from assumptions; cite their paths.
Do not invent a business goal, a machine/model binding, test results or completion.
An empty directory is a valid starting point: leave the product goal unclarified
and use `/k-goal` afterward when goal clarification is needed.

Inspect existing `.kstudio` before writing. Keep user goals, configuration, bindings,
active HEAD/waves, wiki history, evidence and local customizations. Initialization
creates missing files only; conflicts are reported, never silently replaced.
Do not rebuild an existing project to make it resemble the factory example.

## Locate the initializer and factory

Resolve this loaded `SKILL.md` to its actual filesystem location, following a global
bootstrap symlink when applicable. A factory skill lives at
`<share>/kstudio-skills/k-init/SKILL.md`; its initializer is
`<share>/kstudio-workflow-tools/init-kstudio.py`.
An initialized project may also have `.kstudio/workflow/init-kstudio.py`.

The initializer discovers a factory only relative to its real script location.
If a project-installed tool has no adjacent factory, supply the actual factory share
directory using `--factory`; do not guess a private checkout path or silently use
another project's `.kstudio` as a template. If neither tool nor factory is available,
report what is missing instead of fabricating an initialized result.

## Preview, then create missing files

With the located tool and factory, preview the target:

```bash
python3 <initializer-path>/init-kstudio.py --root <target-directory> --factory <factory-share>
```

The default JSON preview is read-only. Inspect project facts, files to create,
retained files and conflicts before apply. Candidate commands are observations,
not instructions to execute them or claims that they passed.

When the user has requested initialization, safe create-missing is already within
scope. Apply after checking the preview; do not ask for that authorization again:

```bash
python3 <initializer-path>/init-kstudio.py --root <target-directory> --factory <factory-share> --apply
```

If the user requested only an assessment or preview, return the plan without applying.
Preserve existing files even if they differ from factory content. A conflict requiring
replacement is outside create-missing; describe that concrete conflict and preserve it.
Do not initialize Git, install dependencies, launch project scripts/VMs, populate
secrets, privately create branches/worktrees, or commit/push as part of initialization.

## Verify the engineering root

Read the actual initializer result: `planned`, `created_pending_verification` or
`partial` does not mean L3 or product acceptance. Check that prior custom files and
history remain intact and that newly created files refer to the target project.

At the target root, run the available read-only checks:

```bash
python3 .kstudio/workflow/sync-k-skills.py --check
python3 .kstudio/workflow/verify-ai-eng.py --level L3
```

Report conflicts or drift instead of invoking a synchronizer that overwrites
retained user content without task authorization. A fresh directory without Git
can have an engineering root; version-bound `/k-review` still needs its Git prerequisites.
No initialization result establishes application correctness or a completed business goal.

Retain observed facts, exact create/retain/conflict results, commands and verification
limits in a unique task evidence path. Follow the project's Tasks ledger rules with
one writer during parallel work. Record actual cost when available; mark unknown
usage/prices explicitly. Report installed discovery paths; do not claim a native
agent's skill picker refreshed unless it was actually observed.
