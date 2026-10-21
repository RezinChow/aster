# Gateway verification — T005/T011

All artifacts referenced here are private files in `/code/Power/.git/optimization-20261021`. No production credentials were read or copied. Tests use synthetic fixture keys; the private proxy uses the fresh `benchmark.key` without recording its contents.

## Source and scope

Root workspace: `/code/aster`, pinned Cargo/Rust 1.97.1. CI reference: `.github/workflows/backend.yml:46-66`, `cargo test --locked -p a3s-gateway`; package default features are empty. Focused tests use `--lib FILTER -- --test-threads=1`, compilation limited to `-j16`.

HEAD is `16469319771867f9dfd46d41534ef00fe2a2addc`. The original five dirty tracked files were captured before verification; the patch stayed byte-identical throughout the initial read-only run (`fb4f7f2ccbe56b4c9f8638357b02bc506b439aef3cf7bdbffadd3580aabeb11c`). The actual initial dirty stash object is `02f45d09c112c4b7a81d2219f4d915a7a22375a1`. Its other four dirty files remain unchanged; listener modifications preserve the existing bounded-body, complete-POST and one-shot-connection work. Untracked pre-close/pre-anonymous backups were retained.

The six owned files are `entrypoint/listener.rs`, `entrypoint/tests.rs`, `entrypoint/listener_cancellation_tests.rs`, `entrypoint/inference_distributed_tests.rs`, `entrypoint/inference_distributed_deadline_tests.rs`, and `entrypoint/protocol/distributed_handler.rs` under `apps/gateway/src`.

The reviewable increment relative to that stash, including both new siblings, is `gateway-cancellation-deadline.patch`, SHA256 `5f0778c82c2886d46541ab366bcc0c0ce18b0e2597ee565f863d426382129dda`. Reverse application check passes. Per-file source hashes and preservation checks are in `gateway-source-provenance.json`. No staging or commits were performed.

## Before and after evidence

| Contract group | Initial dirty source | Final focused result |
| --- | --- | --- |
| Power observation/projection | 2/2 | 2/2 |
| Cloud worker ACL rendering | 1/1 | 1/1 |
| Scheduling unit contracts | 7/7 | 7/7 |
| Inference config contracts | 42/42 | 42/42 |
| Distributed-serving unit contracts | 25/25 | 25/25 |
| Managed scheduling entrypoint | 7 passed, 2 failed | 9/9 |
| Distributed-serving entrypoint | 18 passed, 3 failed | 22/22 |
| Ordinary HTTP entrypoint | later isolated stale rerank expectation | 94/94 |
| Real TCP FIN/RST/POST controls | 1 passed, 3 failed with half_close(true) | 4/4 with false |
| Controlled expired-before-header response | transport reset | explicit 504, 1/1 |

Initial results and isolated managed cancellation repros are preserved in `gateway-verification-results.json`, `gateway-focused-{1..9}.log`. The original two cancellation failures also failed individually. P/D cancel tests now pass individually and in the full focused group. Final commands, counts and raw logs are `gateway-postfix-results.json`, `gateway-postfix-{1..6}.log`. Groups overlap; their counts must not be summed as distinct coverage. The five unit/projection groups were also rerun against the final compiled test executable: `gateway-final-unit-results.json` and `gateway-final-unit-{1..5}.log`.

The TCP control is `gateway-half-close-before.log` versus `gateway-half-close-after.log`. Globally enabling HTTP/1 half-close kept queued/streaming work alive after client EOF. The explicit contract now treats write FIN as cancellation, including after a completed request body. A complete Content-Length POST with `Connection: close` and an open write side receives the delayed full response. Both real FIN and SO_LINGER=0 RST after the first SSE data frame release upstream work and local active accounting. No heuristic production delay was added.

