import { readFileSync } from 'node:fs';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement as h, useContext } from 'react';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { highlight } from 'codehike/code';
import highContrast from '@shikijs/themes/github-light-high-contrast';
import { renderSpec } from '../vendor/seecode/scripts/lib/render.mjs';
import { svgFromHtml } from '../vendor/seecode/scripts/lib/export/svg.mjs';
import { DIAGRAM_CSS, skinCss } from '../vendor/seecode/scripts/lib/tokens.mjs';
import { MOTION_CSS } from '../vendor/seecode/scripts/lib/motion.mjs';
import { DiagramScope } from './docs_diagrams.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const safeName = (name) => typeof name === 'string' && /^[a-z][a-z0-9-]*$/.test(name);
const brand = { light: { paper: '#f4f3ee', ink: '#1d302a', accent: '#347653', link: '#2a5741' }, dark: { paper: '#1d302a', ink: '#f4f3ee', accent: '#3a845d', link: '#77a289' }, fonts: { sans: 'Ubuntu', serif: 'Ubuntu', mono: 'monospace' } };

export function renderAtlas(definition) {
  if (!definition.steps?.length || definition.steps.some((step) => !step.title || !step.body)) throw new Error('Atlas needs explanatory steps');
  const rendered = renderSpec(definition.spec, { settings: { fonts: 'system', skin: 'light', brand } });
  if (!rendered.ok) throw new Error(`SeeCode: ${JSON.stringify(rendered.problems)}`);
  const problems = rendered.result.problems ?? [];
  if (problems.some((problem) => /^[EW]_/.test(problem.code))) throw new Error(`SeeCode layout: ${JSON.stringify(problems)}`);
  return rendered;
}

// The upstream renderer stays unchanged. Only repository-authored drawing data enters it.
export function diagramMarkup(rendered, styles, imageRoot) {
  const tree = fromHtml(rendered.html);
  const find = (node, tag) => node.tagName === tag ? node : (node.children ?? []).map((child) => find(child, tag)).find(Boolean);
  const svg = find(tree, 'svg');
  const title = find(tree, 'h1');
  svg.children.unshift({ type: 'element', tagName: 'title', properties: { id: title.properties.id }, children: title.children });
  svg.properties.className.push('sc-still');
  const extract = (node) => {
    if (node.properties?.style) {
      const style = node.properties.style;
      const className = `atlas-style-${createHash('sha256').update(style).digest('hex').slice(0, 12)}`;
      styles.set(className, style);
      node.properties.className = [...(node.properties.className ?? []), className];
      delete node.properties.style;
    }
    if (node.tagName === 'image') {
      const href = node.properties.href;
      const word = href.includes(Buffer.from(readFileSync(path.join(webRoot, 'vendor/seecode/assets/mark-word.png'))).toString('base64'));
      node.properties.href = `${imageRoot}seecode-${word ? 'word' : 'symbol'}.png`;
      delete node.properties.xLinkHref;
    }
    if (node.properties?.dataScNode) {
      delete node.properties.tabIndex;
      node.properties.role = 'group';
    }
    if (node.tagName === 'script' || node.tagName === 'style' || node.tagName === 'foreignObject') throw new Error('Unexpected executable diagram markup');
    for (const child of node.children ?? []) extract(child);
  };
  extract(svg);
  return toHtml(svg);
}

export const atlasCss = skinCss({ skin: 'light', brand }).replaceAll(':root', '.atlas-figure') + '\n' + DIAGRAM_CSS + '\n' + MOTION_CSS;

export function SeeCodeDiagram({ name, label, description }) {
  const scope = useContext(DiagramScope);
  if (!scope?.chapter.version || !safeName(name)) throw new Error('Atlas needs a version and safe name');
  const { chapter, contentRoot, styles, sources } = scope;
  const root = path.join(contentRoot, chapter.project.id, chapter.version.id, '_atlas');
  const definition = JSON.parse(readFileSync(path.join(root, `${name}.json`), 'utf8'));
  const rendered = renderAtlas(definition);
  const depth = chapter.route.split('/').filter(Boolean).length;
  const docsRoot = '../'.repeat(depth) || './';
  const markup = diagramMarkup(rendered, styles, `${docsRoot}atlas/`);
  return h('figure', { className: 'diagram atlas-figure', 'data-atlas': name, 'data-theme': 'light' },
    h('figcaption', null, h('span', { className: 'figure-label' }, label || definition.spec.title), description || definition.spec.subtitle),
    h('div', { className: 'atlas-controls', hidden: true },
      h('button', { type: 'button', 'data-atlas-action': 'previous' }, '上一步'),
      h('button', { type: 'button', 'data-atlas-action': 'next' }, '下一步'),
      h('button', { type: 'button', 'data-atlas-action': 'play', 'aria-pressed': false }, '播放讲解'),
      h('button', { type: 'button', 'data-atlas-action': 'all' }, '查看全图'),
      definition.spec.type === 'exploded' && h('button', { type: 'button', 'data-atlas-action': 'assemble', 'aria-pressed': false }, '合起分层')),
    h('div', { className: 'diagram-scroll', tabIndex: 0, role: 'region', 'aria-label': `${definition.spec.title}，可横向滚动`, dangerouslySetInnerHTML: { __html: markup } }),
    h('ol', { className: 'atlas-steps' }, ...definition.steps.map((step, index) => h('li', { key: index, 'data-atlas-focus': (step.focus ?? []).join(' ') },
      h('button', { type: 'button', className: 'atlas-step', 'data-atlas-step': index }, h('span', { className: 'step-number' }, String(index + 1).padStart(2, '0')), step.title),
      h('p', null, step.body), step.source && h(sources.SourceRef, step.source)))),
    h('p', { className: 'atlas-status', role: 'status', 'aria-live': 'polite' }),
    h('p', { className: 'atlas-credit' }, 'SeeCode · ', definition.spec.type, ' · ', h('a', { href: `${docsRoot}atlas/${chapter.project.id}-${name}.svg`, download: true }, '下载静态 SVG')));
}

