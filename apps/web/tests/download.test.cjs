'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
// Development-only parser: the deployed page has no package imports.
const publicRequire = createRequire(path.join(root, 'packages/ui/package.json'));
const { JSDOM } = process.env.JS_DOM_MODULE
  ? require(path.resolve(process.env.JS_DOM_MODULE))
  : publicRequire('jsdom');
const publicRoot = path.join(root, 'apps/web/public');
const html = fs.readFileSync(path.join(publicRoot, 'download/index.html'), 'utf8');
const script = fs.readFileSync(path.join(publicRoot, 'download/app.js'), 'utf8');
const pageUrl = 'https://aster-ai-lab.github.io/aster/download/';

function page(t, { execute = true, width = 1280, reducedMotion = false } = {}) {
  const dom = new JSDOM(html, { url: pageUrl, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const network = [];
  const scrollCalls = [];
  window.scrollTo = (options) => scrollCalls.push(options);
  window.fetch = (...args) => { network.push(args); throw new Error('The preview must stay offline'); };
  window.XMLHttpRequest = class { constructor() { network.push('XMLHttpRequest'); throw new Error('Unexpected request'); } };
  window.navigator.sendBeacon = (...args) => { network.push(args); return false; };
  const media = new Map();
  function matches(query) {
    switch (query) {
      case '(max-width: 767px)': return width <= 767;
      case '(min-width: 768px)': return width >= 768;
      case '(prefers-reduced-motion: reduce)': return reducedMotion;
      default: throw new Error(`Add an explicit test fixture for media query: ${query}`);
    }
  }
  window.matchMedia = (query) => {
    if (!media.has(query)) {
      const listeners = new Set();
      media.set(query, { media: query, matches: matches(query), listeners,
        addEventListener: (_type, listener) => listeners.add(listener),
        removeEventListener: (_type, listener) => listeners.delete(listener) });
    }
    return media.get(query);
  };
  const resizeObservers = [];
  window.ResizeObserver = class {
    constructor(callback) { resizeObservers.push(callback); }
    observe() {}
    disconnect() {}
  };
  let previewWidth = 1100;
  Object.defineProperty(document.querySelector('.preview-outer'), 'clientWidth', { get: () => previewWidth });
  // jsdom has no top layer or native Escape default. Only the app's close-event
  // integration is tested here; focus trapping and Escape require a browser.
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  if (execute) window.eval(script);
  return { window, document, network, scrollCalls,
    newTask() { document.querySelector('.preview-topbar [data-demo-reset]').click(); },
    scroll(y) { window.scrollY = y; window.dispatchEvent(new window.Event('scroll')); },
    resizePreview(nextWidth) { previewWidth = nextWidth; for (const callback of resizeObservers) callback([]); },
    resize(nextWidth) {
      width = nextWidth;
      for (const item of media.values()) {
        const next = matches(item.media);
        if (next !== item.matches) {
          item.matches = next;
          for (const listener of item.listeners) listener({ matches: next, media: item.media });
        }
      }
      for (const callback of resizeObservers) callback([]);
    },
    key(element, key) {
      const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event;
    },
    input(value) {
      const prompt = document.querySelector('#demo-prompt');
      prompt.value = value;
      prompt.dispatchEvent(new window.Event('input', { bubbles: true }));
    },
    submit() {
      return document.querySelector('#demo-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    }
  };
}

test('project Pages resource paths and local fragments resolve; no-JS downloads remain available', (t) => {
  const { document } = page(t, { execute: false });
  for (const element of document.querySelectorAll('img[src], script[src], link[rel="stylesheet"][href], link[rel="icon"][href]')) {
    const url = new URL(element.getAttribute('src') || element.getAttribute('href'), pageUrl);
    assert.equal(url.origin, new URL(pageUrl).origin);
    assert.ok(url.pathname.startsWith('/aster/'));
    assert.ok(fs.statSync(path.join(publicRoot, url.pathname.slice('/aster/'.length))).isFile());
  }
  for (const anchor of document.querySelectorAll('a[href^="#"]')) {
    const fragment = decodeURIComponent(anchor.getAttribute('href').slice(1));
    if (fragment) assert.ok(document.getElementById(fragment), `Missing #${fragment}`);
  }
  assert.equal(document.querySelectorAll('a[href*="/releases/download/"]').length, 6);
  assert.equal(document.querySelector('noscript a').href, 'https://github.com/aster-ai-lab/aster/releases');
  for (const opener of document.querySelectorAll('[data-download]')) {
    assert.equal(opener.tagName, 'A');
    assert.equal(opener.href, 'https://github.com/aster-ai-lab/aster/releases');
  }
  assert.equal(document.querySelector('#demo-prompt').maxLength, 1000);
  assert.equal(document.querySelector('.send-button').disabled, true);
});

test('vertical scenario tabs wrap, select one panel, and use a single keyboard tab stop', (t) => {
  const ui = page(t);
  const tabs = [...ui.document.querySelectorAll('.scenario-tabs [role="tab"]')];
  function selected(index) {
    for (const [i, tab] of tabs.entries()) {
      assert.equal(tab.getAttribute('aria-selected'), String(i === index));
      assert.equal(tab.tabIndex, i === index ? 0 : -1);
      assert.equal(ui.document.getElementById(tab.getAttribute('aria-controls')).hidden, i !== index);
    }
  }
  selected(0);
  assert.equal(ui.key(tabs[0], 'ArrowUp').defaultPrevented, true);
  selected(3);
  assert.equal(ui.document.activeElement, tabs[3]);
  ui.key(tabs[3], 'Home'); selected(0);
  ui.key(tabs[0], 'End'); selected(3);
  ui.key(tabs[3], 'ArrowDown'); selected(0);
  assert.equal(ui.key(tabs[0], 'ArrowRight').defaultPrevented, false);
  selected(0);
  tabs[2].click(); selected(2);
});

test('mobile orientation and horizontal feature tabs use left/right keys without cross-selecting other groups', (t) => {
  const ui = page(t, { width: 390 });
  const scenarios = ui.document.querySelector('.scenario-tabs');
  const tabs = [...scenarios.querySelectorAll('[role="tab"]')];
  assert.equal(scenarios.getAttribute('aria-orientation'), 'horizontal');
  ui.key(tabs[0], 'ArrowRight');
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  const features = [...ui.document.querySelectorAll('.feature-chips [role="tab"]')];
  ui.key(features[0], 'ArrowLeft');
  assert.equal(features.at(-1).getAttribute('aria-selected'), 'true');
  assert.equal(ui.document.getElementById(features.at(-1).getAttribute('aria-controls')).hidden, false);
  assert.equal(ui.document.getElementById(features[0].getAttribute('aria-controls')).hidden, true);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  ui.resize(1280);
  assert.equal(scenarios.getAttribute('aria-orientation'), 'vertical');
});

test('each download CTA opens the native dialog and close returns focus to its own opener', (t) => {
  const ui = page(t);
  const dialog = ui.document.querySelector('#download-dialog');
  for (const opener of ui.document.querySelectorAll('[data-download]')) {
    opener.focus();
    assert.equal(opener.dispatchEvent(new ui.window.MouseEvent('click', { bubbles: true, cancelable: true })), false);
    assert.equal(dialog.open, true);
    ui.document.querySelector('#close-download').click();
    assert.equal(dialog.open, false);
    assert.equal(ui.document.activeElement, opener);
  }
  const opener = ui.document.querySelector('[data-download]');
  opener.click();
  dialog.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 500 });
  dialog.dispatchEvent(new ui.window.MouseEvent('click', { clientX: 200, clientY: 200, bubbles: true }));
  assert.equal(dialog.open, true);
  dialog.dispatchEvent(new ui.window.MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));
  assert.equal(dialog.open, false);
  assert.equal(ui.document.activeElement, opener);
  opener.click(); dialog.close();
  assert.equal(ui.document.activeElement, opener);
});

test('mobile menu closes on Escape, navigation, desktop resize, and opening a download', (t) => {
  const ui = page(t, { width: 390 });
  const toggle = ui.document.querySelector('.menu-toggle');
  const menu = ui.document.querySelector('#mobile-nav');
  function state(open) {
    assert.equal(menu.hidden, !open);
    assert.equal(toggle.getAttribute('aria-expanded'), String(open));
    assert.equal(toggle.getAttribute('aria-label'), open ? '关闭导航' : '打开导航');
  }
  toggle.click(); state(true);
  menu.querySelector('a').focus(); ui.key(menu, 'Escape'); state(false);
  assert.equal(ui.document.activeElement, toggle);
  toggle.click(); menu.querySelector('a').click(); state(false);
  toggle.click(); ui.resize(1280); state(false);
  ui.resize(390); toggle.click(); ui.document.querySelector('[data-download]').click(); state(false);
});

test('back-to-top follows scroll state, respects reduced motion, and restores a visible focus destination', (t) => {
  for (const reducedMotion of [false, true]) {
    const ui = page(t, { reducedMotion });
    const button = ui.document.querySelector('.back-to-top');
    assert.equal(button.hidden, true);
    ui.scroll(601);
    assert.equal(button.hidden, false);
    assert.equal(ui.document.querySelector('.site-header').classList.contains('scrolled'), true);
    button.click();
    assert.equal(ui.scrollCalls.length, 1);
    assert.equal(ui.scrollCalls[0].top, 0);
    assert.equal(ui.scrollCalls[0].behavior, reducedMotion ? 'instant' : 'smooth');
    assert.equal(ui.document.activeElement, ui.document.querySelector('.brand'));
    ui.scroll(0);
    assert.equal(button.hidden, true);
    assert.equal(ui.document.querySelector('.site-header').classList.contains('scrolled'), false);
  }
});

test('preview ResizeObserver produces numeric scale without CSS typed arithmetic', (t) => {
  const ui = page(t);
  const preview = ui.document.querySelector('.app-preview');
  assert.equal(preview.style.transform, 'scale(1)');
  ui.resizePreview(550);
  assert.equal(preview.style.transform, 'scale(0.5)');
  ui.resizePreview(1400);
  assert.equal(preview.style.transform, 'scale(1)');
});

test('preview rejects whitespace and renders hostile input as text without network execution', (t) => {
  const ui = page(t);
  ui.newTask();
  const result = ui.document.querySelector('#demo-result');
  const send = ui.document.querySelector('.send-button');
  ui.input(' \n\t'); assert.equal(send.disabled, true);
  assert.equal(ui.submit(), false); assert.equal(result.hidden, true);
  const hostile = '<img src=x onerror="window.pwned=true"><script>window.pwned=true</script>';
  ui.input(hostile); assert.equal(send.disabled, false);
  assert.equal(ui.submit(), false);
  assert.equal(ui.document.querySelector('#demo-request').textContent, hostile);
  assert.equal(ui.document.querySelector('#demo-request').children.length, 0);
  assert.equal(ui.window.pwned, undefined);
  assert.equal(result.hidden, false);
  assert.equal(ui.document.querySelector('#preview-home').hidden, true);
  assert.equal(ui.document.activeElement, ui.document.querySelector('#demo-confirm'));
  ui.document.querySelector('#demo-confirm').click();
  assert.ok(ui.document.querySelector('#demo-note').textContent.includes('没有读取文件、调用模型或执行命令'));
  assert.deepEqual(ui.network, []);
});

test('preview mode changes, completion, reset, and every sample action keep coherent state', (t) => {
  const ui = page(t);
  ui.newTask();
  const toggle = ui.document.querySelector('.plan-toggle');
  const confirm = ui.document.querySelector('#demo-confirm');
  const plan = ui.document.querySelector('.demo-plan');
  for (const planning of [true, false, true]) {
    if (toggle.getAttribute('aria-checked') !== String(planning)) toggle.click();
    ui.input('验证这个示例'); ui.submit();
    assert.equal(ui.document.querySelector('#demo-progress').textContent, planning ? '等待确认' : '示例步骤');
    assert.equal(confirm.textContent, planning ? '确认示例计划' : '查看示例结果');
    assert.equal(confirm.hidden, false);
    assert.equal(plan.classList.contains('complete'), false);
    confirm.click();
    assert.equal(confirm.hidden, true);
    assert.equal(plan.classList.contains('complete'), true);
    const reset = ui.document.querySelector('#demo-result [data-demo-reset]');
    assert.equal(ui.document.activeElement, reset);
    reset.click();
    assert.equal(ui.document.querySelector('#demo-result').hidden, true);
    assert.equal(ui.document.querySelector('#preview-home').hidden, false);
    assert.equal(ui.document.querySelector('.send-button').disabled, true);
    assert.equal(ui.document.activeElement, ui.document.querySelector('#demo-prompt'));
  }
  for (const button of ui.document.querySelectorAll('[data-prompt]')) {
    button.click();
    assert.ok(ui.document.querySelector('#demo-prompt').value.trim());
    assert.equal(ui.document.querySelector('.send-button').disabled, false);
  }
  ui.document.querySelector('[data-demo-reset]').click();
  assert.equal(ui.document.querySelector('#demo-prompt').value, '');
  assert.equal(ui.document.querySelector('.send-button').disabled, true);
  assert.deepEqual(ui.network, []);
});

test('mobile expand changes access on the same preview instance and restores desktop access', (t) => {
  const ui = page(t, { width: 390 });
  const preview = ui.document.querySelector('.app-preview');
  const prompt = ui.document.querySelector('#demo-prompt');
  const expand = ui.document.querySelector('.expand-preview');
  assert.equal(preview.inert, true);
  assert.equal(preview.getAttribute('aria-hidden'), 'true');
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
  expand.click();
  assert.equal(preview.inert, false);
  assert.equal(preview.hasAttribute('aria-hidden'), false);
  assert.equal(expand.getAttribute('aria-expanded'), 'true');
  assert.equal(preview.style.transform, 'none');
  ui.newTask(); ui.input('保留草稿');
  expand.click();
  assert.equal(preview.inert, true);
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
  assert.equal(prompt.value, '保留草稿');
  ui.resize(1280);
  assert.equal(preview.inert, false);
  assert.equal(preview.hasAttribute('aria-hidden'), false);
  assert.equal(ui.document.querySelector('.app-preview'), preview);
  assert.equal(ui.document.querySelector('#demo-prompt'), prompt);
  assert.equal(prompt.value, '保留草稿');
});

test('default workspace, Office, lineage subtabs, and review actions remain separate offline views', (t) => {
  const ui = page(t);
  const workspace = ui.document.querySelector('.workspace-showcase');
  assert.equal(workspace.hidden, false);
  assert.equal(ui.document.querySelector('#preview-home').hidden, true);
  assert.equal(ui.document.querySelector('#demo-result').hidden, true);
  assert.equal(ui.document.querySelector('#workspace-panel-office').hidden, false);
  ui.document.querySelector('[data-tour="files"]').click();
  assert.equal(ui.document.querySelector('#workspace-panel-files').hidden, false);
  const openOffice = ui.document.querySelector('#workspace-panel-files [data-tour="office"]');
  openOffice.focus(); openOffice.click();
  assert.equal(ui.document.querySelector('#workspace-panel-files').hidden, true);
  assert.equal(ui.document.querySelector('#workspace-panel-office').hidden, false);
  assert.equal(ui.document.activeElement, ui.document.querySelector('#workspace-tab-office'));
  ui.document.querySelector('#workspace-panel-office [data-tour="lineage"]').click();
  assert.equal(ui.document.querySelector('#workspace-panel-lineage').hidden, false);
  assert.equal(ui.document.activeElement, ui.document.querySelector('#workspace-tab-lineage'));
  ui.document.querySelector('[data-tour="review"]').click();
  assert.equal(ui.document.querySelector('#proof-review').hidden, false);
  assert.equal(ui.document.querySelector('#proof-artifact').hidden, true);
  assert.equal(ui.document.activeElement, ui.document.querySelector('#proof-tab-review'));
  for (const [action, label] of [['accepted', '已验收'], ['waived', '已忽略']]) {
    ui.document.querySelector(`[data-review-action="${action}"]`).click();
    const status = ui.document.querySelector('#review-disposition-status').textContent;
    assert.ok(status.includes(label));
    assert.ok(status.includes('示例'));
  }
  ui.newTask();
  assert.equal(workspace.hidden, true);
  assert.equal(ui.document.querySelector('#preview-home').hidden, false);
  assert.deepEqual(ui.network, []);
});

test('task options default off, close on Escape or view changes, and only annotate the offline example', (t) => {
  const ui = page(t);
  ui.newTask();
  const menu = ui.document.querySelector('#demo-options');
  const trigger = ui.document.querySelector('.demo-options-trigger');
  const options = [...menu.querySelectorAll('[data-demo-option]')];
  assert.equal(menu.hidden, true);
  assert.equal(menu.querySelector('button:not([data-demo-option])').disabled, true);
  for (const option of options) assert.equal(option.getAttribute('aria-checked'), 'false');
  trigger.click();
  assert.equal(menu.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  options[0].focus(); options[0].click();
  assert.equal(options[0].getAttribute('aria-checked'), 'true');
  ui.key(options[0], 'Escape');
  assert.equal(menu.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.document.activeElement, trigger);
  trigger.click();
  ui.document.body.dispatchEvent(new ui.window.Event('pointerdown', { bubbles: true }));
  assert.equal(menu.hidden, true);
  trigger.click(); ui.newTask();
  assert.equal(menu.hidden, true);
  trigger.click(); ui.document.querySelector('[data-tour="files"]').click();
  assert.equal(menu.hidden, true);
  ui.newTask(); trigger.click(); options[1].click();
  ui.input('只展示选择状态'); ui.submit();
  assert.equal(menu.hidden, true);
  ui.document.querySelector('#demo-confirm').click();
  const note = ui.document.querySelector('#demo-note').textContent;
  assert.ok(note.includes('已选择自动审查'));
  assert.ok(note.includes('已选择产物追溯'));
  assert.ok(note.includes('没有读取文件、调用模型或执行命令'));
  assert.deepEqual(ui.network, []);
});
