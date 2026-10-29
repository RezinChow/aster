import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createElement as h, useContext } from 'react';
import { highlight, Pre, InnerLine, InnerToken } from 'codehike/code';
import { renderToStaticMarkup } from 'react-dom/server';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { extractStyles } from './docs_markup.mjs';
import highContrast from '@shikijs/themes/github-light-high-contrast';
import { DiagramScope } from './docs_diagrams.mjs';

const safeName = (name) => typeof name === 'string' && /^[a-z][a-z0-9-]*$/.test(name);

export async function prepareWalks(directory, sources, styles) {
  let files;
  try { files = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return new Map(); throw error; }
  const walks = new Map();
  for (const file of files.filter((name) => name.endsWith('.json')).sort()) {
    const walk = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    for (const step of walk.steps) {
      step.excerpt = sources.resolve(step.source);
      const code = await highlight({ value: step.excerpt.value, lang: step.lang || (step.source.path.endsWith('.rs') ? 'rust' : 'markdown'), meta: '' }, highContrast);
      code.annotations.push({ name: 'focus', query: '', fromLineNumber: step.excerpt.focus, toLineNumber: step.excerpt.focusEnd });
      const handlers = [
        { name: 'source-lines', Line: (props) => h(InnerLine, { merge: props, className: 'walk-line', 'data-line-number': step.excerpt.first + props.lineNumber - 1 }) },
        { name: 'focus', AnnotatedLine: (props) => h(InnerLine, { merge: props, className: 'walk-focus', 'data-focus': true }) },
        { name: 'tokens', Token: (props) => h(InnerToken, { merge: props, className: 'walk-token' }) },
      ];
      const markup = renderToStaticMarkup(h(Pre, { code, handlers, tabIndex: 0, 'aria-label': `${step.title}的真实源码`, 'data-codehike': '1.1.0' }));
      const tree = fromHtml(markup, { fragment: true });
      extractStyles(tree, styles, 'walk-style');
      step.markup = toHtml(tree);
      step.language = code.lang;
    }
    walks.set(file.slice(0, -5), walk);
  }
  return walks;
}

export function SourceWalk({ name }) {
  const { chapter, walks, sources, styles } = useContext(DiagramScope);
  if (!safeName(name) || !walks.has(name)) throw new Error(`Unknown source walk: ${name}`);
  const walk = walks.get(name);
  const countClass = `walk-count-${walk.steps.length}`;
  styles.set(countClass, `--walk-count:${walk.steps.length}`);
  const identity = `walk-${chapter.project.id}-${name}`;
  const stops = walk.steps.map((step, index) => {
    const id = `${identity}-${index}`;
    const path = step.source.path.split('/');
    const filename = path.pop();
    const narrative = h('div', { className: 'walk-narrative' },
      h('button', { type: 'button', id: `${id}-step`, disabled: true, 'data-walk-step': index, className: 'walk-title', 'aria-controls': `${id}-detail ${id}-code` },
        h('span', { className: 'step-number' }, String(index + 1).padStart(2, '0')), h('span', { className: 'lab-step-label' }, step.title), h('span', { className: 'walk-step-arrow', 'aria-hidden': true }, '↗')),
      h('div', { className: 'walk-detail', id: `${id}-detail` }, h('p', null, step.body),
        h('p', { className: 'walk-takeaway' }, step.takeaway), h(sources.SourceRef, step.source)));
    const code = h('div', { className: `walk-code is-context${step.language === 'markdown' ? ' is-wrapped' : ''}`, id: `${id}-code`, 'data-source-file': step.source.path, role: 'region', 'aria-labelledby': `${id}-step` },
      h('div', { className: 'walk-file' }, h('span', { className: 'walk-language' }, step.language === 'rust' ? 'RS' : 'MD'),
        h('div', { className: 'walk-file-location', title: step.source.path }, h('span', null, `${path.join('/')}/`), h('strong', null, filename)),
        h('a', { className: 'walk-file-source', href: step.excerpt.href, title: '在 GitHub 查看这段原文' }, step.excerpt.lines, ' ↗')),
      h('div', { className: 'walk-code-tools', hidden: true },
        h('button', { type: 'button', 'data-code-action': 'focus', 'aria-pressed': false }, '聚焦关键行'),
        h('button', { type: 'button', 'data-code-action': 'wrap', 'aria-pressed': step.language === 'markdown' }, '自动换行'),
        h('span', { className: 'walk-copy-status', 'data-copy-status': true, role: 'status' }),
        h('button', { type: 'button', 'data-code-action': 'copy' }, '复制代码'),
        h('button', { type: 'button', 'data-lab-expand': true }, '展开 ↗')),
      h('div', { className: 'walk-code-content', dangerouslySetInnerHTML: { __html: step.markup } }));
    return h('section', { key: index, className: 'walk-stop', 'data-walk-stop': index }, narrative, code);
  });
  return h('section', { className: `source-walk reading-lab ${countClass}`, 'data-source-walk': name, 'aria-label': walk.title },
    h('div', { className: 'walk-heading' }, h('div', null, h('p', { className: 'diagram-kicker' }, '源码漫游'), h('h3', null, walk.title)), h('span', { className: 'walk-position', 'data-walk-position': true, 'aria-hidden': true }, `${stops.length} 个步骤`)),
    h('p', { className: 'walk-intro' }, walk.intro),
    h('div', { className: 'walk-controls', hidden: true },
      h('div', { className: 'walk-arrows' }, h('button', { type: 'button', 'data-walk-action': 'previous', 'aria-label': '上一站' }, '←'), h('button', { type: 'button', 'data-walk-action': 'next', 'aria-label': '下一站' }, '→')),
      h('span', { className: 'walk-inline-position', 'data-walk-inline-position': true, 'aria-hidden': true }, ''), h('span', { className: 'walk-hint' }, '选择步骤，对照关键代码'), h('button', { type: 'button', 'data-walk-action': 'all', 'aria-pressed': false }, '连续阅读')),
    h('div', { className: 'walk-stops' }, ...stops),
    h('p', { className: 'walk-status sr-only', role: 'status', 'aria-live': 'polite' }),
    h('p', { className: 'walk-footnote' }, '源码与本文版本一致，保留原始行号。'));
}
