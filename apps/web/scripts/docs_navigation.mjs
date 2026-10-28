import { getStartingSnapshot, calculateTransitions } from 'codehike/utils/token-transitions';

(() => {
  const menu = document.querySelector('.docs-sidebar .chapter-nav');
  if (!menu?.dataset.scrollScope) return;
  const key = `aster.docs.sidebar:${menu.dataset.scrollScope}`;
  try {
    const saved = sessionStorage.getItem(key);
    const position = saved === null ? 0 : Number(saved);
    if (Number.isFinite(position) && position >= 0) menu.scrollTop = position;
  } catch { /* Storage can be disabled; ordinary links still work. */ }
  const save = () => {
    if (menu.clientHeight === 0) return;
    try { sessionStorage.setItem(key, String(menu.scrollTop)); } catch { /* Optional enhancement. */ }
  };
  menu.addEventListener('click', save, { capture: true });
  menu.addEventListener('auxclick', save, { capture: true });
  window.addEventListener('pagehide', save);
})();

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

for (const figure of document.querySelectorAll('[data-atlas]')) {
  const controls = figure.querySelector('.atlas-controls');
  const steps = [...figure.querySelectorAll('[data-atlas-step]')];
  const nodes = [...figure.querySelectorAll('.pele-node[data-id]')];
  const canvas = figure.querySelector('.diagram-scroll');
  let current = -1;
  let timer;
  const play = controls.querySelector('[data-atlas-action="play"]');
  const nodeStep = id => steps.findIndex(button => button.closest('li').dataset.atlasFocus.split(' ').includes(id));
  figure.querySelector('svg').setAttribute('role', 'group');
  steps.forEach(button => { button.disabled = false; });
  for (const node of nodes.filter(item => nodeStep(item.dataset.id) >= 0)) {
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
  }
  const stop = () => {
    window.clearTimeout(timer);
    timer = undefined;
    play.setAttribute('aria-pressed', 'false');
    play.textContent = '播放讲解';
  };
  const select = (index, announce = true) => {
    current = Math.max(-1, Math.min(steps.length - 1, index));
    const focused = current < 0 ? [] : steps[current].closest('li').dataset.atlasFocus.split(' ').filter(Boolean);
    for (const [i, button] of steps.entries()) {
      button.toggleAttribute('aria-current', i === current);
      if (i === current) button.setAttribute('aria-current', 'step');
      button.closest('li').classList.toggle('is-current', i === current);
    }
    const selected = [];
    for (const node of nodes) {
      const active = focused.includes(node.dataset.id);
      node.classList.toggle('atlas-is-muted', focused.length > 0 && !active);
      node.classList.toggle('atlas-is-current', active);
      if (node.getAttribute('role') === 'button') node.setAttribute('aria-pressed', String(active));
      if (active) selected.push(node);
    }
    controls.querySelector('[data-atlas-action="previous"]').disabled = current <= 0;
    controls.querySelector('[data-atlas-action="next"]').disabled = current === steps.length - 1;
    controls.querySelector('[data-atlas-position]').textContent = current < 0 ? '完整图示' : `${String(current + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
    if (announce) {
      figure.querySelector('.atlas-status').textContent = current < 0 ? '正在查看完整图示。' : `第 ${current + 1} 步，共 ${steps.length} 步：${steps[current].textContent.trim()}`;
      revealDiagramNodes(canvas, selected);
    }
    canvas.dispatchEvent(new CustomEvent('reading-step-change'));
  };
  const advance = () => {
    select(current + 1);
    timer = window.setTimeout(current < steps.length - 1 ? advance : stop, 3200);
  };
  figure.addEventListener('click', event => {
    const step = event.target.closest('[data-atlas-step]');
    if (step) { stop(); select(Number(step.dataset.atlasStep)); return; }
    const action = event.target.closest('[data-atlas-action]')?.dataset.atlasAction;
    if (!action) return;
    if (action === 'play') {
      if (timer || reducedMotion?.matches) { stop(); return; }
      if (current === steps.length - 1) current = -1;
      play.setAttribute('aria-pressed', 'true');
      play.textContent = '暂停讲解';
      advance();
      return;
    }
    stop();
    if (action === 'previous') select(current - 1);
    if (action === 'next') select(current + 1);
    if (action === 'all') select(-1);
  });
  figure.addEventListener('keydown', event => {
    if (!event.target.closest('.atlas-controls, .atlas-steps') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); stop();
    select(event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
    steps[current]?.focus({ preventScroll: true });
  });
  canvas.addEventListener('click', event => {
    const node = event.target.closest('.pele-node[data-id][role="button"]');
    if (node) { event.stopPropagation(); stop(); select(nodeStep(node.dataset.id)); }
  });
  canvas.addEventListener('keydown', event => {
    const node = event.target.closest('.pele-node[data-id][role="button"]');
    if (node && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); stop(); select(nodeStep(node.dataset.id)); }
  });
  figure.addEventListener('reading-view-open', stop);
  controls.hidden = false;
  play.hidden = Boolean(reducedMotion?.matches);
  reducedMotion?.addEventListener?.('change', () => { stop(); play.hidden = reducedMotion.matches; });
  window.addEventListener('pagehide', stop, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  figure.classList.add('is-enhanced');
  select(-1, false);
}

for (const walk of document.querySelectorAll('[data-source-walk]')) {
  const stops = [...walk.querySelectorAll('[data-walk-stop]')];
  const controls = walk.querySelector('.walk-controls');
  let current = 0;
  let all = false;
  let animations = [];
  const cancelAnimations = () => { animations.forEach(animation => animation.cancel()); animations = []; };
  const select = (index, announce = true, animate = true) => {
    cancelAnimations();
    const previous = all ? undefined : stops[current].querySelector('.walk-code');
    const next = stops[Math.max(0, Math.min(stops.length - 1, index))].querySelector('.walk-code');
    const canAnimate = animate && !all && previous !== next && !previous?.hidden && !reducedMotion?.matches && typeof next.animate === 'function';
    const sameFile = previous?.dataset.sourceFile === next.dataset.sourceFile && !previous?.classList.contains('is-wrapped') && !next.classList.contains('is-wrapped');
    const snapshot = canAnimate && sameFile ? getStartingSnapshot(previous.querySelector('pre'), { selector: '.walk-token' }) : undefined;
    current = Math.max(0, Math.min(stops.length - 1, index));
    for (const [i, stop] of stops.entries()) {
      const active = all || i === current;
      stop.querySelector('.walk-code').hidden = !active;
      stop.querySelector('.walk-detail').hidden = !active;
      const button = stop.querySelector('[data-walk-step]');
      button.disabled = false;
      button.setAttribute('aria-expanded', String(active));
      button.toggleAttribute('aria-current', i === current && !all);
      if (i === current && !all) button.setAttribute('aria-current', 'step');
      stop.querySelector('.walk-narrative').classList.toggle('is-current', i === current && !all);
    }
    walk.classList.toggle('is-reading-all', all);
    controls.querySelector('[data-walk-action="previous"]').disabled = all || current === 0;
    controls.querySelector('[data-walk-action="next"]').disabled = all || current === stops.length - 1;
    const reading = controls.querySelector('[data-walk-action="all"]');
    reading.textContent = all ? '回到分步漫游' : '连续阅读';
    reading.setAttribute('aria-pressed', String(all));
    walk.querySelector('[data-walk-position]').textContent = all ? `全部 / ${stops.length}` : `${String(current + 1).padStart(2, '0')} / ${String(stops.length).padStart(2, '0')}`;
    walk.querySelector('[data-walk-inline-position]').textContent = walk.querySelector('[data-walk-position]').textContent;
    if (!all) {
      const pre = next.querySelector('pre');
      const focus = pre.querySelector('.walk-focus');
      if (announce && focus) pre.scrollTop = Math.max(0, focus.offsetTop - pre.offsetTop - pre.clientHeight * .3);
      if (canAnimate && snapshot) {
        animations = calculateTransitions(pre, snapshot, { selector: '.walk-token' }).map(({ element, keyframes, options }) => {
          const frames = {};
          if (keyframes.translateX || keyframes.translateY) frames.transform = [0, 1].map(i => `translate(${keyframes.translateX?.[i] || 0}px,${keyframes.translateY?.[i] || 0}px)`);
          if (keyframes.opacity) frames.opacity = keyframes.opacity;
          return element.animate(frames, { duration: Math.max(300, Math.min(500, options.duration * 900)), delay: Math.min(200, options.delay * 300), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        });
        walk.dataset.transition = 'tokens';
      } else if (canAnimate) {
        animations = [pre.animate([{ opacity: .25, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' })];
        walk.dataset.transition = 'file';
      } else walk.dataset.transition = 'none';
    }
    if (announce) walk.querySelector('.walk-status').textContent = all ? '正在阅读全部源码。' : `第 ${current + 1} 站，共 ${stops.length} 站：${stops[current].querySelector('.walk-title').textContent.trim()}`;
  };
  const go = index => {
    all = false;
    select(index);
    const button = stops[current].querySelector('[data-walk-step]');
    button.focus({ preventScroll: true });
    if (window.getComputedStyle(walk.querySelector('.walk-stops')).display !== 'grid') {
      stops[current].scrollIntoView?.({ block: 'start', behavior: 'instant' });
    } else {
      const bounds = button.getBoundingClientRect();
      if (bounds.top < 96 || bounds.bottom > window.innerHeight - 24) button.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    }
  };
  walk.addEventListener('click', event => {
    const button = event.target.closest('[data-walk-step]');
    if (button) { go(Number(button.dataset.walkStep)); return; }
    const action = event.target.closest('[data-walk-action]')?.dataset.walkAction;
    if (action === 'previous') go(current - 1);
    if (action === 'next') go(current + 1);
    if (action === 'all') { all = !all; select(current, true, false); }
  });
  walk.addEventListener('keydown', event => {
    if (!event.target.closest('[data-walk-step], .walk-controls') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    go(event.key === 'Home' ? 0 : event.key === 'End' ? stops.length - 1 : current + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1));
  });
  for (const panel of walk.querySelectorAll('.walk-code')) {
    panel.querySelector('.walk-code-tools').hidden = false;
    panel.classList.add('is-enhanced');
    panel.addEventListener('click', async event => {
      const button = event.target.closest('[data-code-action]');
      if (!button) return;
      if (button.dataset.codeAction === 'focus') {
        const context = panel.classList.toggle('is-context');
        button.setAttribute('aria-pressed', String(!context));
      }
      if (button.dataset.codeAction === 'wrap') {
        const wrapped = panel.classList.toggle('is-wrapped');
        button.setAttribute('aria-pressed', String(wrapped));
      }
      if (button.dataset.codeAction === 'copy') {
        const status = panel.querySelector('[data-copy-status]');
        try { await navigator.clipboard.writeText(panel.querySelector('pre').textContent); status.textContent = '已复制'; }
        catch { status.textContent = '请选中代码复制'; }
      }
    });
  }
  controls.hidden = false;
  walk.classList.add('is-enhanced');
  reducedMotion?.addEventListener?.('change', cancelAnimations);
  window.addEventListener('pagehide', cancelAnimations, { once: true });
  select(0, false, false);
}

for (const tools of document.querySelectorAll('.diagram-tools')) tools.hidden = false;
for (const button of document.querySelectorAll('[data-lab-expand]')) button.hidden = typeof HTMLDialogElement === 'undefined' || typeof HTMLDialogElement.prototype.showModal !== 'function';
document.addEventListener('click', event => {
  const button = event.target.closest('[data-lab-expand]');
  if (!button) return;
  const panel = button.closest('.walk-code');
  const visual = panel || button.closest('.diagram').querySelector('.diagram-scroll');
  const owner = panel ? button.closest('.source-walk') : button.closest('.diagram');
  owner.dispatchEvent(new CustomEvent('reading-view-open'));
  const title = panel ? panel.querySelector('.walk-file-location').title : button.closest('.diagram').querySelector('.figure-label').textContent;
  const placeholder = document.createComment('reading view');
  const position = window.scrollY;
  const dialog = document.createElement('dialog');
  dialog.className = 'doc-viewer';
  dialog.setAttribute('aria-labelledby', 'doc-viewer-title');
  const header = document.createElement('div'); header.className = 'doc-viewer-header';
  const heading = document.createElement('h2'); heading.id = 'doc-viewer-title'; heading.textContent = title;
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '关闭 ×';
  header.append(heading, close); dialog.append(header); document.body.append(dialog);
  const originalLabel = visual.getAttribute('aria-labelledby');
  if (panel) visual.setAttribute('aria-labelledby', 'doc-viewer-title');
  visual.before(placeholder); dialog.append(visual);
  const note = document.createElement('div'); note.className = 'doc-viewer-note';
  const updateNote = () => {
    const selected = owner.querySelector(panel ? '.walk-narrative.is-current' : '.atlas-steps li.is-current');
    note.replaceChildren();
    if (selected) {
      const title = document.createElement('h3'); title.textContent = selected.querySelector('.lab-step-label').textContent;
      note.append(title);
      for (const paragraph of selected.querySelectorAll('p')) note.append(paragraph.cloneNode(true));
      const source = selected.querySelector('.source-ref');
      if (source) note.append(source.cloneNode(true));
    } else if (owner.hasAttribute('data-atlas')) { note.textContent = '选择图中节点，查看对应说明。'; }
  };
  updateNote(); dialog.append(note);
  visual.addEventListener('reading-step-change', updateNote);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { visual.removeEventListener('reading-step-change', updateNote); placeholder.replaceWith(visual); if (originalLabel) visual.setAttribute('aria-labelledby', originalLabel); dialog.remove(); window.scrollTo({ top: position, behavior: 'instant' }); button.focus({ preventScroll: true }); }, { once: true });
  dialog.showModal();
});

function revealDiagramNodes(canvas, nodes) {
  if (!nodes.length) { canvas.scrollTo?.({ left: 0, top: 0, behavior: 'instant' }); return; }
  const bounds = nodes.map(node => node.getBoundingClientRect());
  const frame = canvas.getBoundingClientRect();
  const left = Math.min(...bounds.map(box => box.left));
  const right = Math.max(...bounds.map(box => box.right));
  const top = Math.min(...bounds.map(box => box.top));
  const bottom = Math.max(...bounds.map(box => box.bottom));
  const deltaX = left < frame.left + 16 || right > frame.right - 16 ? (left + right - frame.left - frame.right) / 2 : 0;
  const deltaY = top < frame.top + 16 || bottom > frame.bottom - 16 ? (top + bottom - frame.top - frame.bottom) / 2 : 0;
  canvas.scrollTo?.({ left: canvas.scrollLeft + deltaX, top: canvas.scrollTop + deltaY, behavior: reducedMotion?.matches ? 'instant' : 'smooth' });
}
