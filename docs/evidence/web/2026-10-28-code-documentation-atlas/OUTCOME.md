# Architecture atlas, homepage refinement and release-aware downloads

## Result

Local implementation and verification passed. Publication is explicitly
authorized by the active user goal. The deployment and live-site receipt will
be appended after GitHub Pages completes.

## What changed

- Added 10 Core/ACP internal chapters. The site now contains 89 canonical
  documents and 150 routes, including default-version aliases.
- Authored 23 SeeCode drawings in seven forms, with native trace/reveal motion,
  manual stepping, node explanations and conceptual 3D assembly controls.
  Six README vectors use the same specifications.
- Added seven Code Hike source walks with 38 stations. Excerpts come from
  committed source `8729d7c84a2d887c61dc206ba47bf8a63425e768`, retaining original
  characters and GitHub line anchors. Tests independently compare the rendered
  text to the referenced Git blob ranges.
- Explained prompt text and assembly, role overlays, context budgets and the
  required-item exception, fact-driven runs, typed waits, V3 progress, bounded
  continuation, goal judgment, recovery and completion gates.
- Integrated the accepted homepage direction, 3D space refinements, alternating
  exact taglines and Magpie-inspired typography/feedback details. Preserved the
  original section and screenshot structure.
- Generated homepage/download HTML from authored templates and a single release
  snapshot. Defaults select the latest published stable installation asset per
  product/platform. Drafts, prereleases, uploading assets and ACP-only releases
  do not become application defaults. The current desktop-stable ZIP publisher
  is supported. The browser makes no release API request.
- Extended the existing Pages workflow to refresh after release events and
  successful existing desktop/CLI release workflows, always using main source.
  The web CLI copy command explicitly uses the selected CLI version because
  the repository-wide latest release currently points to ACP v9.1.6.

## Verification

| Check | Command or artifact | Result |
| --- | --- | --- |
| Node implementation/DOM suites | `node --test apps/web/tests/{download,canvas,cosmic,home}.test.cjs apps/web/tests/{docs,atlas,releases}.test.mjs` | 90 passed |
| Release selector final focused run | `node --test apps/web/tests/releases.test.mjs` | 5 passed |
| Python site suite | `python -X utf8 -m unittest discover -s apps/web/tests -p 'test_*.py' -v` | 19 passed |
| Deterministic output | `npm --prefix apps/web run check` | 89 documents / 150 routes passed |
| STC prose and README | `docs_prose.mjs`, then unchanged STC 0.2 checker with `--strict` | 1054 extracted prose units; 0 mandatory / 0 advisory findings |
| Release availability | HEAD of all six selected official asset URLs | All HTTP 200 |
| Staging | `stage_site.py target/aster-atlas-release-final-20261028` | 197 public files |
| Read-back | Independent SHA-256 comparison of staged files, receipt and source | All bytes match |
| Provenance | Compare all 183 original SeeCode files to downloaded Git archive | 0 modified upstream files |
| Standards source | Compare A3S-Lab/stc-answer current rules with bundled copy | Exact text match |

See `inventory.json`, `asset-head-checks.json`, `stage-release-verification.json`,
`provenance-check.json` and the retained command logs. Earlier failing logs are
retained rather than replaced by a success claim.

## Review findings and resolutions

- The standalone SeeCode viewer uses inline styles/scripts. The integration
  extracts SVG and style declarations and retains native motion CSS while
  preserving the existing one-local-script delivery and element bans.
- The first tagline markup hid every heading child from the static accessible
  text parser. The visible typing line remains accessible under the stable
  heading label. The product markup was corrected; the checker was preserved.
- An ACP internal link escaped its explicit version into a default alias.
  Corrected it and added a reading-path test across all new internal pages.
- Existing prose described progress as mutation only. Current V3 also evaluates
  original new-information, uncertainty-reduction and accepted-step evidence.
  Updated the explanation from the actual settlement code.
- The initial font-request assertion matched a literal inside unused upstream
  export code. DOM inspection disproved a real font request. The corrected
  test checks actual external resource elements; restrictions were not relaxed.
- Connected rendered diagram nodes to real step explanations and retained
  keyboard controls. Passive source SVG has no dead node tab stops.
- Reused the existing high-contrast palette for Code Hike and checked actual
  generated token colors against both code backgrounds.
- GitHub's global latest is not the latest installer for every product.
  Six typed targets now use numeric version comparison and exact publisher
  artifact contracts. A malformed tag cannot qualify through an absent channel.

- The final generated stylesheet had one surplus EOF blank line. Corrected the
  source concatenation and regenerated; final staging was read back afterward.

## Explicitly not claimed

- No Rust runtime, public SDK API, model prompt, model evaluation or grader was
  changed. No new SDK bindings or package publication job was added.
- No measured model-quality benefit or actual coding-task execution is claimed
  by the illustrative traces.
- Native browser/pixel and real GPU animation qualification is not claimed.
  Browser inventory returned no enabled surfaces; SeeCode doctor found no
  Chrome/Chromium/Edge. DOM, source, geometry validation and static-site checks
  are separate evidence.
- Asset HEAD checks prove availability, not installation or operating-system
  qualification. Platform versions may differ because published assets differ.
- The stopped local preview service was not restarted. Other root-worktree
  changes were preserved; implementation uses an isolated worktree.
