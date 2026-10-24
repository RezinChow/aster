# H200 native deployment source publication

The user authorized committing, merging and pushing the current H200 work.
The existing source worktree and the dirty main worktree are preserved; integration
uses a separate worktree based on current origin/main. Studio source and unrelated
BGE/ORM changes are excluded from this task commit.

The Power dependency is published at c891f930bcbc06b52175ad4fe0247cc2c1f9b412
on A3S-Lab/Power branch codex/aster-h200-native-20261024. It includes the previously
unpublished parent pin, local workspace dependencies, storage/peer/server hooks,
strict proxy usage handling, and its missing sibling regression file. Its nested
lockfile is removed so the Aster root lockfile is authoritative. CI checks out
both exact Studio and public Power gitlinks before Cargo runs.

Restoration recovered358 missing vendor source/test files from the retained
deployment-recovered-1792764545.tar.gz snapshot, preserving every existing file.
The two maintained YAML dependencies and Power pass package formatting. Exact
`cargo fmt --all -- --check` exceeds Windows process command limits (error206);
its initial failure is retained. Equivalent package checks are used on Windows.

Validation before integration: native CPU447 passed; Power storage/peer/server/
proxy137 passed; native Python20 passed; official Python9 passed/2 skipped;
Linux XQ Python72 passed. Windows XQ discovery is not accepted as Linux proof:
it initially fails POSIX-only imports/permissions, then the same suite passes
on installed WSL Ubuntu. The initial server compile identified a missing
proxy_usage_tests.rs; three meaningful counter-boundary tests are supplied and
the full137-test focused rerun passes. Runtime credentials are excluded.

Final integration checks: `cargo test --locked --offline -p a3s-deepseek
--features server --lib` passed452 tests; `cargo check --locked --offline
-p a3s-deepseek --features server --all-targets` passed. The restored YAML
packages passed919 tests across101 groups. The optional external yaml-test-suite
dataset is absent; it is not counted as executed. Its packaged harness now
declares the missing Saphyr dev dependency and uses this parser's own Marker
and ScanError types. Three focused workspace dependency guards passed.

Exact full workspace formatting was also attempted with pinned Rust1.97.1 on
WSL Ubuntu. Three inherited gateway indentation differences were fixed, with
no semantic gateway changes. The packaged parser harness formatting was then corrected and all four
changed packages pass formatting. The full-workspace check still fails because
the private Studio pin f0bcf13 lacks app_updater/os_feed_tests.rs. The original
failure is retained; full workspace formatting and full CI are not claimed.
The changed source paths pass the staged whitespace check. Unmodified public
YAML fixtures and frozen evidence preserve exact bytes, including intentional
whitespace, using scoped -text attributes; they are not rewritten for lint.

The user subsequently requested1M deployment and replaced the500tok/s goal
with deep correctness and speed optimization of single-H2001M serving. V8 is
now promoted at the existing server-side VIP with context1048576, same key,
exact routing, unchanged qualified binary and no Windows forwarding. A real
131073-token public input completed with answer42,2 output tokens, cold
TTFT163.888s and total163.963s. The earlier V7 run failed DSpark batch-tail
capture on that same exact fixture; V8 uses the upstream-supported
STRATA_SERVE_BATCH_TAIL=0 path. This profile fixes that edge, but the current
short-request trial exposes user-visible waiting:16/16 successful measured
requests, TTFT median4.148s / P959.402s, API wall throughput21.445tok/s and
estimated stream output interval89.677tok/s. These scopes are distinct. Numeric-only engine observations show short-prompt
prefill0.12-0.17s interleaved with real long-session traffic. The measured
4-9s includes queueing and is not an isolated1M profile regression proof.
An uncontended second-GPU baseline is being established.

Explicitly not claimed: completed native Rust GPU inference; isolated GPU
decode speed;300/500tok/s; actual full1M-length or broad quality qualification;
successful WorkBuddy tool/GUI acceptance; low-latency acceptance; full workspace
formatting or CI. Formal serving is on GPU0349, while GPU117a is reserved for
the next TTFT optimization round. Runtime credentials and user state are excluded.
