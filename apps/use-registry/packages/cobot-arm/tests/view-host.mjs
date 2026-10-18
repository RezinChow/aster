// A stand-in for Studio's view host: the view files under Studio's exact
// document policy, inside a sandboxed iframe that runs the AIX handshake.
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('..', import.meta.url))

/** Playwright from the Studio install; the package has no node_modules. */
export const playwright = createRequire(join(root, '../../../studio/package.json'))('@playwright/test')

// Same string as PLUGIN_VIEW_CSP in apps/studio/src-tauri/src/authority.rs.
export const CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'"
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2'
}

/**
 * The host page answers each `aix.agent.invoke` through `window.turn`, which
 * the caller exposes; `{ text }` is a result and `{ reason }` a refusal. When
 * the caller exposes `window.viewState`, view state is stored there and handed
 * back on the next connect, as Studio's view bridge does.
 */
function hostPage({ token, documentId, width, height }) {
  return `<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="view" sandbox="allow-scripts" style="width:${width}px;height:${height}px;border:0"
  src="/aix-view/${token}/ui/workbench/index.html#aix-document=${documentId}"></iframe>
<script>
addEventListener('message', async (event) => {
  const data = event.data
  if (!data || data.type !== 'aix.document.ready' || data.documentId !== '${documentId}') return
  const port = event.ports[0]
  port.onmessage = async ({ data }) => {
    if (data.type === 'aix.view.store') {
      if (window.viewState) await window.viewState(data.stateJSON)
      port.postMessage({ protocolVersion: 1, type: 'aix.view.stored', id: data.id })
      return
    }
    if (data.type !== 'aix.agent.invoke') return
    const reply = window.turn
      ? await window.turn({ agent: data.agent, prompt: data.prompt, parameters: data.parameters, images: data.images })
      : { reason: 'agent_failed' }
    port.postMessage(reply.text === undefined
      ? { protocolVersion: 1, type: 'aix.agent.refused', id: data.id, reason: reply.reason }
      : { protocolVersion: 1, type: 'aix.agent.result', id: data.id, text: reply.text })
  }
  port.start()
  const stateJSON = window.viewState ? await window.viewState() : null
  port.postMessage({ protocolVersion: 1, type: 'aix.view.connect', stateJSON,
    environment: { theme: 'light', locale: 'zh-CN', direction: 'ltr', tokens: {} } })
})
</script>`
}

/**
 * Serve `/host.html` and the view's own files; anything else is 404.
 * `viewRoot` serves another copy of the package, e.g. an older build to compare.
 */
export function serveView(options) {
  const base = options.viewRoot ?? root
  const served = new Set()
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (url.pathname === '/host.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return response.end(hostPage(options))
    }
    const prefix = `/aix-view/${options.token}/`
    const relative = url.pathname.startsWith(prefix) ? normalize(url.pathname.slice(prefix.length)) : ''
    const type = MIME[extname(relative)]
    if (!relative.startsWith('ui/workbench/') || relative.includes('..') || !type) {
      response.writeHead(404)
      return response.end()
    }
    let bytes
    try {
      bytes = readFileSync(join(base, relative))
    } catch {
      response.writeHead(404)
      return response.end()
    }
    served.add(relative)
    response.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy': CSP
    })
    response.end(bytes)
  })
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, served, origin: `http://127.0.0.1:${server.address().port}` }))
  )
}
