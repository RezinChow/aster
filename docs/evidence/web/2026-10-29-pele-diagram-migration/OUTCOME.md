# Pele diagram migration

## Result

Replaced all 23 current SeeCode figures and six README exports with Pele 1.10.0.
Local rendering, interaction, source-fidelity and staging checks passed. Pages
publication and live read-back are pending and will be recorded here.

## Changes

- Authored Mermaid flowcharts, sequences and blocks under each product/version's
  `_diagrams` directory. Catalog entries and public SVG URLs remain stable.
- Retained every original node identity, label, relationship label, explanatory
  step and source selector. Ordered step/source data equals the previous
  committed definitions; see `migration-inventory.json`.
- Converted conceptual layers and independent Goal decisions to arrow-free
  blocks. Their arrangement does not assert execution order.
- Shared one Pele renderer for existing figures, guided figures and exports.
  Guides use explicit rendered node IDs for click and keyboard focus;
  references to absent nodes fail the build.
- Kept previous/next, complete view, finite narration, reduced-motion manual
  controls, source citations and seven Code Hike source walks with 38 stops.
- Removed the retired vendor tree, project settings, watermark assets and
  SeeCode animation/assembly controls. Historical provenance remains.
- Kept generated 9.1.5 documentation byte-identical to its previous state.
  The dirty root checkout was preserved. Latest upstream legal pages and
  footer links were retained in the isolated worktree.

## Verification

| Check | Result |
| --- | --- |
| Complete web Node suites | 91 passed before the final prose-export regression case |
| Final documentation and diagram integration suites | 30 passed |
| Final diagram/prose regression suite | 14 passed |
| Python site suite | Initial mixed-checkout failure retained; isolated root-cause case passed; affected-case reruns and final CI pending |
| Deterministic generation | 89 documents / 150 routes passed |
| Unchanged STC checker, strict mode | 1054 extracted prose units; 0 mandatory and 0 advisory findings |
| Independent diagram audit | 23 SVGs parse; original node identities and ordered step/source data retained |
| Public staging | 198 files; independent source/receipt byte comparison recorded separately |
| Release refresh | Six defaults still match the latest published stable installation assets |

Commands and exact outputs are retained in adjacent logs. Final staging is
`target/aster-pele-final-20261029`; see `stage-final.json` and
`stage-verification.json`. Earlier failed checks remain available.

## Findings resolved

- Pele 1.10.0 block syntax does not accept `accTitle` and `accDescr`. Block files
  use supported syntax. The shared renderer supplies SVG titles, descriptions
  and stable accessible IDs from authored guide metadata.
- Prose extraction still referenced the retired renderer's `spec` object.
  Updated it to the guide schema and added a real CLI regression case checking
  all 1054 prose units. The STC checker and its rules were not modified.
- The existing browser scenario still selected a SeeCode sequence attribute.
  Updated it to the actual interactive Pele sequence and group role.
- Archived Pele figures retain their original source-authored accessible
  descriptions. Current exports include a native SVG background for README
  readability.
- An upstream footer fast-forward occurred while the initial Python process
  still held the previous homepage checker in memory. Four tests subsequently
  saw the new `terms/` link with that old checker. The failed log is retained;
  reruns use one stable checkout. No checker was relaxed for this migration.

- The first staging command included already-staged deletions, so Git refused
  that path list. A shell error-propagation mistake then committed the prior
  vendor removals alone. The remaining migration is committed immediately
  afterward; acceptance uses the complete migration and its successful Pages
  run, never that intermediate commit.

## Explicitly not claimed

No Rust runtime, model prompt, evaluation, grader, dependency version or homepage
design was changed by this migration. No measured task-quality benefit is
claimed. No native browser screenshot or pixel qualification is claimed:
browser inventory had no enabled surfaces. DOM, SVG, source, static-site and
deployment checks provide the recorded evidence. The local preview service was
not started.
