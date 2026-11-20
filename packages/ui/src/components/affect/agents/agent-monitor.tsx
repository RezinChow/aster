import { ChevronDown, ChevronUp, CirclePause, CirclePlay, ExternalLink, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatCost as defaultCost, formatDuration } from '../shared/format'
import type { AffectTone } from '../shared/types'
import { AffectIconButton, AffectStatusDot, AffectSurface, AffectToneBadge } from '../shared/ui'

export type MonitorState = 'idle' | 'running' | 'waiting' | 'paused' | 'finished' | 'failed' | 'cancelled'
export type StepState = 'queued' | 'running' | 'done' | 'failed'

export interface AgentRunStep {
  id: string
  label: string
  state: StepState
  kind?: 'read' | 'search' | 'edit' | 'run' | 'think' | 'web'
  icon?: ReactNode
  since?: number
  took?: number
  tool?: string
  detail?: string
  output?: string
}
export interface AgentMonitorProps {
  state: MonitorState
  agent?: { name: string; role?: string; mark?: ReactNode }
  steps?: AgentRunStep[]
  current?: { label: string; kind?: string; icon?: ReactNode }
  since?: number
  until?: number
  pausedFor?: number
  cost?: number
  ask?: { title: string; command?: string; icon?: ReactNode }
  outcome?: { added?: number; removed?: number; files?: number; note?: string }
  error?: string
  onAllow?: () => void
  onDecline?: () => void
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onRetry?: () => void
  onOpenLog?: () => void
  defaultFolded?: boolean
  formatCost?: (amount: number) => string
  className?: string
}

const monitorTone: Record<MonitorState, AffectTone> = {
  idle: 'neutral', running: 'info', waiting: 'warning', paused: 'warning',
  finished: 'success', failed: 'danger', cancelled: 'neutral'
}
const monitorLabel: Record<MonitorState, string> = {
  idle: 'Idle', running: 'Running', waiting: 'Needs you', paused: 'Paused',
  finished: 'Finished', failed: 'Failed', cancelled: 'Cancelled'
}

