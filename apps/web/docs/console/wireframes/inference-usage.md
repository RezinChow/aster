# Wireframes — Inference 网关面 · Usage Showback

依据 [prd/06-inference-usage.md](../prd/06-inference-usage.md)。  
**无** Token Hub / Token Plan 独立壳；全部挂在 Inference + Usage + Customers。

---

## W-INF-0 页壳（Tab）

```text
Inference                                   作用域: Org ▾  Project ▾  Env ▾
私有模型网关运营面 · 权威在控制面

[概览|路由|策略|密钥|访问|限额|护栏|诊断|用量]

┌ content ─────────────────────────────────────┐ ┌ meta ──────────┐
│                                              │ │ Scope          │
│                                              │ │ Rev digests    │
│                                              │ │ Edge snap_…    │
│                                              │ │ 最近 op_…      │
└──────────────────────────────────────────────┘ └────────────────┘
```

---

## W-INF-1 概览

```text
┌ 活跃路由 12 ┐ ┌ Provider 健康 4/5 ┐ ┌ 1h 错误率 0.12% ┐ ┌ 限额触顶 2 ┐
     ※ Serving 不可用时该卡显「不可用」而非绿点

最近失败                                              [打开诊断]
│ 时间   │ 路由    │ 码          │ correlation │
│ 14:02  │ rt_chat │ upstream_…  │ corr_9f…    │ → 点击预填诊断

快捷链: [Models 供给] [Edge 快照] [完整用量]

可服务模型（只读投影）
│ 模型 ID    │ 能力          │ 来源     │ 状态 │ 绑定路由 │
│ a3s-l2   │ chat,tools    │ hosted   │ ok   │ rt_chat │ → [供给详情]
│ emb-small  │ embed         │ external │ ok   │ rt_embed│

Provider
│ 名称              │ 类型     │ 健康     │ Secret │
│ power:wl_gpu_a    │ local    │ ok       │ 已绑定 │ → Detail（冷却只读）
│ ext:openai-compat │ external │ ok       │ 已绑定 │
│ ext:backup-eu     │ external │ cooldown │ 已绑定 │
Platform: [信任 Provider → System]  ※ 仅平台角色
```

---

## W-INF-2 路由 List

```text
路由                              [退役说明?]              [发布路由]

[搜索路由/模型]   (状态: active|revising|retiring|retired)

│ 路由 ID  │ 模型       │ 优先级摘要     │ Edge    │ 状态   │
│ rt_chat  │ a3s-l2   │ p0 w:70/30    │ snap_88 │ active │ →
│ rt_embed │ emb-small  │ p1 single     │ snap_87 │ retiring│
```

---

## W-INF-3 发布 / 修订向导

```text
发布路由 · 向导                              step 2/5
① 模型  →  ② 候选后端  →  ③ 权重与回退  →  ④ 约束  →  ⑤ 确认

候选后端
│ # │ Provider/目标     │ 健康 │ 权重 │ 纳入 │
│ 1 │ power:wl_gpu_a    │ ok   │ 70   │ ☑  │
│ 2 │ ext:openai-compat │ ok   │ 30   │ ☑  │
│ 3 │ ext:backup-eu     │ cool │  —   │ ☐  │  ※ 未纳入者不可出现在回退链

回退序（仅已纳入）:  [1] → [2]

        [取消]                    [上一步] [下一步]
确认页: diff 摘要 + [发布] → Toast Operation op_…
```

---

## W-INF-4 路由 Detail

```text
rt_chat · a3s-l2 · active                    [修订] [更多▾退役]

[概览|候选与权重|约束|Edge 绑定|活动]

概览:
  有效策略 digest pol_… (Env 层 · 未回落 Org)
  限额: 600 rpm · 并发 40
  亲和: session bounded · TTL …

候选与权重:
  可视化条 ████████░░ 70% power:wl_gpu_a
           ███░░░░░░░ 30% ext:openai-compat
  回退: 1→2 （失败关闭，不重入已排除）

Edge 绑定: snap_88  [打开 Gateway]
```

---

## W-INF-5 策略

```text
策略
解析后的唯一有效策略（失败关闭）

Credential  ──× (无覆盖)
Environment ●  pol_env_12  ← 当前生效
Project     ○  (被 Env 遮蔽)
Org         ○
Global      ○

横幅: 若 Env 策略校验失败 → 请求拒绝，不会使用 Org 策略。

                         [查看 diff] [新建策略修订]
编辑器双栏: ACL 表单 | raw digests
```

---

## W-INF-6 密钥

