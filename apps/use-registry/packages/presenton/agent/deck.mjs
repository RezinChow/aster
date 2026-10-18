// Presenton's three generation calls, ported from servers/fastapi/utils/llm_calls
// (generate_presentation_outlines, generate_presentation_structure,
// generate_slide_content) and its schema-feedback loop (utils/llm_utils). One
// view turn runs one step; the host answers each model request.
import { ICON_NAMES } from './icons.mjs'
import { LANGUAGES } from './languages.mjs'
import { TEMPLATES } from './templates.mjs'

export { LANGUAGES }
export const DEFAULT_MODEL = 'bailian/deepseek-v4.1-flash'
export const MAX_OUTLINE_CONTENT_WORDS = 100
/** A deck's outline and slides travel in one 64 KiB turn output and one 64 KiB view state. */
export const MAX_DECK_SLIDES = 20
/** A turn has 90 s and 16 model requests; three requests leave room for slow replies. */
export const MAX_REQUESTS_PER_TURN = 3
const RETRY_BUDGET_MS = 45_000
const MAX_FIELD = 12_000

export const STEPS = ['outline', 'structure', 'slide']
export const TONES = ['default', 'casual', 'professional', 'funny', 'educational', 'sales_pitch']
export const VERBOSITIES = ['concise', 'standard', 'text-heavy']
/**
 * Template text limits are measured in Latin characters; a CJK character is
 * about two Latin characters wide, so these languages get half the length.
 */
const FULL_WIDTH_LANGUAGES = new Set([
  'Chinese (Simplified - 中文, 汉语)',
  'Chinese (Traditional - 中文, 漢語)',
  'Japanese (日本語)',
  'Korean (한국어)'
])
for (const language of FULL_WIDTH_LANGUAGES) {
  if (!LANGUAGES.includes(language)) throw new Error(`full-width language ${language} is not an upstream language`)
}
const ICON_SET = new Set(ICON_NAMES)

function parseClosed(value, set, name) {
  if (set.includes(value)) return value
  throw new Error(`${name} must be one of: ${set.join(', ')}`)
}