/** One agent at work: clock, bill, step strip and the exact command when it asks. */
export function AgentMonitor({
  state, agent = { name: 'Agent' }, steps = [], current, since, until, pausedFor = 0, cost,
  ask, outcome, error, onAllow, onDecline, onPause, onResume, onCancel, onRetry, onOpenLog,
  defaultFolded = false, formatCost = defaultCost, className
}: AgentMonitorProps) {
  const [folded, setFolded] = useState(defaultFolded)
  const [info, setInfo] = useState<string | null>(null)
  const running = steps.find((step) => step.state === 'running')
  const doneCount = steps.filter((step) => step.state === 'done').length
  const end = until ?? Date.now()
  const elapsed = since ? Math.max(0, end - since - pausedFor) : 0
  const activeLabel = current?.label ?? running?.label ?? 'Working…'

  const body = (
    <div className="space-y-3 p-3">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-foreground">
          {agent.mark ?? agent.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{agent.name}</p>
          {agent.role ? <p className="truncate text-[11px] text-muted-foreground">{agent.role}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {cost !== undefined ? <span className="text-[11px] tabular-nums text-foreground">{formatCost(cost)}</span> : null}
          <AffectToneBadge tone={monitorTone[state]}>{monitorLabel[state]}</AffectToneBadge>
          <AffectIconButton label={folded ? 'Expand monitor' : 'Fold monitor'} onClick={() => setFolded(!folded)}>
            {folded ? <ChevronUp aria-hidden="true" className="size-3" /> : <ChevronDown aria-hidden="true" className="size-3" />}
          </AffectIconButton>
        </div>
      </div>

      {!folded ? (
        <>
          <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
            <AffectStatusDot status={state === 'waiting' ? 'waiting' : state === 'failed' ? 'failed' : state === 'running' ? 'running' : state === 'paused' ? 'paused' : state === 'finished' ? 'done' : 'queued'} />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{activeLabel}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatDuration(elapsed)}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{doneCount}/{steps.length}</span>
          </div>

          <div role="list" aria-label="Steps" className="flex gap-0.5" aria-hidden="true">
            {steps.map((step) => (
              <span key={step.id} className={cn('h-1.5 flex-1 rounded-full',
                step.state === 'done' ? 'bg-success' : step.state === 'running' ? 'bg-info' : step.state === 'failed' ? 'bg-destructive' : 'bg-muted')} />
            ))}
          </div>

          {state === 'waiting' && ask ? (
            <div className="rounded-md border border-warning bg-warning-subtle p-2">
              <p className="text-xs font-medium text-warning-subtle-foreground">{ask.title}</p>
              {ask.command ? <pre className="mt-1 overflow-x-auto rounded bg-background px-2 py-1 font-mono text-[11px] text-foreground"><code>{ask.command}</code></pre> : null}
              <div className="mt-2 flex gap-1">
                <button type="button" onClick={onAllow} className="rounded bg-success-subtle px-2 py-1 text-[11px] text-success-subtle-foreground">Allow</button>
                <button type="button" onClick={onDecline} className="rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">Decline</button>
              </div>
            </div>
          ) : null}
          {state === 'failed' && error ? <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">{error}</p> : null}
          {state === 'finished' && outcome ? (
            <p className="text-[11px] text-muted-foreground">
              Finished in {formatDuration(elapsed)}
              {outcome.added !== undefined ? ` · +${outcome.added} −${outcome.removed ?? 0}` : ''}
              {outcome.files !== undefined ? ` · ${outcome.files} files` : ''}
              {outcome.note ? ` · ${outcome.note}` : ''}
            </p>
          ) : null}

          {steps.length ? (
            <ul role="list" className="space-y-0.5">
              {steps.slice(-3).map((step) => (
                <li key={step.id}>
                  <button type="button" aria-expanded={info === step.id}
                    aria-label={`${step.label}, ${step.state}${step.took ? `, ${formatDuration(step.took)}` : ''}`}
                    onClick={() => setInfo(info === step.id ? null : step.id)}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setInfo(info === step.id ? null : step.id) } }}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <AffectStatusDot status={step.state === 'done' ? 'done' : step.state === 'running' ? 'running' : step.state === 'failed' ? 'failed' : 'queued'} />
                    <span className={cn('min-w-0 flex-1 truncate text-[11px]', step.state === 'failed' ? 'text-destructive' : 'text-foreground')}>{step.label}</span>
                    {step.icon}<span className="text-[10px] text-muted-foreground">{step.tool}</span>
                    {step.took ? <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatDuration(step.took)}</span> : null}
                  </button>
                  {info === step.id ? (
                    <div role="dialog" aria-label={`${step.label} details`} tabIndex={-1}
                      onKeyDown={(event) => { if (event.key === 'Escape') setInfo(null) }}
                      className="ml-4 space-y-1 rounded-md border border-border bg-background p-2 text-[11px]">
                      <span className="flex items-center justify-between"><span className="text-foreground">{step.label}</span>
                        <button type="button" aria-label="Close details" onClick={() => setInfo(null)} className="rounded p-0.5 hover:bg-muted"><X aria-hidden="true" className="size-3" /></button>
                      </span>
                      {step.tool ? <p className="text-muted-foreground">Tool: {step.tool}</p> : null}
                      {step.detail ? <p className="text-muted-foreground">{step.detail}</p> : null}
                      {step.output ? <pre className="overflow-x-auto rounded bg-muted p-1 font-mono text-[10px] text-foreground"><code>{step.output}</code></pre> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-1">
            {state === 'running' && onPause ? (
              <button type="button" onClick={onPause} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"><CirclePause aria-hidden="true" className="size-3" /> Pause</button>
            ) : null}
            {state === 'paused' && onResume ? (
              <button type="button" onClick={onResume} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"><CirclePlay aria-hidden="true" className="size-3" /> Resume</button>
            ) : null}
            {(state === 'running' || state === 'paused') && onCancel ? (
              <button type="button" onClick={onCancel} className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted">Cancel</button>
            ) : null}
            {state === 'failed' && onRetry ? (
              <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"><RotateCcw aria-hidden="true" className="size-3" /> Retry</button>
            ) : null}
            {onOpenLog ? (
              <button type="button" onClick={onOpenLog} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-info hover:bg-muted"><ExternalLink aria-hidden="true" className="size-3" /> Log</button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">{activeLabel} · {formatDuration(elapsed)}</p>
      )}
    </div>
  )

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-monitor">
      <div role="group" aria-label={`${agent.name}, ${monitorLabel[state]}, ${activeLabel}`} tabIndex={0}
        onKeyDown={(event) => {
          if (state === 'waiting' && event.target === event.currentTarget) {
            if (event.key === 'Enter') { event.preventDefault(); onAllow?.() }
            if (event.key === 'Escape') { event.preventDefault(); onDecline?.() }
          }
        }}
        className="rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
        {body}
      </div>
    </AffectSurface>
  )
}
