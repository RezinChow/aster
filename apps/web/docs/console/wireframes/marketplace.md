# Wireframes — 能力市场（API Marketplace）

依据 [prd/08-marketplace.md](../prd/08-marketplace.md)。

---

## W-MKT-0 导航

```text
Activity · 能力
侧栏：
  市场              /marketplace
  已开通            /marketplace/entitled
  推理              /inference
```

与 Inference 密钥：**同一 Credential 资源**；市场页内「密钥」Tab 深链推理密钥。

---

## W-MKT-1 浏览（默认）

```text
市场                              [添加 Provider]¹  [创建 Key]

[浏览|Provider|密钥|用量]

[搜索名称 / SKU / 描述]   Kind：全部|Model|Tool|API|Skill|Feed
                          Provider：全部|World Monitor|Polymarket|AIsa|…
                          状态：全部|未开通|已开通  → chip「已开通」可链到 /marketplace/entitled

视图：[卡片|表格]

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ chokepoint   │ │ markets.list │ │ sonar-large  │
│ World Monitor│ │ Polymarket   │ │ AIsa         │
│ tool · $0.01 │ │ api · $0.002 │ │ model · $/M  │
│ ● healthy    │ │ ● healthy    │ │ ○ degraded   │
│ [已开通] 或  │ │ [开通]       │ │ [开通]       │
│  打开详情 →  │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘

¹ 仅 platform · market.provider.write；Org Admin 隐藏或进「申请」
```

空态：还没有可浏览的能力 · [添加 Provider] 或等待同步。

---

## W-MKT-2 Listing Detail

```text
get_chokepoint_status                    [开通] / [停用]   [试探]
World Monitor · tool · sku wm.chokepoint.status
● healthy · 开通于 env/prod · ent_rev_12

[概览|契约|标价|用量|审计]

概览
  一句话描述…
  上游：MCP tool get_chokepoint_status
  文档：[World Monitor]  隐私/归属说明一行
  Envelope：source · as_of · confidence（若有）

侧栏属性
  Provider     World Monitor
  Kind         tool
  Trust        installation-trusted
  同步时间     …
  Operation    最近开通 op_…
```

契约 Tab：OpenAPI/MCP JSON schema 只读 + curl / MCP 调用示例。

标价 Tab：

```text
│ 维度        │ 单价        │ 说明           │
│ 每次成功调用 │ $0.010     │ 上游 $0.008 + 平台展示费 |
│ 失败重试    │ 不计 / 计*  │ *以 Gateway 策略为准   │
```

---

## W-MKT-3 开通抽屉

```text
开通 · get_chokepoint_status              [取消]  [确认开通]

作用域   Env [prod ▾]   （继承当前 Shell Scope）
权限     将授予：tool.invoke ∩ listing_id
预算     建议检查 Env 支出上限  [打开限额 → Inference]
标价     ~ $0.01 / 次（展示，非钱包扣款）

□ 我已了解上游 ToS 与数据时效责任

→ 提交 loading → Toast：已开通 · op_abc · [查看已开通]
```

停用：Modal「停用后新调用将被拒绝；进行中的 Run 不自动取消」· [停用]。

---

## W-MKT-4 已开通（侧栏叶子 `/marketplace/entitled`）

**不是**市场页 Tab。从侧栏「已开通」进入；开通成功 Toast 链到本页。

```text
已开通（本 Env）                         [同步目录]  [批量停用]

[搜索]  Provider chips

│ Listing              │ Provider      │ Kind │ 开通时间 │ 近7日 │
│ get_chokepoint_status│ World Monitor │ tool │ …       │ 1.2k │ →
│ markets.list         │ Polymarket    │ api  │ …       │ 80   │ →
│ sonar-large          │ AIsa          │ model│ …       │ —    │ →
```

行点击 → Listing Detail；行菜单：停用 · 打开 Inference 路由（仅 model）· 打开 Registry（仅 skill）。

