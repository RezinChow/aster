import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createContext, createElement as h, useContext } from 'react';
import { render } from 'pele';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';

export const DiagramScope = createContext(null);

export function PeleDiagram({ name, label, description }) {
  const scope = useContext(DiagramScope);
  if (!scope?.chapter.version) throw new Error('Diagrams require an explicit product and version');
  if (!/^[a-z][a-z0-9-]*$/.test(name ?? '') || typeof label !== 'string' || !label.trim() || typeof description !== 'string' || !description.trim()) throw new Error('Diagram needs a safe name, label and description');
  const { chapter, contentRoot, styles } = scope;
  const identity = `${chapter.project.id}/${chapter.version.id}/${name}`;
  const source = readFileSync(path.join(contentRoot, chapter.project.id, chapter.version.id, '_diagrams', `${name}.mmd`), 'utf8');
  const { markup } = renderPele(source, identity, styles);
  return h('figure', { className: 'diagram pele-diagram' },
    h('div', { className: 'diagram-hint', 'aria-hidden': true }, '左右滑动查看完整图示 ↔'),
    h('div', { className: 'diagram-scroll', tabIndex: 0, role: 'region', 'aria-label': `${label}，可横向滚动`, dangerouslySetInnerHTML: { __html: markup } }),
    h('figcaption', null, h('span', { className: 'figure-label' }, label), description));
}

export function renderPele(source, identity, styles, { title, description } = {}) {
  const prefix = 'diagram-' + createHash('sha256').update(identity).digest('hex').slice(0, 12);
  const { svg } = render(source, { idPrefix: prefix, fontFamily: 'Ubuntu, sans-serif', fontSize: 14, padding: 24, autoDirection: false, links: false, images: false });
  const tree = fromHtml(svg, { fragment: true });
  const element = tree.children.find((node) => node.tagName === 'svg');
  element.properties.role = 'img';
  if (title) {
    element.children = element.children.filter((node) => !['title', 'desc'].includes(node.tagName));
    element.children.unshift(
      { type: 'element', tagName: 'title', properties: { id: `${prefix}-title` }, children: [{ type: 'text', value: title }] },
      { type: 'element', tagName: 'desc', properties: { id: `${prefix}-description` }, children: [{ type: 'text', value: description }] },
      { type: 'element', tagName: 'rect', properties: { width: '100%', height: '100%', fill: 'var(--_bg)' }, children: [] });
    element.properties.ariaLabelledBy = `${prefix}-title ${prefix}-description`;
  }
  const standalone = toHtml(tree);
  const nodeIds = new Set();
  // Extract generated styles without relaxing the site's ban on inline styles.
  const extractStyles = (node) => {
    if (node.properties?.style) {
      const style = node.properties.style;
      const className = `pele-style-${createHash('sha256').update(style).digest('hex').slice(0, 12)}`;
      styles.set(className, style);
      node.properties.className = [...(node.properties.className ?? []), className];
      delete node.properties.style;
    }
    if (node.properties?.className?.includes('pele-node')) nodeIds.add(node.properties.dataId);
    for (const child of node.children ?? []) extractStyles(child);
  };
  extractStyles(tree);
  return { markup: toHtml(tree), svg: standalone, nodeIds };
}
