# Follow-up: actual client conversation stalls

## Result

The latest user report is that macOS becomes apparently stable after disabling
the VPN, while retaining `http://117.162.0.179:8080/v1`. This supports VPN-path
involvement; it is user-reported stability, not a sustained macOS acceptance run.
The failing VPN-on public HTTP path is **not repaired**. Ordinary tool-enabled
ACP requests reproduce a connection reset through that endpoint, including
after selecting the Windows physical network interface. The same current ACP
executable completed both turns through an SSH local forward to the same
production Gateway. No GPU, Power, Gateway, credential, firewall or server
configuration was changed in this follow-up.

The user identified macOS and the prompt “帮我做一个10页的PPT”, sent at approximately
13:56 China Standard Time on 2026-10-21. The user subsequently reported that an
SSH local forward restored the conversation. Their next error still explicitly
named `http://117.162.0.179:8080/v1/chat/completions`. The user clarified that the
public URL and port8080 must be retained, then reported stable operation with
the VPN disabled. The suggested loopback endpoint is therefore only historical
diagnostic evidence, not the requested final configuration. The macOS reports
are user testimony, not remotely operated UI tests.

## Executed evidence

All runs used the current Windows ACP SHA256
`fc7242ff89bb558f290a7f37b39b26eeb95bae0197f3ae61fe2d37071c4fd4a6`.
The previous qualification used a different executable; its narrower no-tools
results do not substitute for this reproduction.

| Condition | Result | Evidence |
| --- | --- | --- |
| Ordinary ACP, default public route | First turn exceeded the 40-second deadline; child reaped | [default](acp-normal-default1.json) |
| Ordinary ACP, physical public host route | First turn exceeded the same deadline; child reaped | [direct](acp-normal-direct1.json) |
| Ordinary ACP, SSH forward to Gateway localhost8080 | Both synthetic turns correct, end_turn; 21.562s and21.110s | [SSH](acp-normal-ssh1.json) |
| Ordinary ACP, loopback HTTP relay forwarding to the public endpoint | Complete60,390-byte uploads received locally; identical body retried five times, each public forwarding reset within78–109ms | [relay](acp-public-relay1.json), [ACP](acp-normal-public-relay1.json) |

The ordinary driver removes the original sourceReview capability ceiling in a
fresh empty workspace. The relay independently observed25 tool schemas on the
failing streaming call. The original small preliminary calls (5,763 /7,098 /
8,435 bytes, no tools) completed200 through the public endpoint. Full raw JSON,
authorization headers, model output and user state were never persisted by the
relay. The inherited `not_claimed` list in the frozen base driver's result still
contains an ordinary-schema limitation; for these wrapper runs the explicit
scope, `source_review_removed=[true]` and relay observations supersede that
inherited description. This is not Work GUI acceptance or a PPT file-generation
test.

The frozen underlying driver, prompts and timeout remain unchanged. The SSH
comparison was invoked with the wrapper's URL changed in memory to
`http://127.0.0.1:19081/v1`, forwarded to GPU localhost8080; no credentials were
written into an ACL. All four owned ACP children were reaped and all four
isolated-state scans found no resolved credential.

## Upload and network controls

[Valid upload controls](body-upload-valid1.json) add legal JSON whitespace,
keeping the same tiny model prompt. Through the selected physical interface,
132 /68,132 /131,204-byte uploads all returned200 and exactlyOK. Through the
default virtual interface, the68,132-byte upload passed and the other two
attempts timed out during connect. Consequently request size alone does not
explain the ordinary tool-request reset, and bypassing the default VPN is not a
complete repair.

Selecting a physical outgoing interface does not disable every VPN interception
or filtering component. Therefore the physical-route failure above does not
contradict the user's later observation with the VPN actually disabled.

A further header-only experiment configured `Transfer-Encoding: chunked` for
ordinary ACP and still exceeded40s. Observed server headers retained
Content-Length and no Transfer-Encoding, so this does not qualify a successful
on-wire chunked test and is not a recommended configuration change.

