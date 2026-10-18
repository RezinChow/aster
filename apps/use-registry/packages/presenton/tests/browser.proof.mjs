// Browser proof: Presenton's own pages, as the view bundles them, under
// Studio's document policy. For every template it goes input → outline →
// template → generation → a text edit and a title change →
// present mode → reload, with the real agent step code and a schema-reading
// fake model, and checks that the deck restores from view state without new
// turns. Screenshots go to the directory given as the first argument
// (default: a temp dir).
//
//   node tests/browser.proof.mjs [out-dir]
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { runStep } from '../agent/deck.mjs'
import { TEMPLATES } from '../agent/templates.mjs'
import { fakeReply } from './fake-model.mjs'
import { playwright, serveView } from './view-host.mjs'

const out = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'presenton-proof-'))
mkdirSync(out, { recursive: true })
const token = 'a'.repeat(32)
const documentId = 'b'.repeat(64)
const TOPIC = '面向高中生介绍量子计算：它是什么、和经典计算机的区别、目前能做什么、未来的挑战。'
const EDITED = '量子计算入门（已编辑）'
const RENAMED = '量子计算 · 课堂版'
const { server, served, missing, origin } = await serveView({ token, documentId, width: 1440, height: 900 })
const browser = await playwright.chromium.launch()
const results = []

/** The view state as stored: `{v:2, gz}` wraps gzip'd JSON. */
function decode(stored) {
  const outer = JSON.parse(stored)
  return outer.gz ? JSON.parse(gunzipSync(Buffer.from(outer.gz, 'base64')).toString()) : outer
}

async function until(check, what, timeout = 60_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`timed out waiting for ${what}`)
}

/** Double-click across the first slide until a text editor opens, then replace its text. */
async function editFirstText(page, view) {
  const box = await view.locator('#slide-0').boundingBox()
  for (let y = 0.12; y < 0.9; y += 0.08) {
    for (let x = 0.08; x < 0.6; x += 0.08) {
      await page.mouse.dblclick(box.x + box.width * x, box.y + box.height * y)
      const editor = view.locator('.ProseMirror[contenteditable="true"]')
      if (await editor.count()) {
        // Upstream re-sends the opened element's wrapped text after mount; typing before that is overwritten.
        await page.waitForTimeout(300)
        await editor.first().focus()
        await page.keyboard.press('ControlOrMeta+A')
        await page.keyboard.type(EDITED)
        assert.equal((await editor.first().innerText()).trim(), EDITED, 'the editor holds only the new text')
        // Tiptap keeps the editor on its root element; its document, not the DOM, is what commits.
        await until(async () => (await editor.first().evaluate((element) => element.editor?.getText()))?.trim() === EDITED, 'the editor document')
        // Upstream hands the editor's text to the slide on the next animation frame; a click inside that frame commits the text before the last keystroke.
        await editor.first().evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        // The gray margin above the slide: off every element and toolbar.
        await page.mouse.click(box.x + box.width / 2, box.y - 20)
        return
      }
      await page.keyboard.press('Escape')
    }
  }
  throw new Error('no editable text on the first slide')
}

try {
  for (const templateId of Object.keys(TEMPLATES)) {
    const name = TEMPLATES[templateId].name
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const problems = []
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text())
    })
    page.on('pageerror', (error) => problems.push(String(error)))
    let stored = null
    let turns = 0
    let requests = 0
    await page.exposeFunction('viewState', (text) => {
      if (typeof text === 'string') stored = text
      return stored
    })
    await page.exposeFunction('turn', async ({ agent, parameters }) => {
      assert.equal(agent, 'presenton')
      turns += 1
      const output = await runStep(parameters, async (body) => {
        requests += 1
        assert.ok(Buffer.byteLength(JSON.stringify(body)) <= 256 * 1024, 'model body over the host limit')
        return fakeReply(body)
      })
      return { text: JSON.stringify(output) }
    })
    const state = () => (stored ? decode(stored) : null)
    const shot = (step) => page.screenshot({ path: join(out, `${templateId}-${step}.png`) })

    await page.goto(`${origin}/host.html`)
    const view = page.frameLocator('#view')
    await view.locator('textarea').first().fill(TOPIC)
    await shot('1-input')
    await view.locator('button:has(img[src$="generate/submit-arrow.svg"])').click()

    await view.getByText(name, { exact: true }).first().click()
    await until(() => state()?.deck?.outlines?.length > 0, 'the outline')
    const proceed = view.getByRole('button', { name: '继续' })
    await until(() => proceed.isEnabled(), 'the continue button')
    await shot('2-outline')
    await proceed.click()

    const present = view.locator('button:has(svg.lucide-play)')
    await until(() => {
      const deck = state()?.deck
      return deck?.structure?.length > 0 && deck.slides.length === deck.structure.length
    }, 'every slide')
    await until(() => present.isEnabled(), 'the end of generation')
    const count = state().deck.slides.length
    assert.equal(state().deck.template, templateId)
    assert.equal(await view.locator('[data-slide-thumbnail-index]').count(), count)
    await view.locator('[data-slide-thumbnail-index="0"]').click()
    await view.locator('#slide-0').waitFor()
    await page.waitForTimeout(1000)
    await shot('3-editor')

    const frame = page.frame({ url: /index\.html/ })
    const brokenImages = await frame.evaluate(() =>
      [...document.images].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.getAttribute('src')?.slice(0, 80))
    )
    assert.deepEqual(brokenImages, [], 'every image loads')
    await view.locator('#slide-0 canvas').first().waitFor({ timeout: 10_000 })

    await editFirstText(page, view)
    await until(() => JSON.stringify(state().deck.slides[0].patch ?? null).includes(EDITED), 'the stored text edit', 10_000)
    await view.locator('button:has(h2)').first().click()
    await view.locator('input[aria-label="演示文稿标题"]').fill(RENAMED)
    await page.keyboard.press('Enter')
    await until(() => state().deck.title === RENAMED, 'the stored title', 10_000)
    await shot('4-edited')

    await present.click()
    await view.locator('#presentation-mode-wrapper').waitFor()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)
    await shot('5-present')
    await page.keyboard.press('Escape')
    await view.locator('#presentation-mode-wrapper').waitFor({ state: 'hidden' })
    await until(() => !state().route.search.includes('mode=present'), 'the stored editor route')

    assert.ok(Buffer.byteLength(stored) <= 64 * 1024, 'state within 64 KiB')
    const turnsBefore = turns
    await page.reload()
    await page.frameLocator('#view').locator(`[data-slide-thumbnail-index="${count - 1}"]`).waitFor({ state: 'attached' })
    await page.waitForTimeout(1500)
    assert.equal(turns, turnsBefore, 'reload makes no agent turn')
    assert.equal(await page.frameLocator('#view').locator('[data-slide-thumbnail-index]').count(), count)
    assert.ok(JSON.stringify(state().deck.slides[0].patch).includes(EDITED), 'the edit survives the reload')
    await page.frameLocator('#view').locator('button:has(h2)').getByText(RENAMED).waitFor()
    await shot('6-reloaded')

    assert.deepEqual(problems, [], `console errors: ${problems.join('\n')}`)
    results.push({ template: templateId, slides: count, turns, requests, stateBytes: Buffer.byteLength(stored) })
    await page.close()
  }
  assert.deepEqual([...missing], [], 'no request outside the package')
  console.log(JSON.stringify({ out, served: served.size, results }, null, 2))
} finally {
  await browser.close()
  server.close()
}
