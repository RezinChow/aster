# F05 增量补测 OUTCOME（2026-11-14 F05 increment）

> 任务：「继续推进」——在不改产品、不改台账的前提下，尝试用本地回环合成模型服务把 F05 从 BLOCKED 拉到可测。
> 证据目录：`docs/evidence/studio/2026-11-14-windows-agent-desktop-e2e-f05/`
> 上游：`2026-11-14-windows-agent-desktop-e2e-supplement/OUTCOME.md`（F05 = BLOCKED，F16 = 2×PASS UI 子集）
> 口径：`../2026-11-14-windows-agent-desktop-e2e/E2E-TEST-PLAN.md` + `MATRIX.md`

---

## 0. 结论先行

| 项 | 结果 |
|---|---|
| F05 功能级 verdict | **BLOCKED → PARTIAL**（UI 子集可达，**不计入覆盖**） |
| F05 UI 子集用例 | **2×独立 PASS**，各 12 条 AX 断言全 OK |
| F03 | **SKIP**（模型无法在 AX 层成为活跃模型，不能发起受控 turn） |
| 产品代码 / `MATRIX.md` | **未修改** |
| 覆盖率台账数字 | **未发布、未变更** |

本轮把「有没有可用模型服务」这个环境阻塞彻底解掉了：通过真实 GUI 配置了指向本地回环的自定义服务商，产品**自己**拉取了模型列表并发起了 chat completion 校验。但「在工作台选中该模型并回读」这一步仍不可完成——原因是产品把模型行渲染为无 `ref_id` 的 `group`/`statictext`，AX 无法操作。按 fail-closed，只记 PARTIAL。

---

## 1. 环境与隔离

| 项 | 值 |
|---|---|
| 平台 | Windows，`agent-desktop` 1.2.0，`accessibility.granted` |
| 被测应用 | 本 checkout 的 `Studio.exe`，测试专用实例 `ASTER_STUDIO_INSTANCE=win-e2e-01` |
| 实例隔离 | `tenant.rs::storage_slug_for()` → `aster-win-e2e-01`，profile 目录独立于用户主实例；**本轮新增的 provider 配置不污染主实例** |
| 启动命令 | `cd /d/code/aster/apps/studio` → `ASTER_TENANT_SLUG=aster STUDIO_RENDERER_DEV=1 ASTER_STUDIO_INSTANCE=win-e2e-01 STUDIO_RENDERER_PORT=4318 node scripts/studio-dev.mjs` |
| 构建一致性 | `studio-dev.mjs` 每次启动执行两次 `cargo build --locked`；`Cargo.toml` / `package.json` version 临时对齐 `0.2.3`（父仓 `Cargo.lock` 为 `aster-studio 0.2.3`），收尾回退 `0.2.2` |
| 主窗口 | `w-120982452` / pid `50320`，bounds 1456×959 @ (104,104) |
| Phase 0 | `PHASE0_L3: PASS`；S2 `complete:true`，composer 命中 2；S3 无首启对话框；S4 截图 `screenshots/phase0-S4-main-window.png`（1442×952 / 416,524 bytes） |
| 被测产物 | `D:\code\aster\target\studio\aster\debug\Studio.exe` |

### 1.1 本地合成模型服务（`local_llm_fixture.py`）

**不是真实 LLM，也不是桩套件**。它只是环境前置，让产品真实的 provider/model 链路能被 GUI 驱动；所有覆盖断言仍来自 AX，HTTP 仅作环境证据。

- 仅绑定 `127.0.0.1:4399`，无出网访问，stdin 或 stop-file 干净关闭。
- 实现 `GET /v1/models`、`POST /v1/chat/completions`（JSON 与 SSE 流式），模型 ID `e2e-synthetic-1`，固定回复 `E2E-SYNTHETIC-REPLY`。
- 健康探测（`probe_fixture.py` → `fixture-health.txt`）：

```text
GET /v1/models            : HTTP 200 ids=['e2e-synthetic-1']
POST /v1/chat/completions : HTTP 200 content='E2E-SYNTHETIC-REPLY'
POST (stream=True)        : HTTP 200 sse_complete=True bytes=483
FIXTURE: USABLE
```

- **产品侧真实请求证据**（`local-llm-events.jsonl`，第 10–11 条；前 9 条为健康探测）：

```json
{"path": "/v1/models", "payload": null}
{"path": "/v1/chat/completions", "payload": {"model": "e2e-synthetic-1", "messages": [{"role": "user", "content": "Reply with OK."}], "max_tokens": 8, "stream": false}}
```

即产品在配置自定义服务商后**主动发现模型并完成了一次 chat completion 连通性校验**，收到合成回复。这证明 provider → model → endpoint 链路真实可用，而非仅停留在 UI 表单。

---

## 2. GUI 配置链路（全部经 agent-desktop AX 驱动）

