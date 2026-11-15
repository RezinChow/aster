# Aster agent connection diagnosis

Date: 2026-11-15, Asia/Shanghai. Analysis only; no product Rust was changed.

The historical session had two distinct interruptions. Its first Run failed
because the Cursor adapter rejected a tool outside the presented catalog with
`NonRetryableLlmError`. After the user continued, the next Run was cancelled
while its Bash tool was running. The pager then observed ACP transport closure
and exited through its existing error path.

A separate controlled stdio reproduction established a real input transport
defect in the installed ACP: interleaving an outgoing response with an incoming
frame fragmented inside a UTF-8 character terminates ACP with an invalid UTF-8
error. The ACP stdin entry lacks the existing cancel-safe `LineBufferedRead`
wrapper. This reproduction does not prove the exact historical trigger.

## Environment and identity

- macOS 26.6.2, Darwin arm64; Python 3.9.6.
- Inspected checkout HEAD: `e74809409957718b1154fd222e3f871429c82c6e`.
- Installed CLI: `aster 0.3.6 (e74ecd8d951a)`; ACP: `9.2.4`.
- Both installed executables returned the identical BUILD_ID:
  `aster-cli-pair-v1:8b86e5216923a7c6c2be82701f0caf1914dae2e9:aarch64-apple-darwin`.
- Reproduction selected `/Users/roylin/.local/bin/aster-acp` explicitly. No
  current-source build or source-fingerprint equality is claimed for that pair.
- The probe created temporary workspaces with spaces and Chinese characters,
  separate state/log directories, an explicit synthetic ACL, disabled account
  imports, and an unused loopback endpoint. It sent only initialize/session-new
  requests, with no prompt or model request. No Inkstone code was executed.

## Historical evidence

Session: `fadaf458-1cfe-4c2b-9132-80efaa12ff85`.
Original logs and session state remain private; none were copied into this repo.

| UTC timestamp | Observation |
| --- | --- |
| 03:09:57.353 | Cursor rejected `tool_unavailable` |
| 03:09:57.361 | First Run failed with that exact error |
| 03:10:06.807 | Continuation prompt entered |
| 03:10:24.798 | Bash started with a declared 600000 ms timeout |
| 03:10:25.934 | Bash cancelled after 1135 ms; exit 137, `command_cancelled=true`, `timed_out=false`, zero captured output bytes |
| 03:10:26.139 | Second Run recorded as cancelled |
| 03:10:28.974 | AgentSession closed |
| 03:10:29.082 | Pager worker join failed: `Aster Code ACP transport closed` |

The cancellation placeholder in history does not identify its initiator.
There was no retained panic marker in this day's ACP log. Neither the lack of
a panic log nor exit 137 establishes the presence or absence of an OS kill.

## Controlled reproduction and actual checks

The same byte sequence contains two valid session-new requests. The control
sends both complete frames. The fault case sends the first frame and the prefix
of the second frame ending after the first byte of `你`. It waits for the first
request's response before sending the remaining bytes. The input pipe remains
open while waiting for the second response.

| Case | First response | Second response | Result |
| --- | --- | --- | --- |
| Complete frames | success | success | ACP alive until explicit stdin close; exit 0 |
| Fragmented UTF-8 frame | success | EOF instead of response | ACP exits 1 before test closes stdin; `Error: ACP stdio I/O`, caused by `stream did not contain valid UTF-8` |

The initial probe and the final probe each started two ACP processes: one
control and one fragmented case. Both invocations reproduced the same outcome.
Thus there were four launches total, covering two distinct input cases twice.
These are successful defect-reproduction checks, not a repaired product pass.

The final probe and JSON results remain private under
`.runtime/tui-full-e2e/agent-connection-diagnosis-20261115/`.
The Python script asserts both the healthy control and the defective outcome.
Its fault expectation must be inverted in a future fixed-product regression.

Final private artifact SHA-256 values:

```text
fragmented_stdin_probe.py
d26be3f5599b007b1a4db668da0540fdd536c0f5e1739979b87892567e142bf0
fragmented-stdin-result.json
e016b62c07f82ef3a5a3884547e8e5fd3fc331041dd6006b34e9a839af3c8080
```

| Command/check | Actual result |
| --- | --- |
| `aster --version`, `aster-acp --version` using explicit installed paths | 0.3.6 and 9.2.4 |
| Both installed `--build-id` commands | identical values shown above |
| `python3 .runtime/agent-connection-diagnosis-20261115/fragmented_stdin_probe.py` before relocating the private artifacts | exit 0; one control and one defect reproduced |
| Separate assertions over initial probe JSON | both case expectations confirmed |
| `python3 .runtime/tui-full-e2e/agent-connection-diagnosis-20261115/fragmented_stdin_probe.py` after relocation and adding explicit defect assertions | exit 0; same control and defect reproduced |
| `git diff --check` and `git diff --no-index --check /dev/null <file>` for each new Markdown file | exit 0; no whitespace errors |
| Inline Python checks of both Markdown files and final probe JSON | 9 local links resolved; both files UTF-8/LF with balanced code fences; both probe expectations confirmed |

The repair instructions are in
[the implementation prompt](../../../implementation-prompt-aster-agent-connection-recovery.md).

## Explicitly not claimed

- A product fix, a current-source Cargo build, a Rust test/Clippy/workspace pass,
  a release, an installation, a commit, or a push.
- Proof that this UTF-8 fragmentation defect caused the original second
  disconnect. The original stderr was discarded and final I/O error was not
  persisted; the exact trigger cannot be recovered from the retained evidence.
- The unknown Cursor tool's name, the reason it differed from the presented
  catalog, or the safety of permitting that request. Catalog rejection remains
  required; blanket retry or name guessing is not an accepted fix.
- OOM, a segfault, a Vitest timeout, an intentional user cancellation, or an
  indexing-budget/skill-loading warning as the historical connection trigger.
- Inkstone P5/P6 completion, doctor/Vitest success, native GUI acceptance,
  Windows/Linux runtime verification, or abrupt-death input recovery.
