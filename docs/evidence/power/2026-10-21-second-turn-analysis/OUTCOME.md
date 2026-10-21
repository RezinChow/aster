# Public gateway resets and apparent second-turn stalls

<a id="closure-and-lessons"></a>

## 结案与教训（2026-10-21，用户确认）

**状态：已结案。** 用户现场确认：coding agent 生成的 Bash 命令被防火墙
识别为“系统命令注入攻击”，导致正常模型会话流量遭到拦截。这是本次故障的
最终原因说明，取代此前仅能定位到公网中间链路、尚未确认具体拦截原因的结论。
此前关闭 VPN 后短暂稳定的反馈不足以解释该误报。

结案依据是用户的现场确认及此前提供的防火墙/WAF 拒绝记录。我们未直接操作
该设备，未取得精确规则 ID、命中命令、检测方向、JSON 字段或最终策略改动，
也未独立执行策略调整后的 macOS 公网验收。原始测试结果和抓包保持原样；
这些限制不影响记录用户已确认结案，也不把历史失败重新标记为通过。

应当保留的工程教训：

1. **Coding agent 的正常模型流量会携带可执行代码文本。** 生成内容、工具调用
   参数、工具结果及后续轮次历史都可能包含 Bash 命令。安全设备需要理解该接口
   承载代码的用途。合法讨论或生成命令，不等于攻击者正在注入服务器执行入口；
   实际命令执行仍由产品既有的权限、信任边界与沙箱控制。
2. **连续对话故障要检查内容变化。** 后续轮次可能把已生成的命令带回历史，
   因而出现“首轮正常、第二轮卡住”。本次确认了命令注入误报这个原因类别，
   并未证明恰好第二轮或某个具体字段必然触发。
3. **先把传输故障与推理故障分开验证。** 对同一请求比较公网与内网，检查请求
   正文是否完整到达，再对齐源地址、时间、会话和 WAF 原始告警。客户端的
   `Connection reset by peer`、流提前结束，以及网关的正文读取失败，可能是
   边界设备拦截后的不同表现；应尽早取得网络管理员的规则命中证据。
4. **验收要覆盖真实的 agent 流量。** 使用普通工具配置，覆盖代码生成、Bash
   工具调用、工具结果回传及同一会话多轮交互，验证完整上传和流结束事件。
   单轮短提示、无工具请求、纯空白填充的大请求和吞吐压测各有用途，不能单独
   代表这类内容已经通过 WAF。
5. **修正应落在误报规则与业务接口的匹配关系上。** 由网络管理员确认命中规则，
   对已认证的模型 API、指定目标和具体误报类别制定最小范围策略，并核查关联
   的临时封禁。保留认证、访问控制、限流、审计及其他适用防护。接口内容策略
   与 agent 的命令执行授权分别维护。
6. **加密与客户端容错各有边界。** SSH 成功曾帮助定位明文公网路径差异；HTTPS
   可保护传输，但终止 TLS 的 WAF 仍可检查命令文本，仍需正确配置内容规则。
   本次中文 Windows 错误分类修正改善了误重试导致的等待，不承担消除防火墙
   误报的作用。

以下保留结案前的诊断、修正和验收建议，作为可追溯的历史记录。

## Diagnostic result before closure

Two separate mechanisms are now reproduced. The public HTTP path resets some
ordinary tool-enabled uploads before Gateway can finish reading the request.
The same second-turn body succeeds through the internal address. Independently,
the current Windows ACP treats a localized connection-reset error as retryable
and backs off without completing the turn within a 40-second observation.
Neither finding established a GPU generation deadlock. The public route was
still unresolved at that diagnostic stage; the user-confirmed closure above
provides the subsequently established cause.

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
tool upload can fail too. Those controls did not identify a specific JSON field
or phrase as the trigger. The later user confirmation establishes the firewall's
command-injection classification, without identifying an exact signature.

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

## Repair and acceptance guidance recorded before closure

At that stage, the public-path repair required the owner of the actual forwarding
and security policy. The recorded investigation guidance was to inspect the
117.162.0.179:8080 mapping, upload inspection,
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

- Independent post-remediation public acceptance, successful PPT generation, or
  access to the affected user's macOS UI. Closure is user-confirmed.
- The exact device identity, rule ID, policy change, matched payload signature,
  or a universal size limit. The command-injection false-positive category is
  confirmed by the user.
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
