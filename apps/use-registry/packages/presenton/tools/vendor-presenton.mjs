// Vendor four Presenton templates, their content schemas, the bold Phosphor
// icon set, and the template fonts into the package. The view build
// (tools/build-view.mjs) bundles the template and icon data from view/vendor;
// template images, placeholders and fonts are served from ui/workbench.
//
//   git clone https://github.com/presenton/presenton <checkout>
//   npm i --prefix <deps> @fontsource/poppins@5 @fontsource/montserrat@5 \
//     @fontsource/playfair-display@5 @fontsource/albert-sans@5 @fontsource/inter@5
//   node tools/vendor-presenton.mjs <checkout> <deps>/node_modules
//
// Schemas come from upstream's own Python (`uv` with pydantic, jsonschema and
// openai), so the agent asks for exactly the fields upstream asks for.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { blankTemplatePng } from './member-marks.mjs'

const [upstream, nodeModules] = process.argv.slice(2)
if (!upstream || !nodeModules) {
  console.error('usage: node tools/vendor-presenton.mjs <presenton-checkout> <node_modules>')
  process.exit(2)
}

const root = fileURLToPath(new URL('..', import.meta.url))
const tools = join(root, 'tools')
const view = join(root, 'ui/workbench')
const vendor = join(view, 'vendor')
const bundleData = join(root, 'view/vendor')
const fastapi = join(upstream, 'servers/fastapi')

const TEMPLATE_IDS = ['general', 'modern', 'standard', 'swift']
const IMAGE_PLACEHOLDER = '/static/images/replaceable_template_image.png'
const ICON_PLACEHOLDER = '/static/icons/placeholder.svg'
const IMAGE_PLACEHOLDER_FILE = 'vendor/presenton/template-image.png'
const ICON_PLACEHOLDER_FILE = 'vendor/presenton/icon-placeholder.svg'

const commit = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

for (const dir of ['presenton', 'chart', 'phosphor']) rmSync(join(vendor, dir), { recursive: true, force: true })
rmSync(join(view, 'fonts'), { recursive: true, force: true })
rmSync(bundleData, { recursive: true, force: true })
mkdirSync(join(vendor, 'presenton/templates'), { recursive: true })
mkdirSync(join(vendor, 'phosphor'), { recursive: true })
mkdirSync(join(view, 'fonts'), { recursive: true })
mkdirSync(join(bundleData, 'templates'), { recursive: true })
mkdirSync(join(bundleData, 'phosphor'), { recursive: true })

function main() {
  const schemas = templateSchemas()
  const icons = packIcons()
  vendorTemplates(schemas)
  writeAgentData(schemas, icons)
  vendorFonts()
  writeFileSync(join(vendor, 'presenton/LICENSE'), readFileSync(join(upstream, 'LICENSE')))
  writeFileSync(join(vendor, 'presenton/UPSTREAM'), `https://github.com/presenton/presenton\ncommit ${commit}\n`)
  console.log(`vendored presenton ${commit.slice(0, 12)}: ${TEMPLATE_IDS.length} templates, ${icons.length} icons`)
}

function templateSchemas() {
  const paths = TEMPLATE_IDS.map((id) => join(upstream, 'templates', id, 'template.json'))
  const text = execFileSync(
    'uv',
    ['run', '--quiet', '--no-project', '--with', 'pydantic>=2', '--with', 'jsonschema', '--with', 'openai', 'python', join(tools, 'template_schemas.py'), ...paths],
    { cwd: fastapi, env: { ...process.env, PYTHONPATH: fastapi }, encoding: 'utf8', maxBuffer: 64 << 20 }
  )
  return JSON.parse(text)
}

/** Rewrite upstream asset paths to package paths and copy only referenced files. */
function vendorTemplates(schemas) {
  copyFileSync(join(fastapi, 'static/icons/placeholder.svg'), join(view, ICON_PLACEHOLDER_FILE))
  // Upstream paints "Replaceable Template Image" into this file.
  writeFileSync(join(view, IMAGE_PLACEHOLDER_FILE), blankTemplatePng())
  for (const id of TEMPLATE_IDS) {
    const source = join(upstream, 'templates', id)
    const template = JSON.parse(readFileSync(join(source, 'template.json'), 'utf8'))
    const assets = join(vendor, 'presenton/templates', id)
    mkdirSync(assets, { recursive: true })
    const used = new Set([template.thumbnail])
    const rewrite = (value) => {
      if (Array.isArray(value)) return value.forEach(rewrite)
      if (!value || typeof value !== 'object') return
      if (value.type === 'image' && typeof value.data === 'string') {
        if (value.data === IMAGE_PLACEHOLDER) value.data = IMAGE_PLACEHOLDER_FILE
        else if (value.data === ICON_PLACEHOLDER) value.data = ICON_PLACEHOLDER_FILE
        else if (/^static\/[\w.-]+\.(png|jpe?g|svg|webp)$/.test(value.data)) {
          used.add(value.data)
          value.data = `vendor/presenton/templates/${id}/${basename(value.data)}`
        } else throw new Error(`${id}: unexpected image source ${value.data}`)
      }
      Object.values(value).forEach(rewrite)
    }
    rewrite(template.layouts)
    rewrite(template.merged_components)
    for (const file of used) copyFileSync(join(source, file), join(assets, basename(file)))
    const layouts = template.layouts.map((layout, index) => {
      const schema = schemas[id][index]
      if (schema.id !== String(layout.id)) throw new Error(`${id}: layout ${index} is ${layout.id}, schema says ${schema.id}`)
      return { ...layout, repeated: schema.repeated }
    })
    const module = {
      id: template.id,
      name: template.name,
      description: template.description,
      thumbnail: `vendor/presenton/templates/${id}/${basename(template.thumbnail)}`,
      fonts: Object.keys(template.fonts ?? {}),
      icon_type: template.icon_type ?? 'bold',
      theme: template.theme,
      merged_components: template.merged_components ?? null,
      layouts
    }
    writeFileSync(
      join(bundleData, 'templates', `${id}.js`),
      `// templates/${id}/template.json from presenton @ ${commit}, Apache-2.0; asset paths rewritten.\nexport default ${JSON.stringify(module)}\n`
    )
  }
}

