# PRD — Inference 网关面 · Usage Showback

| 字段 | 值 |
| --- | --- |
| 产品 | Kense OS Console |
| 范围 | P1 Inference 深化 + P4 Usage/Showback + Customers 用量桥接 |
| 依据 | [PRINCIPLES §7](../PRINCIPLES.md) · Cloud `platform-capability-architecture` TokenHub outcomes |
| 状态 | Design target（交互完整；控制面闸门随 Cloud I0.x） |
| 非目标 | Token Hub 导航壳 · Token Plan 充值/结算 · 第二用量账本 |

**第一性原理：** Console 只投影与提交；路由选择、限额执行、用量 ledger 均不在浏览器落地。  
**产品原则：** 能力进现有模块，不发明平行品牌面。

---

## 0. 能力矩阵 → 需求 ID

| # | TokenHub-class outcome | 需求包 | 优先级 |
| --- | --- | --- | --- |
| A | 模型目录（与上游库存分离） | INF-M | P1 |
| B | 本地/外部 Provider 资源 | INF-P | P1 |
| C | 统一协议 / 能力发现 | INF-D | P1 |
| D | 项目/环境推理 Key | INF-K | P1 |
| E | 模型访问 ∩ Grants | INF-A | P1 |
| F | 作用域路由策略 | INF-R | P1 |
| G | 优先级 · 权重 · 顺序回退 · 约束 | INF-R · INF-POL | P1 |
| H | 会话/缓存亲和与冷却只读 | INF-R · INF-H | P1 |
| I | 配额 · 速率 · 并发 | INF-Q | P1 |
| J | 用量归因 · 分析 · showback | USE · INF-U | P1/P4 |
| K | 诊断 · 契约示例 · 试探 | INF-D | P1 |
| L | Guardrail / 内容安全策略 | INF-G | P1 |
| M | 协议/Provider 广度只读 | INF-P · SYS 链 | P4 |
| N | 席位/套餐与用量并排 | CUS-U | P4 |
| — | 余额/开票/结算 | **OOS** | — |

---

## 1. Inference 信息架构

导航仍为 **产品 → Inference**（单入口）。页内 Tab：

```text
[概览] [路由] [策略] [密钥] [访问] [限额] [护栏] [诊断] [用量]
```

| Tab | 职责 | 主 CTA |
| --- | --- | --- |
| 概览 | 健康摘要、活跃路由数、限额触顶、最近失败 | 无（或「打开诊断」secondary） |
| 路由 | Route 目录与详情（发布/修订/退役） | 发布路由 |
| 策略 | 作用域有效策略只读树 + 打开修订编辑器 | 新建策略修订 |
| 密钥 | 推理 Credential 列表与轮换 | 创建 Key |
| 访问 | 模型/路由 × 主体有效权限矩阵 | 编辑访问修订 |
| 限额 | 配额/速率/并发策略 | 新建限额修订 |
| 护栏 | Guardrail 绑定与检查模式 | 新建护栏修订 |
| 诊断 | 路由健康、失败消毒、契约示例、试探 | 发送试探 |
| 用量 | 本作用域 rollup（深链到 P4 Usage） | 导出 / 打开完整用量 |

右侧持久属性栏（Detail 模式）：`Scope · Applied revision digests · Edge snapshot · Operation`。

---

## 2. 需求明细 — Inference

### 2.1 概览 INF-O

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-O1 | 卡片：活跃路由、健康 Provider、近 1h 错误率、限额触顶次数 | 假绿禁止：无 Serving 时显式「不可用」 |
| INF-O2 | 「最近失败」表 5 行，点击进诊断预填 correlation | 无 prompt/response 正文 |
| INF-O3 | 链到 Models 供给、Edge 快照、Usage | 新页保留 scope |

### 2.2 模型目录 INF-M（只读投影 + 供给链）

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-M1 | 可服务模型表：ID、能力标签、来源（hosted/external）、状态 | 不把上游厂商名当公共真相主键 |
| INF-M2 | 行操作：打开 Models 供给详情、查看绑定路由 | Viewer 只读 |
| INF-M3 | 空态 CTA：前往 Models / 绑定 Provider | 有 write 权限才显示主 CTA |

