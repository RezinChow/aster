import { Check, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import {
  AffectHeader,
  AffectMeter,
  AffectSurface,
  AffectToneBadge,
  formatCost as defaultFormatCost,
  formatDuration
} from '../shared'

export type FanoutStatus = 'queued' | 'running' | 'retrying' | 'done' | 'failed'

export interface FanoutTask {
  id: string
  label: string
  status: FanoutStatus
  worker?: string
  start?: number
  end?: number
  cost?: number
  attempts?: number
  result?: string
  error?: string
}

export interface FanOutGridProps {
  tasks: FanoutTask[]
  job?: string
  workers?: number
  now?: number
  onRetry?: (ids: string[]) => void
  onSelect?: (task: FanoutTask | null) => void
  formatCost?: (amount: number) => string
  title?: string
  icon?: ReactNode
  className?: string
}

const cellTone: Record<FanoutStatus, string> = {
  queued: 'bg-muted',
  running: 'bg-info',
  retrying: 'bg-warning',
  done: 'bg-success',
  failed: 'bg-destructive'
}
const statusWord: Record<FanoutStatus, string> = {
  queued: 'Queued', running: 'Running', retrying: 'Retrying', done: 'Done', failed: 'Failed'
}

/** A live grid of tasks fanned out to many workers. */
export function FanOutGrid({
  tasks,
  job,
  workers,
  now = 0,
  onRetry,
  onSelect,
  formatCost = defaultFormatCost,
  title = 'Fan-out',
  icon,
  className
}: FanOutGridProps) {
  const [focused, setFocused] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<FanoutStatus | null>(null)
  const [announce, setAnnounce] = useState('')
  const columns = Math.min(16, Math.max(4, Math.ceil(Math.sqrt(tasks.length))))
  const counts = tasks.reduce<Record<FanoutStatus, number>>((acc, task) => { acc[task.status] += 1; return acc }, { queued: 0, running: 0, retrying: 0, done: 0, failed: 0 })
  const progress = tasks.length ? Math.round((counts.done / tasks.length) * 100) : 0
  const activeWorkers = workers ?? counts.running
  const remaining = tasks.length - counts.done - counts.failed
  const failedIds = tasks.filter((task) => task.status === 'failed').map((task) => task.id)
  const detail = tasks.find((task) => task.id === (selected ?? tasks[focused]?.id))

  const pick = (task: FanoutTask) => {
    const next = selected === task.id ? null : task.id
    setSelected(next)
    onSelect?.(next ? task : null)
    setAnnounce(next ? `${task.label}, ${statusWord[task.status]}` : 'Details closed')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const move = (delta: number) => { event.preventDefault(); const next = Math.min(tasks.length - 1, Math.max(0, focused + delta)); setFocused(next); setAnnounce(`${tasks[next]?.label ?? ''}, ${tasks[next] ? statusWord[tasks[next].status] : ''}`) }
    if (event.key === 'ArrowRight') move(1)
    else if (event.key === 'ArrowLeft') move(-1)
    else if (event.key === 'ArrowDown') move(columns)
    else if (event.key === 'ArrowUp') move(-columns)
    else if (event.key === 'Home') move(-focused)
    else if (event.key === 'End') move(tasks.length - 1 - focused)
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (tasks[focused]) pick(tasks[focused]) }
    else if (event.key === 'Escape') { setSelected(null); onSelect?.(null) }
  }

  return (
    <div data-slot="fan-out-grid" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={<span className="inline-flex items-center gap-1.5">{icon}{title}</span>} description={job} actions={<AffectToneBadge tone={counts.running ? 'info' : progress === 100 ? 'success' : 'neutral'}>{progress}%</AffectToneBadge>} />
        <div
          role="grid"
          aria-label={`${title}: ${job ?? 'tasks'}`}
          className="mt-3 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {tasks.map((task, index) => (
            <button
              key={task.id}
              type="button"
              role="gridcell"
              aria-label={`${task.label}, ${statusWord[task.status]}`}
              tabIndex={focused === index ? 0 : -1}
              onFocus={() => setFocused(index)}
              onKeyDown={onKeyDown}
              onClick={() => { setFocused(index); pick(task) }}
              title={`${task.label} · ${statusWord[task.status]}`}
              className={cn(
                'aspect-square rounded-sm border border-border/40 transition-all hover:ring-1 hover:ring-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                cellTone[task.status],
                task.status === 'running' && 'animate-pulse',
                filter && filter !== task.status && 'opacity-25',
                selected === task.id && 'ring-2 ring-foreground'
              )}
            >
              {task.status === 'done' ? <Check aria-hidden="true" className="m-auto size-3 text-success-subtle-foreground" /> : task.status === 'failed' ? <X aria-hidden="true" className="m-auto size-3 text-white" /> : task.status === 'running' || task.status === 'retrying' ? <LoaderCircle aria-hidden="true" className="m-auto size-3 animate-spin text-white" /> : null}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2 border-t border-border pt-2">
          <AffectMeter value={counts.done} max={tasks.length} tone="success" label="Tasks completed" />
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(counts) as FanoutStatus[]).map((status) => (
              <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter((current) => (current === status ? null : status))} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]', filter === status ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                <span aria-hidden="true" className={cn('size-1.5 rounded-full', cellTone[status])} />{statusWord[status]} {counts[status]}
              </button>
            ))}
            {failedIds.length && onRetry ? <button type="button" onClick={() => onRetry(failedIds)} className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-accent"><RotateCcw aria-hidden="true" className="size-3" />Retry failed</button> : null}
          </div>
          <p className="text-[10px] text-muted-foreground">{remaining} left · about {Math.ceil(remaining / Math.max(1, activeWorkers))} per worker · {formatDuration(now)} elapsed</p>
        </div>

        {detail ? (
          <div role="dialog" aria-label={`${detail.label} details`} className="mt-2 rounded-md border border-border bg-background p-2 text-[11px]">
            <div className="flex items-center justify-between"><span className="truncate font-medium text-foreground">{detail.label}</span><button type="button" aria-label="Close details" onClick={() => { setSelected(null); onSelect?.(null) }} className="text-muted-foreground">Close</button></div>
            <p className="mt-1 text-muted-foreground">{statusWord[detail.status]}{detail.worker ? ` · ${detail.worker}` : ''}{detail.attempts && detail.attempts > 1 ? ` · ${detail.attempts} attempts` : ''}</p>
            {detail.start !== undefined ? <p className="text-muted-foreground">Took {formatDuration((detail.end ?? now) - detail.start)}</p> : null}
            {detail.cost !== undefined ? <p className="text-muted-foreground">{formatCost(detail.cost)}</p> : null}
            {detail.result ? <p className="mt-1 text-foreground">{detail.result}</p> : null}
            {detail.error ? <p className="mt-1 text-destructive">{detail.error}</p> : null}
          </div>
        ) : null}
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}

/** Alias matching the public name used by the component's docs. */
export const FanoutGrid = FanOutGrid
export type FanoutGridProps = FanOutGridProps
