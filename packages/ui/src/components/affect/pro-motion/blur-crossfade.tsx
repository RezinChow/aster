"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useReducedMotion } from "../../../lib/useReducedMotion";

/*
 * High-fidelity recreation based on the public description at
 * https://www.affectui.com/motion/blur-crossfade. This is NOT official source —
 * the original is a paid Pro component.
 *
 * 基于官网公开描述的高保真复刻，非官方源码。原版为付费 Pro 组件。
 *
 * Blur Crossfade – swaps content with a soft blur while the box glides smoothly
 * to the size of what comes next. Slides are stacked in one absolutely-positioned
 * stage; their natural heights are measured with a ResizeObserver and the stage
 * animates its height to the active slide's height.
 */

export type BlurCrossfadeProps = {
  /** The pages/slides to crossfade between */
  items: ReactNode[];
  /** Controlled active slide index. When provided, the component will not change it on its own */
  activeIndex?: number;
  /** Initial slide index for uncontrolled usage */
  defaultIndex?: number;
  /** Called whenever a slide is requested (dot click or auto advance) */
  onActiveIndexChange?: (index: number) => void;
  /** Automatically advance through the slides */
  auto?: boolean;
  /** Milliseconds each slide stays visible in auto mode */
  interval?: number;
  /** Crossfade / height glide duration in milliseconds */
  duration?: number;
  /** Peak blur in pixels applied while a slide is leaving/entering */
  blur?: number;
  /** CSS easing used for the crossfade and the height glide */
  easing?: string;
  /** Show clickable indicator dots for manual switching */
  showDots?: boolean;
  className?: string;
};

export function BlurCrossfade({
  items,
  activeIndex,
  defaultIndex = 0,
  onActiveIndexChange,
  auto = true,
  interval = 2600,
  duration = 650,
  blur = 12,
  easing = "cubic-bezier(0.22, 1, 0.36, 1)",
  showDots = true,
  className,
}: BlurCrossfadeProps) {
  const reducedMotion = useReducedMotion();
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const [heights, setHeights] = useState<number[]>([]);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const count = items.length;
  const safeIndex = count > 0 ? Math.min(Math.max(activeIndex ?? internalIndex, 0), count - 1) : 0;

  // Measure every slide at its natural height. Slides are absolutely positioned
  // inside the stage, so their offsetHeight is the content height we must glide to.
  useLayoutEffect(() => {
    const nodes = slideRefs.current.filter((node): node is HTMLDivElement => node != null);
    if (nodes.length === 0) return;

    const measure = () => {
      const next = nodes.map((node) => node.offsetHeight);
      setHeights((prev) => (prev.length === next.length && prev.every((h, i) => h === next[i]) ? prev : next));
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items]);

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return;
      const next = ((index % count) + count) % count;
      if (activeIndex === undefined) setInternalIndex(next);
      onActiveIndexChange?.(next);
    },
    [activeIndex, count, onActiveIndexChange]
  );

  // A timeout keyed on the current index doubles as a reset for manual navigation.
  useEffect(() => {
    if (!auto || count < 2) return;
    const id = window.setTimeout(() => goTo(safeIndex + 1), Math.max(interval, 100));
    return () => window.clearTimeout(id);
  }, [auto, count, goTo, interval, safeIndex]);

  const style = {
    "--pmc-bc-duration": `${Math.max(duration, 0)}ms`,
    "--pmc-bc-blur": `${Math.max(blur, 0)}px`,
    "--pmc-bc-ease": easing,
  } as CSSProperties;

  const targetHeight = heights[safeIndex];

  return (
    <div
      data-slot="blur-crossfade"
      data-ready={heights.length > 0 ? "" : undefined}
      data-static={reducedMotion ? "" : undefined}
      className={["pmc-bc", className].filter(Boolean).join(" ")}
      style={style}
    >
      {/* React 19 hoists this into <head> once, no matter how many instances render */}
      <style href="pmc-blur-crossfade" precedence="default">
        {css}
      </style>
      <div className="pmc-bc-stage" style={targetHeight === undefined ? undefined : { height: `${targetHeight}px` }}>
        {items.map((item, index) => (
          <div
            key={index}
            ref={(node) => {
              slideRefs.current[index] = node;
            }}
            className="pmc-bc-slide"
            data-active={index === safeIndex ? "" : undefined}
            aria-hidden={index !== safeIndex ? true : undefined}
          >
            {item}
          </div>
        ))}
      </div>
      {showDots && count > 1 ? (
        <div className="pmc-bc-dots">
          {items.map((_, index) => (
            <button
              key={index}
              type="button"
              className="pmc-bc-dot"
              data-active={index === safeIndex ? "" : undefined}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === safeIndex ? "true" : undefined}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const css = /* css */ `
.pmc-bc {
  --pmc-bc-accent: #6366f1;
  position: relative;
}
.pmc-bc-stage {
  position: relative;
  overflow: hidden;
}
.pmc-bc[data-ready] .pmc-bc-stage {
  transition: height var(--pmc-bc-duration) var(--pmc-bc-ease);
}
.pmc-bc-slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  opacity: 0;
  filter: blur(var(--pmc-bc-blur));
  transform: scale(0.985);
  pointer-events: none;
  will-change: opacity, filter, transform;
  transition:
    opacity var(--pmc-bc-duration) var(--pmc-bc-ease),
    filter var(--pmc-bc-duration) var(--pmc-bc-ease),
    transform var(--pmc-bc-duration) var(--pmc-bc-ease);
}
.pmc-bc-slide[data-active] {
  opacity: 1;
  filter: blur(0);
  transform: none;
  pointer-events: auto;
}
.pmc-bc-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}
.pmc-bc-dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(127, 127, 127, 0.38);
  cursor: pointer;
  transition: width 0.28s ease, background 0.28s ease;
}
.pmc-bc-dot[data-active] {
  width: 24px;
  background: var(--pmc-bc-accent);
}
.pmc-bc-dot:focus-visible {
  outline: 2px solid var(--pmc-bc-accent);
  outline-offset: 3px;
}

/* Reduced motion: content swaps instantly, the box snaps to size */
.pmc-bc[data-static] .pmc-bc-stage,
.pmc-bc[data-static] .pmc-bc-slide {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .pmc-bc-stage,
  .pmc-bc-slide {
    transition: none !important;
  }
}
`;