---

## W-MKT-5 Provider List

```text
Provider                                 [添加 Provider]

│ 名称          │ 适配器      │ Listings │ 健康    │ 信任   │
│ World Monitor │ mcp+rest    │ 75       │ healthy │ trusted│ →
│ Polymarket    │ openapi     │ 12       │ healthy │ trusted│ →
│ AIsa          │ aisa-proxy  │ 5000+*   │ healthy │ trusted│ →
│ OpenAI        │ native      │ …        │ …       │ …     │ →

* 显示「已同步 / allowlist」计数，避免假全量
```

---

## W-MKT-6 添加 Provider 向导

```text
添加 Provider · 向导                    step 2/4
① 模板 → ② 连接 → ③ 同步范围 → ④ 确认

① 模板（卡选）
  ┌ World Monitor ┐ ┌ Polymarket ┐ ┌ AIsa    ┐ ┌ OpenAPI 通用 ┐
  │ MCP + REST    │ │ 只读 API   │ │ 代理目录│ │ 粘贴 Spec  │
  └───────────────┘ └────────────┘ └─────────┘ └─────────────┘
  ┌ MCP 通用 ┐ ┌ 其他模型商… ┐
  └──────────┘ └─────────────┘

② 连接
  Base URL / MCP endpoint
  上游凭证 → 写入 Secrets（不回显）
  [测试连接]

③ 同步范围
  ○ 全量镜像（谨慎）
  ● SKU / tool allowlist  [上传/多选]
  Kind 过滤：☑ tool ☑ api ☐ model …

④ 确认 → [添加并同步] → op_… · 进入 Provider Detail
```

---

## W-MKT-7 Provider Detail

```text
World Monitor · trusted · healthy
                         [同步] [停用 Provider] [更多▾]

[概览|适配器|目录|凭证|同步日志|审计]

概览 KPI：Listings 75 · 本月调用 … · 错误率 …
适配器：mcp+rest · 上次同步成功
```

停用 Provider：级联提示「将停用其下 N 条已开通 Listing」· 强确认。

---

## W-MKT-8 试探 Drawer

```text
试探 · get_chokepoint_status

Env [prod]  Key [ck_**** ▾]（需 market.probe）

参数
  name [Bab el-Mandeb____]
  jmespath [可选____________]

预估  ~ $0.01
[发送试探]

结果（消毒）
  HTTP 200 · 12ms · 计费：计 1 次
  JSON viewer …
  source / as_of 徽章（若有）
```

写操作 Listing：试探按钮 disable + Tooltip「需要 market.probe.write」。

---

## W-MKT-9 密钥 / 用量

```text
密钥
  与 Inference → 密钥同表；列增加「Market 开通数」
  CTA [创建 Key] → 可勾选「允许 Market 调用」

用量
  筛选 Provider / Listing
  │ 日 │ Provider │ Listing │ 次数 │ 估费用 │
  底栏 [打开完整 Usage →]
```

---

## W-MKT-10 与 Inference 联动（示意）

```text
开通 model Listing「sonar-large」(AIsa)
        │
        ▼
Inference → 路由 候选模型 +标签 aisa/sonar-large
Inference → 访问 / 限额 仍管 Grants 与硬顶
```

---

## UX 要点

1. **一屏一事**：浏览页不做运营大盘；KPI 放 Provider Detail / 用量 Tab。  
2. **主 CTA**：浏览页级仅「创建 Key」或平台「添加 Provider」二选一为主（按角色）；卡片「开通」为行级 primary。  
3. **标价是展示**：文案避免「扣款/余额」；用「单价 / 预估 / 计入 Usage」。  
4. **Provider 模板降低配置税**：World Monitor / Polymarket / AIsa 一等模板。  
5. **AIsa 全量目录**：默认 allowlist，防止 5000+ 刷屏；浏览支持「仅已同步」。
