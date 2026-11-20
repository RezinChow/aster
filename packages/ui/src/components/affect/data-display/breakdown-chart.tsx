import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSectionLabel, AffectSelectMenu } from '../shared'

export type BreakdownValue = string | number | undefined

export interface BreakdownRecord {
  [field: string]: BreakdownValue
}

export interface BreakdownDimension {
  key: string
  label: string
  values: string[]
  colors?: Record<string, string>
  icons?: Record<string, ReactNode>
}

export interface BreakdownMeasure {
  key: string
  label: string
  unit?: string
  field?: string
}

export interface BreakdownChartProps {
  records: BreakdownRecord[]
  dimensions: BreakdownDimension[]
  measures: BreakdownMeasure[]
  title?: string
  defaultMeasure?: string
  defaultSlice?: string
  defaultSegment?: string
  className?: string
}

const palette = ['#2f6bff', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#64748b', '#06b6d4']

function asText(value: BreakdownValue): string {
  return value == null ? '' : String(value)
}

/** A stacked bar chart with measure, slice and segment pickers and a linked table. */
export function BreakdownChart({
  records,
  dimensions,
  measures,
  title = 'Workload',
  defaultMeasure,
  defaultSlice,
  defaultSegment,
  className
}: BreakdownChartProps) {
  const [measureKey, setMeasureKey] = useState(defaultMeasure ?? measures[0]?.key ?? '')
  const [sliceKey, setSliceKey] = useState(defaultSlice ?? dimensions[0]?.key ?? '')
  const [segmentKey, setSegmentKey] = useState(defaultSegment ?? dimensions[1]?.key ?? 'none')
  const [hover, setHover] = useState<{ slice: string; segment: string; value: number } | null>(null)

  const measure = measures.find((m) => m.key === measureKey) ?? measures[0]
  const sliceDim = dimensions.find((d) => d.key === sliceKey) ?? dimensions[0]
  const segmentDim = dimensions.find((d) => d.key === segmentKey)
  const sliceValues = sliceDim?.values.length
    ? sliceDim.values
    : Array.from(new Set(records.map((r) => asText(r[sliceDim?.key ?? '']))))
  const segments = segmentDim?.values.length ? segmentDim.values : ['All']
  const colorFor = (segment: string, index: number) =>
    segmentDim?.colors?.[segment] ?? palette[index % palette.length]

  const bars = sliceValues.map((slice) => {
    const rows = records.filter((r) => asText(r[sliceDim?.key ?? '']) === slice)
    const parts = segments.map((segment, index) => {
      const matched = rows.filter((r) => !segmentDim || asText(r[segmentDim.key]) === segment)
      const value = matched.reduce(
        (sum, r) => sum + (measure?.field ? Number(r[measure.field]) || 0 : 1),
        0
      )
      return { label: segment, value, color: colorFor(segment, index) }
    })
    const total = parts.reduce((sum, p) => sum + p.value, 0)
    return { label: slice, total, parts }
  })
  const grandTotal = bars.reduce((sum, bar) => sum + bar.total, 0)
  const unit = measure?.unit ? ` ${measure.unit}` : ''

  return (
    <div
      data-slot="breakdown-chart"
      className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/40 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <AffectSectionLabel>Breakdown</AffectSectionLabel>
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Measure
          <AffectSelectMenu
            label="Measure"
            value={measureKey}
            options={measures.map((m) => ({ value: m.key, label: m.label }))}
            onChange={setMeasureKey}
          />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Along
          <AffectSelectMenu
            label="Slice by"
            value={sliceKey}
            options={dimensions.map((d) => ({ value: d.key, label: d.label }))}
            onChange={setSliceKey}
          />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Split
          <AffectSelectMenu
            label="Segment by"
            value={segmentKey}
            options={[{ value: 'none', label: 'None' }, ...dimensions.map((d) => ({ value: d.key, label: d.label }))]}
            onChange={setSegmentKey}
          />
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div
          role="img"
          aria-label={`${title}: ${bars.length} groups, total ${grandTotal}${unit}`}
          className="space-y-2"
        >
          {bars.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">No data</div>
          ) : bars.map((bar) => (
            <div key={bar.label} className="grid grid-cols-[80px_1fr_52px] items-center gap-2">
              <span className="truncate text-xs text-muted-foreground" title={bar.label}>{bar.label}</span>
              <div className="flex h-5 w-full overflow-hidden rounded bg-muted">
                {bar.parts.map((part) => {
                  const width = bar.total > 0 ? (part.value / bar.total) * 100 : 0
                  const active = hover?.slice === bar.label && hover.segment === part.label
                  return (
                    <div
                      key={part.label}
                      tabIndex={0}
                      title={`${bar.label} · ${part.label}: ${part.value}${unit}`}
                      onMouseEnter={() => setHover({ slice: bar.label, segment: part.label, value: part.value })}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ slice: bar.label, segment: part.label, value: part.value })}
                      onBlur={() => setHover(null)}
                      className={cn('h-full transition-opacity', active ? 'opacity-100' : 'opacity-80 hover:opacity-100')}
                      style={{ width: `${width}%`, backgroundColor: part.color }}
                    />
                  )
                })}
              </div>
              <span className="text-right text-xs tabular-nums text-foreground">{bar.total}</span>
            </div>
          ))}
        </div>

        <div aria-live="polite" className="min-h-4 text-[11px] text-muted-foreground">
          {hover ? `${hover.slice} · ${hover.segment}: ${hover.value}${unit}` : `${grandTotal}${unit} across ${bars.length} groups`}
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/50 text-left text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">{sliceDim?.label ?? 'Group'}</th>
                {segments.map((s) => <th key={s} className="px-2 py-1.5 text-right font-medium">{s}</th>)}
                <th className="px-2 py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((bar) => (
                <tr key={bar.label} className="border-t border-border">
                  <td className="px-2 py-1.5 text-foreground">{bar.label}</td>
                  {bar.parts.map((p) => <td key={p.label} className="px-2 py-1.5 text-right tabular-nums text-foreground">{p.value}</td>)}
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums text-foreground">{bar.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