| 步骤 | AX 证据 |
|---|---|
| 设置页存在「模型服务」入口 | `probe-gui.json`：`模型服务` 1 命中（button） |
| 「添加服务商」按钮 | `probe-provider.json`：1 命中（button），`localManagement = true` 为常量 |
| 「添加自定义提供商」窗口字段 | `probe-fields.json`：`提供商名称`、`API 密钥`、两个端点框 `OpenAI` / `Anthropic` 共 4 个 textfield |
| 表单填充（优先 `set-value`） | `configure-provider.json`：`提供商名称` → `E2E-Local`、OpenAI Base URL → `http://127.0.0.1:4399/v1`，均经独立 `get --property value` 回读一致；`API 密钥` 因密码框不回显 value（set_ok=True），未作断言 |
| 点「添加」 | `ok:true`，随后产品请求 `/v1/models`（见 §1.1） |
| 模型选择向导 | `add-model.stdout.log`：AX 出现 `checkbox「选择 e2e-synthetic-1」`，点击成功 → 点「添加所选模型」成功；完成后窗口出现 `option` 形态的模型节点 |
| 关闭向导回工作台 | `finish-wizard.json`：点「完成」→ 点「工作」→ `描述任务` 2、`选择模型` 1（menubutton） |

### 2.1 关键平台发现：`expand` 而非 `click`

工作台的「选择模型」是自定义 `menubutton`。`click <ref>` 与 `click --headed <ref>` 都返回 `ok:true`，但**弹层根本不打开**（`screenshots/selector-open.png` 视觉确认，AX 中 `e2e-synthetic-1` 为 0 命中）。真正打开弹层的是语义动作 **`expand <ref>`**：

```text
baseline            model=0 option=0 menuitem=1
click --headed      model=0 option=0 menuitem=1
expand              model=2 option=0 menuitem=1   ← POPUP OPENED
```

（`probe-expand.json` / `probe-expand.stdout.log`）。`expand` 是 toggle，因此用例开头先检测「关闭模型选择」按钮以保证幂等。

弹层打开后 AX 中出现 `关闭模型选择`、`配置自定义模型`、`跳转到服务商设置界面` 等按钮，以及 `e2e-synthetic-1`（`group` + `statictext`）。注意：**AX 可见但视觉截图未呈现弹层**（`screenshots/model-popup-open.png`），这是产品 popover 渲染/定位行为，本轮不据此推断功能可用，只以 AX 为准。

---

## 3. F05 UI 子集用例：2×独立 PASS

`f05_cases.py::case_F05`，每轮 12 条 AX 主断言：弹层初始关闭 → 「选择模型」menubutton 存在 → `expand` 交付 → 「关闭模型选择」出现（弹层确实打开） → `find --name e2e-synthetic-1` 命中 ≥1 → 「配置自定义模型」「跳转到服务商设置界面」入口存在 → `get --property text` 读回「选择模型」→ 关闭弹层 → 独立 AX 回读确认已关闭 → 工作台 composer 恢复。

| 轮次 | token | 断言 | verdict | window |
|---|---|---|---|---|
| run1 | `E2EF058EAF` | 12 / 12 OK | **PASS** | `w-120982452` |
| run2 | `E2EF054FAE` | 12 / 12 OK | **PASS** | `w-120982452` |

典型断言输出：

```text
OK  F05 model popup opened (AX close control present)
OK  F05 configured model visible in selector AX - total_matches=2 name=e2e-synthetic-1
OK  F05 selector AX text readback - text='选择模型'
OK  F05 popup closed (independent AX readback)
OK  F05 workbench recovered (composer ref available)
```

### 3.1 为什么功能级只能是 PARTIAL

「模型选择整链」的最后一环是**选中模型并回读选中态**。本轮确认该环在 AX 层不可完成：

- `find --name e2e-synthetic-1` 只返回 `role=group`（无 ref）与 `role=statictext`（无 ref）；
- `--value` / `--description` 均 0 命中；`--role option|checkbox|radio|menuitem` 无对应模型节点；
- 全窗口 unnamed actionable ref 仅 1 个（`@sbaz8aollqvoz:e5`，`text=None`，无法归属模型行）；
- 非 compact 深 snapshot（`--max-depth 24`）的 UIA 树里完全没有模型名节点，`snapshot` 不暴露深层 Web 内容；
- `click` 只接受 `<REF>`，`find` 不产生可操作 ref；硬规则禁止坐标点击，故**不能也不曾**用鼠标绕过。

因此：**不声称完成模型选中，不声称 F05 严格达标，不计入任何覆盖率**。这是产品的 AX 无障碍缺口，不是测试放宽。

---

## 4. F03 与其余功能

- **F03（流式消息/工具披露/引用）= SKIP**：合成模型无法在 AX 层成为活跃模型，任何 turn 都不受控、无法归因到本地 fixture；且合成服务不是真实 LLM，即便发出 turn 也不满足台账「需契约门禁绿」口径。未伪造模型响应、未发起不可控 turn。
- **F01**：用户工作树 2×FAIL 结论不变（rerun 归档保留）；上一轮冷启动对照只在 gitlink renderer 上 2×PASS，本轮未触碰。
- **F16**：上一轮 2×PASS UI 子集结论不变，本轮未重跑。
- **F06/F09/F12/F15**：结构不可达结论不变。
- **F13/F14**：PARTIAL / NOT TESTED 结论不变。
- 台账：本轮**未修改 `MATRIX.md`**，未发布任何认证覆盖率数字。按宽松实测口径的 6/17 也**未认领**，P0 口径裁决仍未进行。

