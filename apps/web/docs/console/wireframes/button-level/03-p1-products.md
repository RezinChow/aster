# 按钮级线框 — P1 产品泳道

## 通用 List

```text
#L01 [次要 CTA] ·secondary（如导出/审计）
#L02 [主 CTA 新建…] ·primary · enable: write 权限
#L03 搜索 ·field
#L04 状态 chips ·chip
#L05 行主链接 ·ghost → Detail
#L06 [更多] ·row → 启停/删除等
```

## Agents

```text
#AG01 [新建 Agent] ·primary → 创建向导
#AG02 Tabs [概览|修订|执行|访问]  ※ 审批 → 深链 /tasks
#AG03 [通过] ·primary（/tasks 收件箱） · loading
#AG04 [拒绝] ·danger · 需填写原因 textarea 才 enable
#AG05 [Fork Checkpoint] ·secondary · confirm「基于该检查点新建执行」
#AG06 [打开 Workload] ·ghost → Workload Detail
```

## Workflows / Runs

```text
#WF01 [定义|运行] ·tab
#WF02 [重放] ·secondary
      enable: run 可重放；confirm「从失败步继续，已完成步将跳过」
#WF03 [取消] ·danger · confirm
#WF04 [打开 HumanTask] ·primary · enable: 当前 await human
#WF05 HumanTask [提交] ·primary · enable: 表单校验通过
#WF06 [查看修订 diff] ·ghost
```

## Functions

```text
#FN01 [新建 Function] ·primary
#FN02 [手动触发] ·primary → 面板
#FN03 [调用] ·primary · loading「调用中」· 展示 idempotency key
#FN04 [复制响应] ·ghost
```

## Durable Cells

```text
#CE01 [休眠] ·secondary · confirm「将断开协作写者」
#CE02 [唤醒] ·primary · enable: hibernating
#CE03 [打开备份 Operation] ·ghost
```

## Inference

基线 ID 保留；**完整按钮级（策略/访问/限额/护栏/诊断等）**见 [07-inference-usage.md](./07-inference-usage.md)。

```text
#IN01 Tabs（扩为 概览|路由|策略|密钥|访问|限额|护栏|诊断|用量）·tab
#IN02 [发布路由] ·primary
#IN03 [修订] ·secondary
#IN04 [退役] ·danger · confirm「退役后流量失败关闭」
#IN05 [创建推理 Key] ·primary → 一次性明文流程同 #K03–#K05
#IN06 用量维度 chips ·chip
#IN07 [导出] ·secondary → Operation
```

## Applications / Web

```text
#AP01 [新建应用] ·primary
#AP02 [切到 rN 回滚] ·danger/secondary
      confirm: 「将 100% 流量切到 rN」
#AP03 [打开预览] ·ghost · target=_blank
#AP04 [复制 URL] ·icon
```
