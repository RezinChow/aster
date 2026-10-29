import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { prepareWalks } from '../scripts/docs_atlas.mjs';
import { createElement as h, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceReferences } from '../scripts/docs_sources.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const { JSDOM } = require(process.env.JS_DOM_MODULE || path.join(root, 'packages/ui/node_modules/jsdom'));
const publicRoot = path.join(root, 'apps/web/dist/docs');
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

test('prose export retains authored MDX prose without source code', async (t) => {
  const destination = await mkdtemp(path.join(os.tmpdir(), 'aster-docs-prose-'));
  t.after(() => rm(destination, { recursive: true, force: true }));
  const output = execFileSync(process.execPath, ['apps/web/scripts/docs_prose.mjs', destination], { cwd: root, encoding: 'utf8' });
  assert.match(output, /Extracted \d+ prose units/);
  const prose = await readFile(path.join(destination, 'prose.md'), 'utf8');
  assert.ok(prose.includes('系统提示词'));
  assert.ok(prose.includes('ACP'));
  assert.ok(!prose.includes('pub struct SystemPromptSlots {'));
});

test('Code Hike token colors remain readable on both code backgrounds', async () => {
  const css = await readFile(path.join(publicRoot, 'generated.css'), 'utf8');
  const colors = [...css.matchAll(/\.walk-style-[a-f0-9]+\{[^}]*color:(#[a-f0-9]{6})\b/ig)].map((match) => match[1]);
  const luminance = (hex) => hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  assert.ok(colors.length > 5);
  for (const background of ['#ffffff', '#eff6f0']) for (const color of colors) {
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

test('Spotlight preserves explicit selection while the document scrolls', async (t) => {
  const ui = await page(t, 'code/internals/system-prompts', { observe: true });
  const walk = ui.document.querySelector('[data-source-walk]');
  walk.querySelector('[data-walk-step="3"]').click();
  ui.window.dispatchEvent(new ui.window.Event('scroll'));
  assert.equal(walk.querySelector('[aria-current="step"]').dataset.walkStep, '3');
  assert.equal(walk.querySelector('.walk-code:not([hidden])').dataset.sourceFile, 'crates/code/core/prompts/common/runtime_contract.md');
  assert.equal(walk.querySelectorAll('.walk-detail:not([hidden])').length, 1);
  assert.ok(walk.querySelector('.walk-status').textContent.includes('第 4 站'));
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
        assert.equal(stop.querySelector('pre').textContent, original);
        assert.equal(Number(stop.querySelector('.walk-line').dataset.lineNumber), Number(first));
        assert.ok(stop.querySelector('pre[data-ch="true"]'));
        assert.equal(stop.querySelectorAll('pre[style], pre [style]').length, 0);
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

test('published documents contain no interactive architecture diagrams or retired resources', async () => {
  const { readdir } = await import('node:fs/promises');
  const names = await readdir(publicRoot, { recursive: true });
  assert.equal(names.some(name => name.startsWith('atlas/')), false);
  for (const name of names) {
    if (!/\.(html|css|js|svg)$/.test(name)) continue;
    const value = await readFile(path.join(publicRoot, name), 'utf8');
    assert.doesNotMatch(value, /SeeCode|seecode|data-sc-|sc-svg|atlas-assembled|data-atlas|atlas-controls|class="pele/);
  }
});

test('Spotlight focus, wrapping and source range controls remain local to each code panel', async (t) => {
  const ui = await page(t, 'code/internals/system-prompts');
  const walk = ui.document.querySelector('[data-source-walk]');
  const first = walk.querySelector('.walk-code:not([hidden])');
  assert.ok(first.classList.contains('is-context'));
  first.querySelector('[data-code-action="focus"]').click();
  assert.equal(first.classList.contains('is-context'), false);
  assert.equal(first.querySelector('[data-code-action="focus"]').getAttribute('aria-pressed'), 'true');
  first.querySelector('[data-code-action="wrap"]').click();
  assert.ok(first.classList.contains('is-wrapped'));
  walk.querySelector('[data-walk-step="1"]').click();
  const prompt = walk.querySelector('.walk-code:not([hidden])');
  assert.ok(prompt.classList.contains('is-wrapped'));
  assert.ok(prompt.classList.contains('is-context'));
  assert.equal(prompt.querySelector('.walk-file-location strong').textContent, 'system_default.md');
  assert.match(prompt.querySelector('.walk-file-source').href, /system_default\.md#L1-L26$/);
  assert.equal(walk.querySelector('[data-walk-position]').textContent, '02 / 10');
});

test('clipboard boundary receives the exact source text and reports denied access inline', async (t) => {
  const ui = await page(t, 'code/internals/system-prompts');
  const panel = ui.document.querySelector('.walk-code:not([hidden])');
  let copied;
  Object.defineProperty(ui.window.navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value; } } });
  panel.querySelector('[data-code-action="copy"]').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(copied, panel.querySelector('pre').textContent);
  assert.equal(panel.querySelector('[data-copy-status]').textContent, '已复制');
  ui.window.navigator.clipboard.writeText = async () => { throw new Error('Denied'); };
  panel.querySelector('[data-code-action="copy"]').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(panel.querySelector('[data-copy-status]').textContent, '请选中代码复制');
  assert.equal(ui.document.querySelectorAll('.walk-code:not([hidden])').length, 1);
});

test('compact page-source disclosure retains every pinned reference in first-use order', async () => {
  const walk = JSON.parse(await readFile(path.join(root, 'apps/web/content/docs/code/9.1.6/_walks/system-prompts.json'), 'utf8'));
  for (const count of [3, 4]) {
    const sources = createSourceReferences(revision, root);
    const selected = walk.steps.slice(0, count).map(step => step.source);
    const markup = renderToStaticMarkup(h(Fragment, null, ...selected.map((source, key) => h(sources.SourceRef, { ...source, key })), h(sources.SourceList)));
    const dom = new JSDOM(markup);
    try {
      const disclosure = dom.window.document.querySelector('details.page-sources');
      assert.equal(disclosure.open, count === 3);
      assert.equal(disclosure.querySelector('.source-count').textContent, String(count));
      assert.deepEqual([...disclosure.querySelectorAll('nav a')].map(link => link.href), selected.map(source => sources.resolve(source).href));
    } finally { dom.window.close(); }
  }
});
