import { useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'

import { cn } from '../../../lib/utils'

export type TrendVariant = 'line' | 'area' | 'bar' | 'sparkline'

export interface TrendSeries {
  label: string
  values: (number | null)[]
  color?: string
  previous?: boolean
}

export interface TrendChartProps {
  labels: string[]
  tooltipLabels?: string[]
  series: TrendSeries[]
  variant?: TrendVariant
  format?: (value: number) => string
  axisFormat?: (value: number) => string
  height?: number
  axis?: boolean | 'x'
  tooltip?: boolean
  zero?: boolean
  index?: number | null
  onIndexChange?: (index: number | null) => void
  defaultIndex?: number
  label?: string
  emptyText?: string
  className?: string
}

const palette = ['#2f6bff', '#ec4899', '#10b981', '#f59e0b']
const compact = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))

/** A standalone line, area, bar or sparkline chart drawn with SVG. */
export function TrendChart({
  labels,
  tooltipLabels,
  series,
  variant = 'line',
  format = compact,
  axisFormat,
  height,
  axis,
  tooltip = true,
  zero = true,
  index,
  onIndexChange,
  defaultIndex,
  label = 'Chart',
  emptyText = 'No data yet',
  className
}: TrendChartProps) {
  const spark = variant === 'sparkline'
  const plotHeight = height ?? (spark ? 40 : 152)
  const showAxis = axis ?? !spark
  const [internalIndex, setInternalIndex] = useState<number | null>(defaultIndex ?? null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const active = index !== undefined ? index : internalIndex
  const count = Math.max(labels.length, ...series.map((s) => s.values.length), 0)
  const values = series.flatMap((s) => s.values.filter((v): v is number => typeof v === 'number'))
  const empty = count === 0 || values.length === 0 || values.every((v) => v === 0)
  const max = values.length ? Math.max(0, ...values) : 1
  const min = zero || variant === 'bar' ? 0 : (values.length ? Math.min(...values) : 0)
  const span = max - min || 1
  const width = 300
  const pad = showAxis === false ? 2 : 4
  const step = count > 1 ? (width - pad * 2) / (count - 1) : 0
  const xAt = (i: number) => pad + i * step
  const yAt = (v: number) => plotHeight - pad - ((v - min) / span) * (plotHeight - pad * 2)

  const setActive = (next: number | null) => {
    setInternalIndex(next)
    onIndexChange?.(next)
  }

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!tooltip || spark) return
    const rect = event.currentTarget.getBoundingClientRect()
    const next = step > 0 ? Math.max(0, Math.min(count - 1, Math.round((event.clientX - rect.left - pad) / step))) : 0
    setActive(next)
    setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  const handleKey = (event: KeyboardEvent<Element>) => {
    if (event.key === 'ArrowRight') setActive(Math.min(count - 1, (active ?? -1) + 1))
    else if (event.key === 'ArrowLeft') setActive(Math.max(0, (active ?? 0) - 1))
    else if (event.key === 'Escape') setActive(null)
    else return
    event.preventDefault()
  }

  const ticks = showAxis && showAxis !== 'x' ? [max, (max + min) / 2, min] : []
  const labelIndexes = [0, Math.floor((count - 1) / 2), count - 1].filter((i, p, arr) => i >= 0 && arr.indexOf(i) === p)

  return (
    <div
      data-slot="trend-chart"
      className={cn('relative w-full', className)}
      onMouseMove={handleMove}
      onMouseLeave={() => { setActive(defaultIndex ?? null); setPointer(null) }}
    >
      {empty ? (
        <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height: plotHeight }}>{emptyText}</div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${plotHeight}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${label}: ${series.map((s) => s.label).join(', ')}`}
          tabIndex={0}
          onKeyDown={handleKey}
          className="w-full overflow-visible outline-none"
          style={{ height: plotHeight }}
        >
          {showAxis && showAxis !== 'x' ? ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad} x2={width - pad} y1={yAt(tick)} y2={yAt(tick)} className="stroke-border" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              <text x={2} y={yAt(tick) - 2} className="fill-muted-foreground" fontSize={8}>{axisFormat ? axisFormat(tick) : compact(tick)}</text>
            </g>
          )) : null}

          {variant === 'bar' ? series.map((s, si) => {
            const color = s.color ?? palette[si % palette.length]
            const groupWidth = step > 0 ? Math.max(2, step * 0.7) : 12
            const barWidth = Math.max(1, groupWidth / series.length)
            return s.values.map((v, i) => v == null ? null : (
              <rect
                key={`${s.label}-${i}`}
                x={xAt(i) - groupWidth / 2 + si * barWidth}
                y={yAt(v)}
                width={barWidth - 1}
                height={Math.max(1, plotHeight - pad - yAt(v))}
                rx={1}
                fill={color}
                opacity={s.previous ? 0.3 : active === i ? 1 : 0.85}
              />
            ))
          }) : series.map((s, si) => {
            const color = s.color ?? palette[si % palette.length]
            const points = s.values.map((v, i) => v == null ? null : `${xAt(i)},${yAt(v)}`).filter((p): p is string => p !== null).join(' ')
            if (!points) return null
            const dash = s.previous ? '5 4' : undefined
            return (
              <g key={s.label}>
                {variant === 'area' ? (
                  <polygon points={`${xAt(0)},${plotHeight - pad} ${points} ${xAt(count - 1)},${plotHeight - pad}`} fill={color} opacity={s.previous ? 0.06 : 0.14} />
                ) : null}
                <polyline points={points} fill="none" stroke={color} strokeWidth={spark ? 1.5 : 2} strokeDasharray={dash} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {active !== null && s.values[active] != null ? (
                  <circle cx={xAt(active)} cy={yAt(s.values[active] as number)} r={spark ? 2 : 3} fill={color} className="stroke-card" strokeWidth={1.5} />
                ) : null}
              </g>
            )
          })}

          {active !== null ? (
            <line x1={xAt(active)} x2={xAt(active)} y1={pad} y2={plotHeight - pad} className="stroke-border" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>
      )}

      {showAxis && labels.length ? (
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          {labelIndexes.map((i) => <span key={i}>{labels[i] ?? ''}</span>)}
        </div>
      ) : null}

      {spark && active !== null ? (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background">
          {tooltipLabels?.[active] ?? labels[active] ?? ''} · {format(series[0]?.values[active] ?? 0)}
        </span>
      ) : null}

      {!spark && tooltip && active !== null && pointer && !empty ? (
        <div
          role="status"
          className="pointer-events-none absolute z-10 min-w-28 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] shadow-lg"
          style={{ left: pointer.x, top: pointer.y - 6 }}
        >
          <div className="mb-1 font-medium text-foreground">{tooltipLabels?.[active] ?? labels[active] ?? ''}</div>
          {series.map((s, i) => (
            <div key={s.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: s.color ?? palette[i % palette.length] }} />
                {s.label}
              </span>
              <span className="tabular-nums text-foreground">{format(s.values[active] ?? 0)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
