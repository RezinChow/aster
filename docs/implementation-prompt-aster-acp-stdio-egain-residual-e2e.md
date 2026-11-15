# Aster ACP stdio EAGAIN 残留面：端到端执行提示词

状态：主战役 EAGAIN E2E 已 PASS；本文件是**残留面**（客户端真管道 /
共享测试客户端 / 示例 / 薄回归）的权威执行合同。日期基线：2026-11-15。

工作目录：Aster 仓库根。**直接把本文交给执行智能体。**  
不要重做已通过的主战役全套（E1/E2/P2-B/P4），除非 R0/R3 证明回退。  
不要发明仓库中不存在的二进制。

## 0. 权威与参考

| 文档 | 角色 |
| --- | --- |
| **本文** | 执行合同 |
| `docs/evidence/code/2026-11-15-acp-stdio-egain-residual/E2E-TEST-PLAN.md` | 用例矩阵 |
| `docs/evidence/code/2026-11-15-acp-stdio-egain/E2E-OUTCOME.md` | 主战役 PASS（勿重复宣称未跑） |
| `docs/evidence/code/2026-11-15-acp-stdio-egain/OUTCOME.md` | 产品修复 |
| `docs/implementation-prompt-aster-acp-stdio-egain-e2e.md` | 主战役执行合同（对照） |
| `crates/terminal/crates/codegen/aster-test-support/src/acp_agent_connection.rs` | 共享客户端（应已包 RetryTransient） |
| `crates/code/acp/examples/interactive_client.rs` | 示例残留（R4） |

伴生目录：

```text
.runtime/tui-full-e2e/acp-stdio-egain-residual-YYYYMMDD/
  bins/  evidence/  logs/  …
```

可复用主战役 `drive_stdio_egain.py`（P2-A / E3），勿污染主战役证据树。

## 1. 必须完成

| ID | 目标 | 完成标准 |
| --- | --- | --- |
| R0 | 静态产品不变量 + 残留清单 | 产品站点无 MISS；残留列表落盘 |
| R1 | `transient_io` hermetic | 5 PASS；helper 未改则 R1-C SKIP |
| R2 | 客户端真管道背压 A/B | PASS |
| R3 | 薄回归 P2-A + E3 | PASS |
| R5 | `E2E-OUTCOME.md` + 短报 | 未提交 |

R4 默认 SKIP。

**Out of scope**

- Studio；主战役全量重跑；改完所有 duplex 单测；提交/推送。

## 2. 约束

- 本 checkout 重建 `aster`+`aster-acp`；BUILD_ID 成对。
- 产品站点 MISS → 先接线 `RetryTransient*` 再测（小范围，勿借机大重构）。
- 共享测试客户端若对真 `ChildStdin`/`ChildStdout` 裸 `compat_*`：本轮应包上后再跑 R2。
- GUI：应用名 `终端`；mock ACL；`ASTER_DISABLE_*_ACCOUNT=1`。
- 产品 FAIL 不停改 oracle。

## 3. R0 静态审计

对下列路径扫 `*SideConnection::new`，要求同文件含 `RetryTransient`：

- `crates/code/acp/src/bin/`
- `crates/terminal/crates/codegen/aster-pager/src/acp/`（非 tests）
- `crates/terminal/crates/codegen/aster-shell/src/`（排除 `*_tests.rs`、`testkit`）
- `crates/terminal/crates/codegen/aster-test-support/src/`

写入 `r0-product-sites.txt` / `r0-residual-sites.txt`（tests/examples 未包列表）。

## 4. R1 Hermetic

```sh
cargo test --locked -p aster-acp-lib --lib transient_io -- --test-threads=1
```

若改了 `aster-test-support` 等：聚焦 test + `clippy --no-deps`。

## 5. R2 客户端真管道

1. 确认 `aster-test-support` `AgentConnection::connect` 已 `RetryTransient*`。
2. 驱动：Client 连 staged `aster-acp`；慢读 agent stdout；客户端持续写请求。
3. R2-A：无客户端/agent 致命 `os error 35` stdio；恢复后一轮 RPC 成功。
4. R2-B：peer 关闭后须见 Broken pipe 类错误（允许进程仍短暂存活，同主战役 P2-B 口径）。

## 6. R3 薄回归

```sh
python3 drive_stdio_egain.py p2a   # 或 residual 副本
python3 drive_stdio_egain.py e3
```

bins = 本轮 staged。E3 须 history 含 `Agent connection closed` + 日志提示。

## 7. R4 / R5

- R4：默认 SKIP；点名再跑示例 / live_* / 安装通道。
- R5：写入

```text
docs/evidence/code/2026-11-15-acp-stdio-egain-residual/E2E-OUTCOME.md
```

短报用规划 §7 模板。

## 8. 通过定义

与规划 §5 一致。主战役已 PASS **不能**代替 R0-A / R2 / R3。

## 9. 完成检查清单

- [ ] R0 产品无 MISS；残留清单已写
- [ ] R1-W 绿
- [ ] R2-A/B 有命令与日志摘录
- [ ] R3-P2A、R3-E3 绿
- [ ] R4 SKIP 已披露
- [ ] `E2E-OUTCOME.md` + 短报；未提交

执行后向用户给短报与 OUTCOME 路径。