### 2.3 Provider INF-P

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-P1 | Provider 列表：类型（local Power / external）、区域、健康、凭证绑定状态（永不展示密文） | Secret 仅显示「已绑定 / 缺失」 |
| INF-P2 | Detail：资源修订、冷却/半开只读、链 Workload（local） | 健康观测不可编辑为期望副本 |
| INF-P3 | 「信任 Provider」仅 Platform → 链 System | Org 角色不可见平台信任写入口 |

### 2.4 路由 INF-R

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-R1 | List：路由 ID、模型、状态、Edge 绑定、优先级摘要 | 搜索 + 状态 chip |
| INF-R2 | 发布向导：选模型 → 候选后端 → 权重/优先级 → 回退序 → 预览 diff → Operation | 提交后展示 Operation ID |
| INF-R3 | 修订：基于当前 revision 克隆编辑；历史不可就地改 | diff 必显 |
| INF-R4 | 退役：二次确认；确认文案含「失败关闭」 | retire 后列表状态变更 |
| INF-R5 | Detail Tabs：概览 / 候选与权重 / 约束 / Edge 绑定 / 活动 | 约束含 tag/region/env |
| INF-R6 | 回退链可视化（顺序 1..n），禁用项不可被回退重新纳入 | 与 Cloud「不可加回已排除候选」一致的文案提示 |
| INF-H1 | Detail 展示会话/缓存亲和 TTL 与冷却半开只读（不写副本） | 归属路由概览 + Provider/诊断；无独立「调度」编辑器 |

### 2.5 作用域策略 INF-POL

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-POL1 | 展示解析后的 **唯一有效策略**：Credential → Env/Project → Org/Global | 高层无效则失败关闭，UI 标明「未回落到更宽策略」 |
| INF-POL2 | 策略编辑器：ACL/YAML 双模；保存 = 新 revision | 校验错误列表 |
| INF-POL3 | 历史 revision 对比 | Timeline 组件语言 |

### 2.6 密钥 INF-K

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-K1 | 列表：名称、作用域、过期、最后使用、状态 | 无明文列 |
| INF-K2 | 创建：权限交集提示 + 一次性 reveal Modal（复制/下载后关闭不可再取） | 同 Credentials 不变量 |
| INF-K3 | 轮换 / 吊销：confirm + Operation | 吊销立即反映列表 |

### 2.7 访问 INF-A

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-A1 | Matrix：行=主体（Role/Principal），列=模型或路由能力 | 有效权限 = Org∩Project∩Env∩Credential；空限制=拒绝 |
| INF-A2 | 批量编辑模式 + 保存 revision | 保存前 diff |
| INF-A3 | 「打开 Grants」链到 P0 Permissions | 不在 Inference 内重建 RBAC 引擎 |

### 2.8 限额 INF-Q

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-Q1 | 展示：RPM/TPM/并发/日配额，按作用域 | 数值旁标注「Gateway 执行 · Inference 策略权威」 |
| INF-Q2 | 编辑限额 revision（有权限） | 禁止 UI 本地倒计数当真 |
| INF-Q3 | 触顶事件链到 Events；Usage 显示触顶计数 | 只读投影 |

### 2.9 护栏 INF-G

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-G1 | 列表：策略名、检查阶段（pre/post）、绑定护栏模型、状态 | 默认不保留 payload |
| INF-G2 | 修订编辑 + 红线决策只读样例（已消毒） | 无原始 prompt |

### 2.10 诊断 INF-D

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-D1 | 路由健康：候选、最近探测、冷却 | 只读 |
| INF-D2 | 失败表：消毒错误码、applied revision、correlation | 无 Secrets 外泄 |
| INF-D3 | 契约示例：按 `InferenceProtocolProfile` 展示 request/response schema 样例 | 只读 |
| INF-D4 | 试探请求：授权主体下发一笔测试；结果进时间线 | 不进入持久 prompt 库；确认文案说明 |
| INF-D5 | 「打开 API 文档」外链或内嵌只读 | Viewer 可用 |

### 2.11 Inference 内用量 INF-U

| ID | 需求 | 验收 |
| --- | --- | --- |
| INF-U1 | 维度 chip：模型 / 路由 / 主体 / 天 | 与 P4 Usage 同投影源 |
| INF-U2 | [打开完整用量] → `/usage` 预填 scope+维度 | 单账本 |
| INF-U3 | [导出] → 异步 Operation | Toast 可跳转 |

---

## 3. 需求明细 — Usage & Showback（P4）

