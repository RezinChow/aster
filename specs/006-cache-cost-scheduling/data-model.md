# Ephemeral state

PrefixHint: salted scoped checkpoints, bounded scanned bytes, full canonical
input byte count, requested output bound (estimate only).

Performance: execution-signature-bound, expiring EWMA of authoritative token /
byte calibration and prefill/decode milliseconds per token. No prompt text.

Reservation: random request identity, execution signature, estimated work and
start time. Owned by a response lease; removed synchronously on drop.

Completion observation: validated upstream usage/timings and terminal protocol
state. Unknown is absent. No durable schema or new Cloud API.
