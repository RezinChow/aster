import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatRpm } from '@/components/ApiTrafficChart';

export type MultiSeriesPoint = {
  label: string;
  values: Record<string, number | undefined>;
};

export type ResourceSeriesMeta = {
  kind: string;
  label: string;
  color: string;
  /** When false, series has no metered data — legend greyed, no path. */
  enabled: boolean;
};

type MultiSeriesTrafficChartProps = {
  series: MultiSeriesPoint[];
  metas: ResourceSeriesMeta[];
  /** Hidden kinds (user toggled legend off). */
  hidden: Set<string>;
  onToggle: (kind: string) => void;
  className?: string;
  ariaLabel?: string;
  unitLabel?: string;
};

/** Catmull-Rom → cubic Bezier smooth path. */
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
  rows: Array<{ kind: string; name: string; value: number; color: string }>;
  x: number;
  y: number;
} | null;

export function MultiSeriesTrafficChart({
  series,
  metas,
  hidden,
  onToggle,
  className = '',
  ariaLabel,
  unitLabel = 'rpm',
}: MultiSeriesTrafficChartProps) {
  const tipId = useId();
  const [tip, setTip] = useState<TipState>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const visibleMetas = useMemo(
    () => metas.filter((m) => m.enabled && !hidden.has(m.kind)),
    [metas, hidden],
  );

  const chart = useMemo(() => {
    const w = 560;
    const h = 196;
    const pad = { top: 12, right: 10, bottom: 28, left: 40 };
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;

    let maxY = 1;
    for (const point of series) {
      for (const meta of visibleMetas) {
        const v = point.values[meta.kind] ?? 0;
        if (v > maxY) maxY = v;
      }
    }
    maxY *= 1.08;
    const baseY = pad.top + innerH;

    const xAt = (i: number) =>
      pad.left +
      (series.length <= 1 ? 0 : (i / (series.length - 1)) * innerW);

    const curves = visibleMetas.map((meta) => {
      const points = series.map((p, i) => ({
        x: xAt(i),
        y: pad.top + innerH - ((p.values[meta.kind] ?? 0) / maxY) * innerH,
      }));
      return { kind: meta.kind, color: meta.color, curve: smoothCurve(points) };
    });

    const hitPoints = series.map((p, i) => ({
      label: p.label,
      x: xAt(i),
      values: p.values,
    }));

    const gridYs = [0.25, 0.5, 0.75, 1].map((t) => ({
      y: pad.top + innerH * (1 - t),
      label: formatRpm(maxY * t),
    }));

    const xLabels = hitPoints.filter(
      (_, i) => i % 2 === 0 || i === hitPoints.length - 1,
    );

    return { w, h, pad, curves, hitPoints, gridYs, xLabels, baseY };
  }, [series, visibleMetas]);

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
    point: (typeof chart.hitPoints)[number],
    index: number,
    el: SVGGraphicsElement,
  ) {
    const rect = el.getBoundingClientRect();
    setActiveIndex(index);
    setTip({
      label: point.label,
      rows: visibleMetas.map((m) => ({
        kind: m.kind,
        name: m.label,
        value: point.values[m.kind] ?? 0,
        color: m.color,
      })),
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }

  function hideTip() {
    setTip(null);
    setActiveIndex(null);
  }

  const active =
    activeIndex == null ? null : chart.hitPoints[activeIndex] ?? null;

  return (
    <div className={`os-overview__res-chart ${className}`.trim()}>
      <ul className="os-overview__res-legend" aria-label="series">
        {metas.map((meta) => {
          const off = !meta.enabled || hidden.has(meta.kind);
          return (
            <li key={meta.kind}>
              <button
                type="button"
                className="os-overview__res-legend-btn"
                data-off={off ? 'true' : undefined}
                data-empty={!meta.enabled ? 'true' : undefined}
                disabled={!meta.enabled}
                onClick={() => onToggle(meta.kind)}
                aria-pressed={!off}
              >
                <span
                  className="os-overview__res-legend-swatch"
                  style={{ background: meta.color }}
                  aria-hidden
                />
                {meta.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="os-overview__api-chart-wrap">
        <svg
          className="os-overview__api-chart"
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          role="img"
          aria-label={ariaLabel}
          preserveAspectRatio="xMidYMid meet"
        >
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

          {chart.curves.map((c) =>
            c.curve ? (
              <path
                key={c.kind}
                className="os-overview__res-curve"
                d={c.curve}
                fill="none"
                stroke={c.color}
              />
            ) : null,
          )}

          {active ? (
            <line
              className="os-overview__api-guide"
              x1={active.x}
              x2={active.x}
              y1={chart.pad.top}
              y2={chart.baseY}
            />
          ) : null}

          {chart.hitPoints.map((p, i) => (
            <circle
              key={p.label}
              className="os-overview__api-hit"
              cx={p.x}
              cy={(chart.pad.top + chart.baseY) / 2}
              r={16}
              onMouseEnter={(e) => showTip(p, i, e.currentTarget)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(p, i, e.currentTarget)}
              onBlur={hideTip}
              tabIndex={0}
              role="img"
              aria-label={p.label}
            />
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
      </div>

      {tip
        ? createPortal(
            <div
              id={tipId}
              className="os-overview__api-tip os-overview__res-tip"
              role="tooltip"
              style={{ left: tip.x, top: tip.y }}
            >
              <p className="os-overview__api-tip-time">{tip.label}</p>
              <ul className="os-overview__res-tip-list">
                {tip.rows.map((row) => (
                  <li key={row.kind}>
                    <span
                      className="os-overview__res-legend-swatch"
                      style={{ background: row.color }}
                      aria-hidden
                    />
                    <span>{row.name}</span>
                    <span className="os-overview__api-tip-value">
                      {formatRpm(row.value)}
                      <span className="os-overview__api-tip-unit">
                        {unitLabel}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
