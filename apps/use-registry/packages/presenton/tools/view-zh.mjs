// Chinese copy for upstream's pages, kept per area under view-zh/:
// file (relative to servers/nextjs) → [English, Chinese] or
// [English, Chinese, scope] pairs, applied by view-translate.mjs.
//
// English is the exact text of a string literal, a JSX text run (whitespace
// collapsed), or a template literal with its substitutions written {0}, {1}…
// in order. A scope limits the pair to the value of one JSX attribute or
// object property (`label`, `title`, …) or to the arguments of one call
// (`toast.error`); scope `jsx` limits it to JSX text. Every pair must match in
// its file.
import { ZH as CHARTS } from './view-zh/charts.mjs'
import { ZH as EDITOR } from './view-zh/editor.mjs'
import { ZH as FLOW } from './view-zh/flow.mjs'
import { ZH as PRESENTATION } from './view-zh/presentation.mjs'

function merge(tables) {
  const merged = {}
  for (const [area, table] of tables) {
    for (const [file, pairs] of Object.entries(table)) {
      const list = (merged[file] ??= [])
      for (const pair of pairs) {
        const [english, chinese, scope] = pair
        if (typeof english !== 'string' || !english || typeof chinese !== 'string' || !chinese || (scope !== undefined && typeof scope !== 'string') || pair.length > 3) {
          throw new Error(`view-zh/${area}: ${file}: malformed pair ${JSON.stringify(pair)}`)
        }
        const existing = list.find(([other, , otherScope]) => other === english && otherScope === scope)
        if (existing && existing[1] !== chinese) {
          throw new Error(`view-zh: ${file}: ${JSON.stringify(english)} has two translations: ${JSON.stringify(existing[1])} and ${JSON.stringify(chinese)}`)
        }
        if (!existing) list.push(scope === undefined ? [english, chinese] : [english, chinese, scope])
      }
    }
  }
  return merged
}

export const ZH = merge([
  ['flow', FLOW],
  ['presentation', PRESENTATION],
  ['editor', EDITOR],
  ['charts', CHARTS]
])
