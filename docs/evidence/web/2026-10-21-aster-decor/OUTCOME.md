# Aster 官网品牌点缀

参考用户指定的下载站，以 Aster 蓝色柔光和蓝银星轨增加品牌点缀。首屏复用现有 logo，增加星形饰件；功能区以星形细线分隔；页尾使用静态椭圆星轨。手机端缩小饰件。导航和按钮继续采用根 `DESIGN.md` 的中性色角色。

装饰位于 `aria-hidden`、`pointer-events: none` 的区域；不加入焦点顺序，不增加自动动画、第三方资源、运行依赖或发布文件。四张真实界面图片的哈希保持不变。现有 Canvas 的离屏暂停、低动态效果和调度逻辑保持原样。

## 验证

- `python3 -m unittest discover -s apps/web/tests -p 'test_*.py'`：17 项通过。
- `python3 apps/web/scripts/check_site.py`：14 个源文件、6 个下载链接、8 个命名按钮通过。
- `JS_DOM_MODULE="$PWD/target/evaluations/aster-website/download-test-deps/node_modules/jsdom" node --test apps/web/tests/download.test.cjs apps/web/tests/canvas.test.cjs`：25 项通过。
- `a3s-test check docs/evidence/web/2026-10-21-aster-decor/visual.acl --json` 后，以 standalone 驱动和项目使用的 `agent-browser` 运行该 ACL：47 步通过，桌面 27 步、移动端 20 步。页面错误均为空，场景清理均成功。见 `browser.json` 和两个错误收据。
- 视觉检查 1440×900 桌面和 390×844 移动端的首屏、页尾，确认装饰不遮挡标题或下载按钮。四张截图随记录保留。
- `python3 apps/web/scripts/stage_site.py target/evaluations/aster-website/decor-stage-20261021`：只发布原有的 15 个公开文件，哈希见 `stage.json`。
- HTML、CSS 格式及限定差异检查通过。

## Explicitly not claimed

这次修改只调整官网装饰，没有修改桌面功能或重建安装包。没有声称与参考站逐像素一致，没有重新执行模型、Office 或原生窗口的功能验收。产品图继续使用此前实际界面采集的合成演示数据。
