# WorkBuddy compatibility on the GPU deployment

Follow-up: the short protocol checks below did not cover the real WorkBuddy
long-context failure reported afterward. Native slots still had a 32768-token
bound at this point. The capacity correction and live 55K/120K acceptance are
recorded in [WorkBuddy long-context correction](../2026-10-21-workbuddy-long-context/OUTCOME.md).

A later v5.8.3 client report exposed additional replayed message metadata. The
[replay metadata correction](../2026-10-21-workbuddy-replay-metadata/OUTCOME.md)
records both newly reproduced 400 errors, the final twelve-field adapter, and
the exact replacement binary. This page remains the initial three-field record.

The eight `a3s-power@0` through `a3s-power@7` services on the GPU server now run
the WorkBuddy compatibility release. Authenticated synthetic WorkBuddy protocol
checks pass through both the private and public production Gateway endpoints.

## Deployed change

- Existing Power source: `/code/Power`, commit
  `6f259bde19e056d7ede14f2d4833a3d5c6e16935`.
- Release SHA-256:
  `7fd9ef1c0752c748790669bec2d7a51b4187887dd9d45128096b87293523cf6e`.
- Installed path:
  `/opt/a3s/releases/7fd9ef1c0752c748790669bec2d7a51b4187887dd9d45128096b87293523cf6e/a3s-power`.
- Request-message annotations `agent`, `conversationRequestId`, and
  `startsNewUserRequest` are consumed as opaque client metadata. They do not
  affect prompts, routing, policy, responses, or receipts. Other unsupported
  fields remain refused. The source and hermetic tests are preserved in
  [power-workbuddy.patch](power-workbuddy.patch).
- [deploy.py](deploy.py) changed one wrapper service at a time, verified the
  running executable digest, and exercised the authenticated production Gateway.
  [deployment-attempt2.json](deployment-attempt2.json) records all eight upgrades
  and unchanged native inference process IDs. Its Gateway probes are load
  balanced; they do not claim to pin each request to a particular member.
- The persistent systemd drop-in is `91-workbuddy-compat-20261021.conf`. The
  previous release remains installed for rollback. No ACL, authentication key,
  model weight, or native model service was changed by this rollout.

## Verification

Commands on the existing Power checkout:

```sh
cargo fmt --all -- --check
rustfmt --check --edition 2021 src/api/types.rs src/api/types_chat_message_compat.rs src/api/types_workbuddy_tests.rs
cargo test --locked --no-default-features --features server --lib
```

The three compatibility source files pass formatting. The full formatting command
finds an existing layout difference in the unchanged
`src/bin/a3s-power-cuda-fusion-bench.rs`; it is not reported as passing and that
unrelated benchmark was not edited. The complete library suite was rerun against
the clean deployed source: **1953 passed, 0 failed** in
[library-tests-reverified.log](library-tests-reverified.log). It includes six
WorkBuddy tests covering annotation isolation, standard message and tool history
preservation, null content validation, duplicate keys, and real HTTP/SSE with a
hermetic backend. [release-build.log](release-build.log) is the original build
record for the deployed binary.

Commands from this evidence directory, using [qualify.py](qualify.py):

```sh
python qualify.py --output private-qualified.json --platform --ocr-image ocr-synthetic.png
python qualify.py --output public-qualified.json --public
```

| Evidence | Result | Scope |
| --- | --- | --- |
| [private-qualified.json](private-qualified.json) | 18/18 passed | Private Gateway; WorkBuddy protocol and platform regression checks |
| [public-qualified.json](public-qualified.json) | 13/13 passed | Public Gateway; WorkBuddy protocol and authentication/validation checks |
| [deployment-audit.json](deployment-audit.json) | 8/8 instances passed | Exact process executable SHA-256; active and enabled services; health; unauthenticated refusal; unchanged native inference PIDs |

Both Gateway runs include annotated first and second turns, text SSE ending in
`[DONE]`, `auto` routing, a real `bench_sum(19, 23)` call and its `42` result,
streaming tool-call reconstruction, and streaming continuations replaying
assistant tool calls with either null or omitted `content`. They check complete
tool arguments and call IDs, terminal finish reasons, and final answer text.
Unknown message fields and top-level annotations still return 400; missing
credentials return 401. Private regression checks also verify the model catalog,
1024-dimensional BGE embeddings, reranking, Apofasi, and OCR.

[audit_deployment.py](audit_deployment.py) performs the read-only final server
audit. Credentials are read only into process memory and are absent from these
artifacts. Evidence files and scripts in the Aster worktree have not been
committed or pushed by this continuation.

## Failed attempts and corrected assumptions

- The original rollout failed on an unauthenticated direct-instance probe with
  HTTP 401 and automatically rolled back. The successful rollout uses the
  production Gateway credential and its normal upstream authentication path;
  authentication itself was not relaxed.
- [private-before.json](private-before.json) and
  [private-initial.json](private-initial.json) preserve the original 400 schema
  refusal and the check after the first rollback.
- [private-after.json](private-after.json) and
  [public-after.json](public-after.json) preserve the first successful deployment
  acceptance runs before additional streaming and refusal checks were added.
- [private-final.json](private-final.json) and
  [public-final.json](public-final.json) preserve an intentionally stricter
  adversarial pass with one incorrect expectation: a duplicate annotation in
  raw JSON was expected to yield 400 through Gateway. Gateway first parses a
  `serde_json::Value` and serializes its routed document, coalescing duplicate
  keys before Power sees them (`apps/gateway/src/inference/openai_request.rs`,
  `collect_json_body` and `routed_body`). This is existing Gateway behavior,
  including its existing duplicate-model test, rather than a change introduced
  by this compatibility patch. Direct Power parsing still rejects duplicate
  annotations in its hermetic tests. The final Gateway qualification instead
  checks that coalesced opaque annotations cannot alter the requested answer;
  it does not claim duplicate rejection at that earlier boundary. The original
  failed expectation is retained rather than overwritten.

## Explicitly not claimed

- No WorkBuddy GUI or private user conversation was replayed. The proof is
  synthetic protocol traffic matching the three extension fields observed in
  the reported failure, including actual model inference and tool round trips.
- No arbitrary WorkBuddy extension, every client version, load benchmark, or
  future model quality guarantee is claimed.
- Gateway-wide duplicate JSON key rejection and repository-wide formatting
  cleanliness are not claimed. Neither is required for these three opaque
  message annotations to work through the deployed inference endpoint.
