# Public gateway resets and apparent second-turn stalls

## Result

Two separate mechanisms are now reproduced. The public HTTP path resets some
ordinary tool-enabled uploads before Gateway can finish reading the request.
The same second-turn body succeeds through the internal address. Independently,
the current Windows ACP treats a localized connection-reset error as retryable
and backs off without completing the turn within a 40-second observation.
Neither finding is a GPU generation deadlock. The public route remains broken.

The user also reports a failure from another caller without a VPN. Disabling a
VPN is therefore not an established complete repair. Selecting the Windows
physical interface does not disable all host interception; it is a controlled
route comparison, not a claim that every VPN component was absent.

## Same-body transport controls

The fresh ACP session is captured against a loopback mock using only the
retained synthetic continuity prompts. It presents 25 ordinary tool schemas.
The mock's successful dialogue is request acquisition, not model acceptance.
Full bodies and authorization values remain in memory only. The current ACP
binary SHA256 is `f9b5028b84373eb0e8fcac7949cd7036b850bab69b56c2ca88e50f0ff0a5c071`.

The [framing receipt](../2026-10-21-client-stall/transport-framing1.json) records:

| Request | Route/framing | Result |
| --- | --- | --- |
| First ordinary request, 60,378 bytes | Public, Content-Length | Reset in 78 ms |
| Second ordinary request, 60,549 bytes | Public, Content-Length | Reset in 109 ms |
| Same second body, identical SHA256 | Public, real 1,024-byte HTTP chunks | Reset in 78 ms |
| Same second body, identical SHA256 | Internal 172.18.101.2:8080 | HTTP 200; headers in 750 ms, complete SSE including `[DONE]` in 7.719 s |

Gateway journal metadata at 06:58:22 UTC confirms the two Content-Length values
and, for the third request, actual `Transfer-Encoding: chunked` with no
Content-Length. This supersedes the earlier header-only experiment as a real
framing test; chunking still does not repair this path.

A [second capture-period probe](../2026-10-21-client-stall/tcp-probe2.json)
again resets the ordinary 60,549-byte second-turn body in 94 ms. A 131-byte
synthetic control on the same public endpoint completes HTTP 200 and `[DONE]`
in 1.609 s. Earlier valid JSON whitespace controls of up to 131,204 bytes also
passed. Size alone, TCP reuse and the second-turn number are not sufficient
explanations: these probes open fresh TCP connections, and the first ordinary
tool upload can fail too. No specific JSON field or phrase is established as
the trigger.

## Reset direction and packet evidence

The [GPU header capture](../2026-10-21-client-stall/tcp-headers2-safe.json)
uses a 54-byte snapshot, parses only Ethernet(14)+IPv4(20)+TCP(20) layouts and
persists only selected header fields with hashed peer addresses. It closes
after 35 seconds and reports zero kernel drops. The initial instrumentation's
`application_bytes_read=false` label was too strong: truncation precedes the
userspace filter, so other protocols' prefixes can briefly enter memory. The
safe export explicitly corrects that label; no raw prefix or application bytes
were persisted. The private original receipt and its hash remain retained.
The server clock and the old client observations
are not assumed to be aligned to the original user's 13:56 report.

In the failing flow observed during the synthetic probe, ordinary incoming
packets have TTL 179. Fifteen incoming RST packets instead have TTL 127 and IP
IDs 28752/28753. No outgoing RST is captured for that flow. The adjacent small
control flow has normal traffic at TTL 179 and no captured reset. The
[summary](../2026-10-21-client-stall/tcp-headers2-summary.json) retains these
counts, including unrelated flows separately. TCP offload can coalesce packet
metadata; those records are not a reconstruction of physical segment sizes.

Together with the incomplete-body journal and the private-path success, these
facts support intermediary reset generation or interception. They do not
identify a particular router, security product, ISP, or end-user process. The
Windows NIC-only PktMon attempt formatted zero packets and is inconclusive;
it cannot establish absence of client-generated resets. Its capture was stopped
and its only owned filter removed after checking ownership. No firewall rule,
route, system clock, production listener or inference binary was changed.

Read-only checks found the GPU default next hop 172.18.101.1. Its root HTTP/HTTPS
management pages were not reachable. That next hop is not automatically the
device implementing the public forwarding rule. Existing public HTTPS on 443
is a different website and has not been repointed.

## Why a failed second turn can appear stuck

