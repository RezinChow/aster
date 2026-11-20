import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatDuration } from '../shared/format'
import type { AffectTone } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectMeter, AffectSurface, AffectToneBadge } from '../shared/ui'

export type QueueStatus = 'queued' | 'running' | 'done' | 'failed'
export type JobKind = 'llm' | 'tool' | 'agent' | 'human'

export interface QueueJob {
  id: string
  name: string
  kind: JobKind
  status: QueueStatus
  enqueuedAt: number
  priority?: 'high' | 'normal' | 'low'
  startedAt?: number
  endedAt?: number
  worker?: string
  progress?: number
  estimate?: number
  attempt?: number
  maxAttempts?: number
  detail?: string
  icon?: ReactNode
  error?: string
}
export interface QueueWorker { id: string; name: string; detail?: string; icon?: ReactNode }

export interface AgentQueueProps {
  jobs: QueueJob[]
  workers: QueueWorker[]
  now?: number
  rateLimits?: { from: number; until: number; label?: string }[]
  paused?: boolean
  onPausedChange?: (paused: boolean) => void
  onConcurrencyChange?: (workers: number) => void
  minConcurrency?: number
  maxConcurrency?: number
  backpressure?: number
  window?: number
  totals?: { done?: number; failed?: number }
  openId?: string | null
  defaultOpenId?: string | null
  onOpenChange?: (id: string | null, job?: QueueJob) => void
  onPromote?: (job: QueueJob) => void
  onCancel?: (job: QueueJob) => void
  title?: string
  name?: string
  className?: string
}

const kindTone: Record<JobKind, AffectTone> = { llm: 'primary', tool: 'success', agent: 'neutral', human: 'info' }
const statusTone: Record<QueueStatus, AffectTone> = { queued: 'neutral', running: 'info', done: 'success', failed: 'danger' }
const statusLabel: Record<QueueStatus, string> = { queued: 'Waiting', running: 'Running', done: 'Done', failed: 'Failed' }

