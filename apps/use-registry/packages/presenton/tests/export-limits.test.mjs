// Image routes and pptx export go through the shipped view server.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import './ts-hooks.mjs'

globalThis.location = { hash: `#aix-document=${'cd'.repeat(32)}` }
globalThis.window = { scrollTo() {}, parent: { postMessage() {} } }

const { viewFetch } = await import('../view/backend/server.ts')
const { setDeck } = await import('../view/backend/state.ts')

const IMAGE_REFUSALS = [
  ['/api/v1/ppt/images/search', '本插件不能联网搜索图片。'],
  ['/api/v1/ppt/images/generate', '本插件不能生成图片。'],
  ['/api/v1/ppt/images/upload', '本插件不能上传图片。']
]

test('image search, generate, and upload return 501 with the exact sentences', async () => {
  for (const [path, detail] of IMAGE_REFUSALS) {
    for (const method of ['GET', 'POST']) {
      const reply = await viewFetch(path, { method, body: '{}' })
      assert.equal(reply.status, 501, `${method} ${path}`)
      assert.deepEqual(await reply.json(), { detail })
      console.log(`${method} ${path} 501 ${detail}`)
    }
  }
})

test('the shipped server has no successful response that writes the current deck as pptx', async () => {
  setDeck(null)
  const created = await viewFetch('/api/v1/ppt/presentation/create', {
    method: 'POST',
    body: JSON.stringify({ content: '导出检查', n_slides: 1, language: 'Chinese (Simplified - 中文, 汉语)' })
  })
  assert.equal(created.status, 200)
  const deck = await created.json()
  assert.equal(typeof deck.id, 'string')
  const server = readFileSync(new URL('../view/backend/server.ts', import.meta.url), 'utf8')
  assert.equal(server.includes('pptx'), false)
  assert.equal(server.includes('application/vnd.openxmlformats'), false)
  const literals = [...server.matchAll(/["'`](\/api\/v1\/ppt\/[^"'`]+)["'`]/g)].map((match) => match[1])
  const paths = new Set([
    ...literals,
    '/api/v1/ppt/presentation/export',
    `/api/v1/ppt/presentation/export/${deck.id}`,
    `/api/v1/ppt/presentation/${deck.id}/export`,
    '/api/v1/ppt/pptx',
    `/api/v1/ppt/pptx/${deck.id}`,
    `/api/v1/ppt/presentation/${deck.id}/pptx`,
    '/api/v1/ppt/presentation/download'
  ])
  let pptxSuccess = 0
  for (const path of paths) {
    for (const method of ['GET', 'POST']) {
      const reply = await viewFetch(path, {
        method,
        body: JSON.stringify({ presentation_id: deck.id, export_as: 'pptx', id: deck.id })
      })
      const type = reply.headers.get('content-type') || ''
      const bytes = new Uint8Array(await reply.arrayBuffer())
      const zip = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b
      const pptx = type.includes('presentationml') || type.includes('pptx') || zip
      if (reply.status === 200 && pptx) pptxSuccess += 1
      assert.equal(pptx, false, `${method} ${path} ${reply.status} ${type}`)
    }
  }
  const again = await viewFetch(`/api/v1/ppt/presentation/${deck.id}`, { method: 'GET' })
  assert.equal(again.status, 200)
  const kept = await again.json()
  assert.equal(kept.id, deck.id)
  assert.equal(kept.content, '导出检查')
  console.log(`pptx_success=${pptxSuccess}`)
  setDeck(null)
})
