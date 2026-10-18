// Render brand/cover.jpg from the vendored template thumbnails.
//   node tools/render-cover.mjs
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { playwright, root } from '../tests/view-host.mjs'

const thumbs = ['general', 'modern', 'standard', 'swift'].map((id) => {
  const bytes = readFileSync(join(root, `ui/workbench/vendor/presenton/templates/${id}/thumbnail.png`))
  return `data:image/png;base64,${bytes.toString('base64')}`
})

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:1200px;height:675px;font-family:-apple-system,"PingFang SC",sans-serif;background:linear-gradient(135deg,#f6f3ff 0%,#eef2fb 100%);display:grid;grid-template-columns:420px 1fr;align-items:center;overflow:hidden}
.copy{padding:0 0 0 72px}
h1{margin:0 0 14px;font-size:52px;line-height:1.1;color:#171717}
p{margin:0;font-size:20px;line-height:1.6;color:#52525b}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;padding:0 64px 0 24px;transform:rotate(-4deg)}
.grid img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:#fff;box-shadow:0 18px 40px rgba(40,20,90,.18)}
</style><div class="copy"><h1>演示文稿</h1><p>一个主题，一套幻灯片。<br>大纲、版式、内容逐页生成，<br>本地渲染，直接演示。</p></div>
<div class="grid">${thumbs.map((src) => `<img src="${src}">`).join('')}</div>`

const browser = await playwright.chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 675 } })
await page.setContent(html)
await page.screenshot({ path: join(root, 'brand/cover.jpg'), type: 'jpeg', quality: 86 })
await browser.close()
