# WorkBuddy replay metadata compatibility

The reported WorkBuddy v5.8.3 history replay failures have been reproduced with
synthetic `messages[2]` requests and corrected in the deployed Power parser.
The final release accepts the twelve message metadata keys observed in the
reported errors, while preserving the actual model route, tool arguments,
server-reported usage, and unknown-field refusals.

## Observed failures and retained iterations

1. [before.json](before.json) reproduces the screenshot's exact unsupported-field
   list at `messages[2]`: `messageId`, `model`, `requestModelId`,
   `requestModelName`, `stepSeq`, and `traceId`. The existing three-field adapter
   refused these six message-level fields before inference.
2. The initial expansion to nine keys passed [public.json](public.json) (14
   checks), [private.json](private.json) (19 checks), and
   [public-long-tools.json](public-long-tools.json). These were insufficient to
   establish the actual client's full replay shape: the user then reported
   `argumentsDisplayText`, `rawUsage`, and `usage` at the same message index.
3. [before-usage-fields.json](before-usage-fields.json) independently reproduces
   that second error against the nine-field release. The final correction,
   build, deployment and qualification records live under `usage-round/`.

Neither failure has been replaced by a passing artifact. The reported client
request IDs and real conversation contents were not replayed or persisted.

## Final behavior and source

The request-only message adapter consumes these exact client metadata keys:

```text
agent, conversationRequestId, startsNewUserRequest,
messageId, model, requestModelId, requestModelName, stepSeq, traceId,
argumentsDisplayText, rawUsage, usage
```

The `model` inside a replayed message cannot replace the top-level typed `model`
route. `argumentsDisplayText` cannot replace `tool_calls[].function.arguments`.
Historical `rawUsage` and `usage` are discarded, rather than trusted as inference
usage. Metadata values do not enter backend messages, outputs, or receipts.
Standalone public Rust message types remain strict. Unknown message fields,
annotations in content parts, unsupported root fields, and invalid null tool
histories remain refused. Duplicate annotation tracking was widened from eight
to sixteen bits so all twelve keys retain direct-parser duplicate checks.

The final [source patch](usage-round/source.patch), including the source, tests,
and compatibility documentation, is based on the existing Power commit
`6f259bde19e056d7ede14f2d4833a3d5c6e16935`:

- Patch SHA-256:
  `8866fd307211e37fea1b3a8d47b15eb8621e935d5772e089d49d03eb2c5732d7`.
- Power binary SHA-256:
  `231f7db4041a74dedda22935cff7f94149b7b0102c3199a451ff42619e11020c`.
- Installed binary:
  `/opt/a3s/releases/231f7db4041a74dedda22935cff7f94149b7b0102c3199a451ff42619e11020c/a3s-power`.

The source remains uncommitted in the existing `/code/Power` checkout; its exact
diff is bound to the deployment by SHA-256. No repository or sibling checkout
was created. No commit or push was performed by this continuation.

## Tests and deployment

The final focused suite exercises all twelve keys individually over six JSON
value shapes, together across user/assistant/tool histories, as duplicates,
and in unsupported scopes. It proves that the top-level model stays typed and
the real tool arguments remain intact. Its real HTTP and SSE tests also reject
the injected `CLIENT_DISPLAY_OVERRIDE` text and forged `999999` usage counts
from responses, while requiring actual response usage fields.

```sh
rustfmt --check --edition 2021 src/api/types.rs src/api/types_chat_message_compat.rs src/api/types_workbuddy_tests.rs
cargo test --locked --no-default-features --features server --lib workbuddy_compat_tests
cargo test --locked --no-default-features --features server --lib
cargo build --release --locked --no-default-features --features server --bin a3s-power
git diff --check
```

- [Focused tests](usage-round/focused-tests.log): 6 passed, 0 failed.
- [Complete library tests](usage-round/library-tests.log): 1953 passed, 0 failed.
- [Release build](usage-round/release-build.log): succeeded.
- The changed Rust files pass formatting. The full formatting check retains the
  existing unrelated benchmark difference in [full-format.log](full-format.log);
  repository-wide formatting is not reported as passing.

