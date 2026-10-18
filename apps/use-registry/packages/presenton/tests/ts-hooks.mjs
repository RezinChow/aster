// Lets the tests import view/backend's TypeScript the way esbuild resolves it:
// Node strips the types; extensionless relative imports resolve to `.ts`.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, next) {
    if (/^\.\.?\//.test(specifier) && !/\.\w+$/.test(specifier)) return next(`${specifier}.ts`, context)
    return next(specifier, context)
  }
})
