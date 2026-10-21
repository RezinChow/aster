# Aster 官网丰富配色

按用户对[参考下载页](https://agent.minimax.cn/download)配色的反馈，首屏使用蓝、青、紫色大面积渐变和白色标题；四个真实界面截图外侧分别使用蓝、青、珊瑚、紫色背景，页尾使用蓝紫渐变。未恢复此前用户撤回的额外星形饰件。

只修改官网 `styles.css`。导航、按钮、分段选项和弹窗继续使用根 `DESIGN.md` 的中性色、尺寸和交互角色。四张真实产品截图、HTML、JavaScript、下载链接及字体均保持原始字节；发布目录仍为 15 个文件，只有 CSS 的哈希变化。没有增加图片资源、依赖或新的自动动画。

## 验证

- `python3 apps/web/scripts/check_site.py`：14 个源文件、6 个下载链接、8 个命名按钮通过。
- `python3 -m unittest discover -s apps/web/tests -p 'test_*.py'`：17 项通过。
- `JS_DOM_MODULE="$PWD/target/evaluations/aster-website/download-test-deps/node_modules/jsdom" node --test apps/web/tests/download.test.cjs apps/web/tests/canvas.test.cjs`：25 项通过。
- `a3s-test check <manifest> --json` 后，以项目使用的 standalone 驱动及 `agent-browser` 执行所附 ACL。
- `visual.acl` 的桌面 31 步与移动端 22 步均通过，但桌面场景的默认 10 秒浏览器清理超时，完整失败结果保留在 `browser-initial-cleanup-timeout.json`，未标记为整套成功。
- 将清理期限设为 `--cleanup-timeout-ms 30000`，单独复核 `desktop.acl`：31 步通过，清理成功，见 `desktop-recheck.json`。没有放宽产品断言。
- `features.acl`：19 步通过，清理成功。等待图片网络空闲后检查四个颜色背景中的真实截图，避免将懒加载过程的临时空白帧用作展示证据。见 `feature-captures.json`。以上页面错误收据均为空。
- 已视觉检查桌面、手机首屏，四个功能截图背景及手机页尾。最终截图随记录保留。
- 手机首屏正文附近的 9 个背景点，以实际截图 RGB 计算白字对比度。加深文字区域底色后，最小抽样值从约 3.77:1 提升至 4.69:1。见 `contrast-before.json`、`contrast-after.json`。
- `python3 apps/web/scripts/stage_site.py target/evaluations/aster-website/color-stage-final-20261021`：发布文件闭包及最终哈希见 `stage.json`。CSS 格式及限定差异检查通过。

## 公开部署

页面提交 `e0f5bb40ab8693845e070afafc234c21609664d9` 已推送到 `main`。[Pages 运行 39556292002](https://github.com/aster-ai-lab/aster/actions/runs/39556292002) 的验证和部署任务成功。保留 <https://aster-ai-lab.github.io/aster/> 地址。

从公开地址读取的 15 个文件均为 200，SHA-256 全部匹配本地验证过的发布目录。目录入口 `/` 与 `/download/` 也返回 200。见 `pages-run.json` 和 `public-http.json`。浏览器回归在本地相同文件上执行，不声称重复在公开地址执行。

## Explicitly not claimed

背景采样是局部文字可读性检查，不是整站 WCAG 认证。浏览器测试在本地发布源上执行，第一次的清理失败保留为基础设施问题，未声称旧运行清理成功。本次没有重建客户端安装包，没有重新验收真实模型、Office 或原生窗口；真实界面图片继续使用合成演示数据。
