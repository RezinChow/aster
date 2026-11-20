import { RotateCcw, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectTone } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export type RecapKind = 'needs' | 'failed' | 'done'
export interface RecapEvent {
  id: string
  at: string | number | Date
  kind: RecapKind
  title: string
  detail?: string
  logo?: ReactNode
  count?: number
  action?: string
  doneLabel?: string
}
export interface AgentRecapProps {
  events: RecapEvent[]
  since?: string | number | Date
  until?: string | number | Date
  onAction?: (event: RecapEvent, action: 'primary' | 'review') => void | Promise<void>
  onUndo?: (event: RecapEvent) => void
  onRedo?: (event: RecapEvent) => void
  limit?: number
  title?: string
  className?: string
}

const laneMeta: Record<RecapKind, { label: string; tone: AffectTone; action: string; doneLabel: string }> = {
  needs: { label: 'Needs you', tone: 'warning', action: 'Approve', doneLabel: 'Approved' },
  failed: { label: 'Failed', tone: 'danger', action: 'Retry', doneLabel: 'Fixed' },
  done: { label: 'Done', tone: 'success', action: 'Open', doneLabel: 'Done' }
}
const time = (value: string | number | Date) => new Date(value).getTime()

/** What the agents did while you were away, as a small chart and three action lanes. */
export function AgentRecap({
  events, since, until, onAction, onUndo, onRedo, limit = 3,
  title = 'While you were away', className
}: AgentRecapProps) {
  const [acted, setActed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [undone, setUndone] = useState<Record<string, boolean>>({})
  const [announce, setAnnounce] = useState('')
  const end = time(until ?? Date.now())
  const initialStart = time(since ?? Math.min(...events.map((event) => time(event.at))))
  const start = Number.isFinite(initialStart) ? initialStart : end - 3_600_000
  const span = Math.max(1, end - start)
  const sorted = useMemo(() => [...events].sort((a, b) => time(a.at) - time(b.at)), [events])

  const run = async (event: RecapEvent, action: 'primary' | 'review') => {
    setBusy(event.id)
    try {
      await onAction?.(event, action)
      setActed((current) => ({ ...current, [event.id]: true }))
      setAnnounce(`${laneMeta[event.kind].doneLabel}: ${event.title}`)
    } catch {
      setAnnounce(`Could not complete: ${event.title}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-recap">
      <div className="space-y-3 p-3">
        <AffectHeader title={title} description={`${events.length} events`} />
        <div role="img" aria-label="Activity over time" className="relative h-12 rounded-md border border-border bg-muted/20">
          {sorted.map((event) => {
            const left = Math.min(100, Math.max(0, ((time(event.at) - start) / span) * 100))
            return (
              <span key={event.id} title={`${laneMeta[event.kind].label}: ${event.title}`}
                className={cn('absolute bottom-1 h-8 w-1.5 -translate-x-1/2 rounded-full',
                  event.kind === 'needs' ? 'bg-warning' : event.kind === 'failed' ? 'bg-destructive' : 'bg-success')}
                style={{ left: `${left}%` }} />
            )
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {(['needs', 'failed', 'done'] as const).map((kind) => {
            const lane = sorted.filter((event) => event.kind === kind)
            const meta = laneMeta[kind]
            return (
              <section key={kind} aria-label={`${meta.label}, ${lane.length}`} className="space-y-1.5">
                <h3 className="flex items-center justify-between text-[11px] font-medium text-foreground">
                  <span>{meta.label}</span>
                  <AffectToneBadge tone={meta.tone}>{lane.length}</AffectToneBadge>
                </h3>
                {lane.length ? lane.slice(-limit).map((event) => {
                  const isActed = acted[event.id]
                  const isUndone = undone[event.id]
                  return (
                    <div key={event.id} className="space-y-1 rounded-md border border-border bg-card p-2 shadow-sm">
                      <p className="flex items-center gap-1.5">
                        {event.logo}
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{event.title}</span>
                        {event.count !== undefined ? <span className="text-[10px] text-muted-foreground">×{event.count}</span> : null}
                      </p>
                      {event.detail ? <p className="truncate text-[10px] text-muted-foreground">{event.detail}</p> : null}
                      <p className="flex items-center justify-between gap-1">
                        <span className={cn('text-[10px]', isActed && !isUndone ? 'text-success-subtle-foreground' : 'text-muted-foreground')}>
                          {isActed && !isUndone ? meta.doneLabel : new Date(time(event.at)).toLocaleTimeString()}
                        </span>
                        <span className="flex gap-1">
                          {!isActed ? (
                            <>
                              <button type="button" aria-label={`Review: ${event.title}`} onClick={() => void run(event, 'review')}
                                className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Review</button>
                              <button type="button" aria-label={`${event.action ?? meta.action}: ${event.title}`} disabled={busy === event.id}
                                onClick={() => void run(event, 'primary')}
                                className="rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground disabled:opacity-50">
                                {busy === event.id ? '…' : event.action ?? meta.action}
                              </button>
                            </>
                          ) : onUndo || onRedo ? (
                            isUndone ? (
                              <button type="button" aria-label={`Redo: ${event.title}`}
                                onClick={() => { if (onRedo) onRedo(event); setUndone((s) => ({ ...s, [event.id]: false })); setAnnounce(`Redid: ${event.title}`) }}
                                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-foreground hover:bg-muted"><RotateCcw aria-hidden="true" className="size-3" /> Redo</button>
                            ) : (
                              <button type="button" aria-label={`Undo: ${event.title}`}
                                onClick={() => { if (onUndo) onUndo(event); setUndone((s) => ({ ...s, [event.id]: true })); setAnnounce(`Undid: ${event.title}`) }}
                                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"><Undo2 aria-hidden="true" className="size-3" /> Undo</button>
                            )
                          ) : null}
                        </span>
                      </p>
                    </div>
                  )
                }) : <AffectEmpty>No {meta.label.toLowerCase()} events.</AffectEmpty>}
              </section>
            )
          })}
        </div>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </AffectSurface>
  )
}