/** A live job queue: backlog, worker slots, outcomes and a depth chart. */
export function AgentQueue({
  jobs, workers, now = Date.now(), rateLimits = [], paused, onPausedChange, onConcurrencyChange,
  minConcurrency = 1, maxConcurrency = 8, backpressure, window: span = 120_000, totals,
  openId, defaultOpenId = null, onOpenChange, onPromote, onCancel,
  title = 'Queue', name, className
}: AgentQueueProps) {
  const [localPaused, setLocalPaused] = useState(false)
  const [localOpen, setLocalOpen] = useState<string | null>(defaultOpenId)
  const isPaused = paused ?? localPaused
  const pinnedId = openId === undefined ? localOpen : openId
  const pinned = jobs.find((job) => job.id === pinnedId)
  const grouped = (status: QueueStatus) => jobs.filter((job) => job.status === status)
  const waiting = grouped('queued')
  const running = grouped('running')
  const done = (totals?.done ?? 0) + grouped('done').length
  const failed = (totals?.failed ?? 0) + grouped('failed').length
  const rateLimited = rateLimits.some((limit) => now >= limit.from && now <= limit.until)

  const depth = useMemo(() => {
    const buckets = 12
    const start = now - span
    return Array.from({ length: buckets }, (_, index) => {
      const at = start + (span * (index + 1)) / buckets
      return jobs.filter((job) => job.enqueuedAt <= at && (!job.endedAt || job.endedAt > at)).length
    })
  }, [jobs, now, span])
  const peak = Math.max(1, ...depth)
  const setPaused = () => {
    if (paused === undefined) setLocalPaused(!isPaused)
    onPausedChange?.(!isPaused)
  }
  const pin = (job: QueueJob | null) => {
    if (openId === undefined) setLocalOpen(job?.id ?? null)
    onOpenChange?.(job?.id ?? null, job ?? undefined)
  }
  const jobButton = (job: QueueJob) => (
    <button key={job.id} type="button" aria-expanded={pinnedId === job.id}
      aria-label={`${job.name}, ${kindTone[job.kind]}, ${statusLabel[job.status]}${job.priority && job.priority !== 'normal' ? `, ${job.priority} priority` : ''}`}
      onClick={() => pin(pinnedId === job.id ? null : job)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pin(pinnedId === job.id ? null : job) }
        if (event.key === 'Escape') pin(null)
      }}
      className={cn('flex w-full items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        job.priority === 'high' && 'border-warning', pinnedId === job.id && 'bg-accent')}>
      {job.icon ?? <span aria-hidden="true" className="size-2 shrink-0 rounded-sm bg-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{job.name}</span>
      {job.attempt && job.maxAttempts && job.attempt > 1 ? <span className="text-[10px] text-muted-foreground">#{job.attempt}</span> : null}
      <AffectToneBadge tone={statusTone[job.status]}>{statusLabel[job.status]}</AffectToneBadge>
    </button>
  )

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-queue">
      <div className="space-y-3 p-3">
        <AffectHeader title={title} description={name}
          actions={
            <div className="flex items-center gap-1">
              <button type="button" aria-pressed={isPaused} onClick={setPaused}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted">
                {isPaused ? <Play aria-hidden="true" className="size-3" /> : <Pause aria-hidden="true" className="size-3" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              {onConcurrencyChange ? (
                <span className="flex items-center gap-1 text-[11px] text-foreground">
                  <button type="button" aria-label="Remove a worker" disabled={workers.length <= minConcurrency}
                    onClick={() => onConcurrencyChange(workers.length - 1)} className="rounded border border-border p-0.5 disabled:opacity-40"><ChevronLeft aria-hidden="true" className="size-3" /></button>
                  <span className="w-4 text-center tabular-nums">{workers.length}</span>
                  <button type="button" aria-label="Add a worker" disabled={workers.length >= maxConcurrency}
                    onClick={() => onConcurrencyChange(workers.length + 1)} className="rounded border border-border p-0.5 disabled:opacity-40"><ChevronRight aria-hidden="true" className="size-3" /></button>
                </span>
              ) : null}
            </div>
          } />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Waiting', value: waiting.length, tone: waiting.length > (backpressure ?? Infinity) ? 'warning' : 'neutral' },
            { label: 'Running', value: running.length, tone: 'info' },
            { label: 'Done', value: done, tone: 'success' },
            { label: 'Failed', value: failed, tone: 'danger' }
          ].map((metric) => (
            <div key={metric.label} className={cn('rounded-md border border-border px-2 py-1.5', metric.tone === 'warning' && 'bg-warning-subtle')}>
              <p className="text-[10px] text-muted-foreground">{metric.label}</p>
              <p className="text-sm font-medium tabular-nums text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>

        {rateLimited ? (
          <p className="rounded-md bg-warning-subtle px-2 py-1.5 text-[11px] text-warning-subtle-foreground" aria-live="polite">
            Rate limited{rateLimits.find((limit) => now >= limit.from && now <= limit.until)?.label ? `: ${rateLimits.find((limit) => now >= limit.from && now <= limit.until)?.label}` : ''}
          </p>
        ) : null}

        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Backlog depth (peak {peak})</p>
          <div role="img" aria-label={`Backlog depth now ${depth[depth.length - 1] ?? 0}, peak ${peak}`} className="flex h-10 items-end gap-0.5">
            {depth.map((value, index) => (
              <span key={index} className={cn('flex-1 rounded-sm', backpressure && value > backpressure ? 'bg-warning' : 'bg-info')}
                style={{ height: `${Math.max(4, (value / peak) * 100)}%` }} />
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Waiting</p>
            {waiting.length ? waiting.map(jobButton) : <AffectEmpty>Queue empty</AffectEmpty>}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Workers</p>
            {workers.map((worker) => {
              const job = running.find((item) => item.worker === worker.id)
              return (
                <div key={worker.id} className="space-y-1 rounded-md border border-border bg-card px-2 py-1.5">
                  <p className="flex items-center gap-1 truncate text-[11px] font-medium text-foreground">{worker.icon}{worker.name}</p>
                  {job ? (
                    <>
                      <p className="truncate text-[10px] text-muted-foreground">{job.name}</p>
                      <AffectMeter value={(job.progress ?? 0) * 100} tone="info" label={`${job.name} progress`} />
                    </>
                  ) : <p className="text-[10px] text-muted-foreground">Idle · {worker.detail ?? 'ready'}</p>}
                </div>
              )
            })}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Done / Failed</p>
            {[...grouped('done'), ...grouped('failed')].map(jobButton)}
            {grouped('done').length + grouped('failed').length === 0 ? <AffectEmpty>None yet</AffectEmpty> : null}
          </div>
        </div>

        {pinned ? (
          <div role="dialog" aria-label={`${pinned.name} details`} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape') pin(null) }}
            className="space-y-2 rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-foreground">{pinned.name}</span>
              <button type="button" aria-label="Close job details" onClick={() => pin(null)} className="rounded p-0.5 hover:bg-muted">×</button>
            </div>
            {pinned.detail ? <p className="text-[11px] text-muted-foreground">{pinned.detail}</p> : null}
            {pinned.error ? <p className="text-[11px] text-destructive">{pinned.error}</p> : null}
            <p className="text-[10px] tabular-nums text-muted-foreground">Waited {formatDuration((pinned.startedAt ?? now) - pinned.enqueuedAt)}</p>
            <div className="flex gap-1">
              {onPromote && pinned.status === 'queued' ? <button type="button" onClick={() => onPromote(pinned)} className="rounded border border-border px-2 py-1 text-[11px] text-foreground">Move to front</button> : null}
              {onCancel && (pinned.status === 'queued' || pinned.status === 'running') ? <button type="button" onClick={() => onCancel(pinned)} className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground">Cancel</button> : null}
            </div>
          </div>
        ) : null}
      </div>
    </AffectSurface>
  )
}