function text(value, name, { required = false, max = MAX_FIELD } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${name} is required`)
    return ''
  }
  if (typeof value !== 'string' || value.length > max) throw new Error(`${name} must be text of at most ${max} characters`)
  return value.trim()
}

export function modelId(parameters) {
  const requested = parameters?.model
  return typeof requested === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(requested) ? requested : DEFAULT_MODEL
}

function templateFor(id) {
  if (typeof id !== 'string' || !Object.hasOwn(TEMPLATES, id)) {
    throw new Error(`template must be one of: ${Object.keys(TEMPLATES).join(', ')}`)
  }
  return TEMPLATES[id]
}

/** Read one step's settings; a malformed request names the field it got wrong. */
export function settingsFrom(parameters) {
  const p = parameters && typeof parameters === 'object' ? parameters : {}
  const step = parseClosed(p.step, STEPS, 'step')
  const common = {
    step,
    model: modelId(p),
    instructions: text(p.instructions, 'instructions', { max: 4000 })
  }
  if (step === 'outline') {
    // null lets the model choose, as upstream's "Auto" slide count does.
    const n = p.n_slides ?? null
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > MAX_DECK_SLIDES)) {
      throw new Error(`n_slides must be null or an integer from 1 to ${MAX_DECK_SLIDES}`)
    }
    return {
      ...common,
      content: text(p.content, 'content', { required: true }),
      n_slides: n,
      language: parseClosed(p.language, LANGUAGES, 'language'),
      tone: parseClosed(p.tone ?? 'default', TONES, 'tone'),
      verbosity: parseClosed(p.verbosity ?? 'standard', VERBOSITIES, 'verbosity'),
      include_title_slide: p.include_title_slide !== false
    }
  }
  const template = templateFor(p.template)
  if (step === 'structure') {
    if (!Array.isArray(p.outline) || p.outline.length < 1 || p.outline.length > MAX_DECK_SLIDES) {
      throw new Error(`outline must list 1 to ${MAX_DECK_SLIDES} slides`)
    }
    return {
      ...common,
      template: p.template,
      layouts: template.layouts,
      outline: p.outline.map((slide, index) => text(slide, `outline[${index}]`, { required: true, max: 4000 })),
      content: text(p.content, 'content')
    }
  }
  const layout = template.layouts.find((entry) => entry.id === p.layout)
  if (!layout) throw new Error(`layout must be a layout id of template ${p.template}`)
  if (!Number.isInteger(p.slide_number) || p.slide_number < 1 || p.slide_number > MAX_DECK_SLIDES) {
    throw new Error('slide_number must be a one-based slide number')
  }
  return {
    ...common,
    template: p.template,
    layout,
    outline: text(p.outline, 'outline', { required: true, max: 4000 }),
    slide_number: p.slide_number,
    language: parseClosed(p.language, LANGUAGES, 'language'),
    tone: parseClosed(p.tone ?? 'default', TONES, 'tone'),
    verbosity: parseClosed(p.verbosity ?? 'standard', VERBOSITIES, 'verbosity')
  }
}

// ---- outline (generate_presentation_outlines.py) ----

const DIRECT_CONTENT_VOICE_RULES = `Content voice rules:
- Write the content itself, not commentary about the presentation medium.
- Never refer to "this presentation", "this slide", "this deck", "the following slide", "the previous slide", or similar phrases.
- Never use meta-introductions such as "this presentation explores", "this slide presents", "we will discuss", "here we show", or equivalent wording.
- Start directly with the subject, claim, finding, action, or relevant fact.
- Treat the supplied current date as context only. Do not mention it or begin content with it unless the user explicitly requests the date or it is substantively relevant to the source content.
`

export function outlineSystemPrompt(verbosity, includeTitleSlide) {
  const verbosityInstruction =
    verbosity === 'concise'
      ? 'Slide content should be around 20 words but detailed enough to generate a good slide.'
      : verbosity === 'text-heavy'
        ? 'Slide content should be around 60 words but detailed enough to generate a good slide.'
        : 'Slide content should be around 40 words but detailed enough to generate a good slide.'
  const titleSlideInstruction = includeTitleSlide ? 'Include presenter name in first slide.' : 'Do not include presenter name in any slides.'
  const slideOutlineStructure =
    'Each slide content:\n' +
    '   - Must have a ## title.\n' +
    '   - Must be in Markdown format.\n' +
    "   - Don't use **bold** and __italic__ text.\n" +
    '   - First slide title must be the same as the presentation title.'
  const contentOnlyRules =
    'Slide outlines are a user-visible content plan, not a production brief.\n' +
    'Write only audience-facing content and data that could appear on the finished slide.\n' +
    'Never include or paraphrase commands, configuration, or meta-commentary about how ' +
    'to create the slide. This includes requests about slide type, charts, graphs, ' +
    'tables, images, icons, layout, positioning, colors, fonts, styling, animation, ' +
    'or transitions.\n' +
    "Do not write phrases such as 'create a bar chart', 'add an image', 'use a table', " +
    "'show this as', 'the slide should', or 'place on the left'.\n" +
    'Use visual requests only to choose content for the specified slide. For any chart ' +
    'request, include a compact Markdown table with labels and numeric values. Preserve ' +
    'supplied data; otherwise add a small relevant dataset and clearly label estimates ' +
    'or illustrative values. Do not mention the chart instruction.\n' +
    "Example: for 'slide 5: create a bar chart of Q1 10, Q2 20', slide 5 may contain " +
    "a title and a Quarter | Value Markdown table, but it must not contain the words " +
    "'create a bar chart'.\n"
  return (
    'Generate presentation title and content for slides.\n' +
    'Generation settings are authoritative. The Number of Slides, Language, Tone, ' +
    'Include Title Slide, and Include Table Of Contents fields override conflicting ' +
    'requests inside Content, Instructions, or Context.\n' +
    'If Language is not auto-detect, generate every presentation title and slide ' +
    'outline in exactly that language, even if Content asks for a different language.\n' +
    'Generate flow based on user **content** and use **context** just for reference.\n' +
    `${DIRECT_CONTENT_VOICE_RULES}\n` +
    'Presentation title should be plain text, not markdown. It should be a concise title for the presentation.\n' +
    'Each slide content should contain the content for that slide.\n' +
    `Never generate more than ${MAX_DECK_SLIDES} slide outlines, even if the user asks for more. ` +
    `Each slide outline must be ${MAX_OUTLINE_CONTENT_WORDS} words or fewer.\n` +
    `${verbosityInstruction}\n` +
    'Follow the intended outcome of user instructions when they do not conflict with ' +
    'the authoritative generation settings, but never copy production instructions ' +
    'into slide content.\n' +
    'Apply slide-specific instructions only to the exact slide mentioned and only once. ' +
    'Do not apply patterns across multiple slides unless explicitly requested. ' +
    'Resolve ambiguous instructions using the most direct interpretation.\n' +
    "Follow the user's specified tone across all slides. " +
    'Maintain clarity, readability, and factual accuracy. ' +
    'If no tone is provided, use a clear and professional style. ' +
    'Ensure logical flow between slides and avoid repetition or generic filler content.\n' +
    'Give each slide one clear purpose and split overloaded topics across multiple slides.\n' +
    'Minimize repetitive phrasing and do not repeat the same facts across slides.\n' +
    'Build a coherent narrative from the introduction through the conclusion.\n' +
    'Vary audience-facing content structures where appropriate, using bullets, comparisons, chronological facts, tables, or metrics.\n' +
    'Use concrete facts, examples, and numbers when supported by the provided content/context.\n' +
    'Include numerical data, tables or code if required or asked by the user.\n' +
    "If 'auto-detect' is used, figure it out from the content/context.\n" +
    `${titleSlideInstruction}\n` +
    `${slideOutlineStructure}\n` +
    `${contentOnlyRules}` +
    'Slide content must not contain any presentation branding/styling information.\n' +
    'Title slide must only contain title, presenter name, date and overview.\n' +
    'Do not include URLs, hyperlinks, citations, footnotes, references, or source lists in slide outlines.\n' +
    'Make sure data is consistent across all slides.\n'
  )
}

export function outlineUserPrompt(settings, date) {
  return (
    'Generation Settings (authoritative):\n' +
    `Number of Slides: ${settings.n_slides ?? `auto-detect, maximum ${MAX_DECK_SLIDES}`}\n` +
    `Maximum Slide Outlines: ${MAX_DECK_SLIDES}\n` +
    `Maximum Words Per Outline: ${MAX_OUTLINE_CONTENT_WORDS}\n` +
    `Language: ${settings.language}\n` +
    `Tone: ${settings.tone}\n` +
    `Include Title Slide: ${settings.include_title_slide ? 'True' : 'False'}\n` +
    'If Content, Instructions, or Context asks for a different language or slide count, ignore that conflicting request.\n' +
    `Today's Date: ${date}\n` +
    `Content: ${settings.content}\n` +
    `Instructions (apply as constraints; never quote as slide content): ${settings.instructions}\n` +
    'Context: None\n'
  )
}

