// Build the workbench view from Presenton's own Next.js frontend: the upload,
// outline and presentation pages, bundled with esbuild into one document.
//
//   git clone https://github.com/presenton/presenton <checkout>
//   (cd <checkout>/servers/nextjs && npm ci --ignore-scripts)
//   node tools/build-view.mjs <checkout>
//
// Upstream sources are not copied. They are read from the checkout and edited
// on the way into the bundle by the exact-string edits in view-patches.mjs
// (behaviour) and view-zh.mjs (Chinese copy); an edit that no longer matches
// fails the build. next/* modules and analytics are replaced by view/, and the
// page's fetch and EventSource are answered by view/backend.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { armDeckAutostart } from './deck-autostart.mjs'
import { blankLogoPng } from './member-marks.mjs'
import { PATCHES } from './view-patches.mjs'
import { literals, translate } from './view-translate.mjs'
import { ZH } from './view-zh.mjs'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const [upstream] = args.filter((arg) => arg !== '--check')
if (!upstream) {
  console.error('usage: node tools/build-view.mjs <presenton-checkout> [--check]')
  process.exit(2)
}

const root = fileURLToPath(new URL('..', import.meta.url))
const viewSource = join(root, 'view')
const out = join(root, 'ui/workbench')
const nextjs = realpathSync(join(upstream, 'servers/nextjs'))
const require = createRequire(join(nextjs, 'package.json'))
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwindcss = require('tailwindcss')
const loadConfig = require('tailwindcss/loadConfig')
const ts = require('typescript')

