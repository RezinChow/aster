import { useEffect, useRef } from 'react';
import { publicUrl } from '../../lib/publicUrl';

/**
 * Huly hero beam video — behind the product, mix-blend-lighten.
 *
 * Width stays locked to the product. Height is sized so the impact plate
 * lands on the product, while the beam starts at the stage top (never
 * cropped into a needle).
 *
 * Frame geometry (hero.mp4 @ 1920×1438):
 * - plate / impact line ≈ 50.63% from top
 * - beam core ≈ 55.29% from left
 */
const PLATE_TOP_RATIO = 0.5063;
const BEAM_X_RATIO = 0.5529;
/** Beam core across the product (0=left, 1=right). */
const IMPACT_X_RATIO = 0.88;
const BEAM_OFFSET_X = -64;
const BEAM_OFFSET_Y = 0;

function readTranslateY(transform: string): number {
  if (!transform || transform === 'none') return 0;
  const m3 = transform.match(/^matrix3d\((.+)\)$/);
  if (m3?.[1]) {
    const p = m3[1].split(',').map((v) => Number(v.trim()));
    return Number.isFinite(p[13]) ? p[13]! : 0;
  }
  const m2 = transform.match(/^matrix\((.+)\)$/);
  if (m2?.[1]) {
    const p = m2[1].split(',').map((v) => Number(v.trim()));
    return Number.isFinite(p[5]) ? p[5]! : 0;
  }
  return 0;
}

/** getBoundingClientRect includes ancestor transforms; undo Reveal translateY. */
function settledTop(el: HTMLElement, stage: Element): number {
  const stageRect = (stage as HTMLElement).getBoundingClientRect();
  let top = el.getBoundingClientRect().top - stageRect.top;
  let node: HTMLElement | null = el;
  while (node && node !== stage) {
    if (node.classList.contains('reveal')) {
      top -= readTranslateY(getComputedStyle(node).transform);
    }
    node = node.parentElement;
  }
  return top;
}

export function HeroLightBeam({
  className = '',
  targetSelector = '.cloud-console-frame',
}: {
  className?: string;
  targetSelector?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shaftRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    const shaft = shaftRef.current;
    if (!root || !video || !shaft) return;

    const posRoot =
      root.closest('.cloud-hero') ?? root.parentElement ?? root;
    const panel =
      root.closest('.snap-panel--cloud-hero') ??
      root.closest('.cloud-hero-stage') ??
      posRoot;

    const sync = () => {
      const section = panel.closest('section') ?? panel;
      const product = section.querySelector<HTMLElement>(targetSelector);
      if (!product) return;

      const parentRect = (posRoot as HTMLElement).getBoundingClientRect();
      const panelRect = (panel as HTMLElement).getBoundingClientRect();
      const pr = product.getBoundingClientRect();
      const prodW = Math.max(pr.width, 1);

      const productLeft = pr.left - parentRect.left;
      const beamAnchorX =
        productLeft + prodW * IMPACT_X_RATIO + BEAM_OFFSET_X;
      // Height from the OS panel top so the bloom is not a needle.
      const beamAnchorY = Math.max(
        0,
        settledTop(product, panel) + BEAM_OFFSET_Y,
      );

      const videoW = prodW * 1.04;
      const videoH = Math.max(beamAnchorY / PLATE_TOP_RATIO, 1);
      const top = panelRect.top - parentRect.top;
      const left = beamAnchorX - BEAM_X_RATIO * videoW;

      root.style.width = `${Math.round(videoW)}px`;
      root.style.height = `${Math.round(videoH)}px`;
      root.style.left = `${Math.round(left)}px`;
      root.style.top = `${Math.round(top)}px`;

      const shaftWidth = Math.max(2.5, prodW * 0.0055);
      shaft.style.left = `${Math.round(beamAnchorX - shaftWidth / 2)}px`;
      shaft.style.top = `${Math.round(top)}px`;
      shaft.style.width = `${shaftWidth}px`;
      shaft.style.height = `${Math.round(beamAnchorY + 8)}px`;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void video.play().catch(() => undefined);
          sync();
        } else {
          video.pause();
        }
      },
      { threshold: 0.02 },
    );

    const ro = new ResizeObserver(() => sync());
    const section = panel.closest('section') ?? panel;
    const product = section.querySelector<HTMLElement>(targetSelector);
    const reveal = (product?.closest('.reveal') ?? null) as HTMLElement | null;
    if (product) ro.observe(product);
    ro.observe(panel);
    ro.observe(posRoot);

    const onRevealTransition = (e: TransitionEvent) => {
      if (e.propertyName === 'transform' || e.propertyName === 'opacity') {
        sync();
      }
    };
    reveal?.addEventListener('transitionend', onRevealTransition);

    const mo = reveal
      ? new MutationObserver(() => {
          sync();
          // Catch end of Reveal ease after is-visible flips.
          window.setTimeout(sync, 700);
        })
      : null;
    if (reveal && mo) {
      mo.observe(reveal, { attributes: true, attributeFilter: ['class'] });
    }

    sync();
    io.observe(panel);
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, { passive: true });
    video.addEventListener('loadedmetadata', sync);
    video.addEventListener('loadeddata', sync);

    const timers = [50, 250, 700, 1100].map((ms) =>
      window.setTimeout(sync, ms),
    );

    return () => {
      io.disconnect();
      ro.disconnect();
      mo?.disconnect();
      reveal?.removeEventListener('transitionend', onRevealTransition);
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync);
      video.removeEventListener('loadedmetadata', sync);
      video.removeEventListener('loadeddata', sync);
    };
  }, [targetSelector]);

  return (
    <>
      <div ref={shaftRef} className="hero-light-beam-shaft" aria-hidden />
      <div
        ref={rootRef}
        className={`hero-light-beam hero-light-beam-video ${className}`}
        aria-hidden
      >
        <video
          ref={videoRef}
          className="hero-light-beam-media"
          muted
          playsInline
          loop
          preload="auto"
          poster={publicUrl('/motion/cloud/hero-beam-poster.jpg')}
        >
          <source src={publicUrl('/motion/cloud/hero-beam.webm')} type="video/webm" />
          <source src={publicUrl('/motion/cloud/hero-beam.mp4')} type="video/mp4" />
        </video>
      </div>
    </>
  );
}
