import { CalendarClock, GripVertical, Plus } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface } from '../shared'

export interface ScheduledTask {
  id: string
  title: string
  usage: number
  agent?: string
  detail?: string
  logo?: ReactNode
  at?: { day: number; session: number }
}
export interface ScheduledPart {
  task: ScheduledTask
  day: number
  session: number
  usage: number
  part: number
  parts: number
}
export interface ScheduledRunsProps {
  tasks: ScheduledTask[]
  days?: (string | { name: string; date?: string })[]
  sessions?: string[]
  now?: { day: number; session: number }
  limit?: number
  minPiece?: number
  agents?: { name: string; logo?: ReactNode }[]
  defaultMode?: 'auto' | 'manual'
  autoRun?: boolean | number
  loop?: boolean
  title?: string
  note?: string
  onScheduled?: (parts: ScheduledPart[]) => void
  onPlace?: (task: ScheduledTask, parts: ScheduledPart[]) => void
  onMove?: (part: ScheduledPart, to: { day: number; session: number }) => void
  className?: string
}

const dayName = (day: string | { name: string; date?: string }) => (typeof day === 'string' ? day : day.name)

function schedule(tasks: ScheduledTask[], dayCount: number, sessionCount: number, limit: number, now: { day: number; session: number }): ScheduledPart[] {
  const parts: ScheduledPart[] = []
  let cursor = now.day * sessionCount + now.session
  tasks.filter((task) => task.at).forEach((task) => {
    parts.push({ task, day: task.at!.day, session: task.at!.session, usage: task.usage, part: 1, parts: 1 })
  })
  tasks.filter((task) => !task.at).forEach((task) => {
    const total = Math.max(1, Math.ceil(task.usage / limit))
    let remaining = task.usage
    for (let part = 1; part <= total; part++) {
      const usage = Math.min(remaining, limit)
      remaining -= usage
      while (cursor < (dayCount + 2) * sessionCount && parts.filter((item) => item.day === Math.floor(cursor / sessionCount) && item.session === cursor % sessionCount).length >= 2) cursor++
      parts.push({ task, day: Math.floor(cursor / sessionCount), session: cursor % sessionCount, usage, part, parts: total })
      cursor++
    }
  })
  return parts
}

