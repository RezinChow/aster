import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LazyVideo } from '../motion/LazyVideo';
import { Ripple } from '../canvasui/Ripple';
import { publicUrl } from '../../lib/publicUrl';
import { useDesktopFx } from '../../lib/media';

function StarField({ count = 36 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (Math.PI * 2 * i) / count + i * 0.41;
        const dist = 90 + ((i * 53) % 220);
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        return {
          id: i,
          top: `${4 + ((i * 19) % 92)}%`,
          left: `${3 + ((i * 31) % 94)}%`,
          duration: `${7 + (i % 8) + (i % 5) * 0.37}s`,
          delay: `${(i % 47) / 10}s`,
          move: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
          dim: i % 3 === 0,
        };
      }),
    [count],
  );

  return (
    <div className="hero-black-hole-stars">
      {stars.map((s) => (
        <div
          key={s.id}
          className={s.dim ? 'opacity-50' : undefined}
          style={{
            top: s.top,
            left: s.left,
            animationDuration: s.duration,
            animationDelay: s.delay,
            ['--transform' as string]: s.move,
          }}
        />
      ))}
    </div>
  );
}

type BlackHoleProps = {
  className?: string;
  variant?: 'hero' | 'cta';
};

function RippleIfDesktop({ children }: { children: ReactNode }) {
  const fx = useDesktopFx();
  if (!fx) return children;
  return (
    <Ripple
      className="hero-black-hole-ripple"
      trigger="none"
      amplitude={0.85}
      speed={0.5}
      wavelength={110}
      rings={3}
      decay={0.75}
      refraction={140}
      dispersion={0.6}
      shine={0.65}
      interval={3.2}
      ambientOrigin="center"
      ambientX={0.51}
      ambientY={0.5}
    >
      {children}
    </Ripple>
  );
}

export function BlackHole({ className = '', variant = 'hero' }: BlackHoleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const fx = useDesktopFx();

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: '80px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={`hero-black-hole ${variant === 'cta' ? 'hero-black-hole-cta' : ''} ${
        visible ? 'hero-black-hole-visible' : ''
      } ${className}`}
      aria-hidden
    >
      <RippleIfDesktop>
        <div className="hero-black-hole-media">
          <LazyVideo
            className={variant === 'cta' ? 'lazy-video-cta' : ''}
            sources={[
              { src: publicUrl('/motion/blackhole.webm'), type: 'video/webm' },
              { src: publicUrl('/motion/blackhole.mp4'), type: 'video/mp4' },
            ]}
          />
          <StarField count={fx ? 64 : 20} />
        </div>
      </RippleIfDesktop>
    </div>
  );
}
