import { useEffect, useRef } from 'react';

type LazyVideoProps = {
  sources: Array<{ src: string; type: string }>;
  className?: string;
  poster?: string;
};

/** Reflect-style lazy video: play when near viewport */
export function LazyVideo({ sources, className = '', poster }: LazyVideoProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          video.pause();
          return;
        }
        wrap.classList.add('is-loaded');
        void video.play().catch(() => undefined);
      },
      { rootMargin: '120px', threshold: 0.05 },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className={`lazy-video ${className}`}>
      <video ref={videoRef} muted playsInline loop preload="metadata" poster={poster}>
        {sources.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
      </video>
    </div>
  );
}
