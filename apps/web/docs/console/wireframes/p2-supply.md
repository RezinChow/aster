# Wireframes — P2 供给与 CI/CD


> **交付切片线框**（非 ActivityBar 域名）。导航权威：[shell.md](./shell.md) · [SIDEBAR.md](../SIDEBAR.md) · `destinations.ts`。


## W-P2-1 Sources

```text
Sources                              [连接 Git]

│ 提供商 │ 账户/安装      │ Webhook │ 仓库数 │ 状态 │
│ GitHub │ orbit-labs     │ ok      │ 12     │ ready│

仓库订阅：
│ org/repo        │ 默认分支 │ 最近修订     │
│ orbit/platform  │ main     │ abcdef1 2h前 │

修订浏览器：
abcdef1  message…  [复制 digest] [用于 Pipeline]
```

## W-P2-2 Artifacts

```text
Artifacts
│ BuildRun │ Source dig │ 状态    │ 签名 │ 保留至 │
│ br_102   │ abcdef1    │ success │ ok   │ 2027-01│

Manifest 面板：
layers / size / provenance / sbom 链接
[部署到 Workload] [打开 Pipeline]
```

## W-P2-3 PipelineRun 时间线

```text
Pipelines / release-prod / run_551
Artifact digest abcdef1（不可变）

● Trigger        完成  14:00
● Build          完成  14:06   br_102
● Verify         完成  14:10   attestations ✓
● Approval       等待  ──      [批准] [驳回]
○ Deploy staging
○ Promote prod
○ Observe gate

右侧：策略摘要 · 禁止重建说明
「晋级使用同一 Artifact，不会重新构建。」
```

## W-P2-4 Registries

```text
包目录     [Agent|Function|MCP|Skill|Connector]
[搜索]

│ 包名           │ 最新版本 │ 信任 │ 扫描 │
│ hub-mcp/docs   │ 1.4.2    │ ok   │ pass │

详情：
版本列表 · 授权范围 · [安装到当前 Env]
```

## W-P2-5 Models

```text
模型供给
│ Model      │ Revision │ 许可证 │ 信任 │ 权重 digest │
│ a3s-l2   │ 2026.09  │ Apache │ ok   │ sha256:…   │

[绑定到 Inference 路由]
Hub 解析：ModelScope · 上次同步 3h 前
```