/** The bold Phosphor set, keyed by its exact name; upstream's template icon weight is bold. */
function packIcons() {
  const dir = join(fastapi, 'static/icons/bold')
  const stroke = ' fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"'
  const icons = {}
  for (const file of readdirSync(dir).filter((name) => name.endsWith('-bold.svg')).sort()) {
    const svg = readFileSync(join(dir, file), 'utf8').trim()
    const inner = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 256 256">(?:<rect width="256" height="256" fill="none"\/>)?([\s\S]*)<\/svg>$/.exec(svg)
    if (!inner) throw new Error(`unexpected icon shape: ${file}`)
    icons[file.slice(0, -'-bold.svg'.length)] = inner[1].split(stroke).join('~')
  }
  writeFileSync(
    join(bundleData, 'phosphor/icons.js'),
    `// Phosphor Icons, bold weight (MIT), from presenton servers/fastapi/static/icons/bold @ ${commit}.\n// "~" stands for the shared stroke attributes; see iconUrl in view/backend/icons.ts.\nexport const STROKE = ${JSON.stringify(stroke)}\nexport const ICONS = ${JSON.stringify(icons)}\n`
  )
  writeFileSync(join(vendor, 'phosphor/LICENSE'), PHOSPHOR_LICENSE)
  return Object.keys(icons)
}

function writeAgentData(schemas, icons) {
  const templates = {}
  for (const id of TEMPLATE_IDS) {
    const template = JSON.parse(readFileSync(join(upstream, 'templates', id, 'template.json'), 'utf8'))
    templates[id] = {
      name: template.name,
      description: template.description,
      layouts: schemas[id].map(({ id: layoutId, name, description, schema }) => ({ id: layoutId, name, description, schema }))
    }
  }
  writeFileSync(
    join(root, 'agent/templates.mjs'),
    `// Layout descriptions and slide content schemas of the vendored templates,\n// computed by upstream presenton @ ${commit} (tools/template_schemas.py).\nexport const TEMPLATES = ${JSON.stringify(templates)}\n`
  )
  writeFileSync(
    join(root, 'agent/icons.mjs'),
    `// Exact names of the vendored Phosphor icons (view/vendor/phosphor/icons.js).\nexport const ICON_NAMES = ${JSON.stringify(icons)}\n`
  )
}

function vendorFonts() {
  const families = [
    ['Poppins', 'poppins', [['400', 'normal'], ['700', 'normal'], ['400', 'italic'], ['700', 'italic']]],
    ['Montserrat', 'montserrat', [['400', 'normal'], ['700', 'normal']]],
    ['Playfair Display', 'playfair-display', [['400', 'normal'], ['700', 'normal']]],
    ['Albert Sans', 'albert-sans', [['400', 'normal'], ['700', 'normal']]],
    ['Inter', 'inter', [['400', 'normal'], ['700', 'normal']]]
  ]
  let css = '/* Template fonts (SIL OFL 1.1) from @fontsource, latin subset. Generated by tools/vendor-presenton.mjs. */\n'
  for (const [family, slug, faces] of families) {
    const pkg = join(nodeModules, '@fontsource', slug)
    if (!existsSync(pkg)) throw new Error(`missing @fontsource/${slug}`)
    copyFileSync(join(pkg, 'LICENSE'), join(view, 'fonts', `LICENSE-${slug}.txt`))
    for (const [weight, style] of faces) {
      const file = `${slug}-latin-${weight}-${style}.woff2`
      copyFileSync(join(pkg, 'files', file), join(view, 'fonts', file))
      css += `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(${file}) format('woff2')}\n`
    }
  }
  writeFileSync(join(view, 'fonts/fonts.css'), css)
}

const PHOSPHOR_LICENSE = `MIT License

Copyright (c) 2023 Phosphor Icons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`

main()