---

## 5. 合规审计（`compliance-audit.txt` / `results-summary.txt`）

```text
total agent-desktop commands logged: 510
find 313 | list-windows 129 | get 21 | click 16 | clear 12 | expand 7
snapshot 5 | screenshot 4 | set-value 3
mouse-click / coordinate actions : 0   (expected 0)
focus-window                     : 0   (expected 0)
Playwright / runtime stub refs   : 0   (expected 0)
--headed total                   : 1
expand (semantic disclosure)     : 8
set-value (settings inputs)      : 3
error codes: INVALID_ARGS 14, ACTION_FAILED 12, WINDOW_NOT_FOUND 6, AMBIGUOUS_TARGET 1
```

错误码说明（**不构成断言放宽**）：`INVALID_ARGS` / `WINDOW_NOT_FOUND` 主要来自探测阶段对不支持的 `--surface` 取值（menubar/popover/alert/toolbar 返回 `INVALID_ARGS`，menu/sheet 返回 `WINDOW_NOT_FOUND`）以及一次 `screenshot --path` 参数误用；`ACTION_FAILED` 来自 composer `clear` 的 best-effort 状态恢复与 `click --headed` 尝试；`AMBIGUOUS_TARGET` 1 次来自探测。所有失败命令均按 `disposition.retry` 语义处理，`retry: unsafe` 的写动作不盲重试，F05 两轮 verdict 只由独立 AX 回读断言决定。探测失败全部保留归档，未删、未改。

`drive.py` / `f05_cases.py` / `configure_provider.py` / `probe_*.py` 均为编排 harness，串行调用同一个 `agent-desktop-win32-x64.exe`，不是桩套件；进程启停只作环境准备。

---

## 6. 收尾与环境恢复

| 项 | 状态 |
|---|---|
| 本地合成模型服务 | stop-file 干净关闭，`SHUTDOWN_OK`；4399 端口释放 |
| Studio 窗口 / 4318 端口 | `close-app --force` 后 `list-windows` 为 `[]`，端口无监听 |
| `Cargo.toml` / `package.json` | version 由临时 `0.2.3` 回退 `0.2.2` |
| 用户 WIP | `stash pop` 恢复 `reasoning_effort.rs` 39 行；`git diff \| sha256sum` 与 `user-wip.patch` 逐字节一致 |
| 产品源文件 | 未修改（`git status` 仅剩用户 WIP） |
| 测试实例配置 | `aster-win-e2e-01` profile 中留有 `E2E-Local` 自定义服务商与 `e2e-synthetic-1` 模型；位于独立 profile 目录，**不影响用户主实例**，本轮未删除 |
| 父仓 `packages/ui` 445 条 `D` 标记 | 仍为历史异常，未处置 |

---

## 7. Explicitly not claimed

- 不声称 F05 严格达标或计入覆盖；只记 **PARTIAL（UI 子集 2×PASS）**。
- 不声称在工作台完成了「选中模型 → 回读选中态」；模型行无 actionable AX ref，该环未执行。
- 不声称 F03 被验证、不声称发起过真实 LLM turn；本地服务是合成 fixture，不是真实模型。
- 不声称本地合成服务是桩套件冒充结果；它只是环境前置，主断言全部来自 AX。
- 不声称修改了产品代码、放宽了 `--locked` 或任何断言；不声称改过 `MATRIX.md` 或发布过覆盖率数字。
- 不声称使用过坐标点击 / `focus-window` / Playwright（审计均为 0）。
- 不声称弹层视觉可用；AX 可见与视觉呈现不一致已如实记录。
- 不声称处理了 `packages/ui` 历史删除标记异常。

---

## 8. 产品侧缺口与后续建议

1. **AX 无障碍缺口（阻塞 F05 达标）**：模型选择弹层的模型行应暴露可操作 role（`option` / `menuitemradio` / `checkbox`）与稳定 accessible name/ref，使「选中 + 回读」可通过 AX 断言。当前只有 `group` + `statictext`。
2. **popover 视觉/AX 不一致**：弹层在 AX 中已打开但截图未见渲染，建议排查 popover 定位/层级；这会影响任何基于真实窗口的 E2E。
3. **模型激活链路**：即便模型已添加，工作台「选择模型」按钮文本仍恒为「选择模型」；需提供可访问的「设为当前模型」路径，才能让 F03 的受控 turn 成立。
4. **口径**：F05 若要计入台账，需先完成 P0 口径裁决（UI 子集是否计 F 层覆盖、合成模型是否满足「契约门禁绿」），再更新 `MATRIX.md`。
5. **可复用经验**：Windows 上自定义 `menubutton` 的 `click` 可能只完成 UIA Invoke 而不展开；`expand` 才是正确的语义动作，且是 toggle，用例必须做幂等检测。
