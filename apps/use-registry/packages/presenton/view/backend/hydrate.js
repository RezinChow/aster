// Generated slide content applied to a template layout. A port of upstream's
// servers/fastapi/api/v1/ppt/endpoints/presentation.py (_apply_template_*)
// and templates/v2/content.py. `layout.repeated` is upstream's
// get_repeated_top_level_group_schema_name per component, computed at vendor time.

const GENERATED_VALUE_ELEMENT_TYPES = new Set(['text', 'math', 'image', 'text-list', 'table', 'chart', 'infographic'])
const GENERATED_TABLE_TEXT_FONT = { family: 'Sniglet', size: 12, color: '#082314' }
const GENERATED_TABLE_HEADER_FONT = { ...GENERATED_TABLE_TEXT_FONT, bold: true }
const GENERATED_TABLE_CELL_FILL = { color: '#F8F4E9', opacity: 1 }
const GENERATED_TABLE_CELL_STROKE = { color: '#D8D3C4', opacity: 1, width: 1 }
const STRONG = ['**', '__']
const EMPHASIS = ['*', '_']
const DELIMITERS = [...STRONG, ...EMPHASIS]
const CHART_TYPES = new Set(['area', 'bar', 'bubble', 'donut', 'horizontal_bar', 'horizontal_stacked_bar', 'line', 'pie', 'polar_area', 'radar', 'scatter', 'stacked_bar'])

const clone = (value) => (value === undefined ? undefined : structuredClone(value))
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const has = (record, key) => Object.hasOwn(record, key)

/** The layout UI with `content` applied; the layout itself is not changed. */
export function applyContent(layout, content) {
  const ui = clone(layout)
  const components = ui?.components
  if (!Array.isArray(components) || !components.length) return ui
  const keys = componentContentKeys(components)
  const values = isRecord(content) ? content : {}
  components.forEach((component, index) => {
    if (!isRecord(component)) return
    let componentContent = values[keys[index]]
    if (!isRecord(componentContent) && typeof component.id === 'string') componentContent = values[component.id]
    if (!isRecord(componentContent)) componentContent = {}
    if (!Array.isArray(component.elements)) return
    const repeated = hydrateRepeatedTopLevelGroups(component.elements, componentContent, layout.repeated?.[index] ?? null)
    component.elements = repeated ?? applyToElementList(component.elements, componentContent)
  })
  return ui
}

export function componentContentKeys(components) {
  const ids = components.map((component, index) => (isRecord(component) && typeof component.id === 'string' && component.id) || `component_${index}`)
  const counts = new Map()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  const indexes = new Map()
  const used = new Set()
  return ids.map((id) => {
    const occurrence = indexes.get(id) ?? 0
    indexes.set(id, occurrence + 1)
    const base = counts.get(id) > 1 ? `${id}_${occurrence}` : id
    let key = base
    let suffix = 1
    while (used.has(key)) key = `${base}_${suffix++}`
    used.add(key)
    return key
  })
}

export function repeatedChildSourceIndex(index, templateCount, contentCount, centerWhenReduced) {
  if (centerWhenReduced && contentCount < templateCount) return Math.floor((templateCount - contentCount) / 2) + index
  return Math.min(index, templateCount - 1)
}

function hydrateRepeatedTopLevelGroups(elements, content, fieldName) {
  if (!fieldName || !isRecord(content)) return null
  const values = content[fieldName]
  if (!Array.isArray(values) || !elements.length) return null
  const out = []
  for (const [index, value] of values.entries()) {
    const source = clone(elements[repeatedChildSourceIndex(index, elements.length, values.length, true)])
    if (!isRecord(source)) return null
    out.push(applyToElement(source, value, { directValue: true }))
  }
  return out
}

