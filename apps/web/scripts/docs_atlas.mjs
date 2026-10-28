import { readFileSync } from 'node:fs';
import { readFile, readdir, mkdir, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createElement as h, useContext } from 'react';
import { highlight } from 'codehike/code';
import highContrast from '@shikijs/themes/github-light-high-contrast';
import { DiagramScope, renderPele } from './docs_diagrams.mjs';

const safeName = (name) => typeof name === 'string' && /^[a-z][a-z0-9-]*$/.test(name);

export function renderAtlas(source, definition, identity, styles = new Map()) {
  if (!definition.title || !definition.description || !definition.steps?.length || definition.steps.some((step) => !step.title || !step.body)) throw new Error('Atlas needs a title, description and explanatory steps');
  const result = renderPele(source, identity, styles, definition);
  for (const step of definition.steps) for (const id of step.focus ?? []) {
    if (!result.nodeIds.has(id)) throw new Error(`Unknown Pele focus node: ${id}`);
  }
  return result;
}

export function PeleAtlasDiagram({ name, label, description }) {
  const scope = useContext(DiagramScope);
  if (!scope?.chapter.version || !safeName(name)) throw new Error('Atlas needs a version and safe name');
  const { chapter, contentRoot, styles, sources } = scope;
  const root = path.join(contentRoot, chapter.project.id, chapter.version.id);
  const definition = JSON.parse(readFileSync(path.join(root, '_atlas', `${name}.json`), 'utf8'));
  const source = readFileSync(path.join(root, '_diagrams', `${name}.mmd`), 'utf8');
  const { markup } = renderAtlas(source, definition, `${chapter.project.id}/${chapter.version.id}/${name}`, styles);
  const depth = chapter.route.split('/').filter(Boolean).length;
  const docsRoot = '../'.repeat(depth) || './';
  return h('figure', { className: 'diagram pele-diagram atlas-figure', 'data-atlas': name },
    h('figcaption', null, h('span', { className: 'figure-label' }, label || definition.title), description || definition.description),
    h('div', { className: 'atlas-controls', hidden: true },
      h('button', { type: 'button', 'data-atlas-action': 'previous' }, '上一步'),
      h('button', { type: 'button', 'data-atlas-action': 'next' }, '下一步'),
      h('button', { type: 'button', 'data-atlas-action': 'play', 'aria-pressed': false }, '播放讲解'),
      h('button', { type: 'button', 'data-atlas-action': 'all' }, '查看全图')),
    h('div', { className: 'diagram-hint', 'aria-hidden': true }, '左右滑动查看完整图示 ↔'),
    h('div', { className: 'diagram-scroll', tabIndex: 0, role: 'region', 'aria-label': `${definition.title}，可横向滚动`, dangerouslySetInnerHTML: { __html: markup } }),
    h('ol', { className: 'atlas-steps' }, ...definition.steps.map((step, index) => h('li', { key: index, 'data-atlas-focus': (step.focus ?? []).join(' ') },
      h('button', { type: 'button', className: 'atlas-step', 'data-atlas-step': index }, h('span', { className: 'step-number' }, String(index + 1).padStart(2, '0')), step.title),
      h('p', null, step.body), step.source && h(sources.SourceRef, step.source)))),
    h('p', { className: 'atlas-status', role: 'status', 'aria-live': 'polite' }),
    h('p', { className: 'atlas-credit' }, 'Pele · ', h('a', { href: `${docsRoot}atlas/${chapter.project.id}-${name}.svg`, download: true }, '下载静态 SVG')));
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
    if (check) { if (await readFile(target, 'utf8') !== value) throw new Error(`Stale atlas asset: ${target}`); }
    else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, value); }
    files.push(target);
  };
  for (const entry of catalog.diagrams) {
    const root = path.join(contentRoot, entry.product, entry.version);
    const definition = JSON.parse(await readFile(path.join(root, '_atlas', `${entry.name}.json`), 'utf8'));
    const source = await readFile(path.join(root, '_diagrams', `${entry.name}.mmd`), 'utf8');
    const { svg } = renderAtlas(source, definition, `${entry.product}/${entry.version}/${entry.name}`);
    await emit(path.join(outputRoot, 'atlas', `${entry.product}-${entry.name}.svg`), svg);
    if (entry.readme) await emit(path.join(repositoryRoot, 'assets/readme', `${entry.readme}.svg`), svg);
  }
  for (const name of ['seecode-symbol.png', 'seecode-word.png']) {
    const obsolete = path.join(outputRoot, 'atlas', name);
    try { await readFile(obsolete); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (check) throw new Error(`Obsolete diagram watermark: ${obsolete}`);
    await unlink(obsolete);
  }
  return files;
}
