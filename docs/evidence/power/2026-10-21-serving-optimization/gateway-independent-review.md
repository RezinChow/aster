Independent read-only Gateway review

Verdict: PASS; no blocking source finding. The initial non-blocking assertion gap was subsequently fixed and independently verified in the addendum below. Review completed 2026-10-21T01:22:26.936135+00:00.

Scope: six frozen owner files, compared against original dirty snapshot 02f45d09c112c4b7a81d2219f4d915a7a22375a1. Source HEAD 16469319771867f9dfd46d41534ef00fe2a2addc. All six current SHA256 values match gateway-source-provenance.json. No source/config/service edits, inference, GPU operation, builds or test reruns were performed by this reviewer.

HTTP/1 cancellation contract: apps/gateway/src/entrypoint/listener.rs:426 intentionally treats write FIN as cancellation. The four real TCP fixtures cover a complete Content-Length/Connection:close POST receiving its delayed reply without FIN, write-half-close cancelling pending upstream before its 10s deadline, and FIN/RST after first SSE frame closing upstream and releasing the service-active guard. apps/gateway/src/entrypoint/listener_cancellation_tests.rs:54; apps/gateway/src/entrypoint/listener_cancellation_tests.rs:82; apps/gateway/src/entrypoint/listener_cancellation_tests.rs:166; apps/gateway/src/entrypoint/listener_cancellation_tests.rs:170. The raw listener test route is an ordinary proxy; managed P/D cancellation is covered separately by the existing integration tests.

Preheader expiry: apps/gateway/src/entrypoint/protocol/distributed_handler.rs:174 compares the original request-start total budget after response middleware. It drops the owned upstream body, backend connection guards and local inference-admission guard before returning a full JSON 504. It returns directly through finish_error_status; it does not run the execution-error branch, mark workers unhealthy, or dispatch fallback. BackendConnectionGuard::drop only releases accounting/admission. Service/router error metrics for the local 504 remain appropriate.

Cleanup boundary: dropping the body drops the distributed execution stream. Existing ExecutionCleanup::drop schedules both aborts with a shared 2s cleanup deadline (apps/gateway/src/inference/distributed_serving/cleanup.rs:84). Local admission is released before abort acknowledgement; this review does not claim that 504 delivery proves GPU compute already stopped.

Usage lifecycle: explicit finish_attempt(Failed,504) consumes attempt via Option::take (apps/gateway/src/usage/lifecycle.rs:304). Response tracking subsequently closes only the remaining request terminal for status504; finish_background and Drop also consume their Option reservations. No duplicate append path was identified.

Independent deadline cases remain: apps/gateway/src/entrypoint/inference_distributed_tests.rs:2096 warms authentication only for the active-stream 400ms regression, which still requires a first SSE chunk, continuing drips, a body error, worker aborts and admission recovery. apps/gateway/src/entrypoint/inference_distributed_deadline_tests.rs:99 does no auth warmup and uses a controlled401ms response middleware to force preheader exhaustion; it verifies JSON504, both aborts, admission recovery, failed usage terminals and zero reservations.

Rerank test correction: apps/gateway/src/inference/standards.rs already admitted Rerank in the original dirty snapshot; git diff against that snapshot is empty for this policy file. apps/gateway/src/entrypoint/tests.rs:1355 replaces a stale404 expectation with400 for malformed input and retains the captured GET /ordinary assertion proving no ordinary forwarding. This preserves the original dirty intent.

Non-blocking assertion gap: lifecycle_events(spool,4) reads at most4 records (apps/gateway/src/entrypoint/inference_usage_tests.rs:37), so events.len()==4 alone cannot exclude a fifth append. The source Option::take logic is correct, but a future test refinement should drain and assert retained_records==4 or inspect all retained records. The current test provides positive terminal-order evidence rather than an independently complete no-duplicate proof.

Existing evidence read: gateway-half-close-before.log reports1/4 and after reports4/4; gateway-preheader-before.log reports0/1 and after1/1. gateway-postfix-results.json/logs1..6 show three isolated managed P/D regressions each1/1, scheduling9/9, distributed22/22, ordinary entrypoint94/94. These runs were performed by the owner; this independent review inspected their stored results and source rather than rerunning them.

Reviewed source hashes:
- apps/gateway/src/entrypoint/inference_distributed_tests.rs: b5bc6b0b45dc1651f789ca033cb0c19d3ebd42165e3290f8d5301327edbf9cfd
- apps/gateway/src/entrypoint/listener.rs: bbeea9d6e2f5ff87850a25078c15b9331169aa99b28905397387112882a1aaea
- apps/gateway/src/entrypoint/protocol/distributed_handler.rs: 3077f89dcff06eba390b62eca3e596d88d23a736e77bdc8326123bcd68b87c5b
- apps/gateway/src/entrypoint/tests.rs: e02215664f88c6c40641d2ba72b08c7877193d5c5650c5e66b6a6d10f6c7e05c
- apps/gateway/src/entrypoint/listener_cancellation_tests.rs: 5fe312e3527c9ae3506efd1d8368dde5532db2b9fdd840b1efa22f5970a653c8
- apps/gateway/src/entrypoint/inference_distributed_deadline_tests.rs: c4b2a480f5aa0bdf02be2e5ac62a4d3f3eb8041981f94ce34c5bfc9465fa117c

Addendum 2026-10-21T01:34:45.122600+00:00: owner added an explicit retained_records==4 assertion at apps/gateway/src/entrypoint/inference_distributed_deadline_tests.rs:149. Removing precisely that five-line block reproduces the previous frozen file SHA256, and all six sources match updated gateway-source-provenance.json. The previously recorded assertion gap is resolved. This was another read-only source verification; no source edits or test reruns by the reviewer. Updated test source SHA256: 15210dc3350ba7ad8e3c774a06aa2e8e22fd9a5b124ec19c724c362aed7a03c0.