export function outlineSchema(n, language) {
  return scaleLengths(
    {
      type: 'object',
      properties: {
        slides: {
          type: 'array',
          description: 'List of slide outlines',
          minItems: n ?? 1,
          maxItems: n ?? MAX_DECK_SLIDES,
          items: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: `Audience-facing Markdown content and data for the finished slide. Maximum ${MAX_OUTLINE_CONTENT_WORDS} words.`,
                minLength: 100,
                maxLength: 1200
              }
            },
            required: ['content']
          }
        }
      },
      required: ['slides']
    },
    language
  )
}

// ---- structure (generate_presentation_structure.py) ----

export function layoutString(layouts) {
  let message = '## Presentation Layout\n\n'
  layouts.forEach((slide, index) => {
    message += `### Slide Layout: ${index}\n`
    message += `- Name: ${slide.name || slide.schema?.title}\n`
    message += `- Description: ${slide.description}\n`
    message += '\n'
  })
  return message
}

export function outlineString(outline) {
  return outline.map((content, index) => `## Slide ${index + 1}:\n  - Content: ${content} \n`).join('')
}

export function structureSystemPrompt(n, instructions, content) {
  const intent = []
  if (instructions) intent.push(`# User Instructions:\n${instructions}`)
  if (content) intent.push(`# Original User Request:\n${content}`)
  return `
You're a professional presentation designer with creative freedom to design engaging presentations.

# DESIGN PHILOSOPHY
- Create visually compelling and varied presentations
- Match layout to content purpose and audience needs

# Layout Selection Guidelines
1. **Content-driven choices**: Let the slide's purpose guide layout selection
- Opening/closing → Title layouts
- Processes/workflows → Visual process layouts  
- Comparisons/contrasts → Side-by-side layouts
- Data/metrics → Chart/graph layouts
- Concepts/ideas → Image + text layouts
- Key insights → Emphasis layouts

2. **Visual variety**: Aim for diverse slide layouts across the presentation. 
- Don't use same layout for multiple slides unless necessary.
- Mix text-heavy and visual-heavy slides naturally
- Use your judgment on when repetition serves the content
- Balance information density across slides
- Adjacent slide layouts should be different unless instructed/necessary otherwise.

3. **Audience experience**: Consider how slides work together
- Create natural transitions between topics

4. **Table of contents**:
- Must only use table of contents layout if slide content contains table of contents.

${intent.join('\n\n')}

Extract visual constraints from User Instructions and Original User Request; User
Instructions win conflicts. The supplied slide count is authoritative. Slide numbers are
one-based, and "all" or "every" includes the title slide. Prefer exact chart types and
image placements over variety, reusing layouts if needed. A numeric table on a
chart-requested slide is chart data, not a request for a table-only layout.

Select layout index for each of the ${n} slides based on what will best serve the presentation's goals.

`
}

