# Aster CLI 0.3.7 发布后端到端用例规划

状态：**规划稿**（非执行通过证据）。日期基线：2026-11-15。  
目标：对已发布的 **`aster-cli-v0.3.7` / ACP `9.2.5`**（`aster-cli-stable`）做**安装路径端到端回归**，确认断连恢复主线在「用户真实拿到的 pair」上仍成立。

范围：**CLI + ACP + TUI（Terminal「终端」+ agent-desktop）**。不含 Studio。  
权威后续执行合同（待写/执行时）：`docs/implementation-prompt-aster-cli-0.3.7-post-release-e2e.md`。

| 参考 | 角色 |
| --- | --- |
| `docs/evidence/code/2026-11-15-cli-0.3.7-acp-9.2.5-release/OUTCOME.md` | 已发布；tag SHA `1a8e38d51` |
| `docs/evidence/code/2026-11-15-agent-connection-recovery-agent-desktop/OUTCOME.md` | 断连 V1–V5（staged）先例 |
| `docs/evidence/code/2026-11-15-phase8-post-install-gui-smoke/OUTCOME.md` | 安装路径仅 V1 |
| `docs/evidence/code/2026-11-15-long-horizon-complex-e2e/E2E-TEST-PLAN.md` | 长程分层；本计划不重开全战役 |
| `docs/evidence/code/2026-11-15-phase7-campaign-final-closeout/OUTCOME.md` | 残留：Studio / 额外 wire / shipped_tui |

---

## 1. 为何要单独一轮

战役验证多用 **checkout staged debug bins**；Phase 8 只对安装路径跑了 **V1**。  
发布后用户走的是 **stable 通道归档**（`release-dist`、含 `embedding/`、成对 BUILD_ID）。本计划专门钉：

1. 通道安装身份 = 发布窗口；  
2. 断连文案与 resume 在**已安装 pair**上仍绿；  
3. 一条薄长程/resume 不回归；  
4. 诚实区分产品 FAIL vs 额度 BLOCKED。

---

## 2. 可信 oracle（优先级）

1. 成对 `--build-id` / `--version`（安装路径）  
2. Terminal `history of selected tab`（断连 / resume / quit）  
3. 工作区文件字节（若跑薄长程）  
4. mock 请求计数（resume 零 inference）  
5. PNG 仅作证据，非唯一门  

禁止：整屏「看起来好了」、AX 关键字单独过门、用 `target/debug` 冒充通道安装。

---

## 3. 分层总览

```text
P0  通道身份：stable / 安装 / BUILD_ID / 版本
P1  Hermetic 快检（对安装 aster-acp 或同 BUILD_ID 源码树）
P2  断连 GUI 矩阵（安装 bins）—— 必过核
P3  薄长程 / resume（可选加深）
P4  Wire L5 抽检（可选）
P5  OUTCOME + 短报
```

建议默认跑：**P0 + P1 + P2（全核）+ P5**。  
P3 / P4 点名再跑（额度与时间）。

---

## 4. 用例表

### P0 — 通道与安装身份（必过）

| ID | 用例 | 动作 | 通过标准 | 证据 |
| --- | --- | --- | --- | --- |
| **P0-A** | stable 清单 | 读 `aster-cli-stable` 的 `latest.json` | `version=0.3.7`，`tag=aster-cli-v0.3.7` | `p0-stable-latest.json` |
| **P0-B** | 安装/更新 | `aster update` 或 `scripts/install.sh` 装到约定 `DST`（默认 `~/.local/bin`） | 退出 0；pair 落盘 | `p0-install.log` |
| **P0-C** | which + version | `command -v`；`aster --version`；`aster-acp --version` | 路径为 DST；CLI `0.3.7`；ACP `9.2.5` | `p0-which.txt`、`p0-version-*.txt` |
| **P0-D** | BUILD_ID 成对 | 两二进制 `--build-id` | 字符串完全一致；与发布窗口可核对（非旧 `8b86e521…`） | `p0-build-id-*.txt` |
| **P0-E** | agent-desktop | `agent-desktop status` | accessibility + screen_recording granted | `p0-agent-desktop-status.txt` |

失败：停止；先修安装/通道，不进 GUI。

### P1 — Hermetic 快检（必过）

对**当前 checkout**（须含修复祖先 `6c2916864`）跑；用于锁回归，不替代 P2。

| ID | 用例 | 命令要点 | 通过 |
| --- | --- | --- | --- |
| **P1-U** | UTF-8 分片 | `acp_conformance_stdio` / `fragmented_utf8_session_new_survives_outbound_interleave` | PASS |
| **P1-T** | transport | `aster-pager` `acp::aster_spawn::transport_tests` | 5 PASS |