```text
密钥                                              [创建 Key]

│ 名称        │ 作用域      │ 过期    │ 最后使用 │ 状态  │
│ ci-bot      │ proj/env    │ 90d     │ 2m 前   │ active│
│ laptop-dev  │ proj/dev    │ never   │ 1d 前   │ active│

创建 Modal:
  名称 · 过期 · 说明「有效权限 = Grants ∩ 模型访问」
  [创建] → 一次性明文面板
  ┌ sk_live_••••••••████  [复制] [下载] ┐
  │ 关闭后无法再查看                     │
  └─────────────────────────────────────┘
行 [更多]: 轮换 · 吊销
```

---

## W-INF-7 访问 Matrix

```text
访问                                    [只读|批量编辑] [保存修订]

        │ chat │ embed │ code │ admin-route │
role/dev│  ✓   │  ✓    │  ✓   │             │
role/ops│  ✓   │       │      │  ✓          │
user/j  │  ✓   │  ✓    │      │             │

脚注: 空单元格 = 拒绝。与 P0 Grants 取交集。
[打开 Permissions]
```

---

## W-INF-8 限额

```text
限额                                              [新建限额修订]

作用域生效值（Inference 权威 · Gateway 执行）
┌ RPM 600/600 ┐ ┌ TPM 2M ┐ ┌ 并发 40 ┐ ┌ 日配额 80% ┐

策略表:
│ 名称     │ 作用域 │ RPM │ 并发 │ 修订 │
│ env-std  │ env    │ 600 │ 40   │ r3   │

触顶: 今日 2 次  [查看 Events]
```

---

## W-INF-9 护栏

```text
护栏                                              [新建护栏修订]

│ 策略        │ 阶段     │ 护栏模型    │ 状态  │
│ default-pre │ pre      │ guard-lite  │ on    │
│ pii-post    │ post     │ guard-pii   │ on    │

Detail: 红线决策样例（已消毒，无原文）
```

---

## W-INF-10 诊断

```text
诊断
[健康|失败|契约|试探]

健康:
│ 候选            │ 探测   │ 状态   │
│ power:wl_gpu_a  │ 12s 前 │ ok     │
│ ext:backup-eu   │ 12s 前 │ cooldown│

失败:
│ 时间 │ 码 │ revision │ corr │
筛选 correlation [________]

契约:
  Profile: OpenAI-compat chat/completions
  [示例 Request] [示例 Response]  schema 只读

试探:
  路由 [rt_chat ▾]  简短输入（不入库）
  ⚠ 试探不进入持久 prompt 库；仍计用量（若策略要求）
  [发送试探] → 时间线结果（消毒）
```

---

## W-INF-11 Inference · 用量页签

```text
用量（本作用域投影）          [按模型|按路由|按主体|按天]

┌ 请求 ┐ ┌ Token ┐ ┌ 错误率 ┐ ┌ 估算成本 showback ┐
表格 rollup …
[导出]  [打开完整用量 →]
```

---

## W-USE-1 Usage 主页（P4）

```text
用量 · 商业投影（非账单）              [导出 CSV]

范围 = Shell 作用域
维度: [模型|路由|主体|项目|天]   时间窗 [7d▾]

┌ 请求 42.6k ┐ ┌ Token in 800M ┐ ┌ Token out 400M ┐
┌ 错误率 0.08% ┐ ┌ 估算成本 $1.2k ※showback ┐

完整性: ledger 延迟 < 2m ✓

表格:
│ 维度键     │ 请求 │ Token │ 估算 │
│ a3s-l2   │ 12k  │  …    │  …  │ → 下钻

客户摘要（若 Org 已绑定）:
  Orbit Labs · enterprise · 席位 42/60  [打开客户] [完整客户用量]
```

---

## W-USE-2 导出反馈

```text
Toast: 已创建导出 Operation op_export_19
       [查看] → Ops Detail · 完成后可下载
页内横幅可关闭: 用量争议以控制面 ledger 为准
```

---

## W-CUS-U 客户 · 用量页签

```text
客户 / Orbit Labs
enterprise · 正式 · 席位 42/60     ※ 文案「套餐/席位」非 Token Plan

[概览|成员|用量|合同]

用量 | 席位并排
┌ 本月请求 12.1k · Token … · 估算 $… ┐  ┌ 席位 ████░░ 42/60 ┐
[完整用量 → /usage?org=…]

合同摘要: 套餐 enterprise · 续约 …   （外部商业投影，只读+编辑商业字段）
```

---

## 反模式（线框禁止）

```text
✗ 侧栏出现「Token Hub」「Token Plan」「钱包」「充值」
✗ Playground 历史会话库
✗ 路由页内嵌第二套代理配置（Provider-native desired state）
✗ 绿点「健康」在 Serving 缺失时仍显示
```
