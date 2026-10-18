// A stand-in chat model: it reads the JSON schema the agent put in the prompt
// and answers with a value that satisfies it, so tests exercise every layout.
import { ICON_NAMES } from '../agent/icons.mjs'

const PHRASE = '量子计算利用叠加与纠缠处理信息，'

function sampleText(schema, seed) {
  const min = schema.minLength ?? 4
  const max = schema.maxLength ?? Math.max(min, 40)
  const target = Math.max(min, Math.min(max, Math.round((min + max) / 2)))
  let text = ''
  while ([...text].length < target) text += PHRASE[(seed + [...text].length) % PHRASE.length]
  return [...text].slice(0, target).join('')
}

export function sample(schema, seed = 0) {
  if (!schema || typeof schema !== 'object') return null
  if (schema.enum) return schema.enum[seed % schema.enum.length]
  switch (schema.type) {
    case 'object': {
      const out = {}
      for (const [key, child] of Object.entries(schema.properties ?? {})) out[key] = sample(child, seed + key.length)
      return out
    }
    case 'array': {
      const count = Math.max(schema.minItems ?? 1, Math.min(schema.maxItems ?? 3, 3))
      return Array.from({ length: count }, (_, index) => sample(schema.items, seed + index + 1))
    }
    case 'string':
      if (schema.description === 'Exactly one name from the Icon Names list') return ICON_NAMES[(seed * 37) % ICON_NAMES.length]
      return sampleText(schema, seed)
    case 'number':
      return 10 + ((seed * 7) % 40)
    case 'integer':
      return seed
    case 'boolean':
      return true
    default:
      return null
  }
}

function schemaIn(text) {
  const marker = ['Return only one JSON object that matches this JSON schema:\n', '- Follow this response schema exactly: ']
  for (const prefix of marker) {
    const at = text.indexOf(prefix)
    if (at >= 0) {
      const line = text.slice(at + prefix.length).split('\n')[0]
      return JSON.parse(line)
    }
  }
  throw new Error('no schema in the prompt')
}

/** One chat completion for `body`, shaped as the gateway returns it. */
export function fakeReply(body) {
  const system = body.messages[0].content
  const schema = schemaIn(system)
  let value
  if (system.startsWith('Generate presentation title')) {
    // An automatic slide count leaves the range open; pick six.
    const { minItems, maxItems } = schema.properties.slides
    const n = minItems === maxItems ? minItems : Math.min(6, maxItems)
    value = {
      slides: Array.from({ length: n }, (_, index) => ({
        content: `## ${index === 0 ? '量子计算入门' : `第 ${index + 1} 部分`}\n- ${sampleText({ minLength: schema.properties.slides.items.properties.content.minLength + 10, maxLength: 160 }, index)}`
      }))
    }
  } else if (system.includes("You're a professional presentation designer")) {
    const n = schema.properties.slides.minItems
    value = { slides: Array.from({ length: n }, (_, index) => index) }
  } else {
    value = sample(schema)
  }
  return { status: 200, body: { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }] } }
}
