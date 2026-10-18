import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import './ts-hooks.mjs'
import { runStep } from '../agent/deck.mjs'
import { componentContentKeys, nameCandidates, parseMarkdown, repeatedChildSourceIndex, textRunsFromMarkdown, applyContent } from '../view/backend/hydrate.js'
import { fakeReply } from './fake-model.mjs'

const { baseUi, slideModel, storedSlide } = await import('../view/backend/deck.ts')
const { iconUrl } = await import('../view/backend/icons.ts')
const { template } = await import('../view/backend/templates.ts')

const CHINESE = 'Chinese (Simplified - 中文, 汉语)'
const TEMPLATE_IDS = ['general', 'modern', 'standard', 'swift']
const workbench = fileURLToPath(new URL('../ui/workbench/', import.meta.url))

test('Markdown emphasis becomes bold and italic runs over the template run', () => {
  assert.deepEqual(parseMarkdown('a **b** _c_ d'), [
    ['a ', {}],
    ['b', { bold: true }],
    [' ', {}],
    ['c', { italic: true }],
    [' d', {}]
  ])
  const first = { text: 'x', font: { family: 'Poppins', size: 20, bold: true } }
  assert.deepEqual(textRunsFromMarkdown('plain', first), [{ text: 'plain', font: { family: 'Poppins', size: 20, bold: true } }])
  assert.deepEqual(textRunsFromMarkdown('**key** rest', first), [
    { text: 'key', font: { family: 'Poppins', size: 20, bold: true } },
    { text: ' rest', font: { family: 'Poppins', size: 20 } }
  ])
  assert.deepEqual(textRunsFromMarkdown('**unclosed', {}), [{ text: 'unclosed' }])
  assert.deepEqual(textRunsFromMarkdown('', {}), [{ text: ' ' }])
})

test('content keys, name candidates, and repeated sources follow upstream', () => {
  assert.deepEqual(componentContentKeys([{ id: 'body' }, { id: 'card' }, { id: 'card' }, {}]), ['body', 'card_0', 'card_1', 'component_3'])
  assert.deepEqual(nameCandidates('card_2_title'), ['card_2_title', 'card_title', 'title'])
  assert.equal(repeatedChildSourceIndex(0, 4, 2, true), 1)
  assert.equal(repeatedChildSourceIndex(5, 4, 6, true), 3)
  assert.equal(repeatedChildSourceIndex(1, 4, 2, false), 1)
})

test('applying content leaves the template layout unchanged', () => {
  const layout = template('general').layouts[0]
  const before = JSON.stringify(layout)
  applyContent(layout, { anything: 'x' })
  assert.equal(JSON.stringify(layout), before)
})

test('an icon name resolves to an inline data URL only when it is vendored', () => {
  assert.match(iconUrl('rocket'), /^data:image\/svg\+xml,/)
  assert.equal(iconUrl('not-an-icon'), null)
})

test('every layout turns generated content into a slide with package-only assets', async () => {
  for (const id of TEMPLATE_IDS) {
    for (const layout of template(id).layouts) {
      const where = `${id}/${layout.id}`
      const parameters = { step: 'slide', template: id, layout: layout.id, outline: '## 量子比特\n- 叠加', slide_number: 2, language: CHINESE }
      const { content } = await runStep(parameters, async (body) => fakeReply(body))
      const ui = baseUi(id, layout.id, content)
      assert.ok(ui && Array.isArray(ui.components) && ui.components.length > 0, where)
      const json = JSON.stringify(ui)
      assert.match(json, /[\u4e00-\u9fff]{2,}/, `${where} shows the generated text`)
      assert.doesNotMatch(json, /localhost|https?:\/\/(?!www\.w3\.org)/, where)
      for (const [, path] of json.matchAll(/"(vendor\/presenton\/[^"]+)"/g)) assert.ok(existsSync(workbench + path), `${where} names ${path}`)
    }
  }
})

test('a stored slide keeps only its edits and reads back the same', async () => {
  const id = 'general'
  const layout = template(id).layouts[0]
  const { content } = await runStep({ step: 'slide', template: id, layout: layout.id, outline: '## 标题\n- 要点', slide_number: 1, language: CHINESE }, async (body) => fakeReply(body))
  const deck = { id: 'deck' }
  const fresh = slideModel(deck, { id: 's1', group: id, layout: layout.id, content, note: '', patch: null }, 0)
  const untouched = storedSlide(fresh)
  assert.equal(untouched.patch, null)
  const edited = structuredClone(fresh)
  edited.ui.__edited__ = '改过'
  const stored = storedSlide(edited)
  assert.notEqual(stored.patch, null)
  assert.ok(JSON.stringify(stored).length < JSON.stringify(edited).length, 'stores a patch, not the whole slide')
  assert.deepEqual(slideModel(deck, stored, 0).ui, edited.ui)
})