export function nameCandidates(name) {
  const withoutNumber = name.replace(/_\d+(?=_|$)/g, '')
  const split = withoutNumber.indexOf('_')
  const withoutPrefix = split >= 0 ? withoutNumber.slice(split + 1) : withoutNumber
  return [...new Set([name, withoutNumber, withoutPrefix].filter(Boolean))]
}

function contentValue(content, name, preferred) {
  const candidates = [...new Set([...(preferred ?? []), ...nameCandidates(name)].filter(Boolean))]
  for (const candidate of candidates) if (has(content, candidate)) return [true, content[candidate]]
  return [false, undefined]
}

function repeatedContentKeysForName(name, content, occurrences) {
  const occurrence = occurrences.get(name) ?? 0
  occurrences.set(name, occurrence + 1)
  if (occurrence === 0) return null
  const key = `${name}_${occurrence + 1}`
  return has(content, key) ? [key] : null
}

function applyToElement(element, content, { directValue = false, preferred = null, occurrences = null } = {}) {
  if (!isRecord(element)) return element
  const values = isRecord(content) ? content : {}
  const type = element.type
  const name = typeof element.name === 'string' ? element.name : null
  let hasValue = false
  let value
  if (name) {
    if (directValue && ['container', 'flex', 'grid', 'group'].includes(type)) {
      if (has(values, name)) {
        hasValue = true
        value = values[name]
      } else if (Object.keys(values).length === 1) {
        for (const candidate of nameCandidates(name).slice(1)) {
          if (has(values, candidate)) {
            hasValue = true
            value = values[candidate]
            break
          }
        }
      }
    } else {
      if (preferred === null && occurrences !== null) preferred = repeatedContentKeysForName(name, values, occurrences)
      ;[hasValue, value] = contentValue(values, name, preferred)
    }
  }

  if (element.decorative === false && name && hasValue && GENERATED_VALUE_ELEMENT_TYPES.has(type)) return applyValue(element, value)
  // A repeated item that is itself the generated value has no child-name wrapper.
  if (directValue && !hasValue && element.decorative === false && GENERATED_VALUE_ELEMENT_TYPES.has(type)) return applyValue(element, content)

  const nestedContent = isRecord(value) ? value : values
  const nestedDirect = directValue && !hasValue
  const nestedOccurrences = hasValue && isRecord(value) ? new Map() : occurrences

  if (type === 'container') {
    const updated = clone(element)
    updated.child = applyToElement(element.child, nestedContent, { directValue: nestedDirect, occurrences: nestedOccurrences })
    return updated
  }
  if (['flex', 'grid', 'group'].includes(type)) {
    const updated = clone(element)
    const children = Array.isArray(element.children) ? element.children : []
    updated.children = applyToChildren(children, value, nestedContent, {
      directValue: nestedDirect,
      occurrences: nestedOccurrences,
      centerRepeated: type === 'group'
    })
    return updated
  }
  return clone(element)
}

function applyToChildren(children, value, content, { directValue, occurrences, centerRepeated }) {
  if (Array.isArray(value) && children.length) {
    return value.map((item, index) => applyToElement(repeatedChildForIndex(children, index, value.length, centerRepeated), item, { directValue: true }))
  }
  return applyToElementList(children, content, { directValue, occurrences })
}

function repeatedChildForIndex(children, index, contentCount, centerWhenReduced) {
  const source = clone(children[repeatedChildSourceIndex(index, children.length, contentCount, centerWhenReduced)])
  if (!isRecord(source)) return source
  delete source.__presenton_manual_position
  if (index >= children.length) normalizeRepeatedNames(source, index)
  return source
}

function normalizeRepeatedNames(value, index) {
  if (Array.isArray(value)) return value.forEach((item) => normalizeRepeatedNames(item, index))
  if (!isRecord(value)) return
  if (typeof value.name === 'string') value.name = value.name.replace(/_\d+(?=_|$)/g, `_${index + 1}`)
  Object.values(value).forEach((nested) => normalizeRepeatedNames(nested, index))
}

