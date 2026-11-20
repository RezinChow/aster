import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import type { MouseEvent } from 'react'

import { cn } from '../../../lib/utils'

export interface KpiSeries {
  label: string
  color: string
  values: number[]
}

export interface KpiChartProps {
  title?: string
  value?: string
  delta?: number
  labels: string[]
  tooltipLabels?: string[]
  series: KpiSeries[]
  format?: (value: number) => string
  footer?: string
  defaultIndex?: number
  emptyText?: string
  className?: string
}

const compact = (n: number) => {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

/** A headline metric with a multi-line chart and a pointer-following tooltip. */
export function KpiChart({
  title,
  value,
  delta,
  labels,
  tooltipLabels,
  series,
  format = compact,
  footer,
  defaultIndex,
  emptyText = 'No data yet',
  className
}: KpiChartProps) {
  const [index, setIndex] = useState<number | null>(defaultIndex ?? null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const count = Math.max(labels.length, ...series.map((s) => s.values.length), 0)
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const width = 300
  const height = 110
  const pad = 4
  const step = count > 1 ? (width - pad * 2) / (count - 1) : 0
  const xAt = (i: number) => pad + i * step
  const yAt = (v: number) => height - pad - (v / max) * (height - pad * 2)
  const empty = count === 0 || series.every((s) => s.values.every((v) => v === 0))
  const up = (delta ?? 0) >= 0

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const next = step > 0 ? Math.max(0, Math.min(count - 1, Math.round((x - pad) / step))) : 0
    setIndex(next)
    setPointer({ x, y })
  }

  const axisIndex = [0, Math.floor((count - 1) / 2), count - 1].filter((i, pos, arr) => i >= 0 && arr.indexOf(i) === pos)

  return (
    <div
      data-slot="kpi-chart"
      className={cn('rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{title}</div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        </div>
        {typeof delta === 'number' ? (
          <span className={cn(
            'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
            up ? 'bg-success-subtle text-success-subtle-foreground' : 'bg-destructive/10 text-destructive'
          )}>
            {up ? <ArrowUpRight aria-hidden="true" className="size-3" /> : <ArrowDownRight aria-hidden="true" className="size-3" />}
            {format(Math.abs(delta))}
          </span>
        ) : null}
      </div>

      <div className="relative mt-2" onMouseMove={handleMove} onMouseLeave={() => { setIndex(defaultIndex ?? null); setPointer(null) }}>
        {empty ? (
          <div className="flex h-[110px] items-center justify-center text-xs text-muted-foreground">{emptyText}</div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="h-[110px] w-full overflow-visible"
            role="img"
            aria-label={`${title ?? 'Chart'}: ${series.map((s) => s.label).join(', ')}`}
          >
            {series.map((s) => {
              const points = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')
              return (
                <g key={s.label}>
                  <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  {index !== null && s.values[index] !== undefined ? (
                    <circle cx={xAt(index)} cy={yAt(s.values[index])} r={3} fill={s.color} className="stroke-card" strokeWidth={1.5} />
                  ) : null}
                </g>
              )
            })}
            {index !== null && !pointer ? (
              <line x1={xAt(index)} x2={xAt(index)} y1={pad} y2={height - pad} className="stroke-border" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>
        )}

        {index !== null && !empty && pointer ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 min-w-28 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] shadow-lg"
            style={{ left: pointer.x, top: pointer.y - 6 }}
          >
            <div className="mb-1 font-medium text-foreground">{tooltipLabels?.[index] ?? labels[index] ?? ''}</div>
            {series.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="tabular-nums text-foreground">{format(s.values[index] ?? 0)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!empty ? (
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          {axisIndex.map((i) => <span key={i}>{labels[i] ?? ''}</span>)}
        </div>
      ) : null}
      {footer ? <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">{footer}</div> : null}
    </div>
  )
}
