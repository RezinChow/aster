import { Check, CornerDownRight, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge, affectStatusTone, formatCost, formatDuration } from '../shared'

export type FallbackStatus = 'waiting' | 'trying' | 'failed' | 'answered' | 'skipped'

export interface FallbackAttempt {
  id: string
  model: string
  provider?: string
  region?: string
  logo?: ReactNode
  status: FallbackStatus
  startedAt?: number
  duration?: number
  timeout?: number
  cost?: number
  reason?: string
  note?: string
  details?: ReactNode
}

export interface ChainEnd { name: string; logo?: ReactNode; text?: string; details?: ReactNode }

export interface FallbackChainProps {
  attempts: FallbackAttempt[]
  title?: string
  route?: string
  request?: ChainEnd
  response?: ChainEnd
  now?: number
  onRetry?: () => void
  className?: string
}

const statusWord: Record<FallbackStatus, string> = {
  waiting: 'Waiting', trying: 'Trying', failed: 'Failed', answered: 'Answered', skipped: 'Not needed'
}

/** A request trying models in fallback order until one answers. */
export function FallbackChain({
  attempts,
  title = 'Request',
  route,
  request,
  response,
  now,
  onRetry,
  className
}: FallbackChainProps) {
  const [open, setOpen] = useState<string | null>(null)
  const [tick, setTick] = useState(Date.now())
  const trying = attempts.find((attempt) => attempt.status === 'trying')
  const answered = attempts.find((attempt) => attempt.status === 'answered')
  const allFailed = attempts.length > 0 && attempts.every((attempt) => attempt.status === 'failed')

  useEffect(() => {
    if (!trying || now !== undefined) return
    const timer = setInterval(() => setTick(Date.now()), 500)
    return () => clearInterval(timer)
  }, [trying, now])

  const clock = now ?? tick
  const elapsed = trying?.startedAt ? Math.max(0, clock - trying.startedAt) : 0
  const tryingIndex = attempts.findIndex((attempt) => attempt.status === 'trying')
  const summary = allFailed
    ? `All ${attempts.length} models failed`
    : answered
      ? `Answered in ${formatDuration(answered.duration ?? 0)}`
      : tryingIndex >= 0
        ? `Attempt ${tryingIndex + 1} of ${attempts.length} · ${Math.round(elapsed / 1000)}s`
        : `${attempts.length} models in the chain`

  const node = (id: string, end: ChainEnd | undefined, fallback: string, tone: 'info' | 'success' | 'neutral') => (
    <div className="relative">
      <button
        type="button"
        aria-label={`${fallback}${end?.text ? `: ${end.text}` : ''}`}
        aria-describedby={end ? `fbk-tip-${id}` : undefined}
        onFocus={() => setOpen(id)}
        onBlur={() => setOpen(null)}
        onMouseEnter={() => setOpen(id)}
        onMouseLeave={() => setOpen(null)}
        className={cn('flex w-full items-start gap-2 rounded-md border border-border p-2 text-left hover:bg-muted/60')}
      >
        <span className="shrink-0 text-muted-foreground">{end?.logo ?? <span className={cn('flex size-6 items-center justify-center rounded text-[10px]', tone === 'success' ? 'bg-success-subtle text-success-subtle-foreground' : 'bg-info-subtle text-info')}>{fallback.slice(0, 1)}</span>}</span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-foreground">{end?.name ?? fallback}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{end?.text ?? '—'}</span>
        </span>
      </button>
      {end && open === id ? <div role="tooltip" id={`fbk-tip-${id}`} className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-border bg-card p-2 text-[11px] text-foreground shadow-md">{end.text}{end.details ? <div className="mt-1 text-muted-foreground">{end.details}</div> : null}</div> : null}
    </div>
  )

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(null) }
  }

  return (
    <div data-slot="fallback-chain" onKeyDown={onKeyDown} className={cn('w-full max-w-[560px]', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={title} description={route} actions={<AffectToneBadge tone={allFailed ? 'danger' : answered ? 'success' : 'info'}>{allFailed ? 'Failed' : answered ? 'Answered' : 'Routing'}</AffectToneBadge>} />
        <p aria-live="polite" className="mt-2 text-[11px] text-muted-foreground">{summary}</p>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {node('request', request, 'Request', 'info')}
          <span aria-hidden="true" className="h-px w-4 bg-border" />
          {node('response', response ? (answered ? response : { name: 'No response', text: 'No model answered yet' }) : undefined, 'Response', 'success')}
        </div>

        <ol aria-label="Models in fallback order" className="relative mt-3 space-y-1.5 border-l border-border pl-4">
          {attempts.map((attempt) => (
            <li key={attempt.id} className="relative">
              <span aria-hidden="true" className={cn('absolute -left-[21px] top-3 size-2 rounded-full', attempt.status === 'answered' ? 'bg-success' : attempt.status === 'failed' ? 'bg-destructive' : attempt.status === 'trying' ? 'animate-pulse bg-info' : 'bg-muted-foreground/50')} />
              <button
                type="button"
                aria-describedby={`fbk-attempt-${attempt.id}`}
                onFocus={() => setOpen(attempt.id)}
                onBlur={() => setOpen(null)}
                onMouseEnter={() => setOpen(attempt.id)}
                onMouseLeave={() => setOpen(null)}
                className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted/60"
              >
                <span className="shrink-0 text-muted-foreground">{attempt.logo ?? <span className="flex size-5 items-center justify-center rounded bg-muted text-[10px]">{attempt.model.slice(0, 1)}</span>}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{attempt.model}{attempt.provider ? <span className="ml-1 font-normal text-muted-foreground">· {attempt.provider}</span> : null}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{attempt.note ?? attempt.reason ?? statusWord[attempt.status]}</span>
                </span>
                {attempt.status === 'trying' ? <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 animate-spin text-info" /> : attempt.status === 'failed' ? <X aria-hidden="true" className="size-3.5 shrink-0 text-destructive" /> : attempt.status === 'answered' ? <Check aria-hidden="true" className="size-3.5 shrink-0 text-success" /> : <CornerDownRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
                <AffectToneBadge tone={affectStatusTone[attempt.status === 'answered' ? 'done' : attempt.status === 'failed' ? 'failed' : attempt.status === 'trying' ? 'running' : 'queued']}>{statusWord[attempt.status]}</AffectToneBadge>
                <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{attempt.duration ? formatDuration(attempt.duration) : attempt.status === 'trying' ? formatDuration(elapsed) : '—'}</span>
                {attempt.cost !== undefined ? <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-foreground">{formatCost(attempt.cost)}</span> : null}
              </button>
              {open === attempt.id ? <div role="tooltip" id={`fbk-attempt-${attempt.id}`} className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-border bg-card p-2 text-[11px] text-foreground shadow-md">{attempt.reason ?? statusWord[attempt.status]}{attempt.details ? <div className="mt-1 text-muted-foreground">{attempt.details}</div> : null}{attempt.timeout ? <div className="mt-1 text-muted-foreground">Timeout {attempt.timeout}ms</div> : null}{attempt.region ? <div className="text-muted-foreground">{attempt.region}</div> : null}</div> : null}
            </li>
          ))}
        </ol>

        {allFailed && onRetry ? (
          <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent"><RotateCcw aria-hidden="true" className="size-3" />Retry request</button>
        ) : null}
      </AffectSurface>
    </div>
  )
}