export function structureSchema(n) {
  return {
    type: 'object',
    properties: {
      slides: { type: 'array', description: 'List of slide layouts', minItems: n, maxItems: n, items: { type: 'integer' } }
    },
    required: ['slides']
  }
}

/** Upstream fills missing or out-of-range picks at random; this fills them in order. */
export function normalizeStructure(picks, count, layoutCount) {
  const out = []
  for (let index = 0; index < count; index += 1) {
    const pick = Array.isArray(picks) ? picks[index] : undefined
    out.push(Number.isInteger(pick) && pick >= 0 && pick < layoutCount ? pick : index % layoutCount)
  }
  return out
}

// ---- slide content (generate_slide_content.py) ----

const SLIDE_CONTENT_SYSTEM_PROMPT = `
You will be given slide content and response schema.
You need to generate structured content json based on the schema.

# Steps
1. Analyze the content.
2. Analyze the response schema.
3. Generate structured content json based on the schema.
4. Generate speaker note if required.
5. Provide structured content json as output.

# General Rules
- Follow language guidelines.
- Slide Language is authoritative when it is explicitly set. If slide content
  or user instructions request a different language, ignore that conflicting
  language request unless Slide Language says auto-detect.
- Speaker notes must be plain text (no markdown).
- Never exceed max character limits; do not clip mid-sentence to fit—rephrase instead.
- Do not use emojis or $schema fields.
- Follow the intended outcome of user instructions when they do not conflict with Slide
  Language; do not generalize or expand their scope.
- Apply slide-specific instructions only to the exact slide mentioned (first/second/last/named) and only once.
- Do not apply patterns across multiple slides unless explicitly requested.
- If instructions are ambiguous, use the most direct interpretation without extending scope.
- Treat chart, layout, styling, positioning, and other visual instructions as production
  controls. Honor them through the selected schema, but never emit those instructions or
  meta-commentary as a title, body, label, table cell, or speaker note.
- Output fields must contain only audience-facing content and data. For chart fields,
  populate the requested labels, series, and values rather than text such as "create a
  bar chart" or "show this data as a graph".
- Write formulas as plain text; the slides cannot typeset LaTeX.

{markdown_emphasis_rules}

{user_instructions}

{tone_instructions}

{verbosity_instructions}

{output_fields_instructions}
`

