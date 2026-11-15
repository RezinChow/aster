# ACP stdio EAGAIN residual — E2E outcome

Date: 2026-11-15, Asia/Shanghai.  
Contracts: `docs/implementation-prompt-aster-acp-stdio-egain-residual-e2e.md`,
`docs/evidence/code/2026-11-15-acp-stdio-egain-residual/E2E-TEST-PLAN.md`.  
Prerequisite main campaign: `../2026-11-15-acp-stdio-egain/E2E-OUTCOME.md` (PASS).

## Environment and identity

| Item | Value |
| --- | --- |
| Host | Darwin arm64 |
| Toolchain | `rustc 1.97.1 (8bab26f4f 2026-07-14)` |
| HEAD | `6a188a746a29f116b93ae32ca29b43b0ee47f872` (dirty: EAGAIN fix + residual evidence) |
| Staged pair BUILD_ID | `aster-cli-pair-v1:eee0f7ca0a45a28865d04a44027c6a911b6c92fc:aarch64-apple-darwin` (aster == aster-acp) |
| agent-desktop | CLI 2.5 / app 1.0.2; accessibility + screen_recording **granted** |
| Companion root | `.runtime/tui-full-e2e/acp-stdio-egain-residual-20261115/` |

## Verdict

**PASS**

R0 + R1-W + R2-A/B + R3-P2A + R3-E3 green. R1-C SKIP (no new shared-client wiring this round). R4 SKIP (default).  
No product FAIL this residual pass; no additional product code change required during execution.

## Case results

### R0 — static product invariant

| ID | Result | Note |
| --- | --- | --- |
| R0-A | PASS | `prod_ok=8` `prod_miss=0` — all product `*SideConnection::new` sites carry `RetryTransient*` |
| R0-B | PASS (inventory) | `residual_miss=29` listed under tests/examples; not required to clear this round |

Evidence: `…/evidence/r0-product-sites.txt`, `r0-residual-sites.txt`, `r0-summary.txt`.

### R1 — hermetic

| ID | Result | Note |
| --- | --- | --- |
| R1-W | PASS | `cargo test -p aster-acp-lib --lib transient_io` → **5 passed** |
| R1-C | SKIP | No shared-client helper change this round (`aster-test-support` already OK in R0-A) |

Evidence: `…/evidence/r1-transient_io.log`.

### R2 — client real-pipe backpressure

Driver: `…/drive_residual_r2.py`.

| ID | Result | Note |
| --- | --- | --- |
| R2-A | PASS | SIGSTOP agent → client nonblocking stdin writes saw `partial_would_block`; no fatal EAGAIN in agent logs; after SIGCONT round-trip `id=999` succeeded; process alive |
| R2-B | PASS | Kill agent → subsequent client write surfaced `BrokenPipeError`; no `os error 35` / `aster_acp::stdio` EAGAIN misclassification |

Evidence: `r2a-result.json`, `r2b-result.json`, `r2-summary.json`, `r2-drive.log`.

### R3 — thin regression (main nuclear)

Driver: `…/drive_stdio_egain.py` against residual staged bins.

| ID | Result | Note |
| --- | --- | --- |
| R3-P2A | PASS | Slow-read flood: alive after backpressure; `drained_lines=311`; round-trip after; no fatal EAGAIN |
| R3-E3 | PASS | SIGTERM live `aster-acp` → Terminal history has `Agent connection closed` + ACP log path / `session_end.worker_join` |

Evidence: `p2a-result.json`, `r3-p2a.log`, `e3-result.json`, `e3-hist.txt`, `e3-screenshot.png`, `r3-e3.log`, `r3-agent-desktop-status.txt`.

### R4 — deepen

**SKIP** (default; not named this run).

## Commands (representative)

```text
# R0 (product site audit) — already on disk as r0-*.txt
# R1
cargo test --locked -p aster-acp-lib --lib transient_io -- --test-threads=1
# staged pair under companion bins/ (BUILD_ID match)
# R2
PYTHONUNBUFFERED=1 python3 .runtime/tui-full-e2e/acp-stdio-egain-residual-20261115/drive_residual_r2.py
# R3
PYTHONUNBUFFERED=1 python3 .runtime/tui-full-e2e/acp-stdio-egain-residual-20261115/drive_stdio_egain.py p2a
PYTHONUNBUFFERED=1 python3 .runtime/tui-full-e2e/acp-stdio-egain-residual-20261115/drive_stdio_egain.py e3
```

## Short report

```text
战役：acp-stdio-egain-residual-e2e
R0：product=8/0 residual_listed=29
R1：transient_io=5 PASS client_helper=SKIP
R2：A=PASS B=PASS
R3：P2A=PASS E3=PASS
R4：SKIP
判定：PASS
证据：docs/evidence/code/2026-11-15-acp-stdio-egain-residual/E2E-OUTCOME.md
```

## Explicitly not claimed

- Re-running main-campaign E1 / E2 / P2-B / P4 inkstone live.
- Clearing all 29 residual test/example duplex sites.
- Studio GUI E2E.
- Commit or push of product / evidence changes.
- That macOS pipe always returns EAGAIN under SIGSTOP (client observed WouldBlock; pass does not require every write to WouldBlock).
