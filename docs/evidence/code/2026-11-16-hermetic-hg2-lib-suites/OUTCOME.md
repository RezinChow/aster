# Hermetic pack + HG2 lib graders

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Hermetic runner includes `hg2_core_discard` / `hg2_acp_token` / `hg2_pager_latency`
lib filters. Pack **23** suites.

## Commands / counts

```text
python3 scripts/verify-hermetic-perf-e2e.py --suite hg2_core_discard --suite hg2_acp_token --suite hg2_pager_latency
# → 3/0
```

## Explicitly not claimed

- HG2 Pass / named YOLO Done.