const MAX_FILE = 8 * 1024 * 1024
const PUBLIC_ASSET = /(["'`])\/((?:[\w.-]+\/)*[\w.\[\],-]+\.(?:svg|png|jpe?g|webp|gif|js))\1/g
/** Public files the bundle names but the core pages never show: model and search provider settings. */
const isUnusedPublic = (path) => path.startsWith('providers/')

const commit = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

/** file (relative to servers/nextjs) → exact-string edits; each must match. */
function editsByFile() {
  const edits = new Map()
  const add = (file, edit) => {
    if (!edits.has(file)) edits.set(file, [])
    edits.get(file).push(edit)
  }
  for (const [file, list] of Object.entries(PATCHES)) for (const edit of list) add(file, { ...edit, kind: 'patch' })
  for (const [file, pairs] of Object.entries(ZH)) add(file, { kind: 'zh', pairs })
  return edits
}

function applyEdits(file, source, edits) {
  let text = source
  for (const edit of edits) {
    if (edit.kind === 'zh') {
      text = translate(ts, file, text, edit.pairs)
      continue
    }
    if (edit.from !== undefined) {
      // Replace a span: `from` occurs once; the span ends with the first `to` after it.
      const starts = text.split(edit.from).length - 1
      const start = text.indexOf(edit.from)
      const end = start < 0 ? -1 : text.indexOf(edit.to, start + edit.from.length)
      if (starts !== 1 || end < 0) {
        throw new Error(`${file}: ${edit.kind} span edit does not match once: ${JSON.stringify(edit.from.slice(0, 120))}`)
      }
      text = text.slice(0, start) + edit.replace + text.slice(end + edit.to.length)
      continue
    }
    const count = text.split(edit.find).length - 1
    if (edit.count === 'first') {
      // Insert before the first occurrence, e.g. an import ahead of the imports.
      if (count < 1) throw new Error(`${file}: ${edit.kind} edit matched 0 times: ${JSON.stringify(edit.find.slice(0, 120))}`)
      text = text.replace(edit.find, () => edit.replace)
      continue
    }
    if (edit.all ? count < 1 : count !== (edit.count ?? 1)) {
      throw new Error(`${file}: ${edit.kind} edit matched ${count} times: ${JSON.stringify(edit.find.slice(0, 120))}`)
    }
    text = text.split(edit.find).join(edit.replace)
  }
  return text
}

const LOADERS = { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.css': 'css' }
const extension = (path) => /\.[^./]+$/.exec(path)?.[0] ?? ''

async function tailwind(css, from) {
  const config = loadConfig(join(nextjs, 'tailwind.config.ts'))
  config.content = [
    join(nextjs, 'app/**/*.{ts,tsx}'),
    join(nextjs, 'components/**/*.{ts,tsx}'),
    join(nextjs, 'lib/**/*.{ts,tsx}'),
    join(viewSource, '**/*.{ts,tsx}')
  ]
  const result = await postcss([tailwindcss(config)]).process(css, { from })
  return result.css
}

/**
 * Code may compare copy from another file, so an unscoped translated literal
 * must be translated in every bundled file that has it.
 */
function checkCopyConsistency(finalLiterals) {
  const stale = []
  for (const [file, pairs] of Object.entries(ZH)) {
    for (const [english, , scope] of pairs) {
      if (scope !== undefined) continue
      for (const [other, found] of finalLiterals) if (found.has(english)) stale.push(`${JSON.stringify(english)} is translated in ${file} but untranslated in ${other}`)
    }
  }
  if (stale.length) throw new Error(`Chinese copy is inconsistent across files:\n  ${stale.join('\n  ')}`)
}

async function bundle(edits) {
  const used = new Set()
  const finalLiterals = new Map()
  const redirects = {
    'next/navigation': join(viewSource, 'next/navigation.ts'),
    'next/link': join(viewSource, 'next/link.tsx'),
    'next/image': join(viewSource, 'next/image.tsx'),
    'next/script': join(viewSource, 'next/script.tsx'),
    'mixpanel-browser': join(viewSource, 'noop/mixpanel.ts')
  }
  const result = await esbuild.build({
    entryPoints: { app: join(viewSource, 'entry.tsx') },
    bundle: true,
    outdir: out,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    metafile: true,
    write: !checkOnly,
    jsx: 'automatic',
    nodePaths: [join(nextjs, 'node_modules')],
    assetNames: 'assets/[name]-[hash]',
    loader: { '.png': 'file', '.jpg': 'file', '.svg': 'file', '.woff2': 'file', '.woff': 'empty', '.ttf': 'empty', '.eot': 'empty' },
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.PRESENTATION_GENERATION_MODE': '"standard"',
      'process.env.PRESENTON_COMMUNITY_ENABLED': '"false"',
      'process.env.NEXT_PUBLIC_FAST_API': 'undefined',
      // Next leaves every other variable undefined in browser code.
      'process.env': '{}'
    },
    logLevel: 'warning',
    plugins: [
      {
        name: 'presenton-view',
        setup(build) {
          build.onResolve({ filter: /^@view\// }, (args) => build.resolve(`./${args.path.slice(6)}`, { resolveDir: viewSource, kind: args.kind }))
          build.onResolve({ filter: /^\// }, (args) => {
            if (args.kind !== 'url-token') return undefined
            const file = join(nextjs, 'public', args.path)
            return existsSync(file) ? { path: file } : { errors: [{ text: `stylesheet names a missing public file ${args.path}` }] }
          })
          build.onResolve({ filter: /^@\// }, (args) => build.resolve(`./${args.path.slice(2)}`, { resolveDir: nextjs, kind: args.kind }))
          build.onResolve({ filter: /^(next\/[\w/-]+|mixpanel-browser)$/ }, (args) => {
            if (redirects[args.path]) return { path: redirects[args.path] }
            return { errors: [{ text: `${args.path} has no view replacement (imported by ${relative(nextjs, args.importer)})` }] }
          })
          build.onLoad({ filter: /\.(tsx?|jsx?|mjs|css)$/ }, async (args) => {
            const inUpstream = args.path.startsWith(nextjs + '/') && !args.path.includes('/node_modules/')
            const isKatexCss = args.path.endsWith('/katex/dist/katex.min.css')
            if (!inUpstream && !isKatexCss) return undefined
            let text = readFileSync(args.path, 'utf8')
            if (isKatexCss) {
              // The view serves woff2 only.
              text = text.replace(/,url\(fonts\/[\w-]+\.woff\) format\("woff"\),url\(fonts\/[\w-]+\.ttf\) format\("truetype"\)/g, '')
              return { contents: text, loader: 'css', resolveDir: dirname(args.path) }
            }
            const file = relative(nextjs, args.path)
            if (edits.has(file)) {
              text = applyEdits(file, text, edits.get(file))
              used.add(file)
            }
            if (/\.[jt]sx?$/.test(file)) finalLiterals.set(file, literals(ts, file, text))
            if (file === 'app/globals.css') text = await tailwind(text, args.path)
            return { contents: text, loader: LOADERS[extension(args.path)], resolveDir: dirname(args.path) }
          })
        }
      }
    ]
  })
  const unused = [...edits.keys()].filter((file) => !used.has(file))
  if (unused.length) throw new Error(`edits for files outside the bundle: ${unused.join(', ')}`)
  checkCopyConsistency(finalLiterals)
  return result.metafile
}

/** Upstream names its public files from the site root; the view serves them under public/. */
function publishAssets() {
  const appPath = join(out, 'app.js')
  const missing = []
  const copied = new Set()
  const code = readFileSync(appPath, 'utf8').replace(PUBLIC_ASSET, (whole, quote, path) => {
    const source = join(nextjs, 'public', path)
    if (isUnusedPublic(path)) return whole
    if (!existsSync(source)) {
      missing.push(path)
      return whole
    }
    const target = join(out, 'public', path)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
    copied.add(path)
    const license = path.replace(/(\.umd)?\.min\.js$/, '-LICENSE.md')
    if (license !== path && existsSync(join(nextjs, 'public', license))) {
      copyFileSync(join(nextjs, 'public', license), join(out, 'public', license))
      copied.add(license)
    }
    return `${quote}public/${path}${quote}`
  })
  if (missing.length) throw new Error(`bundle names public files that do not exist: ${missing.join(', ')}`)
  writeFileSync(appPath, armDeckAutostart(code))
  // Upstream public/logo-with-bg.png is another product's mark.
  mkdirSync(join(out, 'public'), { recursive: true })
  writeFileSync(join(out, 'public/logo-with-bg.png'), blankLogoPng())
  return [...copied].sort()
}

/** Upstream's UI fonts (variable TTF) as woff2, the only font type the view serves. */
function uiFonts() {
  const fonts = join(out, 'fonts')
  const faces = [
    ['Manrope', 'sans_serif/manrope/Manrope[wght].ttf', 'manrope.woff2', '200 800'],
    ['Syne', 'sans_serif/syne/Syne[wght].ttf', 'syne.woff2', '400 800']
  ]
  let css = ''
  for (const [family, source, file, weight] of faces) {
    execFileSync('uv', ['run', '--quiet', '--no-project', '--with', 'fonttools', '--with', 'brotli', 'python', '-c',
      'import sys\nfrom fontTools.ttLib import TTFont\nf = TTFont(sys.argv[1])\nf.flavor = "woff2"\nf.save(sys.argv[2])',
      join(nextjs, 'public/vendor/fonts', source), join(fonts, file)])
    copyFileSync(join(nextjs, 'public/vendor/fonts', dirname(source), 'OFL.txt'), join(fonts, `LICENSE-${file.replace('.woff2', '')}.txt`))
    css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(${file}) format("woff2")}\n`
  }
  return css
}

function writeIndex() {
  writeFileSync(
    join(out, 'index.html'),
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>演示文稿</title>
    <link rel="stylesheet" href="fonts/fonts.css" />
    <link rel="stylesheet" href="fonts/ui.css" />
    <link rel="stylesheet" href="app.css" />
    <link rel="stylesheet" href="chrome.css" />
  </head>
  <body class="antialiased">
    <div id="root"></div>
    <script type="module" src="app.js"></script>
  </body>
</html>
`
  )
}

function bundledPackages(metafile) {
  const packages = new Map()
  for (const input of Object.keys(metafile.inputs)) {
    const match = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input)
    if (!match || packages.has(match[1])) continue
    const manifest = JSON.parse(readFileSync(join(nextjs, 'node_modules', match[1], 'package.json'), 'utf8'))
    packages.set(match[1], { version: manifest.version, license: typeof manifest.license === 'string' ? manifest.license : JSON.stringify(manifest.license ?? 'UNKNOWN') })
  }
  return [...packages].sort(([a], [b]) => a.localeCompare(b))
}

function writeNotices(packages) {
  const rows = packages.map(([name, { version, license }]) => `| ${name} | ${version} | ${license} |`).join('\n')
  writeFileSync(
    join(out, 'THIRD_PARTY_NOTICES.md'),
    `# Third-party notices

This view is built from Presenton's frontend (https://github.com/presenton/presenton,
commit ${commit}, Apache-2.0; see vendor/presenton/LICENSE) by tools/build-view.mjs.
Fonts under fonts/ are SIL Open Font License 1.1 (see the LICENSE-*.txt files beside
them); KaTeX fonts under assets/ are MIT. Phosphor Icons are MIT (vendor/phosphor/LICENSE).
Chart.js and chartjs-plugin-datalabels under public/vendor/ are MIT (LICENSE files beside them).

npm packages bundled into app.js:

| Package | Version | License |
| --- | --- | --- |
${rows}
`
  )
}

/** The agent accepts exactly upstream's language labels. */
async function checkLanguages() {
  const source = readFileSync(join(nextjs, 'app/(presentation-generator)/upload/type.ts'), 'utf8')
  const block = source.slice(source.indexOf('export enum LanguageType {'))
  const upstreamLabels = [...block.slice(0, block.indexOf('\n}')).matchAll(/^\s+\w+ = "([^"]+)",?$/gm)].map((match) => match[1])
  const { LANGUAGES } = await import(join(root, 'agent/languages.mjs'))
  if (JSON.stringify(upstreamLabels) !== JSON.stringify(LANGUAGES)) throw new Error('agent/languages.mjs differs from upstream LanguageType')
}

async function main() {
  await checkLanguages()
  if (checkOnly) {
    await bundle(editsByFile())
    console.log('view edits and Chinese copy check out')
    return
  }
  for (const generated of ['app.js', 'app.css', 'assets', 'public', 'index.html']) rmSync(join(out, generated), { recursive: true, force: true })
  mkdirSync(join(out, 'fonts'), { recursive: true })
  const metafile = await bundle(editsByFile())
  if (process.env.VIEW_METAFILE) writeFileSync(process.env.VIEW_METAFILE, JSON.stringify(metafile))
  const published = publishAssets()
  writeFileSync(join(out, 'fonts/ui.css'), `/* Presenton's UI fonts. Generated by tools/build-view.mjs. */\n${uiFonts()}`)
  writeIndex()
  writeNotices(bundledPackages(metafile))
  for (const file of ['app.js', 'app.css']) {
    const size = statSync(join(out, file)).size
    if (size > MAX_FILE) throw new Error(`${file} is ${size} bytes; the view serves files up to ${MAX_FILE}`)
  }
  console.log(`built view from presenton ${commit.slice(0, 12)}: app.js ${statSync(join(out, 'app.js')).size} B, app.css ${statSync(join(out, 'app.css')).size} B, ${published.length} public files`)
}

await main()
