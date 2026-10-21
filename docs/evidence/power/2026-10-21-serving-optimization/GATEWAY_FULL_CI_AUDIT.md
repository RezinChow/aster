# Gateway full CI audit

After both rig6 and rig7 formal inference campaigns completed, the existing
Linux CI command from `.github/workflows/backend.yml` was run from `/code/aster`
with pinned Rust1.97.1:

```text
cargo test --locked -p a3s-gateway
```

Only build parallelism was bounded (`CARGO_BUILD_JOBS=16`). No feature or test
thread override was used. All results below remain retained, including failures.

The first run stopped before test execution at the existing example
`apps/gateway/examples/protocol_benchmark_load.rs:138`: tungstenite0.26's
`Message::Binary` requires `Bytes`, while the example passed `Vec<u8>`. The
example was byte-identical to the original dirty stash02f45d09. Its isolated
`cargo check --locked -p a3s-gateway --example protocol_benchmark_load` reproduced
E0308. The authorized one-line `payload.clone().into()` conversion made that
same isolated command pass. No mirror test was added for this conversion.

The unchanged full CI command then executed the library suite:
**2,041 passed, 5 failed, 5 ignored** (2,051 total). Each of the five failures
was independently reproduced with `cargo test --locked -p a3s-gateway --lib
<fully-qualified-name> -- --exact`:

| Test | Observed failure |
|---|---|
| `embedding_and_rerank_suppliers_replace_the_platform_model` | Existing rerank supplier now serves200; old test expects404. |
| `platform_aliases_fail_closed_without_weights_but_proxy_aliases_still_route` | Test assumes no default-home BGE install; this machine serves200 rather than503. Its later rerank404 expectation is also stale. |
| `test_gateway_keeps_serving_when_the_management_plane_cannot_start` | Test attempts default0.0.0.0:80; nonroot server denies the privileged bind. |
| `matches_only_the_closed_endpoint_and_method_set` | Existing dirty admission includes rerank; old unsupported-path list expectsNone. |
| `admission_keeps_only_the_openai_core_and_platform_models` | Existing dirty admission includes rerank; old admitted-standard list omits it. |

No additional runtime or fixture changes were made during this audit. The
library failure stops Cargo before the remaining integration suites, so this
record does **not** claim a green full CI run or unexecuted integration tests.
The six previously verified serving-runtime files and Cargo.lock remained
byte-identical before/after both full CI attempts.

The separate example patch is `gateway-example-ci-compat.patch`, SHA256
`8869c6c24282d8b7da4a59d44535e4615a5d206e9e292cbc43da322b9a48c676`.
Remote example before/after hashes are `10a91d04be9cd99a20c86a5d8145016c1d79fddd8536e4c6837e0ac9846a7a7c`
and `dd9b50d9f3839af40ecd416c0c179d268a231e069fee54d25c2521dedee14ccc`.
The local example was clean before the same one-line edit, with original raw
bytes backed up under `.git/optimization-20261021/gateway-local-sync/`.
Its normalized LF hash exactly matches the remote result; local CRLF bytes are
preserved. Owned example rustfmt and diff whitespace checks passed locally.

This example-only source edit occurred after the serving artifact was built;
it does not change any of the six runtime files or require a serving binary
rebuild. Source checkout changes are not running binary updates.

`gateway-ci-evidence.tar.gz` retains17 logs/results/baseline/patch files. SHA256:
`3f15cd824d773312996dd82e9477ad553239214f42817e97c798d6944a8c3b52`.
