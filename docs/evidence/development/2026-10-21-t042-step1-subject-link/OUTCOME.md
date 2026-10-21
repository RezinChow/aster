# T0.4.2 runbook step 1 — SubjectLink create/resolve first execution (2026-10-21)

| Field | Value |
| --- | --- |
| Task | specs/005 T015（步骤 1 切片）；convergence WS0.4 / T0.4.2 |
| Result | **步骤 1 执行并证明**：建链 201 → 解析 200（principalId 一致）→ 负控 404（denied ≡ missing）。前置 1 的环境半边（迁移 PG + api role + 对象存储）跑通。步骤 4–6 仍卡 D-A。 |
| Canonical retention | 完整 e2e 的权威 OUTCOME 仍按 runbook 落 cloud 侧 `docs/evidence/governance/`；本文件是 aster 侧步骤 1 切片记录（子模块内容走上游）。 |

## 执行链（全部 2026-10-21T14:0xZ，真实 PG + 真实 api 进程）

1. **栈**：box compose（`deploy/dev/compose.acl`，PG :54320 + registry :50020；
   引导链自 forensics 修复后稳定）+ docker `a3s-rustfs`（:9000）。
2. **库**：scratch `a3s_cloud` 重建 → `a3s-cloud-migrate` 全量 278 + flow + boot
   迁移 + serving access reconciled。
3. **api**：`a3s-cloud-control-plane`（本地 ACL：S3 端点改 127.0.0.1:9000、
   node-control 8443→8444 避让用户在跑实例；bootstrap/webhook token 随机）。
4. **API 链**（凭据已按 runbook 语义轮换，以下为节录）：
   - `POST /bootstrap`（header x-a3s-bootstrap-token=env 令牌；body.token=
     新建管理令牌 `a3s_`+64hex）→ 201：org `01a15ec9-…5248`、机器 principal。
   - `POST /organizations/{org}/memberships` `{principalKind:"human",role:"member"}` →
     201：human principal `01a15eca-9f77-763d-b599-fd6f399055c9`。
   - `POST /organizations/{org}/partner-subject-links`
     `{issuer:"https://auth.a3s.internal", principalId:<human>, providerKey:
     "partner-a3s-directory", subject:<uuid>}` → **201**（linkId
     `01a15eca-a184-…`）。
   - `GET …/partner-subject-links/resolve?providerKey=partner-a3s-directory&
     issuer=…&subject=…` → **200**，`data.principalId` == 上述 human
     principal——**runbook 步骤 1 的判据满足**。
   - 负控：resolve 未知 subject → **404 "partner subject link was not
     found"**（denied 与 missing 不可分，与步骤 5 要求的形状一致）。

## runbook 首执行修订（供步骤 4–6 前的文本更新；上游 PR 队列）

1. **步骤 1 前置**：SubjectLink 的 principalId 必须是**活跃 human
   principal**（bootstrap 产出的是机器 principal；`POST memberships
   {principalKind:"human"}` 可直建）。
2. **issuer 校验**：link/resolve 的 issuer 必须是**有界规范 HTTPS URL**
   （域层 fail-closed；`http://127.0.0.1:7641` 被 422 拒绝）。本地 a3s-auth
   的 issuer 标识符必须是 `https://…` 形式——与 D-A 的私有 CA 准入直接
   相邻（标识符面 + 信任面两层）。
3. **bootstrap 语义**：body.token 是**要创建的管理令牌**（`a3s_`+64hex），
   env 引导令牌走 header；平台仅可 bootstrap 一次（409），凭据须当场留存。
4. **run_cloud.sh 缺口（dev 工具债，记上游）**：box 路径未导出 S3 凭据
   （`A3S_CLOUD_S3_*`）、dev ACL 的 `host.orb.internal` 端点在 host-run 下
   不解析（cloud-up.sh 的 sed 生成模式是正解）、node-control 8443 与在跑
   实例冲突时无避让。

## 显式不声明

- 步骤 4–6（Cloud 侧 OIDC 发现/解析、撤回负控、恢复）未执行：本地 issuer
  需 D-A（私有 CA 准入）。T0.4.2 保持 open。
- 未配置 C0.3 a3s-auth issuer（precondition 1 的 issuer 半边随 D-A）。
- 步骤 2–3 已由 2026-10-20 交付（成员面 e2e）；本切片不重复。
- 单工作站、单主体、无性能/规模声明；compose 栈与 api 已拆（恢复步骤
  如上，migrate 为 reconcile 幂等）。
