import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface BreakdownItem {
  id?: string
  label: string
  value: number
  color?: string
}

export interface BreakdownPeriod {
  id: string
  label: string
}

export interface CompactBreakdownProps {
  items: BreakdownItem[]
  title?: string
  periods?: BreakdownPeriod[]
  period?: string
  defaultPeriod?: string
  onPeriodChange?: (id: string) => void
  delta?: number
  format?: (value: number) => string
  totalLabel?: string
  footer?: ReactNode | null
  className?: string
}

const palette = ['#2f6bff', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b']

const defaultFormat = (n: number) => Math.round(n).toLocaleString('en-US')

/** One total split into ranked parts, with an optional period switch. */
export function CompactBreakdown({
  items,
  title = 'Breakdown',
  periods,
  period,
  defaultPeriod,
  onPeriodChange,
  delta,
  format = defaultFormat,
  totalLabel = 'Total',
  footer,
  className
}: CompactBreakdownProps) {
  const [internalPeriod, setInternalPeriod] = useState(defaultPeriod ?? periods?.[0]?.id ?? '')
  const activePeriod = period ?? internalPeriod
  const [hovered, setHovered] = useState<string | null>(null)
  const ranked = [...items].sort((a, b) => b.value - a.value)
  const total = ranked.reduce((sum, item) => sum + item.value, 0)
  const selected = ranked.find((item) => (item.id ?? item.label) === hovered)
  const good = (delta ?? 0) >= 0

  return (
    <div
      data-slot="compact-breakdown"
      className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="truncate text-xs font-medium text-foreground">{title}</span>
        {periods && periods.length > 1 ? (
          <div role="group" aria-label="Period" className="flex shrink-0 rounded-md bg-muted p-0.5">
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={activePeriod === p.id}
                onClick={() => {
                  setInternalPeriod(p.id)
                  onPeriodChange?.(p.id)
                }}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors',
                  activePeriod === p.id && 'bg-card text-foreground shadow-sm'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="px-3 pb-3 pt-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {format(selected ? selected.value : total)}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {selected ? selected.label : totalLabel}
          </span>
          {typeof delta === 'number' && !selected ? (
            <span
              className={cn(
                'ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                good ? 'bg-success-subtle text-success-subtle-foreground' : 'bg-destructive/10 text-destructive'
              )}
            >
              {good ? <ArrowUpRight aria-hidden="true" className="size-3" /> : <ArrowDownRight aria-hidden="true" className="size-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          ) : null}
        </div>

        <div
          role="img"
          aria-label={`${title}, total ${format(total)}`}
          className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          {ranked.map((item, index) => {
            const id = item.id ?? item.label
            const width = total > 0 ? (item.value / total) * 100 : 0
            return (
              <div
                key={id}
                tabIndex={0}
                title={`${item.label}: ${format(item.value)}`}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(id)}
                onBlur={() => setHovered(null)}
                className={cn('h-full transition-opacity', hovered && hovered !== id ? 'opacity-40' : 'opacity-100')}
                style={{ width: `${width}%`, backgroundColor: item.color ?? palette[index % palette.length] }}
              />
            )
          })}
        </div>

        <ul className="mt-3 space-y-1.5">
          {ranked.slice(0, 5).map((item, index) => {
            const id = item.id ?? item.label
            return (
              <li
                key={id}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                className="flex items-center gap-2 text-xs"
              >
                <span aria-hidden="true" className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color ?? palette[index % palette.length] }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span>
                <span className="shrink-0 tabular-nums text-foreground">{format(item.value)}</span>
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                  {total > 0 ? `${Math.round((item.value / total) * 100)}%` : '0%'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        {footer === null ? null : (footer ?? `Largest: ${ranked[0]?.label ?? '—'}`)}
      </div>
    </div>
  )
}