export async function prepareWalks(directory, sources, styles) {
  let files;
  try { files = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return new Map(); throw error; }
  const walks = new Map();
  for (const file of files.filter((name) => name.endsWith('.json')).sort()) {
    const walk = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    for (const step of walk.steps) {
      step.excerpt = sources.resolve(step.source);
      const result = await highlight({ value: step.excerpt.value, lang: step.lang || (step.source.path.endsWith('.rs') ? 'rust' : 'markdown'), meta: '' }, highContrast);
      const lines = [[]];
      for (const token of result.tokens) {
        const value = typeof token === 'string' ? token : token[0];
        const color = typeof token === 'string' ? undefined : token[1];
        const pieces = value.split('\n');
        for (const [index, piece] of pieces.entries()) {
          if (index) lines.push([]);
          const className = color ? `walk-token-${createHash('sha256').update(color).digest('hex').slice(0, 8)}` : undefined;
          if (color) styles.set(className, `color:${color}`);
          if (piece) lines.at(-1).push(h('span', { className, key: lines.at(-1).length }, piece));
        }
      }
      step.lines = lines;
    }
    walks.set(file.slice(0, -5), walk);
  }
  return walks;
}

export function SourceWalk({ name }) {
  const { walks, sources } = useContext(DiagramScope);
  if (!safeName(name) || !walks.has(name)) throw new Error(`Unknown source walk: ${name}`);
  const walk = walks.get(name);
  const stops = walk.steps.map((step, index) => {
    const narrative = h('div', { className: 'walk-narrative' },
      h('button', { type: 'button', 'data-walk-step': index, className: 'walk-title' }, h('span', { className: 'step-number' }, String(index + 1).padStart(2, '0')), step.title),
      h('p', null, step.body), h('p', { className: 'walk-takeaway' }, step.takeaway), h(sources.SourceRef, step.source));
    const code = h('div', { className: 'walk-code' },
      h('p', { className: 'walk-file' }, step.source.path),
      h('pre', { tabIndex: 0, 'aria-label': `${step.title}的真实源码`, 'data-codehike': '1.1.0' }, h('code', null,
        ...step.lines.map((tokens, line) => h('span', { className: `walk-line${line + 1 === step.excerpt.focus ? ' walk-focus' : ''}`, key: line },
          h('span', { className: 'walk-line-number', 'aria-hidden': true }, step.excerpt.first + line), ...tokens, '\n')))));
    return h('section', { key: index, className: 'walk-stop', 'data-walk-stop': index }, narrative, code);
  });
  return h('section', { className: 'source-walk', 'data-source-walk': name, 'aria-label': walk.title },
    h('p', { className: 'walk-intro' }, walk.intro),
    h('div', { className: 'walk-controls', hidden: true }, h('button', { type: 'button', 'data-walk-action': 'previous' }, '上一站'), h('button', { type: 'button', 'data-walk-action': 'next' }, '下一站'), h('button', { type: 'button', 'data-walk-action': 'all' }, '阅读全部源码')),
    h('div', { className: 'walk-stops' }, ...stops),
    h('p', { className: 'walk-status', role: 'status', 'aria-live': 'polite' }), h('p', { className: 'atlas-credit' }, 'Code Hike · 源码按本文版本提取，行号对应仓库。'));
}

export async function buildAtlasAssets({ contentRoot, outputRoot, check, repositoryRoot }) {
  let catalog;
  try { catalog = JSON.parse(await readFile(path.join(contentRoot, 'atlas.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  const emit = async (target, value) => {
    if (check) { if (!Buffer.from(await readFile(target)).equals(Buffer.from(value))) throw new Error(`Stale atlas asset: ${target}`); }
    else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, value); }
    files.push(target);
  };
  for (const entry of catalog.diagrams) {
    const definition = JSON.parse(await readFile(path.join(contentRoot, entry.product, entry.version, '_atlas', `${entry.name}.json`), 'utf8'));
    const rendered = renderAtlas(definition);
    const svg = svgFromHtml(rendered.html);
    await emit(path.join(outputRoot, 'atlas', `${entry.product}-${entry.name}.svg`), svg);
    if (entry.readme) await emit(path.join(repositoryRoot, 'assets/readme', `${entry.readme}.svg`), svg);
  }
  for (const name of ['symbol', 'word']) await emit(path.join(outputRoot, 'atlas', `seecode-${name}.png`), await readFile(path.join(webRoot, 'vendor/seecode/assets', `mark-${name}.png`)));
  return files;
}
