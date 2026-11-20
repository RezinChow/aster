import { useState, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge, formatDuration } from '../shared'

export interface PlanStep {
  id: string
  title: string
  plan: number
  deps?: string[]
  start?: number
  end?: number
  icon?: ReactNode
}
export interface PlanVsActualProps {
  steps: PlanStep[]
  now: number
  task?: string
  formatTime?: (ms: number) => string
  title?: string
  className?: string
}

const defaultTime = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`

/** An agent's plan against what really happened, step by step. */
export function PlanVsActual({
  steps,
  now,
  task,
  formatTime = defaultTime,
  title = 'Plan vs actual',
  className
}: PlanVsActualProps) {
  const [focused, setFocused] = useState<string | null>(null)
  const byId = new Map(steps.map((step) => [step.id, step]))
  const plannedStart = (step: PlanStep, seen = new Set<string>()): number => {
    if (seen.has(step.id)) return 0
    seen.add(step.id)
    return (step.deps ?? []).reduce((start, id) => {
      const dep = byId.get(id)
      return dep ? Math.max(start, plannedStart(dep, seen) + dep.plan) : start
    }, 0)
  }
  const planned = steps.map((step) => ({ step, start: plannedStart(step) }))
  const span = Math.max(1, ...planned.map(({ step, start }) => start + step.plan), ...steps.map((step) => step.end ?? now), now)
  const expectedFinish = Math.max(...steps.map((step) => {
    const start = step.start ?? plannedStart(step)
    if (step.end !== undefined) return step.end
    return Math.max(start, now) + step.plan
  }))
  const plannedFinish = Math.max(...planned.map(({ step, start }) => start + step.plan))
  const delay = expectedFinish - plannedFinish

  return (
    <div data-slot="plan-vs-actual" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={title}
          description={task}
          actions={<AffectToneBadge tone={delay > 0 ? 'warning' : 'success'}>{delay > 0 ? `+${formatDuration(delay)} late` : 'On plan'}</AffectToneBadge>}
        />
        <div className="mt-3 flex justify-between border-b border-border pb-1 text-[10px] tabular-nums text-muted-foreground">
          <span>{formatTime(0)}</span><span>{formatTime(span / 2)}</span><span>{formatTime(span)}</span>
        </div>
        <ul role="list" className="mt-1 space-y-1">
          {planned.map(({ step, start }) => {
            const actualStart = step.start
            const ended = step.end !== undefined
            const actual = actualStart !== undefined ? (step.end ?? Math.max(actualStart, now)) - actualStart : 0
            const late = ended && actual > step.plan
            const waiting = actualStart === undefined
            const width = (actual / span) * 100
            const isFocused = focused === step.id
            const dependents = steps.filter((item) => item.deps?.includes(step.id)).map((item) => item.title)
            return (
              <li key={step.id}>
                <div
                  tabIndex={0}
                  onFocus={() => setFocused(step.id)}
                  onBlur={() => setFocused(null)}
                  aria-label={`${step.title}. Planned ${formatDuration(step.plan)}. ${waiting ? 'Not started' : actual ? `Took ${formatDuration(actual)}` : 'Running'}${late ? `, ${formatDuration(actual - step.plan)} over plan` : ''}.`}
                  className={cn('rounded-md px-1.5 py-1 outline-none hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring', isFocused && 'bg-muted/60')}
                >
                  <div className="mb-1 flex items-center gap-2 text-[11px]">
                    <span className="shrink-0 text-muted-foreground">{step.icon ?? <span className="size-2 rounded-sm bg-muted-foreground/50" />}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{step.title}</span>
                    {step.deps?.length ? <span className="shrink-0 text-[10px] text-muted-foreground">after {step.deps.map((id) => byId.get(id)?.title ?? id).join(', ')}</span> : null}
                    <span className={cn('shrink-0 tabular-nums', late ? 'text-warning' : 'text-muted-foreground')}>{waiting ? `starts ~${formatTime(start)}` : ended ? formatDuration(actual) : formatDuration(Math.max(0, now - (actualStart ?? now)))}</span>
                    <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">/ {formatDuration(step.plan)}</span>
                  </div>
                  <div className="relative h-3 rounded bg-muted">
                    <span aria-hidden="true" className="absolute inset-y-0 rounded border border-dashed border-muted-foreground/60" style={{ left: `${(start / span) * 100}%`, width: `${(step.plan / span) * 100}%` }} />
                    {!waiting ? (
                      <span aria-hidden="true" className={cn('absolute inset-y-0.5 rounded', late ? 'bg-warning' : ended ? 'bg-success' : 'bg-info')} style={{ left: `${((actualStart ?? now) / span) * 100}%`, width: `${Math.max(0.5, width)}%` }} />
                    ) : null}
                  </div>
                  {isFocused && dependents.length ? <p className="mt-0.5 text-[10px] text-muted-foreground">Blocks: {dependents.join(', ')}</p> : null}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px]">
          <span className="text-muted-foreground">Expected finish <span className="tabular-nums text-foreground">{formatTime(expectedFinish)}</span></span>
          <span className="text-muted-foreground">Planned <span className="tabular-nums">{formatTime(plannedFinish)}</span></span>
        </div>
      </AffectSurface>
    </div>
  )
}
