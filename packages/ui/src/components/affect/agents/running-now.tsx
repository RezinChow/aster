import { ChevronDown, ExternalLink, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectIconButton, AffectMeter, AffectToneBadge } from '../shared'

export type RunningState = 'running' | 'paused' | 'needs-you' | 'done'
export interface RunningTask { id: string; title: string; step: string; done: number; total: number; state: RunningState }
export interface RunningNowLabels {
  title: string
  running: string
  needsYou: string
  needsYouOne: string
  needsYouBadge: string
  paused: string
  pausedCount: (n: number) => string
  done: string
  pause: string
  resume: string
  open: string
  openAll: string
  empty: string
  idle: string
}
export interface RunningNowProps {
  tasks: RunningTask[]
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onOpen?: (id: string) => void
  onOpenAll?: () => void
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'end'
  labels?: Partial<RunningNowLabels>
  className?: string
}

const defaultLabels: RunningNowLabels = {
  title: 'Background tasks',
  running: 'running',
  needsYou: 'need you',
  needsYouOne: '1 needs you',
  needsYouBadge: 'Needs you',
  paused: 'paused',
  pausedCount: (n) => `${n} paused`,
  done: 'done',
  pause: 'Pause',
  resume: 'Resume',
  open: 'Open',
  openAll: 'Open Tasks',
  empty: 'No tasks in the list.',
  idle: 'No tasks running'
}

/** A header pill summarising background agents, opening into their tasks. */
export function RunningNow({
  tasks,
  onPause,
  onResume,
  onOpen,
  onOpenAll,
  defaultOpen = false,
  open,
  onOpenChange,
  align = 'end',
  labels,
  className
}: RunningNowProps) {
  const [openState, setOpenState] = useState(defaultOpen)
  const [focused, setFocused] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const text: RunningNowLabels = { ...defaultLabels, ...labels }
  const isOpen = open ?? openState
  const running = tasks.filter((task) => task.state === 'running').length
  const needs = tasks.filter((task) => task.state === 'needs-you').length
  const paused = tasks.filter((task) => task.state === 'paused').length
  const done = tasks.filter((task) => task.state === 'done').length
  const needsLabel = needs === 1 ? text.needsYouOne : `${needs} ${text.needsYou}`
  const summary = !tasks.length ? text.idle : paused && !running && !needs ? `${paused} ${text.pausedCount(paused)}` : [running ? `${running} ${text.running}` : null, needs ? needsLabel : null].filter(Boolean).join(' · ')

  const setOpenNow = (next: boolean) => { setOpenState(next); onOpenChange?.(next) }
  useEffect(() => {
    if (!isOpen) return
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpenNow(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const focusRow = (index: number) => {
    const next = Math.min(tasks.length - 1, Math.max(0, index))
    setFocused(next); rowRefs.current[tasks[next]?.id]?.focus()
  }
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') { event.preventDefault(); setOpenNow(true); focusRow(0) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setOpenNow(true); focusRow(tasks.length - 1) }
  }
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); focusRow(focused + 1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusRow(focused - 1) }
    else if (event.key === 'Home') { event.preventDefault(); focusRow(0) }
    else if (event.key === 'End') { event.preventDefault(); focusRow(tasks.length - 1) }
    else if (event.key === 'Escape') { event.preventDefault(); setOpenNow(false); triggerRef.current?.focus() }
  }

  return (
    <div ref={rootRef} data-slot="running-now" className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${text.title}: ${summary}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="running-now-list"
        onClick={() => setOpenNow(!isOpen)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs text-foreground shadow-sm hover:bg-muted/60"
      >
        {running ? <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-info" /> : null}
        {tasks.length ? <span className="tabular-nums">{summary}</span> : <span>{text.idle}</span>}
        <ChevronDown aria-hidden="true" className={cn('size-3 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen ? (
        <div id="running-now-list" role="dialog" aria-label={text.title} onKeyDown={onListKeyDown} className={cn('absolute top-full z-20 mt-2 w-[348px] max-w-[calc(100vw-32px)] rounded-lg border border-border bg-card p-1.5 shadow-lg', align === 'end' ? 'right-0' : 'left-0')}>
          {tasks.length ? (
            <ul role="list" className="max-h-[286px] space-y-0.5 overflow-y-auto">
              {tasks.map((task, index) => (
                <li key={task.id} className="flex h-[52px] items-center gap-2 rounded-md px-1.5 hover:bg-muted/60">
                  <button
                    ref={(el) => { rowRefs.current[task.id] = el }}
                    type="button"
                    tabIndex={focused === index ? 0 : -1}
                    onFocus={() => setFocused(index)}
                    onClick={() => onOpen?.(task.id)}
                    aria-label={`${task.title} — ${task.state === 'needs-you' ? text.needsYouBadge : task.state}. ${task.step}. ${task.done} of ${task.total} steps.`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <span className="w-6 shrink-0"><AffectMeter value={task.done} max={task.total} tone={task.state === 'done' ? 'success' : task.state === 'paused' ? 'warning' : 'info'} label={`${task.title} progress`} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-foreground">{task.title}</span><span className="block truncate text-[10px] text-muted-foreground">{task.step}</span></span>
                    {task.state === 'needs-you' ? <AffectToneBadge tone="warning">{text.needsYouBadge}</AffectToneBadge> : <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{task.done}/{task.total}</span>}
                  </button>
                  {task.state === 'running' ? <AffectIconButton label={`${text.pause} ${task.title}`} onClick={() => onPause?.(task.id)}><Pause aria-hidden="true" className="size-3" /></AffectIconButton> : task.state === 'paused' ? <AffectIconButton label={`${text.resume} ${task.title}`} onClick={() => onResume?.(task.id)}><Play aria-hidden="true" className="size-3" /></AffectIconButton> : task.state === 'needs-you' ? <button type="button" onClick={() => onOpen?.(task.id)} className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-accent">{text.open}</button> : null}
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-center text-xs text-muted-foreground">{text.empty}</p>}
          {done ? <p className="border-t border-border px-2 py-1.5 text-[10px] text-muted-foreground">{done} {text.done}</p> : null}
          {onOpenAll ? <button type="button" onClick={() => { onOpenAll(); setOpenNow(false) }} className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border-t border-border py-2 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"><ExternalLink aria-hidden="true" className="size-3" />{text.openAll}</button> : null}
        </div>
      ) : null}
    </div>
  )
}
