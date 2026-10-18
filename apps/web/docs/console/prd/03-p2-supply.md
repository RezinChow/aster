# PRD P2 — 供给与 CI/CD

对齐 Cloud：Sources、Developer Workflows、Artifacts、Delivery Pipelines、Assets/Registries、Model Supply。

## 1. Sources

| ID | 需求 | 优先级 |
| --- | --- | --- |
| SRC-1 | Git 连接列表（安装状态、webhook） | P2 |
| SRC-2 | 仓库订阅与默认分支 | P2 |
| SRC-3 | 精确 SourceRevision 浏览器 | P2 |
| SRC-4 | Webhook 投递日志 | P2 |

## 2. Artifacts

| ID | 需求 | 优先级 |
| --- | --- | --- |
| ART-1 | BuildRun 列表与证据链接 | P2 |
| ART-2 | Artifact manifest 只读（digest、签名、保留策略） | P2 |
| ART-3 | 从 Artifact 跳到 Release / Workload | P2 |

## 3. Pipelines（Delivery）

| ID | 需求 | 优先级 |
| --- | --- | --- |
| PIP-1 | Pipeline 定义列表 | P2 |
| PIP-2 | PipelineRun 时间线：阶段、审批、晋级 | P2 |
| PIP-3 | 手动触发 / 批准 / 回滚到先前 release | P2 |
| PIP-4 | 「构建一次、多方部署」提示与禁止重建的护栏文案 | P2 |

**验收：** 晋级动作生成 Operation；时间线可回放到同一 Artifact digest。

## 4. Registries（Assets）

| ID | 需求 | 优先级 |
| --- | --- | --- |
| REG-1 | 目录：Agent / Function / MCP / Skill / Connector 包 | P2 |
| REG-2 | 包详情：版本、授权、安装到 Env | P2 |
| REG-3 | 信任策略与扫描结果摘要 | P2 |
| REG-4 | Skill 包与 **市场** `kind=skill` Listing 深链（开通可触发安装） | P2 |

> **与市场分工：** Registry = 可安装制品；[Marketplace](./08-marketplace.md) = 可调用/可计量的在线要约。MCP 在线工具优先登记为 Market Listing，安装型 Connector 走 Registry。

## 5. Models（Model Supply）

| ID | 需求 | 优先级 |
| --- | --- | --- |
| MOD-1 | 逻辑 Model 与 Revision 列表 | P2 |
| MOD-2 | WeightManifest：不可变、许可证、信任 | P2 |
| MOD-3 | 外部 Hub 解析状态 | P2 |
| MOD-4 | 与 Inference Route 的绑定入口 | P2 |

## UX 注意

- Pipeline 与 Flow Run 视觉区分：Pipeline 强调「阶段门禁」；Flow 强调「步骤 journal」。  
- Artifact digest 始终等宽、可复制。
