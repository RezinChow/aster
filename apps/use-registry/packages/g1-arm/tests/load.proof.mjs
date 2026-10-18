// Load proof: how long the workbench takes from navigation to an interactive
// scene, phase by phase, under Studio's view policy.
//
//   node tests/load.proof.mjs [runs]
//   LOAD_VIEW_ROOT=<package copy> node tests/load.proof.mjs   (measure another build)
//
// Every run is a fresh browser context, so nothing is cached between runs.
// Chromium always runs; WebKit runs when Playwright has it installed; on
// macOS with `swift`, WKWebView (Studio's macOS webview, on the real GPU)
// runs through tests/webview-load.swift. The view marks its own phases:
//   scripts  navigation → boot()   parse and load the module graph
//   assets   → MuJoCo compiled and G1 meshes decoded, side by side
//   world    → model built and settled
//   scene    → scene built, loading overlay gone
//   frame    → first frame with the robot on screen (shaders compiled)
import { execFile, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { playwright, serveView } from './view-host.mjs'

const execFileAsync = promisify(execFile)

const RUNS = Number(process.argv[2] ?? 5)
// The view must be interactive within this many ms (median, per engine, warm
// browser). The cold-browser open is reported but not budgeted: its first
// frame is the GPU process starting, not the view.
const BUDGET_MS = Number(process.env.LOAD_BUDGET_MS ?? 1000)
const token = randomBytes(32).toString('hex')
const documentId = randomBytes(32).toString('hex')
const PHASES = ['scripts', 'assets', 'world', 'scene', 'frame']
const MARKS = ['boot', 'assets', 'world', 'ready', 'drawn']

const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function openOnce(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (error) => problems.push(String(error)))
  const started = performance.now()
  await page.goto(`${origin}/host.html`)
  await page.frameLocator('#view').locator('#loading.hidden').waitFor({ state: 'attached', timeout: 30_000 })
  const frame = page.frames().find((candidate) => candidate.url().includes('/ui/workbench/index.html'))
  await frame.waitForFunction(() => performance.getEntriesByName('g1:drawn').length > 0, null, { timeout: 30_000 })
  const wallMs = Math.round(performance.now() - started)
  const marks = await frame.evaluate(() =>
    Object.fromEntries(
      performance
        .getEntriesByType('mark')
        .filter((mark) => mark.name.startsWith('g1:'))
        .map((mark) => [mark.name.slice('g1:'.length), mark.startTime])
    )
  )
  const resources = await frame.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => ({ name: entry.name.split('/ui/workbench/')[1] ?? entry.name, ms: entry.duration }))
  )
  await context.close()
  if (problems.length) throw new Error(`view raised: ${problems.join('; ')}`)
  for (const mark of MARKS) if (typeof marks[mark] !== 'number') throw new Error(`view did not mark ${mark}: ${JSON.stringify(marks)}`)
  const phases = Object.fromEntries(
    PHASES.map((phase, index) => [phase, Math.round(marks[MARKS[index]] - (index === 0 ? 0 : marks[MARKS[index - 1]]))])
  )
  const slowest = resources.toSorted((a, b) => b.ms - a.ms)[0]
  return { wallMs, readyMs: Math.round(marks.drawn), phases, slowestResource: { name: slowest.name, ms: Math.round(slowest.ms) } }
}

async function measure(engine, launch, origin) {
  const browser = await launch()
  try {
    // The first open in a fresh browser also starts its GPU process and
    // compiles its first shaders; it is reported apart, not in the median.
    const coldStart = await openOnce(browser, origin)
    const runs = []
    for (let run = 0; run < RUNS; run++) runs.push(await openOnce(browser, origin))
    const summary = {
      engine,
      runs: RUNS,
      coldStart: { readyMs: coldStart.readyMs, phases: coldStart.phases },
      readyMs: median(runs.map((run) => run.readyMs)),
      wallMs: median(runs.map((run) => run.wallMs)),
      phases: Object.fromEntries(PHASES.map((phase) => [phase, median(runs.map((run) => run.phases[phase]))]))
    }
    process.stderr.write(
      `load: ${engine} ready ${summary.readyMs} ms ${JSON.stringify(summary.phases)}; cold browser ${coldStart.readyMs} ms ${JSON.stringify(coldStart.phases)}\n`
    )
    return { ...summary, samples: runs }
  } finally {
    await browser.close()
  }
}

/** WKWebView on the real GPU, through tests/webview-load.swift; one fresh web view per run. */
async function measureWebView(origin) {
  const script = fileURLToPath(new URL('./webview-load.swift', import.meta.url))
  // Asynchronous: this process also serves the view.
  const { stdout } = await execFileAsync('swift', [script, `${origin}/host.html`, String(RUNS + 1)], { timeout: 240_000 })
  const opens = stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
    .map((marks) => {
      if (marks.error) throw new Error(`wkwebview: ${marks.error}`)
      for (const mark of MARKS) if (typeof marks[mark] !== 'number') throw new Error(`view did not mark ${mark}: ${JSON.stringify(marks)}`)
      const phases = Object.fromEntries(PHASES.map((phase, index) => [phase, marks[MARKS[index]] - (index === 0 ? 0 : marks[MARKS[index - 1]])]))
      return { readyMs: marks.drawn, phases }
    })
  const [coldStart, ...runs] = opens
  const summary = {
    engine: 'wkwebview',
    runs: RUNS,
    coldStart,
    readyMs: median(runs.map((run) => run.readyMs)),
    phases: Object.fromEntries(PHASES.map((phase) => [phase, median(runs.map((run) => run.phases[phase]))]))
  }
  process.stderr.write(
    `load: wkwebview ready ${summary.readyMs} ms ${JSON.stringify(summary.phases)}; first open ${coldStart.readyMs} ms ${JSON.stringify(coldStart.phases)}\n`
  )
  return { ...summary, samples: runs }
}

async function main() {
  const { server, origin } = await serveView({ token, documentId, width: 1440, height: 900, viewRoot: process.env.LOAD_VIEW_ROOT })
  const engines = [
    ['chromium', () => playwright.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })]
  ]
  if (existsSync(playwright.webkit.executablePath())) engines.push(['webkit', () => playwright.webkit.launch()])
  const results = []
  try {
    for (const [engine, launch] of engines) results.push(await measure(engine, launch, origin))
    if (process.platform === 'darwin' && spawnSync('swift', ['--version']).status === 0) results.push(await measureWebView(origin))
  } finally {
    server.close()
  }
  console.log(JSON.stringify({ budgetMs: BUDGET_MS, results }, null, 2))
  for (const result of results) {
    if (result.readyMs > BUDGET_MS) throw new Error(`${result.engine} took ${result.readyMs} ms, over the ${BUDGET_MS} ms budget`)
  }
}

setTimeout(() => {
  console.error('load: timed out')
  process.exit(1)
}, 300_000).unref()

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
