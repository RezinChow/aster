# 按钮级线框 — 能力市场（API Marketplace）

规范见 [00-spec.md](./00-spec.md)。  
覆盖 [prd/08-marketplace.md](../../prd/08-marketplace.md) · [marketplace.md](../marketplace.md)。

---

## 导航

```text
#MKT-N01 侧栏 [市场] ·ghost → /marketplace
#MKT-N02 Tabs [浏览|Provider|密钥|用量] ·tab  ※「已开通」= 侧栏 /marketplace/entitled，非本 Tab
```

---

## 浏览

```text
#MKT-B01 [添加 Provider] ·secondary · enable: market.provider.write
#MKT-B02 [创建 Key] ·primary · enable: credential.capability.write
#MKT-B03 搜索 ·field
#MKT-B04 Kind chips ·chip
#MKT-B05 Provider chips ·chip
#MKT-B06 开通状态 chips ·chip
#MKT-B07 [卡片|表格] ·chip 视图切换
#MKT-B08 卡片/行 ·ghost → Listing Detail
#MKT-B09 卡片 [开通] ·primary · enable: market.entitle.write ∧ 未开通
#MKT-B10 卡片 [已开通] ·ghost → Detail（或侧栏「已开通」列表）
```

---

## Listing Detail

```text
#MKT-D01 Tabs [概览|契约|标价|用量|审计] ·tab
#MKT-D02 [开通] ·primary · enable: 未开通 ∧ entitle.write
#MKT-D03 [停用] ·danger · enable: 已开通 ∧ entitle.write
         confirm: 「停用后新调用将被拒绝。进行中的 Run 不会自动取消。」
#MKT-D04 [试探] ·secondary · enable: market.probe
         disable write-listing: 无 market.probe.write → Tooltip
#MKT-D05 上游文档 ·ghost 外链
#MKT-D06 打开 Inference 路由 ·ghost · enable: kind=model ∧ 已开通
#MKT-D07 打开 Registry 包 ·ghost · enable: kind=skill
```

---

## 开通抽屉

```text
#MKT-E01 Env ·select · 默认当前 Shell Env
#MKT-E02 [打开限额] ·ghost → Inference 限额
#MKT-E03 ToS 勾选 ·checkbox · 必勾才可提交
#MKT-E04 [取消] ·ghost · confirm if dirty
#MKT-E05 [确认开通] ·primary · loading → Toast op_ · enable: 勾选∧entitle.write
```

---

## 已开通

```text
#MKT-A01 [同步目录] ·secondary · enable: market.provider.write ∨ entitle.write
#MKT-A02 [批量停用] ·danger · enable: 多选≥1 ∧ entitle.write · confirm
#MKT-A03 行菜单 [停用] ·menuitem ·danger · confirm
#MKT-A04 行菜单 [打开 Inference] ·menuitem · enable: model
#MKT-A05 行 ·ghost → Detail
```

---

## Provider

```text
#MKT-P01 [添加 Provider] ·primary · enable: market.provider.write
#MKT-P02 行 ·ghost → Provider Detail

#MKT-W01 模板卡 ·chip/card 单选
#MKT-W02 Base URL / MCP endpoint ·field
#MKT-W03 上游凭证 ·secret-field → Secrets（不回显）
#MKT-W04 [测试连接] ·secondary · loading
#MKT-W05 同步范围 ·radio 全量|allowlist
#MKT-W06 allowlist 多选/上传 ·field · enable: allowlist 模式
#MKT-W07 Kind 过滤 ·chip 多选
#MKT-W08 [取消]/[上一步]/[下一步]
#MKT-W09 [添加并同步] ·primary · loading → op_ · Provider Detail

#MKT-PD01 [同步] ·secondary · loading
#MKT-PD02 [停用 Provider] ·danger
         confirm: 「将停用其下 N 条已开通 Listing，新调用将被拒绝。」
#MKT-PD03 Tabs [概览|适配器|目录|凭证|同步日志|审计] ·tab
```

---

## 试探

```text
#MKT-X01 Key ·select · 本 Env 有效 Capability Key
#MKT-X02 参数表单 ·fields（按 schema）
#MKT-X03 [发送试探] ·primary · loading · enable: probe 权限∧ Key 已选
#MKT-X04 结果 JSON ·readonly
```

---

## 密钥 / 用量

```text
#MKT-K01 [创建 Key] ·primary · 同 Inference 密钥向导；可勾选 Market 调用
#MKT-K02 [吊销] ·danger · confirm · 明文不回显不变量

#MKT-U01 Provider/Listing 筛选 ·chip
#MKT-U02 [打开完整 Usage] ·secondary → /usage?source=market
#MKT-U03 导出 ·secondary · enable: usage.export
```

---

## 全局

```text
提交类按钮失败 → Toast 错误 + 按钮恢复；成功必须带 Operation ID 或深链。
无权限：隐藏主 CTA，不留「点了 403」。
```
