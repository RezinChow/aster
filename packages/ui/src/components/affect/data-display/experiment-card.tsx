import { ChevronDown, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import { AffectToneBadge } from '../shared'

export type ExperimentTone = 'red' | 'amber' | 'green' | 'blue' | 'violet' | 'gray'

export interface ExperimentMetric {
  id: string
  label: string
  format?: (value: number) => string
  lowerIsBetter?: boolean
}

export interface ExperimentVariant {
  id: string
  key: string
  name: string
  values: Record<string, number>
  control?: boolean
  visitors?: number
  confidence?: Record<string, number>
  color?: string
}

export interface ExperimentAction {
  label: string | ((variant: ExperimentVariant) => string)
  onClick: (variant: ExperimentVariant) => void
}

export interface ExperimentCardProps {
  title: string
  variants: ExperimentVariant[]
  metrics: ExperimentMetric[]
  metric?: string
  defaultMetric?: string
  onMetricChange?: (id: string) => void
  winner?: string | null
  defaultWinner?: string | null
  onWinnerChange?: (id: string | null) => void
  status?: { label: string; tone?: ExperimentTone }
  note?: string
  action?: ExperimentAction
  hint?: ReactNode
  trigger?: 'hover' | 'click'
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

const toneMap: Record<ExperimentTone, 'danger' | 'warning' | 'success' | 'info' | 'primary' | 'neutral'> = {
  red: 'danger', amber: 'warning', green: 'success', blue: 'info', violet: 'primary', gray: 'neutral'
}

/** A/B test in two lines that unfolds to a metric switch and a pickable winner. */
export function ExperimentCard({
  title,
  variants,
  metrics,
  metric,
  defaultMetric,
  onMetricChange,
  winner,
  defaultWinner = null,
  onWinnerChange,
  status,
  note,
  action,
  hint = 'Pick a winner',
  trigger = 'hover',
  open,
  defaultOpen = false,
  onOpenChange,
  className
}: ExperimentCardProps) {
  const [internalMetric, setInternalMetric] = useState(defaultMetric ?? metrics[0]?.id ?? '')
  const [internalWinner, setInternalWinner] = useState<string | null>(defaultWinner)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const activeMetric = metric ?? internalMetric
  const activeWinner = winner !== undefined ? winner : internalWinner
  const isOpen = open ?? internalOpen
  const current = metrics.find((m) => m.id === activeMetric) ?? metrics[0]
  const picked = variants.find((v) => v.id === activeWinner)

  const setOpen = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }
  const choose = (id: string) => {
    const next = activeWinner === id ? null : id
    setInternalWinner(next)
    onWinnerChange?.(next)
  }

  return (
    <div
      data-slot="experiment-card"
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow',
        isOpen && 'shadow-md',
        className
      )}
      onMouseEnter={() => { if (trigger === 'hover') setOpen(true) }}
      onMouseLeave={() => { if (trigger === 'hover') setOpen(false) }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {status ? <AffectToneBadge tone={toneMap[status.tone ?? 'gray']}>{status.label}</AffectToneBadge> : null}
            {note ? <span className="text-[11px] text-muted-foreground">{note}</span> : null}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen ? (
        <div className="border-t border-border px-3 py-2.5">
          {metrics.length > 1 ? (
            <div role="group" aria-label="Metric" className="mb-2 flex flex-wrap gap-1">
              {metrics.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={activeMetric === m.id}
                  onClick={() => {
                    setInternalMetric(m.id)
                    onMetricChange?.(m.id)
                  }}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-[11px]',
                    activeMetric === m.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-1" role="group" aria-label="Variants">
            {variants.map((v) => {
              const value = v.values[activeMetric] ?? 0
              const confidence = v.confidence?.[activeMetric]
              const selected = activeWinner === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose(v.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-muted/60',
                    selected && 'border-border bg-accent/50'
                  )}
                >
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
                    style={{ backgroundColor: v.color ?? '#2f6bff' }}
                  >
                    {v.key}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground">
                      {v.name}
                      {v.control ? <span className="ml-1 text-[10px] text-muted-foreground">control</span> : null}
                    </span>
                    {typeof confidence === 'number' ? (
                      <span className="block h-1 w-full max-w-24 rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-info" style={{ width: `${Math.min(100, confidence)}%` }} />
                      </span>
                    ) : null}
                  </span>
                  {v.visitors !== undefined ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{v.visitors} visitors</span>
                  ) : null}
                  <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                    {current?.format ? current.format(value) : value.toFixed(1)}
                  </span>
                  {selected ? <Trophy aria-hidden="true" className="size-3.5 shrink-0 text-warning" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-8 items-center justify-between gap-2 border-t border-border bg-muted/40 px-3 py-1.5">
        <span className="truncate text-[11px] text-muted-foreground">
          {picked ? `Winner: ${picked.key} · ${picked.name}` : hint}
        </span>
        {picked && action ? (
          <button
            type="button"
            onClick={() => action.onClick(picked)}
            className="shrink-0 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            {typeof action.label === 'function' ? action.label(picked) : action.label}
          </button>
        ) : null}
      </div>
    </div>
  )
}
