import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { renderAtlas, diagramMarkup, prepareWalks } from '../scripts/docs_atlas.mjs';
import { createSourceReferences } from '../scripts/docs_sources.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const { JSDOM } = require(process.env.JS_DOM_MODULE || path.join(root, 'packages/ui/node_modules/jsdom'));
const publicRoot = path.join(root, 'apps/web/public/docs');
const revision = '8729d7c84a2d887c61dc206ba47bf8a63425e768';

async function page(t, route, { reduced = false, observe = false } = {}) {
  const dom = new JSDOM(await readFile(path.join(publicRoot, route, 'index.html'), 'utf8'), { url: `https://aster-ai-lab.github.io/aster/docs/${route}`, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const window = dom.window;
  let observer;
  window.matchMedia = () => ({ matches: reduced, addEventListener() {} });
  if (observe) window.IntersectionObserver = class { constructor(callback) { observer = callback; } observe() {} };
  const timers = new Map();
  let sequence = 0;
  window.setTimeout = (callback) => { timers.set(++sequence, callback); return sequence; };
  window.clearTimeout = (id) => timers.delete(id);
  window.eval(await readFile(path.join(publicRoot, 'navigation.js'), 'utf8'));
  return { window, document: window.document, timers, observe: (entries) => observer(entries), flush: () => { for (let i = 0; timers.size && i < 20; i++) { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); } } };
}

test('all atlas specifications render with accessible labels, local watermark assets and no inline code or style', async () => {
  const catalog = JSON.parse(await readFile(path.join(root, 'apps/web/content/docs/atlas.json'), 'utf8'));
  const types = new Set();
  for (const entry of catalog.diagrams) {
    const definition = JSON.parse(await readFile(path.join(root, 'apps/web/content/docs', entry.product, entry.version, '_atlas', `${entry.name}.json`), 'utf8'));
    types.add(definition.spec.type);
    const styles = new Map();
    const result = renderAtlas(definition);
    const dom = new JSDOM(diagramMarkup(result, styles, 'atlas/'));
    try {
      const svg = dom.window.document.querySelector('svg');
      for (const id of svg.getAttribute('aria-labelledby').split(' ')) assert.ok(dom.window.document.getElementById(id)?.textContent.trim());
      assert.equal(svg.querySelectorAll('[style],style,script,foreignObject,a').length, 0);
      assert.equal(svg.hasAttribute('style'), false);
      assert.equal(svg.querySelectorAll('[data-sc-node][tabindex]').length, 0);
      assert.ok([...svg.querySelectorAll('image')].every((image) => /^atlas\/seecode-(symbol|word)\.png$/.test(image.getAttribute('href'))));
      assert.ok(styles.size > 0);
      const standalone = new JSDOM(result.html);
      assert.equal(standalone.window.document.querySelectorAll('link[href^="http"]').length, 0);
      standalone.window.close();
    } finally { dom.window.close(); }
  }
  for (const type of ['architecture','high-level','flowchart','state','sequence','exploded','layers']) assert.ok(types.has(type), type);
});

test('atlas refuses unknown types and missing explanations at the real renderer boundary', () => {
  assert.throws(() => renderAtlas({ spec: { type: 'unknown' }, steps: [{ title: 'A', body: 'B' }] }), /SeeCode/);
  assert.throws(() => renderAtlas({ spec: { type: 'architecture' }, steps: [] }), /explanatory steps/);
});

test('diagram stepping, keyboard bounds and complete view do not start animation timers', async (t) => {
  const ui = await page(t, 'code/internals/system-prompts');
  const figure = ui.document.querySelector('[data-atlas]');
  const next = figure.querySelector('[data-atlas-action="next"]');
  const previous = figure.querySelector('[data-atlas-action="previous"]');
  assert.equal(previous.disabled, true);
  next.click();
  assert.equal(figure.querySelector('[aria-current="step"]').dataset.atlasStep, '0');
  assert.ok(figure.querySelector('.atlas-is-muted'));
  next.dispatchEvent(new ui.window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  assert.equal(next.disabled, true);
  figure.querySelector('[data-atlas-action="all"]').click();
  assert.equal(figure.querySelectorAll('.atlas-is-muted').length, 0);
  assert.equal(figure.querySelectorAll('[aria-current="step"]').length, 0);
  assert.equal(ui.timers.size, 0);
});

test('requested narration is finite and reduced motion keeps manual controls', async (t) => {
  const ui = await page(t, 'code/internals/system-prompts');
  const play = ui.document.querySelector('[data-atlas-action="play"]');
  const svg = ui.document.querySelector('.sc-svg');
  play.click();
  assert.equal(play.getAttribute('aria-pressed'), 'true');
  assert.equal(svg.classList.contains('sc-still'), false);
  assert.equal(svg.getAttribute('data-sc-motion'), 'reveal');
  ui.flush();
  assert.equal(ui.timers.size, 0);
  assert.equal(play.getAttribute('aria-pressed'), 'false');
  assert.equal(svg.classList.contains('sc-still'), true);
  const reduced = await page(t, 'code/internals/system-prompts', { reduced: true });
  assert.equal(reduced.document.querySelector('[data-atlas-action="play"]').hidden, true);
  reduced.document.querySelector('[data-atlas-action="next"]').click();
  assert.equal(reduced.timers.size, 0);
});

test('exploded diagram assembles and expands without changing any other figure', async (t) => {
  const ui = await page(t, 'code/internals');
  const figure = ui.document.querySelector('[data-atlas="meta-harness"]');
  const toggle = figure.querySelector('[data-atlas-action="assemble"]');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.ok(figure.classList.contains('atlas-assembled'));
  assert.equal(ui.document.querySelector('[data-atlas="architecture"]').classList.contains('atlas-assembled'), false);
  toggle.click();
  assert.equal(figure.classList.contains('atlas-assembled'), false);
});

test('diagram nodes have working pointer and keyboard explanations', async (t) => {
  const ui = await page(t, 'code/comparison');
  const figure = ui.document.querySelector('[data-atlas="framework-layers"]');
  const harness = figure.querySelector('[data-sc-node="harness"]');
  assert.equal(harness.getAttribute('role'), 'button');
  harness.dispatchEvent(new ui.window.MouseEvent('click', { bubbles: true }));
  assert.equal(figure.querySelector('[aria-current="step"]').dataset.atlasStep, '1');
  const application = figure.querySelector('[data-sc-node="app"]');
  application.dispatchEvent(new ui.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(figure.querySelector('[aria-current="step"]').dataset.atlasStep, '0');
  assert.equal(application.getAttribute('aria-pressed'), 'true');
  assert.equal(harness.getAttribute('aria-pressed'), 'false');
});

test('Code Hike token colors remain readable on both code backgrounds', async () => {
  const css = await readFile(path.join(publicRoot, 'generated.css'), 'utf8');
  const colors = [...css.matchAll(/\.walk-token-[a-f0-9]+\{color:(#[a-f0-9]{6})\}/ig)].map((match) => match[1]);
  const luminance = (hex) => hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  assert.ok(colors.length > 5);
  for (const background of ['#ffffff', '#f6faf7']) for (const color of colors) {
    const [dark, light] = [luminance(color), luminance(background)].sort((a, b) => a - b);
    assert.ok((light + .05) / (dark + .05) >= 4.5, `${color} on ${background}`);
  }
});

test('source walkthrough works without IntersectionObserver and exposes full reading mode', async (t) => {
  const ui = await page(t, 'code/internals/system-prompts');
  const walk = ui.document.querySelector('[data-source-walk]');
  assert.equal(walk.querySelectorAll('.walk-code:not([hidden])').length, 1);
  walk.querySelector('[data-walk-action="next"]').click();
  assert.equal(walk.querySelector('[aria-current="step"]').dataset.walkStep, '1');
  walk.querySelector('[data-walk-action="all"]').click();
  assert.equal(walk.querySelectorAll('.walk-code[hidden]').length, 0);
  walk.querySelector('[data-walk-action="all"]').click();
  const button = walk.querySelector('[data-walk-action="next"]');
  button.dispatchEvent(new ui.window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  assert.equal(button.disabled, true);
  assert.equal(walk.querySelector('[aria-current="step"]').dataset.walkStep, '9');
});

test('scroll walkthrough follows an observed narrative without announcing every scroll', async (t) => {
  const ui = await page(t, 'code/internals/system-prompts', { observe: true });
  const walk = ui.document.querySelector('[data-source-walk]');
  const narrative = walk.querySelector('[data-walk-stop="3"] .walk-narrative');
  ui.observe([{ isIntersecting: true, target: narrative, boundingClientRect: { top: 200 } }]);
  assert.equal(walk.querySelector('[aria-current="step"]').dataset.walkStep, '3');
  assert.equal(walk.querySelector('.walk-status').textContent, '');
});

test('static source walks retain every explanation and original code line without JavaScript', async () => {
  const originals = new Map();
  for (const [product, name] of [['code','system-prompts'],['code','execution'],['code','long-running'],['code','context'],['code','recovery'],['code','completion'],['acp','runtime']]) {
    const route = product === 'acp' ? 'acp/9.1.6/internals' : `code/9.1.6/internals/${name}`;
    const dom = new JSDOM(await readFile(path.join(publicRoot, route, 'index.html'), 'utf8'));
    try {
      const definition = JSON.parse(await readFile(path.join(root, 'apps/web/content/docs', product, '9.1.6/_walks', `${name}.json`), 'utf8'));
      const stops = [...dom.window.document.querySelectorAll('.walk-stop')];
      assert.equal(stops.length, definition.steps.length);
      for (const [index, stop] of stops.entries()) {
        const step = definition.steps[index];
        const sourceFile = step.source.path;
        if (!originals.has(sourceFile)) originals.set(sourceFile, execFileSync('git', ['show', `${revision}:${sourceFile}`], { cwd: root, encoding: 'utf8' }));
        const reference = new URL(stop.querySelector('.source-ref').href);
        assert.equal(reference.pathname, `/aster-ai-lab/aster/blob/${revision}/${sourceFile}`);
        const [, first, last] = reference.hash.match(/^#L(\d+)(?:-L(\d+))?$/);
        const original = originals.get(sourceFile).split('\n').slice(Number(first) - 1, Number(last || first)).join('\n');
        assert.ok(original.includes(step.source.match));
        assert.ok(stop.querySelector('.walk-focus').textContent.includes(step.source.match.split('\n')[0]));
        const lines = [...stop.querySelectorAll('.walk-line')].map((line) => { line.querySelector('.walk-line-number').remove(); return line.textContent; });
        assert.equal(lines.join('').replace(/\n$/, ''), original);
        assert.equal(stop.querySelector('.walk-code').hidden, false);
        assert.ok(stop.querySelector('pre[data-codehike="1.1.0"]'));
      }
    } finally { dom.window.close(); }
  }
});

test('excerpt resolution refuses stale or ambiguous selections and invalid extents', async (t) => {
  const sources = createSourceReferences(revision, root);
  const file = 'crates/code/core/src/prompts.rs';
  assert.throws(() => sources.resolve({ path: file, match: 'no-longer-existing' }), /exactly once/);
  assert.throws(() => sources.resolve({ path: file, match: 'pub fn' }), /exactly once/);
  assert.throws(() => sources.resolve({ path: file, match: 'pub struct SystemPromptSlots {', after: 100 }), /Invalid excerpt extent/);
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'aster-walk-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await mkdir(path.join(temporary, 'walks'));
  await writeFile(path.join(temporary, 'walks/broken.json'), JSON.stringify({ steps: [{ source: { path: file, match: 'stale-selector' } }] }));
  await assert.rejects(prepareWalks(path.join(temporary, 'walks'), sources, new Map()), /exactly once/);
  assert.ok(execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, encoding: 'utf8' }).includes('pub struct SystemPromptSlots {'));
});

test('new internal reading paths retain explicit product versions rather than default aliases', async () => {
  for (const route of ['code/9.1.6/internals','code/9.1.6/internals/system-prompts','code/9.1.6/internals/context','code/9.1.6/internals/execution','code/9.1.6/internals/long-running','code/9.1.6/internals/recovery','code/9.1.6/internals/completion','acp/9.1.6/internals','acp/9.1.6/internals/events','acp/9.1.6/internals/goals']) {
    const dom = new JSDOM(await readFile(path.join(publicRoot, route, 'index.html'), 'utf8'), { url: `https://aster-ai-lab.github.io/aster/docs/${route}/` });
    try {
      for (const link of dom.window.document.querySelectorAll('.prose a')) {
        const url = new URL(link.href);
        if (url.origin === dom.window.location.origin && url.pathname.endsWith('/')) assert.match(url.pathname, /^\/aster\/docs\/(code|acp)\/9\.1\.6\//, `${route}: ${url.pathname}`);
      }
    } finally { dom.window.close(); }
  }
});
