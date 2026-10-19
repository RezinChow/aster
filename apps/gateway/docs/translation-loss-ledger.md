# Translation loss ledger (PT0)

The frozen conformance corpus for OpenAI ↔ Anthropic chat translation lives
in `tests/fixtures/translation/`; `tests/translation_corpus.rs` locks its
shape. This ledger enumerates every field that cannot survive translation.
An unlisted loss is a contract violation — the translator must refuse or
explicitly drop, never silently mis-carry.

## Preserved in both directions

| OpenAI | Anthropic | Notes |
| --- | --- | --- |
| `messages[]` (user/assistant) | `messages[]` (content blocks) | Text content becomes block arrays. |
| leading `system` message | top-level `system` | Hoist is loss-free. |
| `tools[].function` | `tools[]` | `parameters` ↔ `input_schema`. |
| `tool_calls[]` | assistant `tool_use` blocks | `id` preserved; `arguments` JSON string ↔ `input` object. |
| `role:"tool"` turns | user `tool_result` blocks | `tool_call_id` ↔ `tool_use_id`. |
| `tool_choice:"auto"` | `tool_choice {type:"auto"}` | Named/required variants map to `tool`/`any`. |
| `max_tokens` | `max_tokens` | Required on the Anthropic side; the translator must pick a fail-closed default when absent rather than refuse silently — the default is pinned by the corpus. |
| `temperature`, `top_p` | same | Pass through. |
| `stop[]` | `stop_sequences[]` | Pass through. |
| multimodal content parts | content blocks | Image inputs translate (`image_url.url` base64 ↔ `source` base64); passthrough otherwise. |

## Dropped in the Anthropic direction (no equivalent)

- `logprobs`, `top_logprobs` — OpenAI response-side sampling detail.
- `presence_penalty`, `frequency_penalty` — OpenAI sampling penalties.
- `seed` — OpenAI determinism hint.

## Dropped in the OpenAI direction (no equivalent)

- `thinking` (extended-thinking budget) — OpenAI chat-completions has no
  equivalent surface; never fabricated.

## Refuse, never partially translate

- Unknown message roles, unknown content part types, malformed tool
  arguments (not a JSON object): the translator fails closed with a stable
  error naming the field; it never dispatches a partially translated body.
- Tool round-trips preserve the call id chain; a broken chain
  (`tool_result` without its `tool_use`) refuses.
