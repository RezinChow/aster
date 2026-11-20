# T2026-11-17-l3-bare-skills-gate

Updated: 2026-11-17 · ≠产品 Pass · L3≠Pass

## Slice

`verify-ai-eng.py` L3 skill-name gate updated: reject legacy `k-*` dirs; require 12 bare canonical conductor skills (`init`…`yolo`).

## Commands

```bash
python3 .kstudio/workflow/verify-ai-eng.py --level L3
```

## Counts

| Check | Result |
| --- | --- |
| Before | **FAIL (L3)** 12× “must use k- prefix” |
| After | **PASS (L3)** `aster HEAD=bootstrap` |

## Explicitly not claimed

- Product / Meta Harness Pass
- HG6 closed
- Headed / Studio H2
