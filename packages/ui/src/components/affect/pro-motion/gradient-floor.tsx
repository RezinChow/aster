"use client";

import { type CSSProperties, type ReactNode } from "react";

import { useReducedMotion } from "../../../lib/useReducedMotion";

/*
 * High-fidelity recreation based on the public description at
 * https://www.affectui.com/motion/gradient-floor. This is NOT official source —
 * the original is a paid Pro component.
 *
 * 基于官网公开描述的高保真复刻，非官方源码。原版为付费 Pro 组件。
 *
 * Gradient Floor – a blurred colour gradient that glows up from the bottom edge;
 * two layers that drift and morph. Two oversized radial-gradient blobs are
 * blurred, masked so they dissolve towards the top, and animated on independent
 * paths so the light never repeats in an obvious way.
 */

export type GradientFloorProps = {
  /** Content rendered above the glow */
  children?: ReactNode;
  /** Gradient stops used by the two layers. Extra stops are ignored, missing ones fall back to the default palette */
  colors?: string[];
  /** How far the glow rises: a number in pixels or any CSS length */
  height?: number | string;
  /** Seconds for one full drift cycle of the primary layer */
  speed?: number;
  /** Gaussian blur applied to the gradient layers, in pixels */
  blur?: number;
  /** Glow strength, from 0 to 1 */
  opacity?: number;
  className?: string;
};

const DEFAULT_COLORS = ["#7c3aed", "#2563eb", "#ec4899"];

export function GradientFloor({
  children,
  colors,
  height = 220,
  speed = 9,
  blur = 38,
  opacity = 0.85,
  className,
}: GradientFloorProps) {
  const reducedMotion = useReducedMotion();
  const palette = colors && colors.length > 0 ? colors : DEFAULT_COLORS;

  const style = {
    "--pmc-gf-c1": palette[0] ?? DEFAULT_COLORS[0],
    "--pmc-gf-c2": palette[1] ?? DEFAULT_COLORS[1],
    "--pmc-gf-c3": palette[2] ?? DEFAULT_COLORS[2],
    "--pmc-gf-height": typeof height === "number" ? `${height}px` : height,
    "--pmc-gf-speed": `${Math.max(speed, 0.1)}s`,
    "--pmc-gf-blur": `${Math.max(blur, 0)}px`,
    "--pmc-gf-opacity": `${Math.min(Math.max(opacity, 0), 1)}`,
  } as CSSProperties;

  return (
    <div
      data-slot="gradient-floor"
      data-static={reducedMotion ? "" : undefined}
      className={["pmc-gf", className].filter(Boolean).join(" ")}
      style={style}
    >
      {/* React 19 hoists this into <head> once, no matter how many instances render */}
      <style href="pmc-gradient-floor" precedence="default">
        {css}
      </style>
      <div className="pmc-gf-glow" aria-hidden="true">
        <div className="pmc-gf-layer pmc-gf-layer-a" />
        <div className="pmc-gf-layer pmc-gf-layer-b" />
      </div>
      <div className="pmc-gf-content">{children}</div>
    </div>
  );
}

const css = /* css */ `
.pmc-gf {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: 16px;
  background: #0b0b14;
}
.pmc-gf-glow {
  position: absolute;
  left: -12%;
  right: -12%;
  bottom: 0;
  height: var(--pmc-gf-height);
  z-index: 0;
  pointer-events: none;
  opacity: var(--pmc-gf-opacity);
  filter: blur(var(--pmc-gf-blur));
  -webkit-mask-image: linear-gradient(to top, #000 0%, rgba(0, 0, 0, 0.85) 35%, transparent 92%);
  mask-image: linear-gradient(to top, #000 0%, rgba(0, 0, 0, 0.85) 35%, transparent 92%);
}
.pmc-gf-layer {
  position: absolute;
  inset: -35% -10%;
  border-radius: 50%;
  will-change: transform;
}
/* Layer A rises from the floor and folds from left to right */
.pmc-gf-layer-a {
  background:
    radial-gradient(48% 58% at 28% 88%, var(--pmc-gf-c1), transparent 72%),
    radial-gradient(46% 62% at 74% 96%, var(--pmc-gf-c2), transparent 74%);
  animation: pmc-gf-drift-a var(--pmc-gf-speed) ease-in-out infinite alternate;
}
/* Layer B drifts on a slower, offset path and morphs the colour mix */
.pmc-gf-layer-b {
  background:
    radial-gradient(42% 54% at 62% 92%, var(--pmc-gf-c3), transparent 70%),
    radial-gradient(40% 50% at 18% 100%, var(--pmc-gf-c2), transparent 72%);
  animation: pmc-gf-drift-b calc(var(--pmc-gf-speed) * 1.45) ease-in-out infinite alternate;
}
.pmc-gf-content {
  position: relative;
  z-index: 1;
}

@keyframes pmc-gf-drift-a {
  0%   { transform: translate3d(-7%, 7%, 0) scale(1) rotate(-4deg); }
  50%  { transform: translate3d(4%, 1%, 0) scale(1.12) rotate(3deg); }
  100% { transform: translate3d(9%, 9%, 0) scale(0.96) rotate(-2deg); }
}
@keyframes pmc-gf-drift-b {
  0%   { transform: translate3d(8%, 10%, 0) scale(1.08) rotate(5deg); }
  50%  { transform: translate3d(-5%, 3%, 0) scale(0.94) rotate(-4deg); }
  100% { transform: translate3d(-9%, 8%, 0) scale(1.14) rotate(2deg); }
}

/* Reduced motion: the glow stays lit, but nothing drifts */
.pmc-gf[data-static] .pmc-gf-layer {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .pmc-gf-layer {
    animation: none !important;
  }
}
`;
