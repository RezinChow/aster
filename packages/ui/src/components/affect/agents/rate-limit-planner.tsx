import { AlertTriangle, Plus, Settings2, Trash2 } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge } from '../shared'

export interface PlannedRun {
  id: string
  name: string
  at: number
  peak: number
  rise?: number
  halfLife?: number
  days?: 'daily' | 'weekdays' | 'weekend'
  color?: string
}
export interface RateLimitPlannerProps {
  runs?: PlannedRun[]
  defaultRuns?: PlannedRun[]
  onRunsChange?: (runs: PlannedRun[]) => void
  limit: number
  buffer?: number
  startHour?: number
  checkpoint?: { at: number; label: string }
  now?: number
  actual?: number[]
  today?: 'weekdays' | 'weekend'
  selected?: string
  onSelectedChange?: (id: string) => void
  title?: string
  className?: string
}

const clampMinute = (value: number) => Math.min(1439, Math.max(0, Math.round(value)))
const loadAt = (run: PlannedRun, minute: number): number => {
  const rise = Math.max(1, run.rise ?? 30)
  const tail = Math.max(1, run.halfLife ?? 45)
  const center = run.at + rise
  const distance = Math.abs(minute - center)
  if (distance >= rise + tail) return 0
  return Math.max(0, run.peak * (1 - distance / (rise + tail)))
}

