# Aster

**Rust 编写的智能体执行内核与终端编程工具。**

Aster 连接你配置的模型，在项目中读取文件、修改代码并调用工具。
权限策略控制执行，事实日志记录过程，验证证据约束任务何时可以完成。
你可以直接使用 Aster CLI，也可以把内核嵌入自己的 Rust 应用。

[下载官网](https://aster-ai-lab.github.io/aster/) · [开始使用](#开始使用) · [运行机制](#运行机制) · [当前限制](#当前限制) · [参与开发](#参与开发)

## 从一个任务开始

在项目目录启动 Aster，输入你的目标，例如：

```text
修复配置解析的边界错误，只修改相关文件。
先说明计划，再完成修改并运行相关测试。
最后列出改动、验证结果和仍未解决的问题。
```

完成编程任务，需要把模型的建议接入实际执行，并保留可检查的结果：

| 任务中的问题 | Aster 的处理方式 |
| --- | --- |
| 哪些操作可以执行？ | 工具调用先经过权限判定，需要确认时等待用户回答。 |
| 执行过什么、结果如何？ | 模型、工具和控制事件写入同一份事实日志。 |
| 修改是否满足完成条件？ | 内核检查对应本次修改的验证报告，或宿主显式豁免，再判定能否完成。 |

## 开始使用

### 1. 下载 CLI

从 [Aster CLI v0.1.1 发布页](https://github.com/aster-ai-lab/aster/releases/tag/aster-cli-v0.1.1)下载对应系统的归档：

| 系统 | 下载 |
| --- | --- |
| macOS | [macOS 归档](https://github.com/aster-ai-lab/aster/releases/download/aster-cli-v0.1.1/aster-cli-v0.1.1-macos.tar.gz) |
| Linux | [Linux 归档](https://github.com/aster-ai-lab/aster/releases/download/aster-cli-v0.1.1/aster-cli-v0.1.1-linux.tar.gz) |
| Windows | [Windows 归档](https://github.com/aster-ai-lab/aster/releases/download/aster-cli-v0.1.1/aster-cli-v0.1.1-windows.zip) |

解压后，将 `aster` 和 `a3s-code-acp` 放在同一目录；Windows 对应两个 `.exe` 文件。
CLI 默认启动同目录的 ACP 伴随进程。需要指定其他位置时，设置 `A3S_ACP_AGENT_BIN`。

该版本为未签名构建。当前自动安装脚本与该旧发布包存在兼容问题，请先手动解压安装。

### 2. 配置模型

创建或编辑 `~/.a3s/config.acl`。以下示例使用 OpenAI 兼容接口，
请把接口地址和 `your-model` 替换为服务实际提供的值：

```acl
default_model = "openai/your-model"

providers "openai" {
  base_url = "https://your-api.example/v1"
  api_key = env("OPENAI_API_KEY")
  models "your-model" {}
}
```

密钥通过环境变量提供。更多配置见 [ACL 示例](crates/code/agent.example.acl)；
`A3S_CONFIG` 可以指定其他配置文件，终端内的 `/config` 用于管理模型配置。

### 3. 启动项目

在解压目录执行，并将项目路径替换为实际路径。

macOS / Linux：

```sh
export OPENAI_API_KEY="你的 API 密钥"
./aster --cwd /path/to/project
```

Windows PowerShell：

```powershell
$env:OPENAI_API_KEY = "你的 API 密钥"
$env:A3S_CONFIG = Join-Path $HOME '.a3s/config.acl'
.\aster.exe --cwd C:\path\to\project
```

需要在任意目录使用 `aster` 时，将两个程序所在目录加入 `PATH`。

### 更新与卸载

更新时下载新的发布归档，并一起替换同目录的两个程序。
卸载时删除这两个程序即可；`~/.a3s` 中的本地配置与数据可保留。

## 运行机制

Harness 负责把模型调用接入一个受控的任务过程。
Aster 的 **Meta Harness** 允许 Rust 宿主组合系统指令、工具、预算、上下文压缩和调度组件，
同时由内核维持权限与完成条件。

```text
用户任务 → 模型提案 → 权限判定 → 工具执行 → 结果记入事实日志
                          │                         │
                          └─ 等待确认或拒绝          └─ 更新上下文，继续执行

发生修改 → 收集与本次修改对应的验证证据 → 完成判定
```

组件根据事实日志计算状态和下一步可执行操作。需要确认或补充信息时，
运行等待对应回答；计时器不能代替用户授权。
事实重放用于恢复控制状态，外部副作用的崩溃恢复仍需单独验证。

进一步阅读：

- [Meta Harness](crates/code/manual/META_HARNESS.md)：组件组合与 Rust 嵌入接口。
- [持续工程与目标](crates/code/manual/DURABLE_ENGINEERING.md)：长期目标、预算和等待条件。
- [持久记忆](crates/code/manual/DURABLE_MEMORY.md)：记忆隔离、修订与激活边界。

## 当前限制

- 需要自行配置可用的模型服务及相应凭据。
- macOS 原生 Shell 工具目前仍会因 `native_process_lifetime_unqualified` 被拒绝；依赖 Shell 的完整编程流程尚未通过平台资格验证。详见[验证记录](docs/validation.md)。
- 指定项目目录不等于隔离所有本机进程。实际执行边界由宿主策略和沙箱共同决定。
- 本页的运行机制说明对应当前源码；已发布版本的能力以对应发布说明为准。

## 参与开发

源码构建需要固定 Rust 工具链及仓库内私有组件的读取权限。
准备方式、构建约定和检查要求见 [仓库约定](AGENTS.md)与[开发规范](docs/development-standards.md)。

| 修改方向 | 源码入口 |
| --- | --- |
| CLI 启动与参数 | [apps/aster](apps/aster) |
| ACP 会话与宿主协议 | [crates/code/acp](crates/code/acp) |
| Harness、权限与完成判定 | [crates/code/core](crates/code/core) |
| 组件、效果执行与事实重放 | [crates/effect](crates/effect) |

[验证记录](docs/validation.md)说明已检查的范围与已知限制。
报告缺陷请提交到 [Issues](https://github.com/aster-ai-lab/aster/issues)，
附操作系统、复现步骤、预期结果及去除凭据后的日志。

## 许可证

仓库根许可证为 [MIT](LICENSE)。各组件及第三方材料继续遵循各自许可证与来源声明。