function applyToElementList(elements, content, { directValue = false, occurrences = null } = {}) {
  const scoped = occurrences ?? new Map()
  return elements.map((element) => applyToElement(element, content, { directValue, occurrences: scoped }))
}

function applyValue(element, value) {
  switch (element.type) {
    case 'text':
      return applyText(element, value)
    case 'math':
      return applyMath(element, value)
    case 'image':
      return applyImage(element, value)
    case 'text-list':
      return applyTextList(element, value)
    case 'table':
      return applyTable(element, value)
    case 'chart':
      return applyChart(element, value)
    default:
      return clone(element)
  }
}

function readText(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (isRecord(value)) {
    if (typeof value.text === 'string') return value.text
    if (typeof value.text === 'number' && Number.isFinite(value.text)) return String(value.text)
  }
  return null
}

function applyMath(element, value) {
  const latex = readText(value)
  if (latex === null || latex.trim() === '') return clone(element)
  let normalized = latex.trim()
  if (normalized.startsWith('$$') && normalized.endsWith('$$') && normalized.length > 4) normalized = normalized.slice(2, -2).trim()
  else if (normalized.startsWith('\\[') && normalized.endsWith('\\]') && normalized.length > 4) normalized = normalized.slice(2, -2).trim()
  const updated = clone(element)
  updated.latex = normalized.slice(0, 4000)
  return updated
}

function applyText(element, value) {
  const text = readText(value)
  if (text === null || text === '') return clone(element)
  const updated = clone(element)
  updated.runs = textRunsFromMarkdown(text, firstRun(element.runs), element.font)
  delete updated.text
  return updated
}

/**
 * Upstream sets `data` only from a generated URL. The view resolves icon names
 * to `icon_url` before hydration; an image keeps its placeholder and its prompt.
 */
function applyImage(element, value) {
  if (!isRecord(value)) return clone(element)
  const updated = clone(element)
  const prompt = assetPrompt(value, element.is_icon === true)
  if (prompt) updated.prompt = prompt
  const url = ['image_url', 'icon_url', '__image_url__', '__icon_url__', 'url'].map((key) => value[key]).find((candidate) => typeof candidate === 'string' && candidate)
  if (!url) return updated
  updated.data = url
  normalizeGeneratedImageFit(updated, url)
  return updated
}