/** A day of agent runs planned against an API rate limit. */
export function RateLimitPlanner({
  runs,
  defaultRuns = [],
  onRunsChange,
  limit,
  buffer = 0.8,
  startHour = 6,
  checkpoint,
  now,
  today = 'weekdays',
  selected,
  onSelectedChange,
  title = 'Rate limit',
  className
}: RateLimitPlannerProps) {
  const [localRuns, setLocalRuns] = useState<PlannedRun[]>(defaultRuns)
  const [selectedState, setSelectedState] = useState<string>('')
  const [editing, setEditing] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const trackRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const dragging = useRef<string | null>(null)
  const current = runs ?? localRuns
  const active = current.filter((run) => !run.days || run.days === 'daily' || run.days === today)
  const currentSelected = selected !== undefined ? selected : (selectedState || active[0]?.id || '')
  const ceiling = limit * buffer
  const points = Array.from({ length: 97 }, (_, index) => startHour * 60 + index * 15)
  const loads = points.map((minute) => active.reduce((sum, run) => sum + loadAt(run, minute), 0))
  const peak = Math.max(1, ...loads)
  const overflow = loads.some((load) => load > limit)
  const close = peak > ceiling

  const commit = (next: PlannedRun[], message: string) => { if (!runs) setLocalRuns(next); onRunsChange?.(next); setAnnounce(message) }
  const setAt = (id: string, at: number) => commit(current.map((run) => (run.id === id ? { ...run, at: clampMinute(at) } : run)), `${id} moved to ${Math.floor(at / 60)}:${String(at % 60).padStart(2, '0')}`)
  const remove = (id: string) => { commit(current.filter((run) => run.id !== id), `${id} removed`); setEditing(null) }
  const pick = (id: string) => { setSelectedState(id); onSelectedChange?.(id) }
  const spread = () => {
    const earliest = now ?? startHour * 60
    const sorted = [...active].sort((a, b) => a.at - b.at)
    const step = Math.floor((1439 - earliest) / Math.max(1, sorted.length + 1))
    const moved = new Map(sorted.map((run, index) => [run.id, clampMinute(earliest + step * (index + 1))]))
    commit(current.map((run) => (moved.has(run.id) ? { ...run, at: moved.get(run.id)! } : run)), 'Runs spread out to lower the peak')
  }

  const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, run: PlannedRun) => {
    const hour = event.shiftKey ? 60 : 15
    if (event.key === 'ArrowLeft') { event.preventDefault(); setAt(run.id, run.at - hour) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); setAt(run.id, run.at + hour) }
    else if (event.key === 'Home') { event.preventDefault(); setAt(run.id, now ?? startHour * 60) }
    else if (event.key === 'End') { event.preventDefault(); setAt(run.id, 1439) }
    else if (event.key === 'Delete') { event.preventDefault(); remove(run.id) }
    else if (event.key === 'Enter') { event.preventDefault(); setEditing((id) => (id === run.id ? null : run.id)); pick(run.id) }
    else if (event.key === 'Escape') setEditing(null)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>, run: PlannedRun) => {
    if (dragging.current !== run.id) return
    const rect = trackRefs.current[run.id]?.getBoundingClientRect()
    if (!rect) return
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    setAt(run.id, startHour * 60 + ratio * 1440)
  }

  return (
    <div data-slot="rate-limit-planner" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={title}
          description={`${limit.toLocaleString()} tokens/min`}
          actions={
            <div className="flex items-center gap-1">
              <button type="button" onClick={spread} className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent">Spread out</button>
              <button type="button" onClick={() => { const run: PlannedRun = { id: `run-${Date.now()}`, name: 'New run', at: now ?? startHour * 60, peak: Math.round(limit / 2) }; commit([...current, run], 'Run added'); setEditing(run.id); pick(run.id) }} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground"><Plus aria-hidden="true" className="size-3" />Add run</button>
            </div>
          }
        />
        <div className="mt-2 flex items-center gap-2">
          <AffectToneBadge tone={overflow ? 'danger' : close ? 'warning' : 'success'}>{overflow ? 'Over limit' : close ? 'Close to limit' : 'Within limit'}</AffectToneBadge>
          <span className="text-[10px] tabular-nums text-muted-foreground">Peak {Math.round(peak).toLocaleString()}/min</span>
          {checkpoint ? <span className="text-[10px] text-muted-foreground">{checkpoint.label}: {Math.round(active.reduce((sum, run) => sum + loadAt(run, checkpoint.at), 0)).toLocaleString()}/min</span> : null}
        </div>

        <div aria-hidden="true" className="relative mt-3 h-28 rounded-md border border-border bg-background">
          <div className="absolute inset-x-0 bottom-0 top-0 flex items-end gap-px px-1">
            {loads.map((load, index) => (
              <span key={index} className={cn('min-w-0 flex-1 rounded-t-sm', load > limit ? 'bg-destructive/70' : load > ceiling ? 'bg-warning' : 'bg-info')} style={{ height: `${Math.min(100, (load / Math.max(peak, limit)) * 100)}%` }} />
            ))}
          </div>
          <span aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-destructive" style={{ bottom: `${Math.min(100, (limit / Math.max(peak, limit)) * 100)}%` }} />
          {checkpoint ? <span aria-hidden="true" className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${((checkpoint.at - startHour * 60) / 1440) * 100}%` }} /> : null}
        </div>
        <div aria-hidden="true" className="mt-0.5 flex justify-between text-[10px] tabular-nums text-muted-foreground"><span>{String(startHour).padStart(2, '0')}:00</span><span>{String((startHour + 12) % 24).padStart(2, '0')}:00</span><span>{String((startHour + 24) % 24).padStart(2, '0')}:00</span></div>

        <ul role="list" className="mt-3 space-y-1.5">
          {current.map((run) => {
            const left = ((run.at - startHour * 60) / 1440) * 100
            const isSelected = currentSelected === run.id
            const past = now !== undefined && run.at < now
            return (
              <li key={run.id} className={cn('rounded-md border p-2', isSelected ? 'border-primary bg-accent' : 'border-border')}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{run.name}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{Math.floor(run.at / 60)}:{String(run.at % 60).padStart(2, '0')} · {run.peak.toLocaleString()}/min</span>
                  <button type="button" aria-label={`Settings for ${run.name}`} onClick={() => { setEditing((id) => (id === run.id ? null : run.id)); pick(run.id) }} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><Settings2 aria-hidden="true" className="size-3" /></button>
                  <button type="button" aria-label={`Remove ${run.name}`} onClick={() => remove(run.id)} className="rounded p-0.5 text-muted-foreground hover:text-destructive"><Trash2 aria-hidden="true" className="size-3" /></button>
                </div>
                <div
                  ref={(el) => { trackRefs.current[run.id] = el }}
                  role="slider"
                  tabIndex={0}
                  aria-label={`${run.name} start time`}
                  aria-valuemin={startHour * 60}
                  aria-valuemax={1439}
                  aria-valuenow={run.at}
                  aria-valuetext={`${Math.floor(run.at / 60)}:${String(run.at % 60).padStart(2, '0')}, peak ${run.peak} tokens per minute`}
                  aria-disabled={past || undefined}
                  onKeyDown={(event) => onRowKeyDown(event, run)}
                  onPointerDown={(event) => { dragging.current = run.id; pick(run.id); event.currentTarget.setPointerCapture(event.pointerId) }}
                  onPointerMove={(event) => onPointerMove(event, run)}
                  onPointerUp={() => { dragging.current = null }}
                  className={cn('relative mt-1.5 h-3 cursor-grab rounded bg-muted outline-none focus-visible:ring-1 focus-visible:ring-ring', past && 'opacity-60')}
                >
                  <span className="absolute inset-y-0 rounded bg-primary" style={{ left: `${Math.max(0, left)}%`, width: '6%' }} />
                </div>
                {editing === run.id ? (
                  <div role="dialog" aria-label={`${run.name} settings`} className="mt-2 grid gap-1.5 rounded-md border border-border bg-background p-2 text-[11px]">
                    <label className="flex items-center gap-2">Name<input aria-label="Run name" value={run.name} onChange={(event) => commit(current.map((item) => (item.id === run.id ? { ...item, name: event.target.value } : item)), 'Name edited')} className="min-w-0 flex-1 rounded border border-border px-1.5 py-1 text-foreground outline-none" /></label>
                    <label className="flex items-center gap-2">Peak<input aria-label="Peak tokens per minute" type="number" value={run.peak} onChange={(event) => commit(current.map((item) => (item.id === run.id ? { ...item, peak: Math.max(0, Number(event.target.value)) } : item)), 'Peak edited')} className="w-24 rounded border border-border px-1.5 py-1 text-foreground outline-none" /></label>
                    <button type="button" onClick={() => setEditing(null)} className="justify-self-end rounded bg-muted px-2 py-0.5 text-muted-foreground">Done</button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
        {overflow ? <p className="mt-2 flex items-center gap-1 text-[10px] text-destructive"><AlertTriangle aria-hidden="true" className="size-3" />Runs overlap the rate limit — move them or spread them out.</p> : null}
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
