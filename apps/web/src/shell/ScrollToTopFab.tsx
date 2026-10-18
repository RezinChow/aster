import { useEffect, useState, type RefObject } from 'react';
import { useI18n } from '@/i18n/useI18n';

const SHOW_AFTER = 280;

export function ScrollToTopFab({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const onScroll = () => {
      setVisible(node.scrollTop > SHOW_AFTER);
    };
    onScroll();
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="os-scroll-top"
      aria-label={t('shell.backToTop')}
      onClick={() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  );
}
