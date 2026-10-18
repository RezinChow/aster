import assert from 'node:assert/strict'
import test from 'node:test'

import { currentWeather } from './weather.mjs'

test('currentWeather reports the geocoded city temperature', async () => {
  const seen = []
  const fetchImpl = async (url) => {
    const href = String(url)
    seen.push(href)
    if (href.includes('geocoding-api')) {
      return {
        ok: true,
        json: async () => ({ results: [{ name: 'Shanghai', country: 'China', latitude: 31.23, longitude: 121.47 }] })
      }
    }
    return {
      ok: true,
      json: async () => ({ current: { temperature_2m: 26.4 }, current_units: { temperature_2m: '°C' } })
    }
  }
  const text = await currentWeather(' 上海 ', fetchImpl)
  assert.equal(text, 'Shanghai，China 当前 26.4 °C')
  assert.match(seen[0], /name=%E4%B8%8A%E6%B5%B7/)
  assert.match(seen[1], /latitude=31\.23/)
})

test('currentWeather refuses an unknown city', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ results: [] }) })
  await assert.rejects(currentWeather('Nowhere', fetchImpl), /没有找到城市 Nowhere/)
})
