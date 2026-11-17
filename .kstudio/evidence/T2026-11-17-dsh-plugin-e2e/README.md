# DeepSeek Harness Plugin E2E（安装 / 使用 / 卸载）

真实 `dsh` CLI（`@deepseek-ai/dsh`，已测 **0.2.2-rc.1**）上的插件生命周期复跑包。
不等于 Aster 产品 Pass，也不等于 cordis→Core 吸收完成。

## 布局

```text
T2026-11-17-dsh-plugin-e2e/
├── README.md          # 本说明
├── OUTCOME.md         # 命令、观测、Explicitly not claimed
├── run.sh             # 一键：install → use → uninstall
├── fixture/           # 官方 bundle 形插件 dsh-aster-e2e-hello
│   ├── package.json   # dsh.bundle.patch
│   ├── cordis.patch.yml
│   └── index.js       # apply + ctx.effect；ASTER_DSH_E2E_MARKER 写 loaded
└── artifacts/         # 本机一次跑通快照（dump / marker / residual）
```

## 前置

- `dsh` 在 `PATH`（Homebrew / npm `@deepseek-ai/dsh`）
- `rg`

脚本使用**临时** `$DSH_HOME`，不改写 `~/.dsh`。

## 复跑

```bash
bash .kstudio/evidence/T2026-11-17-dsh-plugin-e2e/run.sh
```

期望末行：`PASS install/use/uninstall`。

| 步骤 | 命令口径 | 通过条件 |
| --- | --- | --- |
| 安装 | `dsh plugin --profile aster-e2e add ./fixture` | `package.json` bundles 含插件；`--dump-config` 有 `# == dsh-aster-e2e-hello` |
| 使用 | 短时 boot（`ASTER_DSH_E2E_MARKER`） | marker：`loaded:aster-e2e-hello:…` |
| 卸载 | `dsh plugin --profile aster-e2e remove dsh-aster-e2e-hello` | bundles/dump 无插件；负向 boot 无 marker |

## 已知残差

`dsh plugin remove` 后，`node_modules/dsh-aster-e2e-hello` 的 symlink 可能仍在（pnpm hoisted）。
层与运行时已卸：dump 无层、boot 不再 `apply`。详见 `OUTCOME.md`。

## 明确不宣称

- Meta Harness / Aster Pass
- DeepSeek API 对话路径
- Electron `desktop` profile
- fixture 发布到 npm
