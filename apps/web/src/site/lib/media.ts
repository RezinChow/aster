import { useEffect, useState, useSyncExternalStore } from 'react';

function subscribeDesktopFx(onStoreChange: () => void) {
  const desktop = window.matchMedia('(min-width: 1024px)');
  desktop.addEventListener('change', onStoreChange);
  return () => desktop.removeEventListener('change', onStoreChange);
}

function getDesktopFx() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

/** Desktop visual effects (beam / WebGL). Off on mobile only. */
export function useDesktopFx() {
  return useSyncExternalStore(subscribeDesktopFx, getDesktopFx, () => false);
}

/** rAF-throttled scroll flag — avoids re-rendering on every wheel tick. */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [threshold]);

  return scrolled;
}