export function slideSystemPrompt(settings, schema) {
  const fill = {
    markdown_emphasis_rules: '- Strictly use markdown to emphasize important points, by bolding or italicizing the part of text.',
    user_instructions: settings.instructions ? `# User Instructions:\n${settings.instructions}` : '',
    tone_instructions: settings.tone ? `# Tone Instructions:\nMake slide as ${settings.tone} as possible.` : '',
    verbosity_instructions: settings.verbosity ? `# Verbosity Instructions:\nMake slide as ${settings.verbosity} as possible.` : '',
    output_fields_instructions: `# Output Fields:\n- Follow this response schema exactly: ${JSON.stringify(promptSchema(schema))}`
  }
  let prompt = SLIDE_CONTENT_SYSTEM_PROMPT.replace(/\{(\w+)\}/g, (match, key) => (Object.hasOwn(fill, key) ? fill[key] : match))
  if (hasIconField(schema)) {
    prompt += `\n# Icon Names:\nEvery icon_query must be exactly one of these names: ${ICON_NAMES.join(', ')}\n`
  }
  return prompt
}

export function slideUserPrompt(settings, dateTime) {
  return `
# Current Date and Time:
${dateTime}

# Icon Query And Image Prompt Language:
English

# Slide Language:
${settings.language}

# Slide Number:
${settings.slide_number}

# SLIDE CONTENT: START
${settings.outline}
# SLIDE CONTENT: END
`
}

/** The layout's upstream schema, with icon fields bound to the vendored icon names. */
export function slideSchema(layout, language) {
  if (!layout.schema) return null
  const bind = (node) => {
    if (Array.isArray(node)) return node.map(bind)
    if (!node || typeof node !== 'object') return node
    const out = {}
    for (const [key, value] of Object.entries(node)) {
      if (key === '$schema') continue
      out[key] = key === 'properties' ? Object.fromEntries(Object.entries(value).map(([name, child]) => [name, name === 'icon_query' ? { type: 'string', icon: true } : bind(child)])) : bind(value)
    }
    return out
  }
  return scaleLengths(bind(layout.schema), language)
}

function hasIconField(node) {
  if (Array.isArray(node)) return node.some(hasIconField)
  if (!node || typeof node !== 'object') return false
  return node.icon === true || Object.values(node).some(hasIconField)
}

/** The schema as the model reads it: `icon` is this package's marker, not JSON Schema. */
function promptSchema(node) {
  if (Array.isArray(node)) return node.map(promptSchema)
  if (!node || typeof node !== 'object') return node
  if (node.icon === true) return { type: 'string', description: 'Exactly one name from the Icon Names list' }
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, promptSchema(value)]))
}

function scaleLengths(schema, language) {
  if (!FULL_WIDTH_LANGUAGES.has(language)) return schema
  const scale = (node) => {
    if (Array.isArray(node)) return node.map(scale)
    if (!node || typeof node !== 'object') return node
    const out = {}
    for (const [key, value] of Object.entries(node)) {
      if (key === 'minLength' && typeof value === 'number') out[key] = Math.ceil(value / 2)
      else if (key === 'maxLength' && typeof value === 'number') out[key] = Math.max(1, Math.floor(value / 2))
      else out[key] = scale(value)
    }
    return out
  }
  return scale(schema)
}

// ---- validation (utils/llm_utils.py, jsonschema subset the templates use) ----

const length = (value) => [...value].length
const show = (value) => {
  const json = JSON.stringify(value)
  return json.length > 60 ? `${json.slice(0, 57)}...` : json
}

