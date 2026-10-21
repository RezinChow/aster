# Internal contract

Only 2xx OpenAI chat JSON with a recognized finish reason, or SSE with a
recognized finish followed by DONE and clean EOF, establishes completion.
Errors, malformed/oversized telemetry, cancellation and truncated bodies do not.
The observer forwards bytes unchanged and neither retries nor buffers delivery.

Only upstream `prism_upstream` source `upstream-reported` timings with consistent
nonnegative bounded counts and finite durations train cost estimates. Other
providers retain completion locality and conservative load-based fallback.
No client metadata, byte/frame count or estimated tokens affects billing.
