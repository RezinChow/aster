import { fileURLToPath } from 'node:url'
import { serveView } from '../../g1-arm/tests/view-host.mjs'

const { server, origin } = await serveView({ token: 'a'.repeat(64), documentId: 'b'.repeat(64), width: 1440, height: 900, viewRoot: fileURLToPath(new URL('..', import.meta.url)), entry: 'ui/editor/index.html' })
console.log(`${origin}/host.html`)
process.once('SIGINT', () => server.close())
process.once('SIGTERM', () => server.close())
