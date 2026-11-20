import { Check, Trophy } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import {
  AffectHeader,
  AffectMeter,
  AffectSurface,
  AffectToneBadge,
  formatCost as defaultFormatCost,
  formatDuration
} from '../shared'

export interface Attempt {
  id: string
  name: string
  approach: string
  model?: string
  icon?: ReactNode
  status: 'running' | 'done' | 'failed'
  progress?: number
  step?: string
  score?: number
  note?: string
  took?: number
  cost?: number
}
export interface ParallelAttemptsProps {
  attempts: Attempt[]
  task?: string
  picked?: string | null
  onPick?: (attempt: Attempt) => void
  formatCost?: (amount: number) => string
  title?: string
  className?: string
}

/** Several ways at one task, raced side by side, with the best one picked. */
export function ParallelAttempts({
  attempts,
  task,
  picked,
  onPick,
  formatCost = defaultFormatCost,
  title = 'Best of N',
  className
}: ParallelAttemptsProps) {
  const [internal, setInternal] = useState<string | null>(null)
  const finished = attempts.filter((attempt) => attempt.status === 'done')
  const best = finished.reduce<Attempt | null>((current, attempt) => (!current || (attempt.score ?? 0) > (current.score ?? 0) ? attempt : current), null)
  const currentId = picked !== undefined ? picked : (internal ?? best?.id ?? null)
  const choose = (attempt: Attempt) => { setInternal(attempt.id); onPick?.(attempt) }

  return (
    <div data-slot="parallel-attempts" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={title} description={task} actions={<AffectToneBadge tone={attempts.some((attempt) => attempt.status === 'running') ? 'info' : 'success'}>{finished.length}/{attempts.length} done</AffectToneBadge>} />
        <div role="radiogroup" aria-label={`${title}: ${task ?? 'attempts'}`} className="mt-3 space-y-1.5">
          {attempts.map((attempt) => {
            const isBest = best?.id === attempt.id
            const selected = currentId === attempt.id
            const tone = attempt.status === 'running' ? 'info' : attempt.status === 'failed' ? 'danger' : 'success'
            return (
              <div key={attempt.id} className={cn('rounded-md border p-2 transition-colors', selected ? 'border-primary bg-accent' : 'border-border')}>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-foreground">{attempt.icon ?? attempt.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5"><span className="truncate text-xs font-medium text-foreground">{attempt.name}</span>{attempt.model ? <span className="text-[10px] text-muted-foreground">{attempt.model}</span> : null}{isBest ? <AffectToneBadge tone="info"><Trophy aria-hidden="true" className="size-2.5" />Best</AffectToneBadge> : null}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{attempt.approach}</span>
                  </span>
                  {attempt.score !== undefined ? <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">{attempt.score}</span> : null}
                  <AffectToneBadge tone={tone}>{attempt.status === 'failed' ? 'Failed' : attempt.status === 'running' ? 'Running' : 'Done'}</AffectToneBadge>
                </div>
                {attempt.status === 'running' ? <div className="mt-2"><AffectMeter value={Math.round((attempt.progress ?? 0) * 100)} tone="info" label={`${attempt.name} progress`} /><p className="mt-0.5 text-[10px] text-muted-foreground">{attempt.step ?? 'Working…'}</p></div> : null}
                {attempt.note ? <p className={cn('mt-1 text-[10px]', attempt.status === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>{attempt.note}</p> : null}
                <div className="mt-1.5 flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
                  {attempt.took !== undefined ? <span>{formatDuration(attempt.took)}</span> : null}
                  {attempt.cost !== undefined ? <span>{formatCost(attempt.cost)}</span> : null}
                  {attempt.status === 'done' ? (
                    <button type="button" role="radio" aria-checked={selected} onClick={() => choose(attempt)} className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-foreground hover:bg-muted">
                      {selected ? <Check aria-hidden="true" className="size-3 text-success" /> : null}Use this one
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </AffectSurface>
    </div>
  )
}
