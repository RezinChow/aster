"use client";

import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { useReducedMotion } from "../../../lib/useReducedMotion";

/*
 * High-fidelity recreation based on the public description at
 * https://www.affectui.com/motion/tilt-card. This is NOT official source —
 * the original is a paid Pro component.
 *
 * 基于官网公开描述的高保真复刻，非官方源码。原版为付费 Pro 组件。
 *
 * Tilt Card – a card that tilts in 3D towards the pointer, with a soft glare
 * that follows it and a smooth spring back. Pointer position is written straight
 * to CSS variables on the root (no React re-render per move); leaving the card
 * releases the variables so a springy transition glides it back to rest.
 */

export type TiltCardProps = {
  /** Card contents */
  children: ReactNode;
  /** Maximum tilt on either axis, in degrees */
  maxTilt?: number;
  /** Enable the soft glare that follows the pointer */
  glare?: boolean;
  /** Colour of the glare gradient */
  glareColor?: string;
  /** Slight scale applied while hovered */
  hoverScale?: number;
  /** Spring-back duration in milliseconds */
  springDuration?: number;
  /** Perspective distance in pixels; smaller values exaggerate the 3D effect */
  perspective?: number;
  className?: string;
};

export function TiltCard({
  children,
  maxTilt = 12,
  glare = true,
  glareColor = "rgba(255, 255, 255, 0.55)",
  hoverScale = 1.02,
  springDuration = 520,
  perspective = 900,
  className,
}: TiltCardProps) {
  const reducedMotion = useReducedMotion();

  const style = {
    "--pmc-tc-rx": "0deg",
    "--pmc-tc-ry": "0deg",
    "--pmc-tc-gx": "50%",
    "--pmc-tc-gy": "50%",
    "--pmc-tc-glare-color": glareColor,
    "--pmc-tc-hover-scale": `${hoverScale}`,
    "--pmc-tc-speed": `${Math.max(springDuration, 0)}ms`,
    "--pmc-tc-perspective": `${Math.max(perspective, 1)}px`,
  } as CSSProperties;

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const py = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    const limit = Math.max(maxTilt, 0);
    el.style.setProperty("--pmc-tc-ry", `${((px * 2 - 1) * limit).toFixed(2)}deg`);
    el.style.setProperty("--pmc-tc-rx", `${((0.5 - py) * 2 * limit).toFixed(2)}deg`);
    el.style.setProperty("--pmc-tc-gx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--pmc-tc-gy", `${(py * 100).toFixed(1)}%`);
  };

  const handleEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    event.currentTarget.setAttribute("data-active", "");
  };

  const handleLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    el.removeAttribute("data-active");
    el.style.setProperty("--pmc-tc-rx", "0deg");
    el.style.setProperty("--pmc-tc-ry", "0deg");
    el.style.setProperty("--pmc-tc-gx", "50%");
    el.style.setProperty("--pmc-tc-gy", "50%");
  };

  return (
    <div
      data-slot="tilt-card"
      data-glare={glare ? "" : undefined}
      data-static={reducedMotion ? "" : undefined}
      className={["pmc-tc", className].filter(Boolean).join(" ")}
      style={style}
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {/* React 19 hoists this into <head> once, no matter how many instances render */}
      <style href="pmc-tilt-card" precedence="default">
        {css}
      </style>
      <div className="pmc-tc-card">
        <div className="pmc-tc-glare" aria-hidden="true" />
        <div className="pmc-tc-content">{children}</div>
      </div>
    </div>
  );
}

const css = /* css */ `
.pmc-tc {
  perspective: var(--pmc-tc-perspective);
  display: block;
}
.pmc-tc-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: 18px;
  background: #14141f;
  transform-style: preserve-3d;
  transform: rotateX(var(--pmc-tc-rx)) rotateY(var(--pmc-tc-ry)) scale(1);
  transition: transform var(--pmc-tc-speed) cubic-bezier(0.2, 0.9, 0.25, 1.15);
  will-change: transform;
}
/* While tracking the pointer the follow is quick; spring-back uses the long transition above */
.pmc-tc[data-active] .pmc-tc-card {
  transform: rotateX(var(--pmc-tc-rx)) rotateY(var(--pmc-tc-ry)) scale(var(--pmc-tc-hover-scale));
  transition: transform 90ms ease-out;
}
.pmc-tc-glare {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle at var(--pmc-tc-gx) var(--pmc-tc-gy), var(--pmc-tc-glare-color), transparent 55%);
  mix-blend-mode: screen;
  transition: opacity var(--pmc-tc-speed) ease;
}
.pmc-tc[data-active][data-glare] .pmc-tc-glare {
  opacity: 1;
  transition: opacity 160ms ease;
}
.pmc-tc-content {
  position: relative;
  z-index: 1;
  transform: translateZ(28px);
}

/* Reduced motion: the card stays flat and still */
.pmc-tc[data-static] .pmc-tc-card,
.pmc-tc[data-static] .pmc-tc-glare {
  transition: none;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .pmc-tc-card,
  .pmc-tc-glare {
    transition: none !important;
    transform: none !important;
  }
}
`;