[usage-round/deploy.py](usage-round/deploy.py) installs the exact tested binary
one Power service at a time using `94-workbuddy-replay-usage-20261021.conf`, with
automatic rollback of its own override on failure. The preceding nine-field
release and 93-series overrides remain available for rollback. Its before/after
native process IDs are identical in [the deployment record](usage-round/deployment.json).
The [server audit](usage-round/deployment-audit.json) verifies all eight running
Power executable hashes, native executable hashes, enabled/active services, and
two native slots with 131072 context tokens each. Gateway probes are load
balanced and do not claim to target a particular member.

## Live qualification

[usage-round/metadata_fixture.py](usage-round/metadata_fixture.py) contains all
twelve observed names, synthetic identifiers, a message-level model label that
is deliberately not a deployed route, incorrect display arguments, and fake
client usage counts of 999999. The fixtures do not contain user state.

| Final evidence | Result |
| --- | --- |
| [usage-round/public.json](usage-round/public.json) | 15/15 pass through the public production endpoint |
| [usage-round/private.json](usage-round/private.json) | 20/20 pass through the private production endpoint, including platform interface regressions |
| [usage-round/public-long-tools.json](usage-round/public-long-tools.json) | Public streaming tool call and result replay pass with 55430 and 55237 prompt tokens |

The suites use all twelve metadata fields during first/second turns, text SSE,
tool calls, streamed tool calls, and null/omitted assistant tool content. They
also separately exercise `messages[2]` with all twelve fields. The usage
isolation check returns the actual 44 prompt tokens and 2 completion tokens,
total 46, rather than the client's forged values, and still reports `prism-27b`
despite the different message-level model label. Unknown policy fields still
yield 400 and missing credentials still yield 401.

The long production test reconstructs `bench_sum(19,23)` from SSE deltas and
replays its real call ID with the result `42`. It verifies complete streams,
finish reasons, correct arguments and answer, no stream errors, and actual
reported prompt usage above 55K. No history truncation was introduced.

Representative commands from the Aster worktree:

```sh
python docs/evidence/power/2026-10-21-workbuddy-replay-metadata/usage-round/qualify_replay.py --public --output PUBLIC_EVIDENCE.json
python docs/evidence/power/2026-10-21-workbuddy-replay-metadata/usage-round/qualify_replay.py --platform --ocr-image docs/evidence/power/2026-10-21-workbuddy-compatibility/ocr-synthetic.png --output PRIVATE_EVIDENCE.json
python docs/evidence/power/2026-10-21-workbuddy-replay-metadata/usage-round/qualify_long_replay.py --public --tokens 55000 --repeat 5005 --exercise-tools --output LONG_EVIDENCE.json
```

## Client version scope

The user identified the client as WorkBuddy v5.8.3. The
[official changelog](https://www.workbuddy.cn/docs/workbuddy/Changelog) and
[official archive](https://www.codebuddy.cn/docs/workbuddy/Download-History)
identify that release. Public product documentation does not itself establish
the complete outgoing message schema. Field admission here is based on the
explicit reported error names, with strict boundary tests; it is not inferred
from User-Agent, capitalization, or a name pattern.

The user retried the original conversation in v5.8.3 and explicitly confirmed
“已正常回复”; see [client-confirmation.json](usage-round/client-confirmation.json).
This real-client confirmation is separate from the synthetic protocol suites.
The official archived installer was downloaded and inspected without launching
it: version `5.8.3.41334564`, 441343160 bytes, SHA-256
`9e1d07be0c0dbf4d789cd3e5bed739b719111b8b2e1261df72d9dbe4924d758d`.
Its bundled CLI contains the reported annotation names; this observation alone
does not establish every possible outgoing message shape.

## Explicitly not claimed

- No private WorkBuddy conversation or GUI action was replayed. The live proof
  uses synthetic messages matching the reported failures and actual inference.
- Twelve observed fields are not an assertion that every optional field in every
  WorkBuddy build is supported. Unrecognized fields remain refused rather than
  silently interpreted. A complete version-specific client schema requires
  stronger source evidence than the product documentation alone.
- Historical usage metadata is not billing authority. This work checks actual
  inference usage responses; it does not assert a separate billing database audit.
- No new GPU model, model weight, native runtime, context bound, ACL, key, firewall
  rule, or unrelated formatting change was deployed in this correction.
