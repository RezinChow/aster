import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ApiTrafficPoint } from '@/data/platformOps';

type ApiTrafficChartProps = {
  series: ApiTrafficPoint[];
  className?: string;
  ariaLabel?: string;
  rpmLabel?: string;
};

function formatRpm(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Catmull-Rom → cubic Bezier smooth path through points. */
function smoothCurve(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0]!;
    return `M${p.x},${p.y}`;
  }
  if (points.length === 2) {
    const a = points[0]!;
    const b = points[1]!;
    return `M${a.x},${a.y} L${b.x},${b.y}`;
  }

  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? i : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

type TipState = {
  label: string;
  rpm: number;
  x: number;
  y: number;
} | null;

export function ApiTrafficChart({
  series,
  className = '',
  ariaLabel,
  rpmLabel = 'rpm',
}: ApiTrafficChartProps) {
  const tipId = useId();
  const gradId = useId().replace(/:/g, '');
  const [tip, setTip] = useState<TipState>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    const w = 560;
    const h = 196;
    const pad = { top: 12, right: 10, bottom: 28, left: 36 };
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;
    const maxY = Math.max(...series.map((p) => p.rpm), 1) * 1.08;
    const baseY = pad.top + innerH;

    const points = series.map((p, i) => ({
      ...p,
      x:
        pad.left +
        (series.length <= 1 ? 0 : (i / (series.length - 1)) * innerW),
      y: pad.top + innerH - (p.rpm / maxY) * innerH,
    }));

    const curve = smoothCurve(points);
    const area =
      points.length === 0
        ? ''
        : `${curve} L${points[points.length - 1]!.x},${baseY} L${points[0]!.x},${baseY} Z`;

    const gridYs = [0.25, 0.5, 0.75, 1].map((t) => ({
      y: pad.top + innerH * (1 - t),
      label: formatRpm(maxY * t),
    }));

    const xLabels = points.filter(
      (_, i) => i % 2 === 0 || i === points.length - 1,
    );

    return { w, h, pad, points, curve, area, gridYs, xLabels, baseY };
  }, [series]);

  useEffect(() => {
    if (!tip) return;
    const hide = () => {
      setTip(null);
      setActiveIndex(null);
    };
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip]);

  function showTip(
    point: (typeof chart.points)[number],
    index: number,
    el: SVGGraphicsElement,
  ) {
    const rect = el.getBoundingClientRect();
    setActiveIndex(index);
    setTip({
      label: point.label,
      rpm: point.rpm,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }

  function hideTip() {
    setTip(null);
    setActiveIndex(null);
  }

  const active = activeIndex == null ? null : chart.points[activeIndex];

  return (
    <div className={`os-overview__api-chart-wrap ${className}`.trim()}>
      <svg
        className="os-overview__api-chart"
        viewBox={`0 0 ${chart.w} ${chart.h}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={`api-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-text-link)"
              stopOpacity="0.28"
            />
            <stop
              offset="100%"
              stopColor="var(--color-text-link)"
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>

        {chart.gridYs.map((g) => (
          <g key={g.label}>
            <line
              className="os-overview__api-grid"
              x1={chart.pad.left}
              x2={chart.w - chart.pad.right}
              y1={g.y}
              y2={g.y}
            />
            <text
              className="os-overview__api-axis"
              x={chart.pad.left - 6}
              y={g.y + 3}
              textAnchor="end"
            >
              {g.label}
            </text>
          </g>
        ))}

        {chart.area ? (
          <path
            className="os-overview__api-area"
            d={chart.area}
            fill={`url(#api-fill-${gradId})`}
          />
        ) : null}
        {chart.curve ? (
          <path className="os-overview__api-curve" d={chart.curve} fill="none" />
        ) : null}

        {active ? (
          <line
            className="os-overview__api-guide"
            x1={active.x}
            x2={active.x}
            y1={chart.pad.top}
            y2={chart.baseY}
          />
        ) : null}

        {chart.points.map((p, i) => (
          <g key={p.label}>
            <circle
              className="os-overview__api-dot"
              cx={p.x}
              cy={p.y}
              r={activeIndex === i ? 4 : 3}
              data-active={activeIndex === i ? 'true' : undefined}
            />
            <circle
              className="os-overview__api-hit"
              cx={p.x}
              cy={p.y}
              r={14}
              onMouseEnter={(e) => showTip(p, i, e.currentTarget)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(p, i, e.currentTarget)}
              onBlur={hideTip}
              tabIndex={0}
              role="img"
              aria-label={`${p.label}, ${formatRpm(p.rpm)} ${rpmLabel}`}
            />
          </g>
        ))}

        {chart.xLabels.map((p) => (
          <text
            key={`x-${p.label}`}
            className="os-overview__api-axis"
            x={p.x}
            y={chart.h - 8}
            textAnchor="middle"
          >
            {p.label}
          </text>
        ))}
      </svg>

      {tip
        ? createPortal(
            <div
              id={tipId}
              className="os-overview__api-tip"
              role="tooltip"
              style={{ left: tip.x, top: tip.y }}
            >
              <p className="os-overview__api-tip-time">{tip.label}</p>
              <p className="os-overview__api-tip-value">
                {formatRpm(tip.rpm)}
                <span className="os-overview__api-tip-unit">{rpmLabel}</span>
              </p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export { formatRpm };
