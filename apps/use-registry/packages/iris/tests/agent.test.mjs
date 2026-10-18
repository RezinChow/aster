import assert from 'node:assert/strict'
import test from 'node:test'

import { decisionFromReply } from '../agent/choose.mjs'

const reply = (model) => ({
  model,
  answers: { action: { type: 'choice', choice: 'hold', confidence: 0.47, probabilities: { direct: 0.12, hold: 0.88 } } }
})

test('a lexical ranking distribution cannot authorize a flight action', () => {
  assert.equal(decisionFromReply(200, reply('apofasi-lexical-0.1.1'), ['direct', 'hold']), null)
})

test('a planning decision preserves its offered choice and published probabilities', () => {
  assert.deepEqual(decisionFromReply(200, reply('decision-fixture'), ['direct', 'hold']), {
    choice: 'hold', confidence: 0.47, probabilities: { direct: 0.12, hold: 0.88 }, model: 'decision-fixture'
  })
})
