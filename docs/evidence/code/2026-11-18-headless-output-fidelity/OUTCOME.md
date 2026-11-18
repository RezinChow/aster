# Headless structured-output fidelity

## Result

Headless structured output now fails closed instead of manufacturing a result from an incomplete or schema-invalid answer. The primary model sees the requested schema before it answers, valid answers retain their original nested evidence, and any denied tool prevents structured output.

## Root cause and changes

- `structured_output_from_response` previously sent a completed answer through another model for structured repair. That second model could change verdicts, paths, indentation, and other source evidence. It now accepts only the original answer when it already validates against the requested schema and otherwise returns an error without another model call.
- `stream_turn` previously supplied the schema only after the agent had finished. It now adds the schema and a no-prose/no-fence requirement to the primary prompt.
- `TurnState` now records denied tool names. A turn with a denied tool returns `structuredOutputError` even when its final text is valid JSON.

Regression coverage includes valid direct output, nested evidence with leading indentation, schema-invalid prose, malformed schemas, and a denied `bash` call followed by schema-valid text.

## Verification

Environment: Linux x86_64, Rust 1.97.1, GCC 10, offline Cargo dependencies.

- `cargo test --offline -p aster-acp --lib structured_output -- --nocapture`: **6 passed, 0 failed**.
- `cargo test --offline -p aster-acp --lib`: **532 passed, 2 failed, 10 ignored**. The failures were `plugin_mcp::tests::cancelling_an_actual_native_mcp_call_retires_its_process_and_descendant_writes` and `wiki_search::tests::cold_workspace_wiki_search_reuses_original_index_and_refuses_unowned_or_personal_roots`; each passed when rerun alone, indicating parallel-environment flakiness rather than a failure in this change.
- `cargo clippy --locked --offline -p aster-core --all-targets --no-deps`: passed with existing warnings.
- `cargo clippy --locked --offline -p aster-acp --all-targets --no-deps`: passed with existing warnings.
- `CC=/home/a3s/toolchains/gcc10/root/usr/bin/gcc-10 CXX=/home/a3s/toolchains/gcc10/root/usr/bin/g++-10 PROTOC=/home/a3s/toolchains/protoc/bin/protoc PATH=/home/a3s/toolchains/protoc/bin:$PATH cargo build --locked --offline -p aster -p aster-acp`: both binaries built successfully; `aster --version` reports 0.3.9 and `aster-acp --version` reports 9.2.7.
- `rustfmt --edition 2021 --check` on all changed Rust files and `git diff --check`: passed.
- `cargo fmt --all -- --check`: reports only pre-existing formatting differences in the `apps/studio` submodule; none are in this change.

Real static-analysis smoke tests used the same Kimi model and read-only `ls/read/search` tool boundary. No sample was imported, installed, or executed.

- Initial fail-closed smoke (`kimi-pilot-fix-smoke`): all three tasks ended without a structured verdict instead of producing a false benign result. `gpt-requests` specifically returned `structured output requires a turn without denied tool calls; denied: bash`.
- Schema-forward smoke (`kimi-pilot-fix-smoke-v2`): `certefi` and `smtmlib` completed on the first attempt with `malicious` verdicts and all evidence checks passed (43s and 76s). `gpt-requests` returned a `malicious` candidate but failed exact source-line validation; it did not produce a benign verdict.

## Pull request

- `aster-ai-lab/aster#314`: https://github.com/aster-ai-lab/aster/pull/314

## Explicitly not claimed

- The full 200-sample cohort was not rerun, so this does not establish a new pass rate, detection accuracy, recall, or a general performance improvement.
- Exact source-line mismatch remains a separate model/output-quality issue; this change does not normalize or repair evidence to make it pass.
- Model-written explanations are not independently verified factual claims; this change guarantees only that the structured projection does not add a second model's rewriting.
- The parallel full-library failures are not proven upstream defects; only their isolated reruns are claimed here.
