// Apply view-zh.mjs pairs to one upstream source file through its syntax
// tree, so only string literals, JSX text and template literals can change;
// identifiers, keys and imports never do.

function sourceFile(ts, file, source) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
}

const isImportSpecifier = (ts, node) =>
  ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isExternalModuleReference(node.parent) ||
  (ts.isCallExpression(node.parent) && node.parent.expression.kind === ts.SyntaxKind.ImportKeyword) ||
  ts.isLiteralTypeNode(node.parent)

/** The JSX attribute, object property or call a literal is the value of. */
function scopeOf(ts, sf, node) {
  if (ts.isJsxText(node)) return 'jsx'
  let value = node
  const isResult = (parent) =>
    ts.isParenthesizedExpression(parent) ||
    (ts.isConditionalExpression(parent) && parent.condition !== value) ||
    (ts.isBinaryExpression(parent) && parent.right === value &&
      [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(parent.operatorToken.kind))
  while (isResult(value.parent)) value = value.parent
  const parent = value.parent
  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) return parent.parent.name.getText(sf)
  if (ts.isJsxAttribute(parent)) return parent.name.getText(sf)
  if (ts.isPropertyAssignment(parent) && parent.initializer === value) return parent.name.getText(sf).replace(/^["']|["']$/g, '')
  if (ts.isCallExpression(parent) && parent.expression !== value) return parent.expression.getText(sf)
  return null
}

const templateKey = (ts, node) => node.head.text + node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join('')

function quoted(text, quote) {
  if (quote === '"') return JSON.stringify(text)
  const escaped = text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
  return quote === "'" ? `'${escaped.replace(/'/g, "\\'")}'` : `\`${escaped.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``
}

/** Source with every matching literal translated; each pair must match. */
export function translate(ts, file, source, pairs) {
  const sf = sourceFile(ts, file, source)
  const hits = new Set()
  const pairFor = (key, node) => {
    const scope = scopeOf(ts, sf, node)
    const pair = pairs.find(([english, , only]) => english === key && (only === undefined || only === scope))
    if (pair) hits.add(pair)
    return pair
  }
  const visit = (node, edits) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isImportSpecifier(ts, node)) {
      const pair = pairFor(node.text, node)
      if (pair) {
        const start = node.getStart(sf)
        edits.push([start, node.end, quoted(pair[1], source[start])])
      }
      return
    }
    if (ts.isJsxText(node)) {
      const key = node.text.replace(/\s+/g, ' ').trim()
      const pair = key && pairFor(key, node)
      if (pair) {
        if (/[{}<>]/.test(pair[1])) throw new Error(`${file}: JSX text translation ${JSON.stringify(pair[1])} contains { } < or >`)
        const raw = source.slice(node.pos, node.end)
        const lead = raw.length - raw.trimStart().length
        const trail = raw.length - raw.trimEnd().length
        edits.push([node.pos + lead, node.end - trail, pair[1]])
      }
      return
    }
    if (ts.isTemplateExpression(node)) {
      const pair = pairFor(templateKey(ts, node), node)
      if (pair) {
        const spans = node.templateSpans
        const used = new Set()
        const parts = pair[1].split(/\{(\d+)\}/)
        let text = '`'
        parts.forEach((part, index) => {
          if (index % 2 === 0) {
            text += quoted(part, '`').slice(1, -1)
            return
          }
          const span = spans[Number(part)]
          if (!span) throw new Error(`${file}: ${JSON.stringify(pair[1])} names substitution {${part}} that ${JSON.stringify(pair[0])} lacks`)
          used.add(Number(part))
          text += '${' + translated(span.expression) + '}'
        })
        if (used.size !== spans.length) throw new Error(`${file}: ${JSON.stringify(pair[1])} drops a substitution of ${JSON.stringify(pair[0])}`)
        edits.push([node.getStart(sf), node.end, text + '`'])
        return
      }
    }
    ts.forEachChild(node, (child) => visit(child, edits))
  }
  /** A node's source with the pairs inside it applied. */
  const translated = (node) => {
    const inner = []
    visit(node, inner)
    return applyEdits(source.slice(0, node.end), inner).slice(node.getStart(sf))
  }
  const edits = []
  visit(sf, edits)
  const missed = pairs.filter((pair) => !hits.has(pair))
  if (missed.length) throw new Error(`${file}: Chinese copy matches no literal: ${missed.map(([english]) => JSON.stringify(english)).join(', ')}`)
  return applyEdits(source, edits)
}

function applyEdits(source, edits) {
  let text = source
  for (const [start, end, replacement] of [...edits].sort((a, b) => b[0] - a[0])) text = text.slice(0, start) + replacement + text.slice(end)
  return text
}

/** The text of every plain string literal in a file, outside imports. */
export function literals(ts, file, source) {
  const sf = sourceFile(ts, file, source)
  const found = new Set()
  const visit = (node) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isImportSpecifier(ts, node)) found.add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}