入口：**运营 → Usage**（Billing 字样仅作「商业投影」副标题，不做收银台）。

### 3.1 仪表 USE

| ID | 需求 | 验收 |
| --- | --- | --- |
| USE-1 | 范围：跟随 Shell Org/Project/Env；Platform 可选安装级 | 切换 scope 刷新 |
| USE-2 | 维度：模型 / 路由 / 主体 / 项目 / 天 | 至少一类筛选 |
| USE-3 | KPI：请求数、Token in/out、错误率、估算成本（若有单价元数据） | 成本旁注「showback · 非账单」 |
| USE-4 | Rollup 表 + 下钻到单日/单路由 | 空态与筛选无结果区分 |
| USE-5 | 导出 CSV：异步 Operation；完成后通知 | 争议以 ledger 为准文案 |
| USE-6 | 完整性徽章：ledger 延迟/缺口提示 | 间接数据不假装精确 |
| USE-7 | 链 Customers：当前 Org 有绑定客户时显示套餐/席位摘要 | 无客户则隐藏 |

### 3.2 Showback 规则 USE-S

| ID | 需求 | 验收 |
| --- | --- | --- |
| USE-S1 | 单价来自控制面不可变参考元数据；缺失则显示「—」 | 禁止前端捏造单价 |
| USE-S2 | 分组成本中心 = Projects 归因引用 | 只读 |
| USE-S3 | **无** 充值、余额、支付、发票、税、结算入口 | QA 检查导航与 CTA 清单 |

### 3.3 Customers 桥接 CUS-U

| ID | 需求 | 验收 |
| --- | --- | --- |
| CUS-U1 | Detail「用量」页签：本月请求/Token/估算成本 + [完整用量] | 同 USE 投影 |
| CUS-U2 | 席位与套餐与用量并排，不混为「Token Plan」 | 文案用「套餐 / 席位」 |
| CUS-U3 | 套餐变更向导仍写外部商业投影字段；不写 usage ledger | Audit 可区分 |

---

## 4. 跨切面 UX 规则

1. **修订不可变**：策略/路由/限额/护栏/访问的保存皆新 revision。  
2. **失败关闭可见**：无效高层策略不静默放宽；横幅说明。  
3. **无 Prompt 正文**：管理面列表、诊断、导出均 prompt-free。  
4. **Operation 反馈**：写路径结束后展示 `op_…` 与 Audit 链。  
5. **权限**：无 permission 时控件 disable + Tooltip 说明缺失 ID（按钮级规范）。  
6. **与 Models / Edge / Secrets**：用深链，不复制编辑器。

---

## 5. 屏幕清单（本 PRD）

| 屏幕 ID | 名称 | 模式 |
| --- | --- | --- |
| INF-HOME | Inference 概览 | List/Dashboard≤4 |
| INF-ROUTE-LIST | 路由目录 | List |
| INF-ROUTE-DETAIL | 路由详情 | Detail |
| INF-ROUTE-WIZ | 发布/修订向导 | Wizard |
| INF-POL | 策略树 + 编辑器 | Editor |
| INF-KEY | 密钥列表/创建 | List + Modal |
| INF-ACCESS | 访问矩阵 | Matrix |
| INF-QUOTA | 限额 | List + Editor |
| INF-GUARD | 护栏 | List + Editor |
| INF-DIAG | 诊断与试探 | Timeline + Form |
| INF-USAGE | Inference 用量页签 | List |
| USE-HOME | Usage 仪表 | List |
| USE-EXPORT | 导出 Operation 反馈 | Toast/Detail |
| CUS-USAGE | 客户用量页签 | Detail |

---

## 6. 里程碑映射

| 里程碑 | 本 PRD 交付 |
| --- | --- |
| M2 | INF-R / INF-K / INF-U 可点通（可 mock） |
| M5 | USE-\* · CUS-U · INF-Q 展示 · showback 文案 |
| 随 Cloud I0.2b–e | INF-POL · INF-A · INF-D · INF-G 接真 |

---

## 7. Out of scope（再次冻结）

- Token Hub 品牌导航、兼容 API、嵌入式第二代理。  
- Token Plan：钱包、充值、优惠券、发票、税务、结算台。  
- 将 Provider 发票当作用量真相。  
- 在 Console 持久化用户 prompt / playground 历史库。