/** Errors as `path: message`, like upstream's jsonschema feedback. */
export function validate(schema, value, path = '$', errors = []) {
  if (!schema || typeof schema !== 'object') return errors
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${show(value)} is not one of ${JSON.stringify(schema.enum)}`)
    return errors
  }
  switch (schema.type) {
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path}: ${show(value)} is not of type 'object'`)
        return errors
      }
      for (const key of schema.required ?? []) {
        if (!Object.hasOwn(value, key)) errors.push(`${path}: '${key}' is a required property`)
      }
      for (const [key, child] of Object.entries(schema.properties ?? {})) {
        if (Object.hasOwn(value, key)) validate(child, value[key], `${path}.${key}`, errors)
      }
      return errors
    }
    case 'array': {
      if (!Array.isArray(value)) {
        errors.push(`${path}: ${show(value)} is not of type 'array'`)
        return errors
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: should have at least ${schema.minItems} items, has ${value.length}`)
      if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: should have at most ${schema.maxItems} items, has ${value.length}`)
      value.forEach((item, index) => validate(schema.items, item, `${path}[${index}]`, errors))
      return errors
    }
    case 'string': {
      if (typeof value !== 'string') {
        errors.push(`${path}: ${show(value)} is not of type 'string'`)
        return errors
      }
      if (schema.minLength !== undefined && length(value) < schema.minLength) errors.push(`${path}: ${show(value)} is too short (${length(value)} characters, minimum ${schema.minLength})`)
      if (schema.maxLength !== undefined && length(value) > schema.maxLength) errors.push(`${path}: ${show(value)} is too long (${length(value)} characters, maximum ${schema.maxLength})`)
      if (schema.icon === true && !ICON_SET.has(value)) errors.push(`${path}: ${show(value)} is not one of the Icon Names`)
      return errors
    }
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${path}: ${show(value)} is not of type 'number'`)
      return errors
    case 'integer':
      if (!Number.isInteger(value)) errors.push(`${path}: ${show(value)} is not of type 'integer'`)
      return errors
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path}: ${show(value)} is not of type 'boolean'`)
      return errors
    default:
      return errors
  }
}

export function feedbackMessage(value, errors) {
  const shown = errors.slice(0, 10)
  if (errors.length > 10) shown.push(`...and ${errors.length - 10} more validation errors.`)
  let previous = JSON.stringify(value, null, 2)
  if (previous.length > 6000) previous = `${previous.slice(0, 6000)}\n... (truncated)`
  return (
    'The previous JSON response did not match the required response schema.\n\n' +
    'Validation errors:\n' +
    shown.map((error) => `- ${error}`).join('\n') +
    '\n\nPrevious invalid JSON:\n' +
    `\`\`\`json\n${previous}\n\`\`\`\n\n` +
    'Return corrected JSON only. Make sure it fully matches the required schema.'
  )
}

// ---- model exchange ----

export function modelRequest(model, messages, maxTokens) {
  return {
    model,
    stream: false,
    max_tokens: maxTokens,
    reasoning_effort: 'none',
    response_format: { type: 'json_object' },
    messages
  }
}

/** The JSON object in a finished chat reply, or why there is none. */
export function replyObject(status, body) {
  if (status !== 200) return { error: `model unavailable (${status})` }
  const choice = Array.isArray(body?.choices) && body.choices.length === 1 ? body.choices[0] : null
  if (!choice) return { error: 'model reply has no choice' }
  if (choice.finish_reason === 'length') return { error: 'model reply was cut off' }
  const content = choice.message?.content
  if (typeof content !== 'string' || !content.trim()) return { error: 'model reply is empty' }
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(content.trim())
  try {
    const value = JSON.parse(fenced ? fenced[1] : content)
    return value && typeof value === 'object' && !Array.isArray(value) ? { value } : { error: 'model reply is not a JSON object' }
  } catch {
    return { error: 'model reply is not JSON' }
  }
}

function responseFormatNote(schema) {
  return `\n# Response Format\nReturn only one JSON object that matches this JSON schema:\n${JSON.stringify(schema)}\n`
}

