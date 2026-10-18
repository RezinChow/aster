# 按钮级线框 — P3 Workloads · Fleet · Edge

## Workloads

```text
#WL01 [新建工作负载] ·primary → 向导（Source/Agent/OCI）
#WL02 [扩缩] ·secondary → 副本输入 Modal
      #WL02a [应用] ·primary · loading
#WL03 [回滚] ·secondary → 选 revision
      confirm: 「回滚到 rN」
#WL04 [暂停] ·danger · confirm
#WL05 [恢复] ·primary · enable: paused
#WL06 Tabs [概览|修订|部署|事件|访问]
#WL07 [查看 Edge 目标] ·ghost
#WL08 [打开 Pipeline receipt] ·ghost
#WL09 修订行 [设为当前] ·row · confirm
```

## Fleet

```text
#FL01 [排水] ·danger
      → 预检 Modal 列出受影响 Workload 数
      confirm primary「开始排水」
#FL02 [结束排水] ·primary · enable: draining
#FL03 [维护窗口] ·secondary → 时间范围表单
#FL04 [取消维护] ·ghost
#FL05 NodePool [编辑容量策略] ·secondary · platform only
#FL06 [查看放置失败] ·ghost → Drawer 可读原因
```

## Gateway / Edge

```text
#ED01 Tabs [域名|路由|快照]
#ED02 [添加域名] ·primary
#ED03 [续期/查看证书] ·secondary
#ED04 [发布快照] ·primary · loading
      enable: 有未应用意图 diff
#ED05 [查看快照差异] ·secondary · enable: 意图≠已应用
#ED06 路由 [修订] ·row
#ED07 路由 [退役] ·danger · confirm
#ED08 [打开 Inference 策略] ·ghost
#ED09 快照历史行 [回滚到此快照] ·danger · confirm
```
