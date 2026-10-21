# Composer approval paint gate, R4

Root reproduced the persistent white normal-composer card over an approval in the final FreshE R3 native window. This was a real display defect, despite accessibility exposing only the approval.

Root bound WebInspector to the same unique active QA window/PID and R3 origin. There was exactly one primary layer and one inputbar; the inputbar was inside that primary. Primary and all descendants computed to `visibility:hidden`, with `inert=true`. Hit testing at the inputbar center returned approval/DIFFS-CONTAINER descendants, with override membership true and primary membership false. Opening Inspector changed the viewport and cleared the obsolete white-card paint without a DOM or CSS change. These observations rule out a second ordinary composer, an escaping inputbar portal, and a normal visibility-cascade override. They establish a rendering-state/DOM-state mismatch; they do not identify an exact upstream WebKit bug or version.

No same-scene opacity A/B was completed: Inspector resize cleared that scene first. We do not count the inspection-repainted scene as a fix pass. A proposed temporary diagnostic renderer was unnecessary and was never generated.

The entire product change is one additional `opacity-0` class on the already inactive primary layer in `ComposerCore.tsx`. Its existing visibility, pointer-event, inert and accessibility gates remain. Opacity creates a non-inherited paint gate while preserving the current DOM, React instance, ProseMirror editor, layout and portal. Display, focus handling and native code are unchanged; no remount or forced reflow was added.

The maintained actual Core regression failed first (1 failed / 3 passed), then passed. All six owning suites pass **62 tests**. The new real Tiptap regression commits a Chinese IME draft, activates an approval, verifies the same editor/DOM/selection and draft, releases the approval, verifies focus restoration, and sends with a later Enter exactly once. The existing stateful Core case verifies attachment/undo/selection preservation. Original five composition tests remain on their original harness path; only the new lifecycle case opts into the real Core wrapper. An intermediate all-cases wrapper affected one synthetic missing-data composition fixture, and was corrected without expanding the product patch.

R4 freezes **89 source/asset files**, retaining all 86 R3 sources unchanged. Both actual production builds measure **101 unchanged inputs**:

- `target/evaluations/studio-default-aster/renderer-local-r4-aster-20261021` — 16.765 seconds, 2,655 files.
- `target/evaluations/studio-default-aster/renderer-local-r4-toyou-20261021` — 15.051 seconds, 2,650 files.

Run from `apps/studio` with `A3S_TENANT_SLUG=aster|toyou`, `STUDIO_RENDERER_DIST=<distinct output>`, `NODE_ENV=production`, `NODE_OPTIONS=--max-old-space-size=12288`, then `node node_modules/@rsbuild/core/bin/rsbuild.js build`. R3 directories were not overwritten. Full manifests bind each output and verify the exact new inactive-primary class string in its compiled Core chunk. Canonical assets, Aster login-component absence/local-provider presence, and ToYou local-provider absence remain checked.

Three changed files pass ESLint, formatting and diff checks. Actual scoped TypeScript diagnostics remain **33 before / 33 after, zero additions**; this does not claim whole-tree TypeScript is green. `local-r4-final-validation.json` binds exact logs, source, build and artifact hashes, including the parent-owned before observations.

Root must accept the entire new R4 GUI workflow without Inspector/viewport changes. These source, behavior-test and static-artifact results do not replace that fresh native GUI gate. This agent performed no GUI, native or package actions.
