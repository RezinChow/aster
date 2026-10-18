import assert from 'node:assert/strict'
import test from 'node:test'

import { RecoveryJournal } from '../src/recovery-journal.mjs'

test('reopening restores the submitted scene and unresolved project intent', async () => {
  let stored = { revision: 0, content: null }
  const host = { async request(input) {
    if (input.operation === 'read-draft') return stored
    assert.equal(input.expectedRevision, stored.revision)
    stored = { revision: stored.revision + 1, content: input.content }
    return stored
  } }
  const state = { scene: 'scene "kept" { revision = 7 }', saveIntent: { operationId: crypto.randomUUID(), expectedRevision: 4 } }
  const first = new RecoveryJournal(host, () => state, () => {})
  await first.load()
  await first.checkpoint()
  let restored
  const second = new RecoveryJournal(host, () => restored, (value) => { restored = value })
  await second.load()
  assert.deepEqual(restored, state)
  await second.checkpoint()
  assert.equal(stored.revision, 1)
})

test('a lost checkpoint reply replays identical bytes before persisting newer input', async () => {
  let stored = { revision: 0, content: null }
  let original
  const submitted = []
  const host = { async request(input) {
    if (input.operation === 'read-draft') return stored
    submitted.push({ ...input })
    if (submitted.length === 1) {
      original = { ...input }
      stored = { revision: 1, content: input.content }
      throw Object.assign(new Error('outcome_unknown'), { reason: 'outcome_unknown' })
    }
    if (input.operationId === original.operationId) return stored
    assert.equal(input.expectedRevision, stored.revision)
    stored = { revision: stored.revision + 1, content: input.content }
    return stored
  } }
  let state = { task: 'Original request' }
  const journal = new RecoveryJournal(host, () => state, () => {})
  await journal.load()
  await assert.rejects(journal.checkpoint(), { reason: 'outcome_unknown' })
  state = { task: 'Newer local request' }
  await journal.checkpoint()
  assert.deepEqual(submitted[1], original)
  assert.equal(stored.revision, 2)
  assert.deepEqual(JSON.parse(stored.content), state)
})

test('corrupt recovery refuses initialization and cannot be overwritten by an empty editor', async () => {
  const host = { async request() { return { revision: 1, content: '{invalid' } } }
  const journal = new RecoveryJournal(host, () => ({}), () => {})
  await assert.rejects(journal.load())
  await assert.rejects(journal.checkpoint(), { reason: 'closed' })
  assert.equal(journal.ready, false)
})

test('rapid input coalesces to one checkpoint and a leave flush does not wait for the timer', async () => {
  let writes = 0
  const host = { async request(input) {
    if (input.operation === 'read-draft') return { revision: 0, content: null }
    writes += 1
    return { revision: input.expectedRevision + 1, content: input.content }
  } }
  let input = ''
  const journal = new RecoveryJournal(host, () => ({ input }), () => {})
  await journal.load()
  const pending = []
  for (let index = 0; index < 100; index += 1) { input += 'x'; pending.push(journal.schedule()) }
  await journal.checkpoint()
  await Promise.all(pending)
  assert.equal(writes, 1)
  assert.equal(JSON.parse(journal.confirmed).input.length, 100)
})
