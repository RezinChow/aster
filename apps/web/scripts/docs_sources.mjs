import { execFileSync } from 'node:child_process';
import { createElement as h } from 'react';
import { sourceRepository } from './docs_components.mjs';

export function createSourceReferences(sourceRef, repositoryRoot, cache = new Map()) {
  const references = new Map();

  function SourceRef({ path, match, children }) {
    if (typeof path !== 'string' || !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+$/.test(path) || path.split('/').some((part) => part === '.' || part === '..')) throw new Error(`Invalid source path: ${path}`);
    if (typeof match !== 'string' || !match.trim()) throw new Error(`Source reference needs an exact match: ${path}`);
    const identity = `${sourceRef}:${path}`;
    if (!cache.has(identity)) cache.set(identity, execFileSync('git', ['show', identity], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    const source = cache.get(identity);
    const offset = source.indexOf(match);
    if (offset === -1 || source.indexOf(match, offset + 1) !== -1) throw new Error(`Source match must occur exactly once: ${identity}: ${match}`);
    const first = source.slice(0, offset).split('\n').length;
    const last = first + match.split('\n').length - 1;
    const lines = `L${first}${last > first ? `-L${last}` : ''}`;
    const href = `${sourceRepository}/blob/${sourceRef}/${path}#${lines}`;
    const label = children || path.split('/').at(-1);
    references.set(href, { href, path, lines, label });
    return h('a', { className: 'source-ref', href, title: `${path}:${first}` }, h('code', null, label), h('span', { className: 'source-line' }, ` ${lines} ↗`));
  }

  // React renders this after the article, once its inline citations have been collected.
  function SourceList() {
    if (!references.size) return null;
    return h('nav', { className: 'page-sources', 'aria-label': '本页源码' },
      h('p', { className: 'nav-label' }, '本页源码'),
      ...[...references.values()].map(({ href, path, lines, label }) => h('a', { key: href, href, title: path },
        h('strong', null, label), h('span', null, `${path.split('/').at(-1)} · ${lines} ↗`))));
  }

  return { SourceRef, SourceList };
}
