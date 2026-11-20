import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectMeter, AffectSectionLabel } from '../shared'

export interface UsageValues {
  tokens?: number
  cost?: number
  requests?: number
}

export interface UsageModel {
  id: string
  name: string
  usage: UsageValues
  tasks?: Record<string, UsageValues>
}

export interface UsageCompany {
  id: string
  name: string
  models: UsageModel[]
  color?: string
  logo?: ReactNode
}

export type UsageMetric = 'tokens' | 'cost' | 'requests'

export interface ModelUsageProps {
  companies: UsageCompany[]
  previous?: UsageValues
  since?: string
  metrics?: UsageMetric[]
  defaultMetric?: UsageMetric
  title?: string
  kinds?: Record<string, { label: string; color: string; icon?: ReactNode }>
  className?: string
}

const palette = ['#2f6bff', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']
const defaultKinds: Record<string, { label: string; color: string }> = {
  search: { label: 'Search', color: '#2f6bff' },
  analyze: { label: 'Analyze', color: '#8b5cf6' },
  code: { label: 'Code', color: '#10b981' },
  test: { label: 'Test', color: '#f59e0b' }
}

const metricLabel: Record<UsageMetric, string> = { tokens: 'Tokens', cost: 'Cost', requests: 'Requests' }

function formatValue(metric: UsageMetric, value: number): string {
  if (metric === 'cost') return `$${value.toFixed(2)}`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`
  return Math.round(value).toLocaleString('en-US')
}

/** Per-company stacked model usage with a measure switch and a task breakdown. */
export function ModelUsage({
  companies,
  previous,
  since,
  metrics = ['tokens', 'cost', 'requests'],
  defaultMetric = 'tokens',
  kinds = defaultKinds,
  className
}: ModelUsageProps) {
  const [metric, setMetric] = useState<UsageMetric>(defaultMetric)
  const [hovered, setHovered] = useState<string | null>(null)

  const valueOf = (values: UsageValues | undefined) => values?.[metric] ?? 0
  const total = companies.reduce(
    (sum, company) => sum + company.models.reduce((s, model) => s + valueOf(model.usage), 0),
    0
  )
  const delta = previous ? ((total - valueOf(previous)) / Math.max(1, valueOf(previous))) * 100 : undefined
  const activeCompany = companies.find((c) => c.id === hovered)
  const models = [...(activeCompany?.models ?? [])].sort((a, b) => valueOf(b.usage) - valueOf(a.usage))

  const taskTotals: Record<string, number> = {}
  for (const company of activeCompany ? [activeCompany] : companies) {
    for (const model of company.models) {
      for (const [kind, values] of Object.entries(model.tasks ?? {})) {
        taskTotals[kind] = (taskTotals[kind] ?? 0) + valueOf(values)
      }
    }
  }
  const maxTask = Math.max(1, ...Object.values(taskTotals))

  return (
    <div
      data-slot="model-usage"
      className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
        <div className="min-w-0">
          <AffectSectionLabel>Usage</AffectSectionLabel>
          <div className="flex items-baseline gap-2">
            <span className="truncate text-xl font-semibold tabular-nums text-foreground">{formatValue(metric, total)}</span>
            {typeof delta === 'number' ? (
              <span className={cn('text-[11px] font-medium', delta >= 0 ? 'text-success' : 'text-destructive')}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%{since ? ` since ${since}` : ''}
              </span>
            ) : since ? <span className="text-[11px] text-muted-foreground">{since}</span> : null}
          </div>
        </div>
        {metrics.length > 1 ? (
          <div role="group" aria-label="Measure" className="flex shrink-0 rounded-md bg-muted p-0.5">
            {metrics.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metric === m}
                onClick={() => setMetric(m)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px]',
                  metric === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                {metricLabel[m]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 p-3">
        <div role="img" aria-label={`${metricLabel[metric]} usage by company`} className="flex items-end gap-4 overflow-x-auto pb-1">
          {companies.map((company, index) => {
            const companyTotal = company.models.reduce((sum, model) => sum + valueOf(model.usage), 0)
            const parts = [...company.models].sort((a, b) => valueOf(b.usage) - valueOf(a.usage))
            const base = company.color ?? palette[index % palette.length]
            return (
              <div
                key={company.id}
                tabIndex={0}
                onMouseEnter={() => setHovered(company.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(company.id)}
                onBlur={() => setHovered(null)}
                className="flex min-w-24 flex-1 flex-col items-center gap-1.5 rounded-md p-1"
              >
                <span className="text-[10px] tabular-nums text-muted-foreground">{formatValue(metric, companyTotal)}</span>
                <div className="flex h-16 w-full flex-col-reverse justify-start overflow-hidden rounded bg-muted">
                  {parts.map((model, i) => (
                    <div
                      key={model.id}
                      title={`${model.name}: ${formatValue(metric, valueOf(model.usage))}`}
                      style={{ height: `${companyTotal > 0 ? (valueOf(model.usage) / companyTotal) * 100 : 0}%`, backgroundColor: base, opacity: 1 - i * 0.18 }}
                    />
                  ))}
                </div>
                <span className="flex items-center gap-1 text-xs text-foreground">
                  {company.logo ? <span aria-hidden="true" className="size-3.5">{company.logo}</span> : null}
                  <span className="truncate">{company.name}</span>
                </span>
              </div>
            )
          })}
        </div>

        <div aria-live="polite" className="min-h-8 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
          {activeCompany ? (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {models.map((model, i) => (
                <span key={model.id} className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="size-2 rounded-sm" style={{ backgroundColor: activeCompany.color ?? palette[0], opacity: 1 - i * 0.18 }} />
                  {model.name} <span className="tabular-nums text-foreground">{formatValue(metric, valueOf(model.usage))}</span>
                </span>
              ))}
            </span>
          ) : `Point at a company to see its models · ${metricLabel[metric]}`}
        </div>

        {Object.keys(taskTotals).length ? (
          <div className="space-y-1.5 border-t border-border pt-2">
            <AffectSectionLabel>{hovered ? `${activeCompany?.name} breakdown` : 'Across all models'}</AffectSectionLabel>
            {Object.entries(taskTotals).map(([kind, value]) => (
              <div key={kind} className="grid grid-cols-[72px_1fr_56px] items-center gap-2">
                <span className="truncate text-[11px] text-muted-foreground">{kinds[kind]?.label ?? kind}</span>
                <AffectMeter value={value} max={maxTask} label={`${kinds[kind]?.label ?? kind} usage`} className="h-1.5" />
                <span className="text-right text-[11px] tabular-nums text-foreground">{formatValue(metric, value)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
