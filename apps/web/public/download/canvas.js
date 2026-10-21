(() => {
  const canvas = document.getElementById('aster-canvas');
  const hero = canvas?.closest('.hero');
  if (!canvas || !hero) return;
  let context;
  try { context = canvas.getContext('2d'); } catch { return; }
  if (!context || typeof context.ellipse !== 'function') return;

  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? { matches: true };
  const stars = [
    [.08, .18, 2], [.17, .38, 3], [.24, .11, 1.5], [.31, .48, 2],
    [.42, .07, 1.5], [.58, .47, 1.5], [.69, .12, 2.5], [.77, .36, 2],
    [.88, .20, 3], [.94, .45, 1.5], [.12, .58, 1.5], [.86, .59, 2]
  ];
  let width = 0, height = 0, ratio = 0, frame = 0, lastPaint = null, phase = 0;
  let inView = false, pageActive = true, pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  const hasIntersection = typeof IntersectionObserver === 'function';

  function draw(time) {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    const radius = Math.min(width * .43, 720);
    context.save();
    context.translate(width * .5 + pointerX, Math.min(height * .32, 330) + pointerY);
    context.rotate(-.18 + Math.sin(time * .12) * .015);
    for (const [scale, tilt] of [[1, 0], [.78, .21]]) {
      context.save();
      context.rotate(tilt);
      const silver = context.createLinearGradient(-radius, 0, radius, 0);
      silver.addColorStop(0, 'rgba(123,134,150,0)');
      silver.addColorStop(.25, 'rgba(123,134,150,.30)');
      silver.addColorStop(.65, 'rgba(123,134,150,.18)');
      silver.addColorStop(1, 'rgba(123,134,150,0)');
      context.strokeStyle = silver;
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(0, 0, radius * scale, radius * .24 * scale, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.restore();
    stars.forEach(([x, y, size], index) => {
      const shimmer = .45 + Math.sin(time * .65 + index * 1.7) * .15;
      const px = width * x + pointerX * (index % 2 ? .6 : 1);
      const py = height * y + pointerY * .6 + Math.sin(time * .2 + index) * 2;
      context.fillStyle = index % 3 ? `rgba(123,134,150,${shimmer})` : `rgba(0,90,187,${shimmer})`;
      context.beginPath();
      if (size > 2) {
        context.moveTo(px, py - size * 2);
        context.lineTo(px + size * .5, py - size * .5);
        context.lineTo(px + size * 2, py);
        context.lineTo(px + size * .5, py + size * .5);
        context.lineTo(px, py + size * 2);
        context.lineTo(px - size * .5, py + size * .5);
        context.lineTo(px - size * 2, py);
        context.lineTo(px - size * .5, py - size * .5);
        context.closePath();
      } else context.arc(px, py, size, 0, Math.PI * 2);
      context.fill();
    });
  }

  function active() { return pageActive && !document.hidden && inView; }
  function animated() { return active() && hasIntersection && !motion.matches && width > 0 && height > 0; }
  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    lastPaint = null;
  }
  function tick(now) {
    frame = 0;
    if (!animated()) return;
    const elapsed = lastPaint === null ? 34 : now - lastPaint;
    if (elapsed >= 1000 / 30) {
      phase += Math.min(elapsed, 64) / 1000;
      pointerX += (targetX - pointerX) * .08;
      pointerY += (targetY - pointerY) * .08;
      draw(phase);
      lastPaint = now;
    }
    frame = window.requestAnimationFrame(tick);
  }
  function sync() {
    if (!animated()) {
      stop();
      if (active()) {
        if (motion.matches) pointerX = pointerY = targetX = targetY = 0;
        draw(motion.matches ? 0 : phase);
      }
    } else if (!frame) frame = window.requestAnimationFrame(tick);
  }
  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(0, Math.round(bounds.width));
    const nextHeight = Math.max(0, Math.round(bounds.height));
    const nextRatio = Math.min(2, window.devicePixelRatio || 1);
    if (nextWidth === width && nextHeight === height && nextRatio === ratio) return;
    width = nextWidth; height = nextHeight; ratio = nextRatio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (animated()) draw(phase);
    sync();
  }
  function pointer(event) {
    if (motion.matches || !active() || event.pointerType === 'touch') return;
    const bounds = hero.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    targetX = (Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) - .5) * 12;
    targetY = (Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) - .5) * 8;
  }

  hero.addEventListener('pointermove', pointer, { passive: true });
  hero.addEventListener('pointerleave', () => { targetX = targetY = 0; }, { passive: true });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pagehide', () => { pageActive = false; stop(); });
  window.addEventListener('pageshow', () => { pageActive = true; resize(); sync(); });
  if (motion.addEventListener) motion.addEventListener('change', sync);
  else motion.addListener?.(sync);
  if (hasIntersection) new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(hero);
  else inView = true;
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
})();