/** A week of sessions with queued tasks sorted in around a usage limit. */
export function ScheduledRuns({
  tasks,
  days = ['Mon', 'Tue', 'Wed'],
  sessions = ['07:00', '12:00', '17:00'],
  now = { day: 0, session: 0 },
  limit = 100,
  agents = [],
  defaultMode = 'auto',
  title = 'This week',
  note,
  onScheduled,
  onPlace,
  onMove,
  className
}: ScheduledRunsProps) {
  const [mode, setMode] = useState<'auto' | 'manual'>(defaultMode)
  const [placed, setPlaced] = useState<ScheduledPart[]>(() => (defaultMode === 'auto' ? schedule(tasks, days.length, sessions.length, limit, now) : []))
  const [picked, setPicked] = useState<string | null>(null)
  const [target, setTarget] = useState<{ day: number; session: number }>(now)
  const [details, setDetails] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const stack = tasks.filter((task) => !placed.some((part) => part.task.id === task.id))
  const currentPlaced = mode === 'auto' ? schedule(tasks, days.length, sessions.length, limit, now) : placed

  const place = (taskId: string, day: number, session: number) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const total = Math.max(1, Math.ceil(task.usage / limit))
    const pieces: ScheduledPart[] = Array.from({ length: total }, (_, index) => ({ task, day, session, usage: Math.min(task.usage, limit), part: index + 1, parts: total }))
    setPlaced((current) => [...current, ...pieces]); onPlace?.(task, pieces)
    setAnnounce(`${task.title} placed on ${dayName(days[day] ?? 'Day')} ${sessions[session] ?? ''}`)
    setPicked(null)
  }
  const confirmAuto = () => { const parts = schedule(tasks, days.length, sessions.length, limit, now); setPlaced(parts); onScheduled?.(parts); setAnnounce('Week scheduled') }
  const onModeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setMode((current) => (current === 'auto' ? 'manual' : 'auto')) }
  }
  const onCardKeyDown = (event: KeyboardEvent<HTMLButtonElement>, part: ScheduledPart | null) => {
    if (event.key === 'Escape') { setPicked(null); setDetails(null); setAnnounce('Put back'); return }
    if (!picked || !part) return
    if (event.key === 'ArrowRight') { event.preventDefault(); setTarget((current) => ({ ...current, day: Math.min(days.length - 1, current.day + 1) })) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); setTarget((current) => ({ ...current, day: Math.max(0, current.day - 1) })) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setTarget((current) => ({ ...current, session: Math.min(sessions.length - 1, current.session + 1) })) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setTarget((current) => ({ ...current, session: Math.max(0, current.session - 1) })) }
    else if (event.key === 'Enter') { event.preventDefault(); onMove?.(part, target); setPicked(null); setAnnounce(`Moved to ${dayName(days[target.day] ?? 'Day')} ${sessions[target.session] ?? ''}`) }
  }

  return (
    <div data-slot="scheduled-runs" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={title}
          description={note}
          actions={
            <div role="radiogroup" aria-label="Scheduling mode" onKeyDown={onModeKeyDown} className="flex rounded-md border border-border p-0.5">
              {(['auto', 'manual'] as const).map((option) => <button key={option} type="button" role="radio" aria-checked={mode === option} tabIndex={mode === option ? 0 : -1} onClick={() => setMode(option)} className={cn('rounded px-2 py-0.5 text-[11px]', mode === option ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>{option === 'auto' ? 'Auto' : 'Manual'}</button>)}
            </div>
          }
        />
        {agents.length ? <div className="mt-2 flex flex-wrap items-center gap-1">{agents.map((agent) => <span key={agent.name} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{agent.logo}{agent.name}</span>)}</div> : null}

        <div className="mt-3 space-y-2">
          <section aria-label="Task stack" className="rounded-lg border border-dashed border-border p-2">
            <h3 className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"><CalendarClock aria-hidden="true" className="size-3" />Stack · {stack.length}</h3>
            <div className="flex flex-wrap gap-1.5">
              {stack.map((task) => (
                <button key={task.id} type="button" aria-pressed={picked === task.id} aria-label={`${task.title}. ${task.usage}% of a session.`} onKeyDown={(event) => onCardKeyDown(event, null)} onClick={() => { setPicked((current) => (current === task.id ? null : task.id)); setTarget(now); setAnnounce(`${task.title} picked up`) }} className={cn('flex max-w-40 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted/60', picked === task.id && 'border-primary bg-accent')}>
                  <GripVertical aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{task.title}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{task.usage}%</span>
                </button>
              ))}
              {!stack.length ? <span className="text-[10px] text-muted-foreground">All tasks scheduled.</span> : null}
            </div>
            {mode === 'auto' ? <button type="button" onClick={confirmAuto} className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] text-primary-foreground"><Plus aria-hidden="true" className="size-3" />Schedule stack</button> : null}
          </section>

          <div role="grid" aria-label="Week of sessions" className="grid gap-1.5" style={{ gridTemplateColumns: `40px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div />
            {days.map((day) => <div key={dayName(day)} className="truncate text-center text-[10px] font-medium text-muted-foreground">{dayName(day)}</div>)}
            {sessions.map((time, sessionIndex) => (
              <div key={time} role="row" className="contents">
                <div className="flex items-center text-[9px] tabular-nums text-muted-foreground">{time}</div>
                {days.map((_day, dayIndex) => {
                  const cellParts = currentPlaced.filter((part) => part.day === dayIndex && part.session === sessionIndex)
                  const isTarget = target.day === dayIndex && target.session === sessionIndex && picked !== null
                  const past = dayIndex < now.day || (dayIndex === now.day && sessionIndex < now.session)
                  return (
                    <div key={`${dayIndex}-${sessionIndex}`} role="gridcell" onClick={() => { if (picked) place(picked, dayIndex, sessionIndex) }} className={cn('min-h-20 space-y-1 rounded-md border border-border p-1', past && 'opacity-60', isTarget && 'ring-1 ring-primary')}>
                      {cellParts.map((part) => {
                        const key = `${part.task.id}-${part.part}-${part.day}-${part.session}`
                        return (
                          <button key={key} type="button" onKeyDown={(event) => onCardKeyDown(event, part)} onClick={(event) => { event.stopPropagation(); setDetails((current) => (current === key ? null : key)); setPicked(part.task.id); setTarget({ day: part.day, session: part.session }) }} aria-label={`${part.task.title}, part ${part.part} of ${part.parts}, ${part.usage}% used. ${dayName(days[dayIndex] ?? 'Day')} ${time}.`} className={cn('w-full truncate rounded border border-border px-1.5 py-1 text-left text-[10px] text-foreground hover:bg-accent', details === key && 'bg-accent')}>
                            {part.task.title}{part.parts > 1 ? ` · ${part.part}/${part.parts}` : ''}
                          </button>
                        )
                      })}
                      {!cellParts.length ? <span className="block text-center text-[9px] text-muted-foreground">+</span> : null}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {details ? <p className="text-[10px] text-muted-foreground">{details.split('-').slice(0, -3).join('-')} · scheduled card selected. Use arrow keys to move it.</p> : null}
        </div>
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
