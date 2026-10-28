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

(() => {
  for (const figure of document.querySelectorAll('[data-atlas]')) {
    const controls = figure.querySelector('.atlas-controls');
    const steps = [...figure.querySelectorAll('[data-atlas-step]')];
    const nodes = [...figure.querySelectorAll('.pele-node[data-id]')];
    const diagram = figure.querySelector('.pele');
    let current = -1;
    let timer;
    const play = controls.querySelector('[data-atlas-action="play"]');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const nodeStep = (id) => steps.findIndex((button) => button.closest('li').dataset.atlasFocus.split(' ').includes(id));
    diagram.setAttribute('role', 'group');
    for (const node of nodes.filter((item) => item.dataset.id && nodeStep(item.dataset.id) >= 0)) {
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
    }
    const stop = () => {
      window.clearTimeout(timer);
      timer = undefined;
      play.setAttribute('aria-pressed', 'false');
      play.textContent = '播放讲解';
    };
    const advance = () => {
      select(current + 1);
      if (current < steps.length - 1) timer = window.setTimeout(advance, 3200);
      else timer = window.setTimeout(stop, 3200);
    };
    const select = (index, announce = true) => {
      current = Math.max(-1, Math.min(steps.length - 1, index));
      const focused = current < 0 ? [] : steps[current].closest('li').dataset.atlasFocus.split(' ').filter(Boolean);
      for (const [i, button] of steps.entries()) {
        if (i === current) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      }
      for (const node of nodes) {
        const active = focused.includes(node.dataset.id);
        node.classList.toggle('atlas-is-muted', focused.length > 0 && !active);
        node.classList.toggle('atlas-is-current', active);
        if (node.getAttribute('role') === 'button') node.setAttribute('aria-pressed', String(active));
      }
      controls.querySelector('[data-atlas-action="previous"]').disabled = current <= 0;
      controls.querySelector('[data-atlas-action="next"]').disabled = current === steps.length - 1;
      if (announce) figure.querySelector('.atlas-status').textContent = current < 0 ? '正在查看完整图示。' : `第 ${current + 1} 步，共 ${steps.length} 步：${steps[current].textContent.trim()}`;
    };
    figure.addEventListener('click', (event) => {
      const step = event.target.closest('[data-atlas-step]');
      if (step) { stop(); return select(Number(step.dataset.atlasStep)); }
      const node = event.target.closest('.pele-node[data-id][role="button"]');
      if (node) { stop(); return select(nodeStep(node.dataset.id)); }
      const action = event.target.closest('[data-atlas-action]');
      if (!action) return;
      if (action.dataset.atlasAction === 'play') {
        if (timer || reducedMotion?.matches) return stop();
        if (current === steps.length - 1) current = -1;
        play.setAttribute('aria-pressed', 'true');
        play.textContent = '暂停讲解';
        advance();
        return;
      }
      stop();
      if (action.dataset.atlasAction === 'previous') select(current - 1);
      if (action.dataset.atlasAction === 'next') select(current + 1);
      if (action.dataset.atlasAction === 'all') select(-1);
    });
    figure.addEventListener('keydown', (event) => {
      const node = event.target.closest('.pele-node[data-id][role="button"]');
      if (node && ['Enter', ' '].includes(event.key)) {
        event.preventDefault(); stop(); select(nodeStep(node.dataset.id)); return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !event.target.closest('.atlas-controls, .atlas-steps')) return;
      event.preventDefault();
      stop();
      select(event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
      steps[current]?.focus();
    });
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
    const select = (index, announce = true) => {
      current = Math.max(0, Math.min(stops.length - 1, index));
      for (const [i, stop] of stops.entries()) {
        stop.querySelector('.walk-code').hidden = !all && i !== current;
        const button = stop.querySelector('[data-walk-step]');
        if (i === current && !all) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      }
      walk.classList.toggle('is-reading-all', all);
      controls.querySelector('[data-walk-action="previous"]').disabled = all || current === 0;
      controls.querySelector('[data-walk-action="next"]').disabled = all || current === stops.length - 1;
      controls.querySelector('[data-walk-action="all"]').textContent = all ? '回到分步漫游' : '阅读全部源码';
      if (announce) walk.querySelector('.walk-status').textContent = all ? '正在阅读全部源码。' : `第 ${current + 1} 站，共 ${stops.length} 站。`;
    };
    const go = (index) => {
      all = false;
      select(index);
      const target = stops[current].querySelector('[data-walk-step]');
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    };
    walk.addEventListener('click', (event) => {
      const step = event.target.closest('[data-walk-step]');
      if (step) return go(Number(step.dataset.walkStep));
      const action = event.target.closest('[data-walk-action]')?.dataset.walkAction;
      if (action === 'previous') go(current - 1);
      if (action === 'next') go(current + 1);
      if (action === 'all') { all = !all; select(current); }
    });
    walk.addEventListener('keydown', (event) => {
      if (!event.target.closest('[data-walk-step], .walk-controls') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      go(event.key === 'Home' ? 0 : event.key === 'End' ? stops.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => Math.abs(a.boundingClientRect.top - window.innerHeight * 0.3) - Math.abs(b.boundingClientRect.top - window.innerHeight * 0.3));
        if (!all && visible.length) select(Number(visible[0].target.closest('[data-walk-stop]').dataset.walkStop), false);
      }, { rootMargin: '-20% 0px -50% 0px', threshold: 0 });
      for (const stop of stops) observer.observe(stop.querySelector('.walk-narrative'));
    }
    controls.hidden = false;
    walk.classList.add('is-enhanced');
    select(0, false);
  }
})();