A separate existing 400ms P/D total-timeout test failed before response headers even after the cancellation fix. Its reqwest client does not half-close. A content-free syscall trace showed approximately 531ms before the first usage sync/worker connection; sync itself was under 0.4ms. The request clock precedes cold Argon2 authentication. The active-stream test now verifies the credential first and retains its exact 400ms budget, first-frame/drip assertions, both worker aborts, admission recovery, and failed terminal records.

The distinct cold-auth regression deliberately spends 401ms in response middleware after Power is ready, with the service total still 400ms. It failed with IncompleteMessage before the product fix (`gateway-preheader-before.log`) and returns JSON 504 after it (`gateway-preheader-after.log`). The final strengthened run is `gateway-preheader-exact-once.log`, 1/1; it checks retained_records == 4 as well as both failed terminal kinds and reserved bytes == 0.

The product checks the same absolute total deadline after asynchronous response middleware and before returning the SSE response. It drops the owned upstream body before worker guards/local admission, records the attempt failure, and sends the existing distributed timeout JSON. It does not retry or classify this local response deadline as worker unhealthiness. Stream drop triggers the existing bounded, asynchronous two-worker abort (2s); a returned 504 alone is not proof that GPU execution has already stopped.

The original dirty standard policy already admitted rerank. The stale reserved-path expectation was updated, with malformed rerank still required to return 400 without consuming the ordinary upstream capture.

All six owned files pass rustfmt --check and the stash-relative diff passes git diff --check. Full `cargo fmt --all -- --check` reports only an unowned pre-existing Studio `tenant.rs:379` formatting difference; see `gateway-workspace-format-check.log`. It was not changed.

## Observation and runtime boundaries

`candidate-worker-observation.json` records a content-free GET snapshot from 2026-10-21T00:50:35Z, not a claim about a later Power restart: health/metrics 200, worker schema v1, active_limit 1, active 0, waiting 0, aggregated phase ready, prompt cache false, state transfer false, transfer health unsupported. The observation has its own expiry. num_parallel/flash_attention/num_thread fields are configuration echoes, not evidence of actual external engine slots or capabilities. Local HTTP admission metrics measure Power queue waits; GPU queue delay remains unknown without engine measurements.

Private standalone generic routes are baseline `19880 -> Power19200` and candidate `19881 -> Power19210`; Power-to-engine routing is controlled separately by root. Both proxy policies use request/stream total 135s and idle 30s, with no extra retry/fallback queue, content access logging, or tracing. The proxy forwards the fresh benchmark Authorization header. Generic transport smoke does not exercise managed grants, worker observation projection, scheduling, or P/D execution; the hermetic groups above cover those contracts.

Original runtime provenance and the earlier one-request-per-arm synthetic smoke are in `gateway-private-provenance.json` and `gateway-private-smoke.json`. Baseline copied an existing Gateway binary with SHA256 `e5437e7bda876d4a28f1b8b34287f427762c6414d78ff28fb87e42601d721542`; reproducible source matching is not claimed for that existing binary. Candidate is built independently from the recorded final source; build provenance and private runtime replacement are recorded separately. Production `/opt` and baseline 19880 remain untouched. Root owns the subsequent full engine cancellation E2E and formal matrix; this document does not preclaim their outcome.


At 2026-10-21T01:27:25Z the private candidate 19881 was restarted as PID 3075982 from `gateway-cancel-candidate`, SHA256 `eaf9f4ca8baf38074d1548badebbd3b42bd08ab5174e2f9136101ccbcfb6c1fd`, version `1.1.1 16469319771867f9dfd46d41534ef00fe2a2addc-dirty`. Final release build completed in 164.84s and ACL validation passed. Its hash is identical to the preceding build before the test-only retained-record assertion. Candidate and baseline health both returned 200. Baseline PID 2967433, old binary and production `/opt` SHA remained unchanged. This restart sent zero inference requests. Full runtime details: `gateway-private-final-provenance.json`; build details: `gateway-candidate-build-provenance.json`. Baseline and candidate now intentionally use different Gateway binaries; their proxy policy/timeouts are equal. No throughput comparison should describe them as the same Gateway artifact.
