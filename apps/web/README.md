# Aster 下载页

`public/download/` 是独立静态网站，使用 HTML、CSS 和 JavaScript，不需要安装前端框架或读取私有桌面源码。品牌图形直接使用 `public/tenant/aster/logo.svg` 和 `mark-light.png`。

从仓库根目录预览：

```sh
python3 -m http.server 4188 --bind 127.0.0.1 --directory apps/web/public
```

打开 <http://127.0.0.1:4188/download/>。

校验和生成部署目录：

```sh
python3 -m unittest discover -s apps/web/tests -p 'test_*.py' -v
python3 apps/web/scripts/check_site.py
node --check apps/web/public/download/app.js
node --check apps/web/public/download/canvas.js
python3 apps/web/scripts/stage_site.py target/aster-site
```

交互回归使用公共 UI 工作区已有的 `jsdom` 开发依赖；已安装该工作区依赖时直接运行：

```sh
node --test apps/web/tests/download.test.cjs apps/web/tests/canvas.test.cjs
```

也可以隔离安装测试依赖并显式指定，不需要私有源码：

```sh
npm install --prefix target/download-test-deps --ignore-scripts --no-save --package-lock=false jsdom@26.1.0
JS_DOM_MODULE="$PWD/target/download-test-deps/node_modules/jsdom" node --test apps/web/tests/download.test.cjs apps/web/tests/canvas.test.cjs
```

DOM 回归验证交互状态和事件；Canvas 测试用受控绘图上下文和动画时钟验证调度。它们不替代真实浏览器的像素、布局、原生对话框焦点和绘图效果检查。

输出目录必须不存在。脚本只复制下载页的四个文件、两个 Aster 图标，并生成指向 `./download/` 的根入口；不复制其他租户、源码、依赖或用户数据。所有资源路径均兼容 GitHub Pages 的项目路径。Canvas 是独立装饰层：减少动态时静态绘制，页面隐藏或首屏离开视口时停止动画，没有第三方绘图库。

下载链接的封闭清单位于 `scripts/site_contract.py`，对应已存在的公开稳定包。新增或调整链接前应核实 GitHub Release 的版本、CPU 和文件名；下载页应区分当前公开包与尚未发布的新界面。静态检查不访问网络，也不证明远端下载可用性或浏览器交互效果。

`.github/workflows/aster-pages.yml` 在 `main` 的相关文件变化时部署，也支持手动触发。它仅检出公共仓库，DOM 测试依赖隔离在 runner 临时目录，校验后只上传精确静态目录。Pages 需由仓库管理员启用 GitHub Actions 来源；本脚本不修改远端设置。

浏览器回归在上述 4188 静态服务启动后运行：

```sh
a3s-test check apps/web/tests/download.acl --json
a3s-test run apps/web/tests/download.acl --browser-driver standalone --json
```

该套件覆盖桌面与移动端的工作区、Office、审查示例、下载弹层、任务演示、常见问题与回顶按钮；需要已安装兼容的 `agent-browser`。
