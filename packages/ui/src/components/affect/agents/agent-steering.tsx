import { Pause, Play, Send, X, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '../../../lib/utils'
import { formatDuration } from '../shared/format'
import { AffectEmpty, AffectHeader, AffectStatusDot, AffectSurface } from '../shared/ui'

export type SteerStatus = 'done' | 'active' | 'pending'
export interface SteerNote { id: string; text: string; picked?: 'next' | 'now' }
export interface SteerStep {
  id: string
  title: string
  status?: SteerStatus
  duration?: number
  startedAt?: number
  notes?: SteerNote[]
}
export interface AgentSteeringProps {
  title: string
  agent: string
  steps: SteerStep[]
  queue: SteerNote[]
  status?: 'running' | 'paused' | 'done'
  startedAt?: number | Date
  onQueue?: (text: string) => void
  onInterrupt?: (text: string, queuedId?: string) => void
  onRemove?: (id: string) => void
  onPause?: () => void
  onResume?: () => void
  draft?: string
  onDraftChange?: (text: string) => void
  placeholder?: string
  className?: string
}

/** Steer a running agent by queuing a note for the next step or interrupting now. */
export function AgentSteering({
  title, agent, steps, queue, status = 'running', startedAt, onQueue, onInterrupt,
  onRemove, onPause, onResume, draft, onDraftChange, placeholder = 'Steer the agent…', className
}: AgentSteeringProps) {
  const [localDraft, setLocalDraft] = useState('')
  const [now, setNow] = useState(Date.now())
  const [announce, setAnnounce] = useState('')
  const text = draft ?? localDraft
  const setText = (value: string) => {
    if (draft === undefined) setLocalDraft(value)
    onDraftChange?.(value)
  }
  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [status])
  const elapsed = startedAt ? Math.max(0, now - new Date(startedAt).getTime()) : 0
  const active = steps.find((step) => step.status === 'active')

  const send = (interrupt: boolean) => {
    if (!text.trim()) return
    if (interrupt) { onInterrupt?.(text.trim()); setAnnounce(`Interrupted with: ${text.trim()}`) }
    else { onQueue?.(text.trim()); setAnnounce(`Queued note for the next step: ${text.trim()}`) }
    setText('')
  }

  return (
    <AffectSurface className={cn('w-full max-w-[460px]', className)} data-slot="agent-steering">
      <div className="space-y-3 p-3">
        <AffectHeader title={title} description={agent}
          actions={
            <span className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
              {startedAt ? formatDuration(elapsed) : null}
              {status === 'running' && onPause ? (
                <button type="button" aria-label="Pause" onClick={onPause} className="rounded p-1 text-muted-foreground hover:bg-muted"><Pause aria-hidden="true" className="size-3" /></button>
              ) : null}
              {status === 'paused' && onResume ? (
                <button type="button" aria-label="Resume" onClick={onResume} className="rounded p-1 text-muted-foreground hover:bg-muted"><Play aria-hidden="true" className="size-3" /></button>
              ) : null}
            </span>
          } />

        <ol role="list" aria-label="Plan" className="space-y-1">
          {steps.map((step) => {
            const stepStatus = step.status ?? 'pending'
            const stepElapsed = step.startedAt && stepStatus === 'active' ? Math.max(0, now - step.startedAt) : 0
            return (
              <li key={step.id} aria-current={stepStatus === 'active' ? 'step' : undefined}
                className={cn('flex items-center gap-2 rounded-md px-2 py-1.5',
                  stepStatus === 'active' && 'bg-info-subtle', stepStatus === 'done' && 'opacity-70')}>
                <AffectStatusDot status={stepStatus === 'active' ? 'running' : stepStatus === 'done' ? 'done' : 'queued'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-foreground">{step.title}</span>
                  {step.notes?.length ? (
                    <span className="mt-0.5 block space-y-0.5">
                      {step.notes.map((note) => (
                        <span key={note.id} className="flex items-center gap-1 text-[10px] text-info">
                          <Zap aria-hidden="true" className="size-3" />
                          <span className="truncate">{note.text}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                {stepElapsed ? <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatDuration(stepElapsed)}</span> : null}
                {step.duration ? <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatDuration(step.duration)}</span> : null}
              </li>
            )
          })}
        </ol>

        {queue.length ? (
          <div role="list" aria-label="Queued notes" className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Queued for the next step</p>
            {queue.map((note) => (
              <div key={note.id} role="listitem" className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{note.text}</span>
                {onInterrupt ? (
                  <button type="button" aria-label={`Apply now: ${note.text}`} onClick={() => { onInterrupt(note.text, note.id); setAnnounce(`Applied now: ${note.text}`) }}
                    className="rounded bg-warning-subtle px-1.5 py-0.5 text-[10px] text-warning-subtle-foreground">Now</button>
                ) : null}
                {onRemove ? (
                  <button type="button" aria-label={`Remove note: ${note.text}`} onClick={() => onRemove(note.id)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted"><X aria-hidden="true" className="size-3" /></button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {status !== 'done' ? (
          <div className="space-y-1">
            <div className="flex items-end gap-1">
              <textarea aria-label="Steer the agent" aria-describedby="steer-hint"
                value={text} onChange={(event) => setText(event.target.value)} placeholder={placeholder} rows={2}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (event.metaKey || event.ctrlKey) send(true)
                    else send(false)
                  }
                  if (event.key === 'Escape') { event.preventDefault(); setText('') }
                }}
                className="min-h-12 min-w-0 flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
              <button type="button" aria-label="Queue for the next step" disabled={!text.trim()} onClick={() => send(false)}
                className="mb-0.5 rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-40"><Send aria-hidden="true" className="size-3" /></button>
            </div>
            <p id="steer-hint" className="text-[10px] text-muted-foreground">
              Enter queues for the next step · ⌘/Ctrl+Enter applies now · Shift+Enter adds a line
              {active ? ` · Active: ${active.title}` : ''}
            </p>
          </div>
        ) : <AffectEmpty>The run is done. Nothing to steer.</AffectEmpty>}
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </AffectSurface>
  )
}
