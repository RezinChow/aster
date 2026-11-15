# Aster CLI 0.3.7 发布后端到端回归 执行提示词

状态：`aster-cli-v0.3.7` 已发布且 `aster-cli-stable→0.3.7`；战役 CLOSED-PASS，但**通道安装 pair 上的断连矩阵尚未按全核重跑**（Phase 8 仅 V1）。  
本文件是**发布后 E2E**权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**

> **授权边界：** 执行本提示词 = 授权按 `E2E-TEST-PLAN.md` 跑 **P0+P1+P2+P5**，写 OUTCOME，docs commit + push。  
> **P3 薄长程 / P4 wire** 默认 SKIP，须点名。  
> 不用 Studio。密钥不进证据。禁止用 `target/debug` 冒充 stable 安装通过。

| 文档 | 角色 |
| --- | --- |
| **本文** | 执行合同 |
| `docs/evidence/code/2026-11-15-cli-0.3.7-post-release-e2e/E2E-TEST-PLAN.md` | 用例权威定义 |
| `docs/evidence/code/2026-11-15-cli-0.3.7-acp-9.2.5-release/OUTCOME.md` | 已发布 |
| `.runtime/…/drive_connection_recovery.py` | GUI 驱动（私有） |

---

## 1. 必须 / 可选

| ID | 完成标准 |
| --- | --- |
| **P0** | stable=0.3.7；安装 path 成对 0.3.7/9.2.5；BUILD_ID 一致 |
| **P1** | utf8 + transport PASS（或无源码 BLOCKED） |
| **P2** | V1→V3→V2→V5→V4；bins 源自安装路径 |
| **P5** | OUTCOME + 短报 + push |
| **P3/P4** | 默认 SKIP |

通过判定见计划 §5。

---

## 2. 约束摘要

- 伴生 `bins/` ← `cp` 自 `$(command -v aster)` / `aster-acp`，provenance 落盘。  
- Oracle：history > 文件字节 > mock 计数 > PNG。  
- 产品 FAIL 不停改 oracle；额度 BLOCKED。  
- `.runtime/` 不提交。

---

## 3. 短报模板

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

## 4. Explicitly not claimed

- Studio；全量 shipped_tui；完整长程再战役；delayed_catalog 已修；非 Darwin GUI。