若仅有安装 bin、无源码树：P1 记 **BLOCKED（无源码）**，P2 仍可跑。

### P2 — 断连 GUI 核（必过；安装 bins）

复用伴生 `drive_connection_recovery.py`；**bins 必须来自 P0 安装路径**（拷入伴生 `bins/` 并记 provenance）。  
顺序固定：**V1 → V3 → V2 → V5 → V4**。

| ID | 用例 | 操作摘要 | 通过标准 | 证据 |
| --- | --- | --- | --- | --- |
| **V1** | 欢迎屏断连 | 启动 → ready → SIGTERM live `aster-acp` | hist 含 `Agent connection closed` **且** 日志路径或 `session_end.worker_join`；无 session 时 `has_resume_hint` 允许 false | `v1-*.json/txt/png` |
| **V3** | 正常退出对照 | `/quit` | 有 resume/保存类文案；**无** `Agent connection closed` | `v3-*` |
| **V2** | 有 session 断连 | `/new`+`/session-info` → kill ACP | bail + 同 id 的 `aster --resume …` 提示 | `v2-*`；记下 session id |
| **V5** | 日志可定位 | 读 V2 的 `ASTER_LOG_DIR` | 有 transport/stdio 类字段可摘录；缺 `acp_stderr=` 不单方面否决 V2 | `v5-*` |
| **V4** | resume 零补全 | `--resume <V2 id>` + counting mock | UI 恢复；`inference_requests=0`；允许 1× catalog `GET /v1/models` 并披露 | `v4-*` |

任一条产品性 FAIL → 战役 FAIL；额度/权限 → BLOCKED。

### P3 — 薄长程（可选加深）

不重跑全 L3。点名时三选一即可：

| ID | 用例 | 说明 | 通过 |
| --- | --- | --- | --- |
| **LH-C4** | multiturn 一案 | `drive_*` C4 或等价；安装 bins + kimi（或披露 deepseek） | HOLD→GATE 文件 oracle |
| **LH-CL** | control-loop 一案 | 单次 CL；超时/无 progress 归类 harness vs 产品 | PASS 或诚实 BLOCKED |
| **LH-F1** | 断连+resume | 同 session SIGTERM ACP 后 resume | 同 Phase 长程 L4-F1 口径 |

### P4 — Wire 抽检（可选）

| ID | 用例 | 说明 |
| --- | --- | --- |
| **W1** | `live_interactive_dialogue` 主测 | 已在 Phase 5 PASS；发布后抽检可用安装 ACP 或 cargo bin 同 BUILD_ID |
| **W2+** | soak / restart / effort | 仍属残留；默认 SKIP |

### P5 — 证据

```text
docs/evidence/code/<实际日期>-cli-0.3.7-post-release-e2e/OUTCOME.md
```

须含：安装 version/BUILD_ID、P2 每案结果、未跑的 P3/P4、`Explicitly not claimed`、短报。

---

## 5. 战役通过定义

**PASS** 当且仅当：

1. P0 全绿（安装身份 = 0.3.7 / 9.2.5 成对）；  
2. P1 绿或诚实 BLOCKED（无源码）；  
3. P2：V1、V3、V2、V4 全 PASS；V5 PASS 或「部分字段」与先例同口径披露；  
4. 未点名的 P3/P4 在 OUTCOME 写 SKIP。

**PARTIAL**：P0+P1 绿 + P2 子集绿 + 其余 BLOCKED（非产品）。  
**FAIL**：P2 任一条产品性失败，或 P0 身份漂移冒充通过。

---

## 6. Explicitly not claimed（规划层）

- Studio 宿主 E2E。  
- 全量 `shipped_tui_e2e` / 多平台手跑矩阵。  
- 完整长程 L2–L5 再跑一遍。  
- `delayed_catalog` 已修。  
- Windows / Linux GUI（本计划默认 Darwin + Terminal「终端」）。

---

## 7. 短报模板（执行后）

```text
战役：cli-0.3.7-post-release-e2e
P0身份：version=…；BUILD_ID=…；stable=0.3.7
P1：utf8=…；transport=…
P2：V1=… V3=… V2=… V5=… V4=…
P3/P4：SKIP|…
判定：PASS|PARTIAL|FAIL
证据：docs/evidence/code/…/OUTCOME.md
```

---

## 8. 与既有证据的关系

| 已有 | 本计划增量 |
| --- | --- |
| 战役 staged V1–V5 | 改为 **stable 安装 bins** 重跑核 |
| Phase 8 仅 V1 | 补全 V2–V5 + V3/V4 |
| Phase 5 L5 W1 | 默认不重跑；P4 点名抽检 |
| 长程全案 | 不默认重开；P3 薄切 |
