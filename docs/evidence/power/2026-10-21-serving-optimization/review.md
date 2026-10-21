# Independent serving qualification and API review

Date: 2026-10-21. Private engineering evidence; not a product configuration file.

## Result

The corrected harness is ready for formal literal-IP synthetic paired campaigns. Independently reran its latest 14 tests: all passed in 1.358 seconds. The API/admission review found no demonstrated normal-Prism-path ownership/permit blocker. This is not GPU cancellation, performance or deployment evidence.

## Confirmed findings and disposition

- Absolute timeout: independent 30 ms loopback test took 297 ms with one byte per 6 ms. Root fixed absolute shutdown watchdog, detached socket and TLS handshake; slow headers/SSE/JSON tests now pass.
- Output quality: empty/unknown-finish response could produce successful token throughput. Root added closed finish validation, nonempty checks and expected text/tool predicates. Formal correctness cases must specify expect.
- Concurrency proof: serial code could previously pass. Root added a barrier and maximum exactly 2; passed.
- Confounds: root now matches optional warmup/template/speculation/NUMA provenance. Broad runtime_flags factor requires a retained narrow manual flag diff.
- Metrics: wire/upstream disagreement and uncertified nested rates are now visible/refused by the tested harness. Nonstream completion timing is explicitly buffered-completion and TTFT/first-tool/interval are null; exploratory cold/warm files predating that fix have invalid TTFT columns.
- Finish protocol: reported acceptance of arbitrary nonempty provider finish reasons. Provider owner reports its closed-set fix and 29 tests passed; this reviewer did not rerun that suite.
- Audit privacy: raw error strings bypassed privacy in Resources::audit_failure and streaming failure branch. Pre-fix new regression FAILED because AUDIT_PROMPT_SECRET appeared in serialized audit. Fixed centrally by existing sanitize_error then sanitize_log, and streaming reuses that method. No new content/intent matcher or blanket reason suppression.

## Audit verification

Only source edits owned by this reviewer: src/api/openai/chat_runtime.rs and src/api/openai/chat_runtime_tests.rs. Added three tests covering sensitive prefix and JSON markers, both buffered/SSE failures and responses, preserved ordinary 503 host reasons and unchanged success audit status/model/token accounting.

Pre-fix command: CARGO_BUILD_JOBS=16 /home/user/.cargo/bin/cargo test --locked --no-default-features --features server --lib failure_audit_applies_error_and_log_privacy_without_hiding_benign_reasons
Result: 1 failed, 0 passed, confirming actual sensitive marker retention.

Corrected command: CARGO_BUILD_JOBS=16 /home/user/.cargo/bin/cargo test --locked --no-default-features --features server --lib api::openai::chat
Result: 78 passed, 0 failed, 1862 filtered; compilation 12.13 seconds, test execution 0.11 seconds. Existing unused imports in src/backend/llamacpp.rs left unchanged.

Whole-workspace cargo fmt --all -- --check reported unrelated existing src/bin/a3s-power-cuda-fusion-bench.rs:40 vec! formatting. Did not edit that file. Owned-path check results and exact source SHA256 follow.

## Adversarial hypotheses not confirmed

OwnedSource drops source HTTP/future before permit-owned cleanup. Resources keeps capacity through bounded two-second cleanup; existing drop-order/cleanup-once tests passed. Admission rechecks cancellation/deadline before immediate admission and after semaphore wake, with RAII waiting slots; no confirmed new race was found.

Power intentionally excludes tool identity-only deltas from internal TTFT; harness observes first tool name/arguments. Keep internal and wire observations labelled and compare like for like.

## Explicitly not claimed

No inference/model process/profiling sample/service restart/deployment was performed by this review. Actual GPU termination/overload/memory and rollout require root-controlled campaigns. Existing PrivacyProvider recognizes its declared sensitive prefixes/JSON keys; this change does not claim arbitrary unmarked secrets are semantically detected. Existing dirty work preserved; no branch/staging/commit. Capability inventory remains in capability-probes.json and is not a performance result.

## Exact owned checks and source identities

```json
{
  "checks": [
    {
      "command": [
        "/home/user/.cargo/bin/rustfmt",
        "--edition",
        "2021",
        "--check",
        "src/api/openai/chat_runtime.rs",
        "src/api/openai/chat_runtime_tests.rs"
      ],
      "exit_code": 0,
      "stdout": ""
    },
    {
      "command": [
        "git",
        "--no-pager",
        "diff",
        "--check",
        "--",
        "src/api/openai/chat_runtime.rs",
        "src/api/openai/chat_runtime_tests.rs"
      ],
      "exit_code": 0,
      "stdout": ""
    }
  ],
  "source_sha256": {
    "src/api/openai/chat_runtime.rs": "28e2e5ea0de5241b1a80c2f9833e3ff223796266221479fb3786c8b04ea8040a",
    "src/api/openai/chat_runtime_tests.rs": "50f24af64334dc012e1bba8320442eac04c3c820624c08f733673b2d1bf0ea94"
  }
}
```
