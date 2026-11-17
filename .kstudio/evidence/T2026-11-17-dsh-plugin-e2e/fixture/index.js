import { appendFileSync, writeFileSync } from 'node:fs'

export const name = 'aster-e2e-hello'

export function apply(ctx) {
  const markerPath = process.env.ASTER_DSH_E2E_MARKER
  if (markerPath) {
    writeFileSync(markerPath, `loaded:${name}:${Date.now()}\n`, 'utf8')
  } else {
    console.log('[aster-e2e-hello] plugin loaded!')
  }
  ctx.effect(() => {
    return () => {
      if (markerPath) {
        appendFileSync(markerPath, `unloaded:${name}:${Date.now()}\n`, 'utf8')
      } else {
        console.log('[aster-e2e-hello] plugin unloaded!')
      }
    }
  })
}
