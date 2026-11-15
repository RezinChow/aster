# ACP stdio EAGAIN — E2E outcome

Date: 2026-11-15, Asia/Shanghai.  
Contracts: `docs/implementation-prompt-aster-acp-stdio-egain-e2e.md`,
`docs/evidence/code/2026-11-15-acp-stdio-egain/E2E-TEST-PLAN.md`.  
Product fix evidence (separate): `OUTCOME.md` in this directory.

## Environment and identity

| Item | Value |
| --- | --- |
| Host | Darwin arm64 |
| Toolchain | `rustc 1.97.1 (8bab26f4f 2026-07-14)` |
| HEAD | `6a188a746a29f116b93ae32ca29b43b0ee47f872` (dirty: EAGAIN fix + docs) |
| Staged pair BUILD_ID | `aster-cli-pair-v1:eee0f7ca0a45a28865d04a44027c6a911b6c92fc:aarch64-apple-darwin` |
| Versions | `aster 0.3.7` / ACP `9.2.5` |
| agent-desktop | CLI 2.5 / app 1.0.2; accessibility + screen_recording **granted** |
| Companion root | `.runtime/tui-full-e2e/acp-stdio-egain-agent-desktop-20261115/` |

## Verdict

**PASS**

P0 + P1 + P2 + P3 green. P4 SKIP. No product code change required during
this E2E pass (fix already present in the dirty tree).

## Case results

### P0 — baseline

| ID | Result | Evidence |
| --- | --- | --- |
| P0-A | PASS | `…/evidence/p0-git.txt` (includes `transient_io.rs` + wrap paths) |
| P0-B | PASS | `…/evidence/p0-build.log` |
| P0-C | PASS | identical BUILD_ID files |
| P0-D | PASS | `…/evidence/p0-agent-desktop-status.txt` |

### P1 — hermetic

| ID | Result | Count / note |
| --- | --- | --- |
| P1-W | PASS | `transient_io` **5 passed** |
| P1-U | PASS | `fragmented_utf8_session_new_survives_outbound_interleave` **1 passed** |
| P1-T | PASS | `transport_tests` **5 passed** |
| P1-C | PASS | clippy exit 0 (pre-existing warnings only) |

### P2 — process backpressure

| ID | Result | Note |
| --- | --- | --- |
| P2-A | PASS | Slow-read flood: alive after backpressure; round-trip after drain (`drained_lines=311`); no stdio `-32603`/`os error 35` |
| P2-B | PASS | Closed stdout read end → ACP logs `Broken pipe (os error 32)` WARN; **not** absorbed as EAGAIN retry; no `os error 35` |

Driver: `…/drive_stdio_egain.py`. Results: `p2a-result.json`, `p2b-result.json`.

### P3 — agent-desktop GUI

Order executed: E1 → E3 → E2 (E1 re-run after PID-match harness fix).

| ID | Result | Note |
| --- | --- | --- |
| E1 | PASS | SIGSTOP pager parent of live `aster-acp` 5s → ACP stayed alive; no `Agent connection closed`; no fatal EAGAIN log hits |
| E3 | PASS | SIGTERM ACP → history has `Agent connection closed` + log hint |
| E2 | PASS | `/quit` → Saving session / 进程已完成; **no** `Agent connection closed` bail |

Evidence: `e1-result.json`, `e1-hist.txt`, `e3-result.json`, `e3-hist.txt`,
`e2-result.json`, `e2-hist.txt`, screenshots under companion `evidence/`.

### P4 — large-repo live

**SKIP** (default; no authorized inkstone-class live this run).

## Commands (representative)

```text
cargo build --locked -p aster -p aster-acp --bin aster --bin aster-acp
cargo test --locked -p aster-acp-lib --lib transient_io -- --test-threads=1
cargo test --locked -p aster-acp --test acp_conformance_stdio fragmented_utf8_… -- --test-threads=1
cargo test --locked -p aster-pager --lib acp::aster_spawn::transport_tests -- --test-threads=1
cargo clippy --locked -p aster-acp-lib -p aster-acp --bin aster-acp --all-targets --no-deps
python3 .runtime/…/drive_stdio_egain.py p2a p2b
python3 .runtime/…/drive_stdio_egain.py e1
python3 .runtime/…/drive_stdio_egain.py e3
python3 .runtime/…/drive_stdio_egain.py e2
```

## Harness notes (not product FAIL)

1. First E1 attempt matched `aster-acp` as `aster` via naive `pgrep -f …/aster`
   substring; fixed by resolving pager as **parent PID of aster-acp**.
2. P2-B process may remain alive while logging per-message Broken pipe; oracle
   accepts Broken pipe in `ASTER_LOG_DIR` as proof it is not WouldBlock-retried.

## Explicitly not claimed

- Live inkstone / large-workspace session under indexing storm (P4 SKIP).
- Published/install-channel bins (this run used checkout staged debug pair).
- Studio GUI E2E.
- That every duplex unit-test harness site is wrapped (product paths covered
  in product `OUTCOME.md`).
- Commit/push of the dirty EAGAIN fix tree.

## Short report

```text
战役：acp-stdio-egain-e2e
P0：HEAD=6a188a746a29…；BUILD_ID=aster-cli-pair-v1:eee0f7ca0a45a28865d04a44027c6a911b6c92fc:aarch64-apple-darwin
P1：transient_io=5；utf8=1；transport=5；clippy=0
P2：A=PASS B=PASS
P3：E1=PASS E3=PASS E2=PASS
P4：SKIP
判定：PASS
证据：docs/evidence/code/2026-11-15-acp-stdio-egain/E2E-OUTCOME.md
```
