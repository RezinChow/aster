# CLI 0.3.8 / Core+ACP 9.2.6 — release preparation

Date: 2026-11-15 (Asia/Shanghai).  
Product tip: ACP stdio `WouldBlock`/`EAGAIN` retried via `RetryTransient*`
(evidence under `docs/evidence/code/2026-11-15-acp-stdio-egain*` ).

## R0–R3 preparation

| Check | Result |
| --- | --- |
| Prior published window | `aster-cli-v0.3.7` / `aster-acp-v9.2.5` @ `1a8e38d51` |
| Version bump | aster `0.3.8`; core/acp `9.2.6` (+ matching `Cargo.lock`) |
| `RELEASE_9.2.6.md` | written |
| `cargo build --locked -p aster -p aster-acp` | PASS (this prep) |
| `transient_io` | 5 PASS |
| `aster_spawn::transport_tests` | 5 PASS |
| `tests/release_governance.py` | recorded at prep commit |

## R4 land / P0–P5

Filled after push, qualify success, tags, publish, and channel update.

## Explicitly not claimed

- Studio desktop release synced to this tip.
- Clearing every residual duplex/example ClientSide site.
- That installed `0.3.7` clients have already updated.