/**
 * Ask until the reply validates, at most MAX_REQUESTS_PER_TURN times. Like
 * upstream, the last parsed reply is kept when fixes run out.
 */
async function generate(ask, model, messages, schema, maxTokens, now) {
  const working = [...messages]
  const started = now()
  let last = null
  let error = null
  for (let attempt = 0; attempt < MAX_REQUESTS_PER_TURN; attempt += 1) {
    if (attempt > 0 && now() - started > RETRY_BUDGET_MS) break
    const reply = await ask(modelRequest(model, working, maxTokens))
    const parsed = replyObject(reply.status, reply.body)
    if (parsed.error) {
      error = parsed.error
      if (reply.status !== 200) break
      continue
    }
    const errors = validate(schema, parsed.value)
    last = { value: parsed.value, errors, requests: attempt + 1 }
    if (!errors.length) return last
    working.push({ role: 'assistant', content: JSON.stringify(parsed.value) }, { role: 'user', content: feedbackMessage(parsed.value, errors) })
  }
  return last ?? { error: error ?? 'model gave no answer' }
}

const isoDate = (date) => date.toISOString().slice(0, 10)
const isoDateTime = (date) => date.toISOString().slice(0, 19).replace('T', ' ')

/**
 * Run one step. `ask(body)` sends one chat request and resolves to the host's
 * `{status, body}`. The result is the turn's output object.
 */
export async function runStep(parameters, ask, clock = () => new Date()) {
  const settings = settingsFrom(parameters)
  const now = () => clock().getTime()
  const model = settings.model
  if (settings.step === 'outline') {
    const schema = outlineSchema(settings.n_slides, settings.language)
    const messages = [
      { role: 'system', content: outlineSystemPrompt(settings.verbosity, settings.include_title_slide) + responseFormatNote(schema) },
      { role: 'user', content: outlineUserPrompt(settings, isoDate(clock())) }
    ]
    const result = await generate(ask, model, messages, schema, 8192, now)
    if (result.error) return { step: 'outline', error: result.error, model }
    const slides = Array.isArray(result.value.slides) ? result.value.slides : []
    const outline = slides
      .map((slide) => (typeof slide?.content === 'string' ? slide.content.trim() : ''))
      .filter(Boolean)
      .slice(0, settings.n_slides ?? MAX_DECK_SLIDES)
    if (!outline.length) return { step: 'outline', error: 'model reply has no slide outlines', model }
    return { step: 'outline', outline, model, requests: result.requests, issues: result.errors.slice(0, 10) }
  }
  if (settings.step === 'structure') {
    const n = settings.outline.length
    const schema = structureSchema(n)
    const messages = [
      { role: 'system', content: structureSystemPrompt(n, settings.instructions, settings.content) + responseFormatNote(schema) },
      {
        role: 'user',
        content: `${layoutString(settings.layouts)}\n\n--------------------------------------\n\n${outlineString(settings.outline)}`
      }
    ]
    const result = await generate(ask, model, messages, schema, 1024, now)
    const count = settings.layouts.length
    if (result.error) {
      return { step: 'structure', layouts: normalizeStructure(null, n, count).map((index) => settings.layouts[index].id), source: 'rule', note: result.error, model }
    }
    const picks = normalizeStructure(result.value.slides, n, count)
    return { step: 'structure', layouts: picks.map((index) => settings.layouts[index].id), source: 'model', model, requests: result.requests }
  }
  const schema = slideSchema(settings.layout, settings.language)
  if (!schema) return { step: 'slide', layout: settings.layout.id, content: {}, model, requests: 0 }
  const messages = [
    { role: 'system', content: slideSystemPrompt(settings, schema) },
    { role: 'user', content: slideUserPrompt(settings, isoDateTime(clock())) }
  ]
  const result = await generate(ask, model, messages, schema, 4096, now)
  if (result.error) return { step: 'slide', layout: settings.layout.id, error: result.error, model }
  return { step: 'slide', layout: settings.layout.id, content: result.value, model, requests: result.requests, issues: result.errors.slice(0, 10) }
}
