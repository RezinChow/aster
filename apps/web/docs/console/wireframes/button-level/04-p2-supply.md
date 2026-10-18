# 按钮级线框 — P2 供给与 CI/CD

## Sources

```text
#SRC01 [连接 Git] ·primary → OAuth/App 安装引导
#SRC02 [管理 Webhook] ·secondary
#SRC03 [订阅仓库] ·primary · enable: 连接 ready
#SRC04 [复制 digest] ·icon
#SRC05 [用于 Pipeline] ·secondary → 预填 Pipeline 触发表单
#SRC06 Webhook 日志 [重放投递] ·row · enable: failed
```

## Artifacts

```text
#ART01 [打开 BuildRun] ·ghost
#ART02 [复制 digest] ·icon
#ART03 [部署到 Workload] ·primary → 选择 Env/Workload 向导
#ART04 [打开 Pipeline] ·secondary
```

## Pipelines

```text
#PIP01 [新建 Pipeline] ·primary
#PIP02 [手动触发] ·primary · enable: 定义有效
#PIP03 [批准] ·primary · enable: 当前阶段=Approval && 我是审批人
#PIP04 [驳回] ·danger · 必填原因
#PIP05 [晋级] ·primary · enable: Observe gate 通过
      → Toast + Operation；文案固定提示「不重建 Artifact」
#PIP06 [回滚到先前 Release] ·danger
      confirm: 选择目标 release + 「确认回滚」
#PIP07 [取消 Run] ·danger · confirm
```

## Registries

```text
#REG01 类型 Tabs ·tab
#REG02 [搜索] ·field
#REG03 [安装到当前 Env] ·primary
      enable: Env 已选 && 信任=ok
      disable: 扫描 fail → Tooltip「扫描未通过」
#REG04 [查看信任策略] ·ghost
```

## Models

```text
#MOD01 [同步 Hub] ·secondary · loading「同步中」
#MOD02 [绑定到 Inference 路由] ·primary → 选择/创建路由
#MOD03 [复制权重 digest] ·icon
#MOD04 [查看许可证] ·ghost → Drawer
```
