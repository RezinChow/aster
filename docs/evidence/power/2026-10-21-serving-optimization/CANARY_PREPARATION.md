# Production canary preparation

The new `canary-scenarios.py` is prepared and hermetically tested. It has **not
been run against production**. It does not start, stop, register, or signal any
service. The three frozen qualification tools and Gateway source were unchanged.

The intended chain is fresh benchmark Gateway `19897` → Power `19507` → existing
GPU7 native `18107`. Actual wrapper identity and provenance receipts are required:

```text
python3 -B canary-scenarios.py --tag <fresh-lowercase-tag> --slots 1|2 \
  --identity <private>/eight-replica/worker-7-identity.json \
  --provenance <private>/eight-replica/worker-7-provenance.json
```

The receipt's three actual PIDs, start times, executable and command hashes, and
listener ownership must match. Native CUDA placement must be exactly `7`, with
one or two actual slots, each context 32768. Admission provenance must declare
`active=slots`, `waiting_limit=8`, `queue_timeout_ms=1000`. The fresh fixture key
is read from the existing private benchmark key file and is never printed.
The proof uses `eight-card-corpus.jsonl` SHA256 `1791c2cc7f6496454c69c903f2c3a82b61240b0e46d6b9b690747a6e7b113256`
and the registered `prism-27b` alias, matching the eight-replica wrapper.

Production native currently has neither `--metrics` nor `--slots`. The helper
returns `unsupported` before reading the key or sending inference if native slot
state or complete metrics are unavailable. Power configuration echo does not
replace this evidence. Enabling native observability or changing production
geometry requires a separate authorized deployment step.

The scenarios fill all actual slots with blockers, cancel a queued request,
verify the entire native slot/task vector survives blocker completion, cancel
before first meaningful output only after observing an actual unfinished native
prefill, cancel after 12 meaningful output deltas, and
fill eight queue entries before requiring HTTP429 with `admission_queue_full`.
Every case requires all Power request gauges and native work to drain, followed
by an expected `OK` recovery response with authoritative usage and matching
native completion delta. Concurrent native work fails the idle/accounting gates.
The execution budget is 160 seconds with bounded cleanup within the 180 second
envelope. GPU memory above 90% or unavailable GPU observations abort only the
helper's own HTTP transports. HTTPResponse parser cleanup stays on its reader.

Local command:

```powershell
& 'C:\Users\admin\AppData\Roaming\uv\python\cpython-3.12.14-windows-x86_64-none\python.exe' -B tests/power_serving_canary.py
```

Result: **8 tests passed in 12.977 seconds**. This includes real loopback HTTP
fixtures for both NP1 and NP2 queued cancellation/overload, pre-first and
midstream recovery, retention of a `Connection: close` response transport during
guard cancellation, missing native observation refusal with zero POSTs, and the
exact wrapper corpus/alias. The pre-first fixture inserts 350ms authentication
before native admission; cancellation follows observed native prefill rather
than a timer expiring during authentication. A per-request socket scope preserves
the frozen parser's original outcome alongside the explicit controlled cancel.
The default `py` Python3.13 installation failed before loading tests because its
`encodings` module is absent; the existing Python3.12 installation was used with
no host configuration change. `git diff --check` passed for the two new files.

Explicitly not claimed: live production qualification, managed Gateway routing
or grant coverage, GPU kernel cancellation acknowledgement, deployment
authorization, or performance improvement from these fixture tests.
