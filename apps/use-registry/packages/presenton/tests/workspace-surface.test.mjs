// The workspace document must not stay on the upload page once a deck exists.
import assert from 'node:assert/strict'
import test from 'node:test'

import './ts-hooks.mjs'

globalThis.window = { scrollTo() {}, parent: {} }
globalThis.location = { hash: '' }

const router = await import('../view/router.ts')
const state = await import('../view/backend/state.ts')
const home = await import('../view/backend/homeSeed.ts')
const { openWorkspaceSurface } = await import('../view/homeDocument.ts')

const CHINESE = 'Chinese (Simplified - 中文, 汉语)'

function put(deck) {
  state.setDeck(deck)
  router.restore({ pathname: '/upload', search: '' })
  openWorkspaceSurface()
}

test('a generated deck opens the editor without regenerating', () => {
  put({ id: 'deck-1', outlines: ['# 已生成'], slides: [{ id: 'page-1' }] })
  const here = router.location()
  assert.equal(here.pathname, '/presentation')
  const params = new URLSearchParams(here.search)
  assert.equal(params.get('id'), 'deck-1')
  assert.equal(params.get('stream'), null)
})

test('an empty deck stays on the outline page', () => {
  put({ id: 'deck-2', outlines: null, slides: [] })
  const here = router.location()
  assert.equal(here.pathname, '/outline')
  assert.equal(new URLSearchParams(here.search).get('id'), 'deck-2')
})

test('no deck stays put, and a homepage seed is not moved onto the editor', () => {
  state.setDeck(null)
  router.restore({ pathname: '/upload', search: '' })
  openWorkspaceSurface()
  assert.equal(router.location().pathname, '/upload')

  const applied = home.acceptHomeSeed({
    content: '给高中生讲量子计算入门',
    n_slides: null,
    language: CHINESE,
    tone: 'educational',
    verbosity: 'standard',
    include_title_slide: true,
    instructions: ''
  })
  assert.equal(applied.applied, true)
  openWorkspaceSurface()
  assert.equal(router.location().pathname, '/outline')
  assert.equal(state.deck.slides.length, 0)
})

test('a later return to the upload page reopens the editor', () => {
  put({ id: 'deck-3', outlines: ['# 已生成'], slides: [{ id: 'page-1' }] })
  router.navigate('/upload', 'push')
  openWorkspaceSurface()
  assert.equal(router.location().pathname, '/presentation')
  assert.equal(new URLSearchParams(router.location().search).get('stream'), null)
})
