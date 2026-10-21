Independent read-only review of the Power v4 request compatibility adapter.

Verdict: no confirmed correctness blocker found for the reviewed change. This is
an OpenAI tool-history compatibility fix; it does not establish the cause of the
reported second ordinary Aster message hang.

Runtime sources reviewed directly on the existing host:

- `src/api/types.rs`: SHA256 `841b3ed3f454e609b3d4db6c0e203df43c763bfb052473d7c8fabe2e65359e71`.
- `src/api/types_chat_message_compat.rs`: SHA256 `99921ad4bc606c81d410342b9dec1be16b7b1e375ea34743868b1a8aa6cabea9`.
- Release artifact `candidate-v4-power`: SHA256 `75afe5de8d423547fdb9b9bb302b17ca9e168d6f6fe13a18d29fbce9492bf1c1`.
- Final test source after the file-level test-only annotation: SHA256
  `22b6b8297d9b34306270d7928cb8b186ce7372786067f5c32813fd26458d18dc`.
- Preserved patch `tool-null-v4.patch`: SHA256
  `a62f97631c1ca65c1fa5650fbd782236f1a2b05805117cfddc67fa4c630d9259`.

The request messages field retains `Vec<ChatCompletionMessage>`. The public
message/content Rust field types and backend types remain unchanged. The
request-only `MapAccess` adapter delegates all message fields to the original
typed visitor. It normalizes null content to an empty string, and admits null or
omitted content only for assistant messages with a nonempty list of complete,
typed function calls and nonblank call IDs and function names. String content
continues through the original typed path, including Aster's empty-string
assistant tool messages. The change preserves argument strings exactly.

The adapter forwards duplicate known fields and serde aliases to the original
visitor instead of collapsing whole messages into JSON maps. Existing typed
duplicate rejection therefore remains effective. Content parts pass their
original typed validation before replay. Unknown policy fields remain available
for the existing fail-closed request policy checks. No new response fields,
backend enum variants, detached tasks or credential logging are introduced.

Read the actual `v4-build-result.json` and the focused/full log tails in
`/code/Power/.git/optimization-20261021`: focused 7/7, complete server library
1947/1947, owner format check and release build all exited zero. The added tests
cover null and omitted assistant content over a real loopback HTTP router,
nonassistant rejection, malformed/incomplete calls, duplicate typed fields,
unsupported nested policy preservation, text/parts and empty-string paths. The
review did not run parallel compilation, inference or production mutations.
