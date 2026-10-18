# Aster identity and terminal branding

## Result

ACP sessions use the existing role slot to identify the assistant as Aster.
The normal model request still carries the runtime contract and safety boundaries;
explicit host roles can still override the product default. Internal crate and
protocol identifiers remain compatible.

The default day/night palettes use Aster blue and silver from
[the product design](../../../../apps/work/DESIGN.md) and
[logo gradient](../../../../apps/work/logo.svg). Day uses #005ABB; Night uses
the logo's brighter #2789ED for readable text. Status colors remain distinct.
Theme labels are Aster Night/Day, with compatible stored keys and new aliases.

The existing ASCII star silhouette now has a breathing core, a tilted orbital
ring, and a moving comet trail, inspired by [ascii.rest scenes](https://ascii.rest/#scenes).
Both sizes use 96 precomputed geometry frames in an eight-second loop. The
welcome cadence remains capped at 12 frames/second. Rendering uses the current
palette and terminal color quantization. The cache contract checks its byte
budget, finite opacity, ASCII glyphs, visible star silhouette, moving geometry,
and the reserved bounds. No website or renderer dependency is used at runtime.

## Checks

- [Theme regression](themes.log): 166 rendering and 18 theme-command tests pass,
  including brand contrast, day scrollbar visibility and terminal color fallback.
- [Welcome/question components](welcome-and-question.log): 167 pass, including
  full/compact layout, clipping, cached animation, theme labels, choice keys and
  free-text behavior. These run serially because existing theme tests mutate a
  process-global palette; an initial parallel consent-link failure passes solo.
- [Shipped ACP request](identity-wire.log): 1 passes; the actual model HTTP body
  contains Aster's role while preserving runtime and safety instructions.
- [Live provider identity](live-identity.json): a one-sentence identity request
  replies with Aster. Isolated session state is removed; no private ACL or key is
  retained.
- Both product binaries build with the locked Rust 1.97.1 workspace.
- [A3S Test startup](startup-result.json): passes at 120x40, 60x20 and 80x24.
  [Actual terminal recording](startup.vt) and [full-cycle geometry preview](orbit-preview.gif).
- Changed-file formatting and whitespace checks pass.

## Explicitly not claimed

The question-component tests do not qualify OpenUI forms end to end. The separate
`a3s/form/request` to existing question-view adapter is still missing at this
checkpoint. No broad workspace acceptance, Windows/Linux run, shell lifetime
qualification, release or publishing is claimed.
