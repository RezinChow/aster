import assert from 'node:assert/strict'
import test from 'node:test'

import { readCall } from './call.mjs'

test('readCall keeps the city and the member text', () => {
  assert.deepEqual(readCall('{"text":"帮我看一下","parameters":{"city":" 上海 "}}'), {
    city: '上海',
    text: '帮我看一下'
  })
})

test('readCall fills the prompt from the city', () => {
  assert.deepEqual(readCall('{"parameters":{"city":"上海"}}'), {
    city: '上海',
    text: '查询上海的当前气温'
  })
})

test('readCall refuses a call without a city', () => {
  assert.throws(() => readCall('{"text":"天气"}'), /城市不能为空/)
})
