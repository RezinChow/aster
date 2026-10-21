# 撤回官网装饰

按用户“撤回”的要求，撤回 `bec95e14b` 对官网 HTML、CSS 的点缀修改。两个文件逐字节恢复为先前验证过的 `358bd2ea7` 版本；保留真实界面截图、原有 Canvas 和回到顶部按钮。其他工作区修改不在本次范围内。

历史装饰测试及部署记录保留在 `2026-10-21-aster-decor`，仅作为已撤回版本的证据。

## 验证

- 比较两个恢复文件与 `git show 358bd2ea7:<path>` 的原始字节：一致。
- `python3 apps/web/scripts/check_site.py`：通过，14 个源文件、6 个下载链接、8 个命名按钮。
- `python3 -m unittest discover -s apps/web/tests -p 'test_*.py'`：17 项通过。
- `JS_DOM_MODULE="$PWD/target/evaluations/aster-website/download-test-deps/node_modules/jsdom" node --test apps/web/tests/download.test.cjs apps/web/tests/canvas.test.cjs`：25 项通过。
- 限定差异检查通过；没有删除历史证据或改写 Git 历史。

## Explicitly not claimed

本次是恢复既有网站版本，没有增加功能、改动客户端或重建安装包。本地没有重跑浏览器端到端测试；恢复版本已有的公开浏览器验收记录见 `2026-10-21-aster-real-screens`。