The [actual ACP fault fixture](../2026-10-21-client-stall/second-turn-faults1.json)
uses a fresh ordinary session and a loopback-only mock with no real credential.
A healthy two-turn mock completes both turns. In the reset condition, the first
turn completes normally; resetting requests belonging to the second turn leads
to six repeated preliminary HTTP calls over 40 seconds and no terminal ACP
response before the independent driver's deadline. The child is reaped. This
is observed backoff, not a demonstrated infinite mutex deadlock.

The [warning trace](../2026-10-21-client-stall/second-reset-trace2.json)
independently reproduces the reset with a five-second deadline. Reqwest's final
source is the localized Windows message ending in OS error 10054. The provider
then logs synthetic 503 retries, with a budget of 11 attempts. The source
policy in `crates/code/core/src/llm/http.rs` recognized English reset/refusal
text after flattening the error chain, losing the locale-independent IO kind.

The EOF fixture is narrower: it produces both an invalid preliminary JSON
response and prematurely ended tool streams, then an ACP error in under one
second. It does not prove that every streaming failure or an actual Work GUI
recovers promptly. `stream ended before a response` can arise when the fact
model actor receives EOF without its terminal response; it is not proof that
the GPU never started or that every such error has the same network cause.

## Client correction and verification

The HTTP error renderer now examines typed `std::io::ErrorKind` values while
the original source chain is available. Existing hard-failure categories get a
stable label before conversion to the public String diagnostic. Public Rust
enum fields and APIs are preserved. Localized reset/refusal and unreachable
errors follow the existing hard-failure policy; timeout and unexpected EOF
retain the existing retry policy. This improves error termination; it cannot
prevent a device on the public path from sending resets.

[Focused validation](client-policy-tests.json) passes all 3 new cases and all
24 HTTP module cases, including a real loopback TCP reset through Reqwest.
The owning two Rust files pass rustfmt and whitespace checks. The initial
`--locked` command refuses an existing Studio contract manifest/lock mismatch;
offline resolution removes one unused dependency edge without version changes.
The tracked lockfile is restored after the tests, and that unrelated difference
is not part of this change. Whole-workspace `cargo fmt --all -- --check` fails
before formatting with Windows OS error 206 (command/path too long), recorded
in [the receipt](workspace-fmt.json). No all-workspace formatting pass is claimed.
No new Mac Work package or production inference binary is deployed by this
source correction. The before-fix ACP fixtures remain evidence of the old
binary; they are not relabeled as after-fix acceptance.

## Required repair and acceptance

The remaining public-path repair needs the owner of the actual forwarding and
security policy. Investigate the 117.162.0.179:8080 mapping, upload inspection,
IPS/WAF and TCP reset logs; compare the same synthetic full tool request at
the public ingress and GPU egress. The packet fingerprints above narrow that
investigation without naming an unverified device. Keeping the exact HTTP URL
requires correcting that route/policy. Increasing GPU concurrency, heartbeat
frequency or timeouts cannot restore request bytes removed before inference.

A separately authorized, trusted HTTPS inference endpoint could be qualified
if the public policy cannot support the required HTTP traffic. The existing
website is not such an endpoint. The historical SSH success is a diagnostic
control, not the requested final public configuration.

Acceptance must use the actual affected macOS Work client, VPN off and on as
separate conditions, ordinary tools enabled, the same session and at least
three messages including a tool/PPT request. Verify complete uploads, first
response, final stream event, cancellation and a usable resulting file. Small
curl requests and the earlier throughput campaign do not substitute for this.

## Explicitly not claimed

- A repaired public 8080 path, successful PPT generation, or access to the
  affected user's macOS UI.
- The identity or location of a unique reset injector, a universal size limit,
  or a proved payload-inspection signature.
- An unbounded deadlock, or an explanation unique to second-turn state.
- A deployed macOS client correction or all workspace CI being green.

## Commands

```text
python -X utf8 -B docs/evidence/power/2026-10-21-client-stall/transport-framing.py
python -X utf8 -B docs/evidence/power/2026-10-21-client-stall/second-turn-faults.py
# GPU: run tcp-header-capture.py under the already authorized sudo account;
# it writes only header metadata under the existing private Git directory.
rustfmt --edition 2021 --config skip_children=true --check crates/code/core/src/llm/http.rs crates/code/core/src/llm/http/transport_error_tests.rs
cargo test -p a3s-code-core --lib llm::http::transport_error_tests --offline --target-dir D:/code/aster/target
cargo test -p a3s-code-core --lib llm::http:: --offline --target-dir D:/code/aster/target
cargo fmt --all -- --check
```
