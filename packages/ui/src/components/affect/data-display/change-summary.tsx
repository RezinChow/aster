import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader } from '../shared'

export type ChangeTone = 'good' | 'bad' | 'neutral'

export interface MetricChange {
  label: string
  change: string
  tone?: ChangeTone
  direction?: 'up' | 'down'
}

export interface ChangeSummaryProps {
  changes: MetricChange[]
  title?: string
  period?: string
  icon?: ReactNode
  className?: string
}

const toneClass: Record<ChangeTone, string> = {
  good: 'text-success',
  bad: 'text-destructive',
  neutral: 'text-muted-foreground'
}

/** A short recap: one metric per row with a colored trend. */
export function ChangeSummary({ changes, title = "What's changed", period, icon, className }: ChangeSummaryProps) {
  return (
    <div
      data-slot="change-summary"
      className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="border-b border-border bg-muted/40 px-3 py-2.5">
        <AffectHeader
          title={
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{icon ?? <Sparkles className="size-3.5" aria-hidden="true" />}</span>
              {title}
            </span>
          }
          description={period}
        />
      </div>
      <ul className="divide-y divide-border">
        {changes.length === 0 ? (
          <li className="px-3 py-4 text-center text-xs text-muted-foreground">No changes</li>
        ) : changes.map((item) => {
          const tone = item.tone ?? 'neutral'
          const Icon = item.direction === 'down' ? ArrowDownRight : item.direction === 'up' ? ArrowUpRight : Minus
          return (
            <li key={item.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="truncate text-xs text-muted-foreground">{item.label}</span>
              <span className={cn('flex shrink-0 items-center gap-1.5 text-xs font-medium', toneClass[tone])}>
                <Icon aria-hidden="true" className="size-3.5" />
                <span className="truncate">{item.change}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