function normalizeGeneratedImageFit(element, url) {
  if (element.is_icon === true || element.fit === 'cover') return
  if (['clip_path', 'clipPath', 'clippath'].some((key) => typeof element[key] === 'string' && element[key].trim() && element[key].trim().toLowerCase() !== 'none')) return
  if (url.trim().toLowerCase().startsWith('data:image/svg+xml') || /\.svg(?:[?#]|$)/i.test(url.trim())) return
  element.fit = 'cover'
}

function assetPrompt(value, isIcon) {
  const keys = isIcon ? ['icon_query', '__icon_query__', 'query', 'prompt'] : ['image_prompt', '__image_prompt__', 'prompt', 'query']
  for (const key of keys) if (typeof value[key] === 'string' && value[key].trim()) return value[key]
  return null
}

function applyTextList(element, value) {
  if (!Array.isArray(value)) return clone(element)
  const existing = Array.isArray(element.items) ? element.items : []
  const items = []
  value.forEach((item, index) => {
    const text = readText(item)
    if (text === null || text === '') return
    const runs = Array.isArray(existing[index]) ? existing[index] : null
    items.push(textRunsFromMarkdown(text, runs && isRecord(runs[0]) ? runs[0] : {}, element.font))
  })
  const updated = clone(element)
  updated.items = items
  return updated
}

function applyTable(element, value) {
  if (!isRecord(value)) return clone(element)
  const templateColumns = Array.isArray(element.columns) ? element.columns : []
  const templateRows = (Array.isArray(element.rows) ? element.rows : []).filter(Array.isArray)
  const columns = Array.isArray(value.columns) ? value.columns.map(readTableText) : []
  const rows = Array.isArray(value.rows) ? value.rows.filter(Array.isArray).map((row) => row.map(readTableText)) : []
  const fallbackRow = templateRows.length ? templateRows.at(-1) : templateColumns
  const updated = clone(element)
  updated.columns = columns.length ? mergeTableRow(templateColumns, columns, true) : clone(templateColumns)
  updated.rows = rows.length ? rows.map((row, index) => mergeTableRow(index < templateRows.length ? templateRows[index] : fallbackRow, row, false)) : clone(templateRows)
  return updated
}

function mergeTableRow(templateCells, texts, isHeader) {
  const fallback = templateCells.length ? templateCells.at(-1) : null
  return texts.map((text, index) => replaceTableCellText(index < templateCells.length ? templateCells[index] : fallback, text ?? '', isHeader))
}

function replaceTableCellText(cell, text, isHeader) {
  const font = isHeader ? GENERATED_TABLE_HEADER_FONT : GENERATED_TABLE_TEXT_FONT
  if (!isRecord(cell)) {
    return { color: GENERATED_TABLE_CELL_FILL, stroke: GENERATED_TABLE_CELL_STROKE, font, runs: textRunsFromMarkdown(text, { font }) }
  }
  const updated = clone(cell)
  const first = firstRun(cell.runs)
  const runFont = isRecord(first.font) ? first.font : null
  const nextFont = runFont || cell.font || font
  updated.color = cell.color || cell.fill || GENERATED_TABLE_CELL_FILL
  updated.stroke = cell.stroke || GENERATED_TABLE_CELL_STROKE
  updated.font = cell.font || nextFont
  updated.runs = textRunsFromMarkdown(text, first, nextFont)
  delete updated.text
  delete updated.fill
  return updated
}

function readPrimitiveTableText(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function readTableText(value) {
  const primitive = readPrimitiveTableText(value)
  if (primitive !== null) return [...primitive].slice(0, 80).join('')
  if (!isRecord(value)) return null
  if (Array.isArray(value.runs)) {
    const text = value.runs.map((run) => (isRecord(run) && typeof run.text === 'string' ? run.text : '')).join('')
    if (text) return [...text].slice(0, 80).join('')
  }
  for (const key of ['text', 'value']) {
    const text = readPrimitiveTableText(value[key])
    if (text !== null) return [...text].slice(0, 80).join('')
  }
  return null
}

function readDataLabels(value) {
  if (value === true) return 'top'
  if (typeof value === 'string' && ['base', 'mid', 'top', 'outside'].includes(value.trim().toLowerCase())) return value.trim().toLowerCase()
  return null
}

function applyChart(element, value) {
  const updated = clone(element)
  delete updated.data_labels_color
  delete updated.grid
  if (!isRecord(value)) return updated
  const chartType = value.chartType ?? value.chart_type
  if (CHART_TYPES.has(chartType)) updated.chart_type = chartType
  if (typeof value.title === 'string') updated.title = value.title
  if (Array.isArray(value.categories) && value.categories.length) updated.categories = value.categories
  if (Array.isArray(value.series) && value.series.length) updated.series = value.series
  if (Array.isArray(value.colors) && value.colors.length) updated.colors = value.colors
  for (const [source, target] of [
    ['axisColor', 'axis_color'], ['axis_color', 'axis_color'], ['gridColor', 'grid_color'], ['grid_color', 'grid_color'],
    ['legendColor', 'legend_color'], ['legend_color', 'legend_color'], ['xAxisTitle', 'x_axis_title'], ['x_axis_title', 'x_axis_title'],
    ['yAxisTitle', 'y_axis_title'], ['y_axis_title', 'y_axis_title'], ['source', 'source']
  ]) {
    if (typeof value[source] === 'string') updated[target] = value[source]
  }
  for (const [source, target] of [
    ['xAxis', 'x_axis'], ['x_axis', 'x_axis'], ['yAxis', 'y_axis'], ['y_axis', 'y_axis'],
    ['xAxisGrid', 'x_axis_grid'], ['x_axis_grid', 'x_axis_grid'], ['yAxisGrid', 'y_axis_grid'], ['y_axis_grid', 'y_axis_grid']
  ]) {
    if (typeof value[source] === 'boolean') updated[target] = value[source]
  }
  for (const source of ['dataLabels', 'data_labels']) if (has(value, source)) updated.data_labels = readDataLabels(value[source])
  return updated
}

function firstRun(runs) {
  return Array.isArray(runs) && isRecord(runs[0]) ? runs[0] : {}
}

/** Markdown `**bold**`, `__bold__`, `*italic*`, `_italic_` to text runs over the template's first run. */
export function textRunsFromMarkdown(text, first, fallbackFont) {
  // Upstream sends an unclosed leading `**` through its LaTeX-aware path, which drops the marker.
  const source = text.startsWith('**') && text.indexOf('**', 2) === -1 ? text.slice(2) : text
  const parsed = parseMarkdown(source)
  const styled = parsed.some(([, style]) => Object.keys(style).length)
  const base = baseRun(isRecord(first) ? clone(first) : {}, fallbackFont, styled)
  const runs = []
  for (const [part, style] of parsed) {
    const run = clone(base)
    run.text = part
    if (Object.keys(style).length) run.font = { ...(isRecord(run.font) ? run.font : {}), ...style }
    appendRun(runs, run)
  }
  return runs.length ? runs : [{ ...base, text: ' ' }]
}

function baseRun(run, fallbackFont, stripEmphasis) {
  if (isRecord(fallbackFont)) run.font = { ...clone(fallbackFont), ...(isRecord(run.font) ? clone(run.font) : {}) }
  else if (isRecord(run.font)) run.font = clone(run.font)
  if (stripEmphasis && isRecord(run.font)) {
    delete run.font.bold
    delete run.font.italic
  }
  return run
}

export function parseMarkdown(text) {
  const parsed = []
  let index = 0
  while (index < text.length) {
    const strong = STRONG.find((delimiter) => text.startsWith(delimiter, index))
    if (strong) {
      const close = text.indexOf(strong, index + strong.length)
      if (close > index + strong.length) {
        parsed.push([text.slice(index + strong.length, close), { bold: true }])
        index = close + strong.length
        continue
      }
    }
    const emphasis = EMPHASIS.find((delimiter) => text.startsWith(delimiter, index))
    if (emphasis) {
      const close = text.indexOf(emphasis, index + emphasis.length)
      if (close > index + emphasis.length) {
        parsed.push([text.slice(index + emphasis.length, close), { italic: true }])
        index = close + emphasis.length
        continue
      }
    }
    const next = nextDelimiter(text, index + 1)
    parsed.push([text.slice(index, next === -1 ? text.length : next), {}])
    index = next === -1 ? text.length : next
  }
  return parsed
}

function nextDelimiter(text, start) {
  const found = DELIMITERS.map((delimiter) => text.indexOf(delimiter, start)).filter((index) => index !== -1)
  return found.length ? Math.min(...found) : -1
}

function appendRun(runs, run) {
  if (typeof run.text !== 'string' || run.text === '') return
  const previous = runs.at(-1)
  if (isRecord(previous) && typeof previous.text === 'string') {
    const { text: _a, ...previousStyle } = previous
    const { text: _b, ...nextStyle } = run
    if (sameValue(previousStyle, nextStyle)) {
      previous.text += run.text
      return
    }
  }
  runs.push(run)
}

function sameValue(a, b) {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameValue(item, b[index]))
  if (!isRecord(a) || !isRecord(b)) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => has(b, key) && sameValue(a[key], b[key]))
}
