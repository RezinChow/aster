# PRD — 渠道管理（OEM）

| 字段 | 值 |
| --- | --- |
| 产品 | Kense OS Console · 渠道管理 |
| 版本 | Design target v1 |
| 形态 | **仅 OEM 白标渠道**（不做省/市地理代理） |
| 对照 | Customers · 品牌设置 · Identity |
| 状态 | Draft for implementation |
| 相关 | [wireframes/channels.md](../wireframes/channels.md) · [button-level/08-channels](../wireframes/button-level/08-channels.md) |

---

## 1. 问题与目标

**问题：** 平台需发展白标 / OEM 伙伴，以对方品牌转售或嵌入能力；缺与 Org、品牌、凭证、客户归属对齐的运营面。  
**目标：** Console 提供 **渠道管理**：平台开通 OEM、配置品牌与边界、客户归属与用量可审计。

**明确不做：** 省代、市代、区县代及任何行政区划独占渠道。

**成功标准：**

1. 平台可创建 / 冻结 / 归档 OEM；每个 OEM 绑定恰好一个主 Organization。  
2. OEM 可配置展示品牌（名称 · Logo · 可选主色/登录域备注）。  
3. 客户归属二选一：`direct`（平台直客）· `oem`；变更可审计。  
4. OEM Admin 仅见本渠客户与自身详情。  
5. 变更写 Audit / Operation。

---

## 2. 领域模型

```text
Installation
  ├─ OemPartner（渠道伙伴）
  │     org_id · owner · brand · credentials
  └─ Customers
        channel = none（直客）| oem_id
```

| 概念 | 权威 | Console |
| --- | --- | --- |
| OEM / 渠道伙伴 | 控制面 OemPartner | List / 向导 / Detail |
| 品牌包 | OEM 作用域配置 | 预览 + 保存修订 |
| 渠道凭证 | Identity credentials | 一次性明文创建 |
| 客户归属 | Customer.channel_ref | 徽章 + 划转 |
| 分润结算 | 外部商业 | **OOS** |

**不变量：** 不复制授权引擎；不做地理代理树；无分润提现台。

---

## 3. 角色

| 角色 | 导航 | 可做 | 不可做 |
| --- | --- | --- | --- |
| Platform Admin | 渠道全量 | CRUD、冻结、归档、划转客户 | — |
| OEM Admin | 本渠 Detail + 本渠客户 | 品牌（若授权）、本 Org 成员/客户 | 建其他 OEM |
| Viewer | 只读授权范围 | — | 写 |

Permission 示意：`oem.read` / `oem.write` / `oem.brand.write` / `oem.credential.write`

---

## 4. 导航

ActivityBar **商业** 领域侧栏：

```text
商业
  ├─ 客户
  └─ 渠道     （本 PRD · OEM 伙伴）
```

路由建议：`/channels`（UI 文案「渠道」；实体为 OEM）。

---

## 5. 需求明细

### 5.1 目录 CH-L

| ID | 需求 | 优先级 |
| --- | --- | --- |
| CH-L1 | List：名称、code、状态、客户数、套餐摘要、Owner | P0 |
| CH-L2 | 搜索 + 状态 chips（生效/冻结/已归档） | P0 |
| CH-L3 | 空态 CTA「开通渠道」 | P0 |

### 5.2 开通向导 CH-W

| ID | 需求 | 优先级 |
| --- | --- | --- |
| CH-W1 | 资料（名称·code）→ Org → Owner → 品牌初值（可跳过）→ 确认 | P0 |
| CH-W2 | code 全局唯一校验 | P0 |
| CH-W3 | 提交 → Operation + Owner 邀请 | P0 |

### 5.3 Detail CH-D

| ID | 需求 | 优先级 |
| --- | --- | --- |
| CH-D1 | Tabs：概览 · 品牌 · 凭证 · 客户 · 成员 · 用量 · 合同 · 审计 | P0 |
| CH-D2 | 品牌：名称、Logo、预览；保存=修订 | P0 |
| CH-D3 | 凭证：渠道 Key；一次性 reveal；吊销 | P1 |
| CH-D4 | 客户表 + 平台「划转客户入渠」 | P0 |
| CH-D5 | 用量投影 + 深链 Usage | P1 |
| CH-D6 | 冻结 / 解冻 / 归档 | P0 |

### 5.4 客户归属 CH-X

| ID | 需求 | 优先级 |
| --- | --- | --- |
| CH-X1 | 客户 Detail 徽章：直客 / 渠道（OEM 名） | P0 |
| CH-X2 | 平台变更归属：直客 ↔ OEM；confirm + Audit | P1 |

### 5.5 审计 CH-A

| ID | 需求 | 优先级 |
| --- | --- | --- |
| CH-A1 | 开通、品牌、冻结、划转、凭证吊销进 Audit | P0 |

---

## 6. 状态机

```text
active ──freeze──► frozen ──unfreeze──► active
   │                  │
   └──archive─────────┴──► archived
```

v1：冻结后默认 **禁止** 划入新客户。

---

## 7. 屏幕

| ID | 名称 |
| --- | --- |
| CH-LIST | 渠道目录 |
| CH-WIZ | 开通向导 |
| CH-DETAIL | 详情 |
| CUS-CHANNEL | 客户渠道徽章与变更归属 |

---

## 8. 里程碑

| 里程碑 | 交付 |
| --- | --- |
| C0 | 导航 + List/Detail mock |
| C1 | 开通向导 + 冻结 + 归属只读 |
| C2 | 品牌 + 凭证 + Audit |
| C3 | 划转 + Usage 桥接 |

---

## 9. Out of scope

- 省 / 市 / 区县地理代理  
- OEM 下级 OEM / 分销树  
- 分润、返佣、提现、发票台  
- 多 Installation 独立 OEM 集群（v1 同安装内 Org 隔离）  

---

## 10. 验收

- [ ] 平台开通渠道 → OEM Owner 仅见本渠  
- [ ] 品牌保存后壳预览一致  
- [ ] 客户归属仅为直客或单一 OEM  
- [ ] 无任何省/市代理入口  
- [ ] 控件对齐 [08-channels](../wireframes/button-level/08-channels.md)  
