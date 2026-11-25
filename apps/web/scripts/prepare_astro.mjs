import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDocs } from './build_docs.mjs';
import { buildNavigation } from './build_navigation.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const cacheRoot = path.join(webRoot, 'node_modules/.cache/aster-docs');
const publicRoot = path.join(webRoot, 'node_modules/.cache/astro-public');
const args = process.argv.slice(2);
const check = args.includes('--check');
if (args.some((argument) => argument !== '--check')) throw new Error('Usage: prepare_astro.mjs [--check]');

const staticFiles = [
  'screenshots/workspace.png', 'screenshots/office.png', 'screenshots/review.png', 'screenshots/lineage.png', 'screenshots/tui.png',
  'screenshots/tui-model.png', 'screenshots/tui-context.png', 'screenshots/tui-resume.png',
  'screenshots/tui-home.png',
  'fonts/ubuntu-latin-400-normal.woff2', 'fonts/ubuntu-latin-500-normal.woff2', 'fonts/ubuntu-latin-700-normal.woff2', 'fonts/Ubuntu-LICENSE.txt',
  'tenant/aster/logo.svg', 'tenant/aster/mark-light.png', 'tenant/aster/favicon.png',
  'home.css', 'home.js', 'cosmic.js', 'transitions.css', 'legal/styles.css',
  'docs/styles.css', 'docs/harness-demo.css', 'docs/search.js',
];

if (!check) await rm(publicRoot, { recursive: true, force: true });
await buildNavigation({ check });
await buildDocs({ check, outputRoot: cacheRoot });
if (!check) {
  for (const name of staticFiles) {
    const target = path.join(publicRoot, name);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(webRoot, 'public', name), target);
  }
  for (const name of ['docs/generated.css', 'docs/search-index.json', 'docs/atlas']) {
    const target = path.join(publicRoot, name);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(cacheRoot, name.slice('docs/'.length)), target, { recursive: true });
  }
}
console.log(`${check ? 'Checked' : 'Prepared'} documentation and isolated public assets for Astro.`);
