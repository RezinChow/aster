import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@a3s-lab/ui';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

type TooltipProps = {
  label: string;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
  /** Delay before showing, in ms. */
  delayMs?: number;
};

type BubblePos = {
  top: number;
  left: number;
};

const GAP = 10;

export function Tooltip({
  label,
  children,
  side = 'right',
  className,
  delayMs = 120,
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<BubblePos | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    switch (side) {
      case 'left':
        return { top: rect.top + rect.height / 2, left: rect.left - GAP };
      case 'top':
        return { top: rect.top - GAP, left: rect.left + rect.width / 2 };
      case 'bottom':
        return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 };
      default:
        return { top: rect.top + rect.height / 2, left: rect.right + GAP };
    }
  }, [side]);

  const show = useCallback(() => {
    if (!label) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      const next = measure();
      if (!next) return;
      setPos(next);
      setOpen(true);
    }, delayMs);
  }, [clearTimer, delayMs, label, measure]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // Opening the user menu clears the label; drop any stuck open state.
  useEffect(() => {
    if (!label) hide();
  }, [label, hide]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => hide();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, hide]);

  if (!label) return children;

  const bubbleStyle = ((): CSSProperties | undefined => {
    if (!pos) return undefined;
    switch (side) {
      case 'left':
        return {
          top: pos.top,
          left: pos.left,
          transform: 'translate(-100%, -50%)',
        };
      case 'top':
        return {
          top: pos.top,
          left: pos.left,
          transform: 'translate(-50%, -100%)',
        };
      case 'bottom':
        return {
          top: pos.top,
          left: pos.left,
          transform: 'translate(-50%, 0)',
        };
      default:
        return {
          top: pos.top,
          left: pos.left,
          transform: 'translate(0, -50%)',
        };
    }
  })();

  return (
    <span
      ref={triggerRef}
      className={cn('os-tooltip', className)}
      data-side={side}
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return;
        show();
      }}
      onPointerLeave={hide}
      onFocus={(event) => {
        // Keyboard only — avoid sticky tips after mouse click focus.
        if (event.currentTarget.matches(':focus-visible')) show();
      }}
      onBlur={hide}
    >
      {children}
      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              className="os-tooltip__bubble os-tooltip__bubble--portal"
              data-side={side}
              style={bubbleStyle}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