The [40-second flags-only capture](client-stall-flags1-safe.json) contains23
packets and reports zero kernel capture drops. Fourteen captured resets enter
the server; no captured reset leaves it. This is partial header metadata with
hashed addresses, not an application-payload capture or a unique attribution
to the original macOS caller, VPN product, forwarding device or reset injector.

The [earlier pilot](body-upload-diagnostic1.json) used an unsupported top-level
`user` field. All six requests returned400; follow-up synthetic inspection
identified `unsupported_request_fields`. These pilot responses are retained
and are **not** inference acceptance or evidence of the body-read failure.

Read-only production journal inspection found repeated `request body could
not be read` / `request body read failed` events followed by400. Declared bodies
were roughly60–141KB, including independent callers. Server/client wall clocks
have a previously measured skew; a shared credential and rewritten ports do
not uniquely attribute every journal event to the macOS user.

A temporary Windows ActiveStore route for only117.162.0.179/32 was applied after
the default reproduction, tested, and explicitly removed. The original LetsTAP
route was selected again after cleanup. [The receipt](gateway-direct-route-receipt.json)
records the historical apply; it is **not** a claim that this route remains
active. The same exact temporary route was applied once more for the header
experiment and removed again using the ownership checks. The Windows diagnostic
SSH connections, packet capture and relay are no longer running.
The user's independently launched macOS SSH session was not touched.

Read-only host inspection found the Gateway itself listening8080, ordinary
Docker host firewall rules, and no matched host WAF/security-process names.
This snapshot does not prove absence of all host filtering. Public443 accepts
a valid `jxtoyou.com` certificate, but `/v1/models` under that hostname returns404;
it is not a qualified model endpoint and was not repointed. No TLS private key
or credential was read for this inspection.

## Commands and current user configuration

Commands executed from the repository root with the working Python3.12 runtime:

```text
python -X utf8 -B docs/evidence/power/2026-10-21-client-stall/body-upload-diagnostic.py
python -X utf8 -B docs/evidence/power/2026-10-21-client-stall/body-upload-valid.py
python -X utf8 -B docs/evidence/power/2026-10-21-client-stall/acp-normal-dialogue.py --tag default1
powershell -File docs/evidence/power/2026-10-21-client-stall/gateway-direct-route.ps1 -Action Apply
python -X utf8 -B docs/evidence/power/2026-10-21-client-stall/acp-normal-dialogue.py --tag direct1
python -X utf8 -B docs/evidence/power/2026-10-21-client-stall/acp-public-relay.py
powershell -File docs/evidence/power/2026-10-21-client-stall/gateway-direct-route.ps1 -Action Remove
```

The user now retains the original public endpoint and disables the VPN. A
future VPN-on solution can use that VPN client's destination-specific DIRECT
rule for117.162.0.179, but its exact syntax and effectiveness have not been
verified because the VPN product is unknown. No macOS route, VPN configuration
or application file was remotely changed.

Historical macOS SSH workaround already reported working by the user:

```sh
ssh -N -L 127.0.0.1:18080:127.0.0.1:8080 user@172.18.101.2
```

For that optional workaround only, keep SSH running and set the selected provider to
`base_url = "http://127.0.0.1:18080/v1"`, retaining the existing key and model.
Fully quit/reopen the client and create a fresh conversation. An error naming
the old public URL means this endpoint change has not reached that request.
ACP reads launch configuration and retains a core agent; editing an ACL file
does not rewrite already constructed clients. Work's host-generated provider
configuration can also differ from the terminal's trusted ACL.

An enduring VPN-on solution may need a VPN policy correction, a qualified encrypted public endpoint or a repair
to the actual forwarding path. The current HTTPS website is not such an
endpoint. This record does not approve repointing an unrelated website.

## Explicitly not claimed

- A unique router, ISP, inspection rule, request phrase or exact reset origin.
- A general failure of all large requests, all public inference, or the GPU.
- A repaired public8080 route, successful PPT generation, or direct operation
  of the user's macOS UI.
- A unique root cause established solely by the later VPN-off stability report,
  or a verified DIRECT rule for an unidentified VPN product.
- New product behavior, a production rollout, or rerun of the previous pressure
  campaign. This follow-up adds diagnostic scripts and evidence only.
