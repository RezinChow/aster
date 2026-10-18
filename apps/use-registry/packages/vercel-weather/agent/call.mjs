/** One turn. The host writes this object to stdin, then the process exits. */

export function readCall(raw) {
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('调用必须是 JSON 对象')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('调用必须是 JSON 对象')
  }
  const city = value.parameters?.city
  if (typeof city !== 'string' || !city.trim()) throw new Error('城市不能为空')
  const text = typeof value.text === 'string' && value.text.trim() ? value.text.trim() : `查询${city.trim()}的当前气温`
  return { city: city.trim(), text }
}
