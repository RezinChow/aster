// Run the real view under G1's Studio sandbox and CSP, including slow assets.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { playwright, serveView } from '../../g1-arm/tests/view-host.mjs'

const viewRoot = fileURLToPath(new URL('..', import.meta.url))
const { server, origin } = await serveView({
  token: 'a'.repeat(64), documentId: 'b'.repeat(64), width: 1440, height: 900, viewRoot
})

async function prove(engine, launch) {
  const browser = await launch()
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addInitScript(() => {
      const Native = globalThis.DecompressionStream
      let release
      const ready = new Promise((resolve) => { release = resolve })
      globalThis.releaseIrisAssets = release
      globalThis.DecompressionStream = class {
        constructor(format) {
          const stream = new Native(format)
          this.writable = stream.writable
          this.readable = stream.readable.pipeThrough(new TransformStream({
            async transform(chunk, controller) {
              await ready
              controller.enqueue(chunk)
            }
          }))
        }
      }
    })
    const page = await context.newPage()
    const problems = []
    page.on('pageerror', (error) => problems.push(String(error)))
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text())
    })
    await page.goto(`${origin}/host.html`)
    const frame = page.frameLocator('#view')
    await frame.locator('.controls').waitFor()
    for (const selector of ['#run', '#step', '#stop', '#reset', '.task-option', '#threshold', '#timeline', '#replay-play', '#live']) {
      for (const control of await frame.locator(selector).all()) {
        assert.equal(await control.isDisabled(), true, `${engine}: ${selector} enabled before assets loaded`)
      }
    }
    const document = page.frames().find((candidate) => candidate.url().includes('/ui/workbench/index.html'))
    await document.evaluate(() => globalThis.releaseIrisAssets())
    await frame.locator('#loading.hidden').waitFor({ state: 'attached' })
    await document.waitForFunction(() => performance.getEntriesByName('iris:drawn').length > 0)
    const paintedPixels = await document.evaluate(() => {
      const canvas = document.querySelector('canvas')
      const gl = canvas.getContext('webgl2')
      const pixels = new Uint8Array(canvas.width * canvas.height * 4)
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      let painted = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.abs(pixels[i] - pixels[0]) + Math.abs(pixels[i + 1] - pixels[1]) + Math.abs(pixels[i + 2] - pixels[2]) > 30) painted += 1
      }
      return painted
    })
    assert.ok(paintedPixels > 10_000, `${engine}: the scene is blank (${paintedPixels} painted pixels)`)
    for (const task of ['空中巡航', '外卖配送', '设施巡检']) {
      await frame.getByRole('button', { name: task, exact: true }).click()
      await playwright.expect(frame.locator('#scene-task')).toHaveText(task)
      await frame.getByRole('button', { name: '重置实验', exact: true }).click()
      await frame.getByRole('button', { name: '运行实验', exact: true }).click()
      await playwright.expect(frame.locator('#status-text')).toHaveText('验证通过', { timeout: 60_000 })
      await playwright.expect(frame.locator('#toast')).not.toHaveClass(/visible/)
      if (process.env.PROOF_SCREENSHOTS) {
        await mkdir(process.env.PROOF_SCREENSHOTS, { recursive: true })
        await page.screenshot({ path: join(process.env.PROOF_SCREENSHOTS, `${engine}-${task}.png`) })
      }
    }
    assert.deepEqual(problems, [], `${engine}: browser errors`)
    await context.close()

    const reviewed = await browser.newPage()
    let decisions = 0
    let unanswered = false
    await reviewed.exposeFunction('turn', ({ parameters }) => {
      decisions += 1
      if (unanswered) return new Promise(() => {})
      const request = parameters.observation
      const choice = request.baseline_choice
      const keys = Object.keys(request.options)
      return { text: JSON.stringify({ choice, source: 'model', model: 'review-fixture', probabilities: Object.fromEntries(keys.map((key) => [key, key === choice ? 0.4 : 0.6 / (keys.length - 1)])) }) }
    })
    await reviewed.goto(`${origin}/host.html`)
    const reviewedView = reviewed.frameLocator('#view')
    await reviewedView.locator('#loading.hidden').waitFor({ state: 'attached' })
    await reviewedView.getByRole('button', { name: '运行实验', exact: true }).click()
    await playwright.expect(reviewedView.locator('#status-text')).toHaveText('等待人工处理')
    assert.equal(await reviewedView.locator('#events li.event').count(), 0)
    await reviewedView.getByRole('button', { name: '确认并继续', exact: true }).click()
    await playwright.expect(reviewedView.locator('#events li.event')).toHaveCount(1)
    await playwright.expect(reviewedView.locator('#status-text')).toHaveText('等待人工处理')
    assert.equal(decisions, 2, `${engine}: a confirmed action was requested again`)
    await reviewedView.getByRole('button', { name: '停止实验', exact: true }).click()
    await playwright.expect(reviewedView.locator('#status-text')).toHaveText('已停止')
    await reviewedView.getByRole('button', { name: '重置实验', exact: true }).click()
    unanswered = true
    await reviewedView.getByRole('button', { name: '运行实验', exact: true }).click()
    await playwright.expect.poll(() => decisions).toBe(3)
    await reviewedView.getByRole('button', { name: '重置实验', exact: true }).click()
    await playwright.expect(reviewedView.locator('#status-text')).toHaveText('待命', { timeout: 3000 })
    await reviewedView.getByRole('button', { name: '外卖配送', exact: true }).click()
    await playwright.expect(reviewedView.locator('#scene-task')).toHaveText('外卖配送')
    await reviewed.close()

    const failed = await browser.newPage()
    await failed.route('**/vendor/iris/iris.js', async (route) => {
      const response = await route.fetch()
      const body = (await response.text()).replace(/export const PACK = "[^"]*"/, 'export const PACK = "invalid"')
      await route.fulfill({ response, body })
    })
    await failed.goto(`${origin}/host.html`)
    const failedView = failed.frameLocator('#view')
    await playwright.expect(failedView.locator('#loading')).toHaveText('场景加载失败')
    for (const selector of ['#run', '#step', '#stop', '#reset', '.task-option']) {
      for (const control of await failedView.locator(selector).all()) {
        assert.equal(await control.isDisabled(), true, `${engine}: ${selector} enabled after asset failure`)
      }
    }
    await failed.close()
    console.log(`${engine}: slow startup, all three missions, reviewed decisions, unanswered-agent reset, and failed assets PASS`)
  } finally {
    await browser.close()
  }
}

try {
  await prove('chromium', () => playwright.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] }))
  await prove('webkit', () => playwright.webkit.launch())
} finally {
  server.close()
}
