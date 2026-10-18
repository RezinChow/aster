# 按钮级线框 — Inference · Usage · Customers 用量桥

规范见 [00-spec.md](./00-spec.md)。  
本文件覆盖 [prd/06-inference-usage.md](../../prd/06-inference-usage.md) 全部可点控件；**无** Token Hub / Token Plan CTA。

---

## Inference · 壳与概览

```text
#INF-T0..T8  Tabs [概览|路由|策略|密钥|访问|限额|护栏|诊断|用量] ·tab
#INF-O1      概览失败行 ·ghost → 诊断预填 correlation
#INF-O2      [打开诊断] ·secondary
#INF-O3      [Models 供给] ·ghost
#INF-O4      [Edge 快照] ·ghost
#INF-O5      [完整用量] ·ghost → /usage
#INF-M01     模型行 [供给详情] ·ghost → Models
#INF-M02     模型行 [绑定路由] ·ghost → 路由筛选
#INF-P01     Provider 行 ·ghost → Provider Detail（只读健康/冷却）
#INF-P02     [信任 Provider → System] ·ghost · enable: platform
```

## 路由

```text
#INF-R01 [发布路由] ·primary · enable: inference.route.write
#INF-R02 搜索 ·field
#INF-R03 状态 chips ·chip
#INF-R04 行主链接 ·ghost → Detail
#INF-R05 [修订] ·secondary · enable: active|revising
#INF-R06 [更多] ·row
#INF-R07 [退役] ·danger · confirm「退役后流量失败关闭，需输入路由 ID」
#INF-R08 向导 [取消] ·ghost · confirm if dirty
#INF-R09 向导 [上一步] ·secondary
#INF-R10 向导 [下一步] ·primary · enable: 当前步校验通过
#INF-R11 候选 纳入 ☑ ·checkbox · 取消纳入时同步移出回退链
#INF-R12 权重 ·field · enable: 已纳入
#INF-R13 回退序拖拽 ·dnd · enable: 已纳入数≥2
#INF-R14 向导 [发布] ·primary · loading「发布中」→ Toast op_
#INF-R15 Toast [查看] ·ghost → Ops
#INF-R16 Detail [打开 Gateway] ·ghost
#INF-R17 Detail Tabs ·tab
```

## 策略

```text
#INF-P01 策略层节点 ·ghost → 打开该 revision 只读
#INF-P02 [查看 diff] ·secondary · enable: 选中两版或当前+上一版
#INF-P03 [新建策略修订] ·primary · enable: policy.write
#INF-P04 编辑器模式 [表单|Raw] ·tab
#INF-P05 [保存修订] ·primary · enable: dirty && valid · loading
#INF-P06 [丢弃] ·ghost · confirm if dirty
```

## 密钥

```text
#INF-K01 [创建 Key] ·primary · enable: credential.write
#INF-K02 Modal [创建] ·primary · loading
#INF-K03 Reveal [复制] ·primary · 复制成功后仍可点直至关闭
#INF-K04 Reveal [下载] ·secondary
#INF-K05 Reveal [关闭] ·ghost · confirm「确认已保存明文？」
#INF-K06 [轮换] ·secondary · confirm → 新 reveal
#INF-K07 [吊销] ·danger · confirm
```

## 访问

```text
#INF-A01 [只读|批量编辑] ·tab/toggle
#INF-A02 Matrix 单元格 ·checkbox · enable: 批量编辑模式
#INF-A03 [保存修订] ·primary · enable: dirty · 保存前 Diff Modal
#INF-A04 Diff Modal [确认保存] ·primary · loading
#INF-A05 [打开 Permissions] ·ghost → P0
```

## 限额

```text
#INF-Q01 [新建限额修订] ·primary · enable: quota.write
#INF-Q02 [保存] ·primary · loading
#INF-Q03 [查看 Events] ·ghost · 预筛 quota.exhausted
```

## 护栏

```text
#INF-G01 [新建护栏修订] ·primary
#INF-G02 行 → Detail
#INF-G03 [保存修订] ·primary · loading
```

## 诊断

```text
#INF-D01 Tabs [健康|失败|契约|试探] ·tab
#INF-D02 correlation 筛选 ·field
#INF-D03 [示例 Request|Response] ·ghost · 只读抽屉
#INF-D04 试探路由 ·select
#INF-D05 试探输入 ·textarea · 不入库说明可见
#INF-D06 [发送试探] ·primary
      enable: 路由已选 && 有 probe 权限
      confirm「将产生一笔真实试探（不计持久 prompt；可能计入用量）」
      loading「发送中」
#INF-D07 [打开 API 文档] ·ghost
```

## Inference · 用量页签

```text
#INF-U01 维度 chips ·chip
#INF-U02 [导出] ·secondary → Operation
#INF-U03 [打开完整用量] ·secondary → /usage 预填
```

---

## Usage（P4）

```text
#USE01 维度 chips ·chip
#USE02 时间窗 ·select
#USE03 行下钻 ·ghost
#USE04 [导出 CSV] ·secondary → Operation Toast
#USE05 Toast [查看] ·ghost → /ops/:id
#USE06 [打开客户] ·ghost · enable: Org 已绑定客户
#USE07 [完整客户用量] ·ghost
#USE08 完整性徽章 ·tooltip（延迟/缺口说明）
```

**禁止控件（不得出现）：** `#PAY*` 充值/余额/发票/结算。

---

## Customers · 用量桥

```text
#CU07 [完整用量] ·ghost → Usage 预填 Org   （保留）
#CU09 用量页签 ·tab
#CU10 [打开 Usage 下钻] ·ghost
#CU11 套餐字段编辑 ·field · 写商业投影非 ledger
```

---

## 状态矩阵（摘要）

| 控件 | disable 条件 | loading | confirm |
| --- | --- | --- | --- |
| 发布/保存类 | 无写权限 / 校验失败 / 非 dirty | 是 | 退役/吊销/试探/关闭 reveal |
| 试探 | 无路由或无 probe | 是 | 是 |
| 导出 | 无 export 或时间窗非法 | 提交后 Toast | 否 |
| 充值等 | — | — | **不实现** |
