# 按钮级线框 — 渠道管理（OEM）

规范见 [00-spec.md](./00-spec.md)。  
覆盖 [prd/07-channels.md](../../prd/07-channels.md)。

---

## 导航

```text
#CH-N01 侧栏 [渠道] ·ghost → /channels
```

---

## List

```text
#CH01 [导出] ·secondary
#CH02 [开通渠道] ·primary · enable: oem.write
#CH03 搜索 ·field
#CH04 状态 chips ·chip
#CH05 行 ·ghost → Detail
```

---

## 开通向导

```text
#CH-W01 显示名 ·field
#CH-W02 Code ·field · 唯一校验
#CH-W03 Org 模式 ·radio
#CH-W04 Owner 邮箱 ·field
#CH-W05 品牌 [上传] ·secondary
#CH-W06 [跳过品牌] ·ghost
#CH-W07 [取消] ·ghost · confirm if dirty
#CH-W08 [上一步]/[下一步]
#CH-W09 [开通] ·primary · loading → Toast op_
```

---

## Detail

```text
#CH-D01 Tabs [概览|品牌|凭证|客户|成员|用量|合同|审计] ·tab
#CH-D02 [冻结] ·danger · confirm
#CH-D03 [解冻] ·secondary · enable: frozen
#CH-D04 [归档] ·danger · confirm
#CH-D05 [打开组织] ·ghost

#CH-B01 品牌字段 …
#CH-B02 [保存修订] ·primary · loading
#CH-B03 [丢弃] ·ghost · confirm if dirty

#CH-K01 [创建渠道 Key] ·primary
#CH-K02 Reveal 复制/下载/关闭 · 同凭证不变量
#CH-K03 [吊销] ·danger · confirm

#CH-C01 [划转客户入渠] ·secondary · enable: 平台
#CH-C02 Modal 确认划转 ·primary · confirm
#CH-C03 [完整用量] ·ghost → /usage
```

---

## 客户归属

```text
#CUS-CH01 渠道徽章 ·ghost → 渠道 Detail
#CUS-CH02 [变更归属] ·secondary · enable: 平台
#CUS-CH03 [确认变更] ·primary · confirm
```

---

## 禁止

```text
省/市代理相关控件 — 不实现
分润/充值/结算 — 不实现
```
