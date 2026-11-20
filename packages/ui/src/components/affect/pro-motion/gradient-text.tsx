"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useReducedMotion } from "../../../lib/useReducedMotion";

/*
 * High-fidelity recreation based on the public description at
 * https://www.affectui.com/motion/gradient-text. This is NOT official source —
 * the original is a paid Pro component.
 *
 * 基于官网公开描述的高保真复刻，非官方源码。原版为付费 Pro 组件。
 *
 * Gradient Text – letters cut from a liquid, ever-flowing gradient; the color
 * sweeps across the word the first time it's seen. The fill is a clipped,
 * continuously flowing gradient. A second copy of the text carries a one-shot
 * white highlight that sweeps across on first view (IntersectionObserver).
 */

export type GradientTextProps = {
  /** Text to paint. Keep it a string so the highlight copy matches exactly */
  children: ReactNode;
  /** Seconds for one full flow loop of the liquid gradient */
  speed?: number;
  /** Gradient stops, repeated twice to make the flow loop seamless */
  colors?: string[];
  /** Duration of the one-time sweep in milliseconds */
  sweepDuration?: number;
  /** Replay the sweep every time the text re-enters the viewport */
  repeat?: boolean;
  /** Element to render */
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
  /** Extra inline styles for the root element */
  style?: CSSProperties;
  className?: string;
};

const DEFAULT_COLORS = ["#a78bfa", "#60a5fa", "#f472b6", "#22d3ee"];

export function GradientText({
  children,
  speed = 6,
  colors,
  sweepDuration = 1200,
  repeat = false,
  as: Tag = "span",
  style: userStyle,
  className,
}: GradientTextProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const palette = colors && colors.length > 0 ? colors : DEFAULT_COLORS;
  // Repeat the palette so shifting background-position by one tile loops cleanly.
  const gradient = `linear-gradient(100deg, ${[...palette, ...palette].join(", ")})`;

  useEffect(() => {
    if (reducedMotion || (!repeat && seen)) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          if (!repeat) observer.disconnect();
        } else if (repeat) {
          setSeen(false);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, repeat, seen]);

  const style = {
    "--pmc-gt-gradient": gradient,
    "--pmc-gt-speed": `${Math.max(speed, 0.1)}s`,
    "--pmc-gt-sweep-duration": `${Math.max(sweepDuration, 0)}ms`,
    ...userStyle,
  } as CSSProperties;

  return (
    <Tag
      ref={ref as never}
      data-slot="gradient-text"
      data-seen={seen && !reducedMotion ? "" : undefined}
      data-static={reducedMotion ? "" : undefined}
      className={["pmc-gt", className].filter(Boolean).join(" ")}
      style={style}
    >
      {/* React 19 hoists this into <head> once, no matter how many instances render */}
      <style href="pmc-gradient-text" precedence="default">
        {css}
      </style>
      <span className="pmc-gt-fill">{children}</span>
      <span className="pmc-gt-sweep" aria-hidden="true">
        {children}
      </span>
    </Tag>
  );
}

const css = /* css */ `
.pmc-gt {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 1.08;
}
.pmc-gt-fill,
.pmc-gt-sweep {
  display: inline-block;
  max-width: 100%;
  background-image: var(--pmc-gt-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}
.pmc-gt-fill {
  background-size: 200% 100%;
  animation: pmc-gt-flow var(--pmc-gt-speed) linear infinite;
  will-change: background-position;
}
/* A bright band on a second copy of the text, sitting exactly on top of the fill */
.pmc-gt-sweep {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(100deg, transparent 38%, rgba(255, 255, 255, 0.9) 50%, transparent 62%);
  background-size: 280% 100%;
  background-position: -100% 50%;
  opacity: 0;
}
.pmc-gt[data-seen] .pmc-gt-sweep {
  animation: pmc-gt-sweep var(--pmc-gt-sweep-duration) cubic-bezier(0.2, 0.8, 0.2, 1) 1 both;
}

@keyframes pmc-gt-flow {
  from { background-position: 0% 50%; }
  to   { background-position: 200% 50%; }
}
@keyframes pmc-gt-sweep {
  0%   { background-position: -100% 50%; opacity: 0; }
  20%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { background-position: 200% 50%; opacity: 0; }
}

/* Reduced motion: a still gradient, no sweep */
.pmc-gt[data-static] .pmc-gt-fill,
.pmc-gt[data-static] .pmc-gt-sweep {
  animation: none;
}
.pmc-gt[data-static] .pmc-gt-sweep {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .pmc-gt-fill,
  .pmc-gt-sweep {
    animation: none !important;
  }
  .pmc-gt-sweep {
    display: none;
  }
}
`;
