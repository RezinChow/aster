import { Check, ChevronDown, Clock3, CircleSlash, CircleX, LoaderCircle, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatDuration } from '../shared/format'
import { AffectEmpty, AffectHeader, AffectSurface } from '../shared/ui'

export type TrailState = 'done' | 'running' | 'pending' | 'waiting' | 'failed' | 'declined'
export interface TrailSubstep { id?: string; title: string; state?: TrailState; detail?: string }
export interface TrailStep {
  id: string
  title: string
  state: TrailState
  duration?: number | string
  status?: string
  startedAt?: number
  gate?: boolean
  substeps?: TrailSubstep[]
}
export interface AgentTrailLabels {
  running: string; approval: string; waiting: string; failed: string; declined: string
  done: string; pending: string; empty: string; untitled: string; approve: string; decline: string
}
export interface AgentTrailProps {
  steps: TrailStep[]
  title?: string
  agent?: { name: string; logo?: ReactNode }
  expanded?: string[]
  onExpandedChange?: (ids: string[]) => void
  onApprove?: (step: TrailStep) => void
  onDecline?: (step: TrailStep) => void
  labels?: Partial<AgentTrailLabels>
  className?: string
}

const defaultLabels: AgentTrailLabels = {
  running: 'Running', approval: 'Approval', waiting: 'Needs you', failed: 'Failed', declined: 'Declined',
  done: 'Done', pending: 'Pending', empty: 'No steps yet', untitled: 'Untitled step', approve: 'Approve', decline: 'Decline'
}
const mark: Record<TrailState, ReactNode> = {
  done: <Check className="size-3" />, running: <LoaderCircle className="size-3 animate-spin" />,
  pending: <span className="size-1.5 rounded-full bg-muted-foreground" />,
  waiting: <ShieldAlert className="size-3" />, failed: <CircleX className="size-3" />, declined: <CircleSlash className="size-3" />
}
const markClass: Record<TrailState, string> = {
  done: 'bg-success-subtle text-success-subtle-foreground',
  running: 'bg-info-subtle text-info',
  pending: 'bg-muted text-muted-foreground',
  waiting: 'bg-warning-subtle text-warning-subtle-foreground',
  failed: 'bg-destructive/10 text-destructive',
  declined: 'bg-muted text-muted-foreground'
}

/** The quiet trail of steps an agent walks through, with gates and live timers. */
export function AgentTrail({
  steps, title, agent, expanded, onExpandedChange, onApprove, onDecline, labels, className
}: AgentTrailProps) {
  const words = { ...defaultLabels, ...labels }
  const [localExpanded, setLocalExpanded] = useState<string[]>(() => steps.filter((step) => step.state === 'running').map((step) => step.id))
  const [answering, setAnswering] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const open = expanded ?? localExpanded
  useEffect(() => {
    if (!steps.some((step) => step.state === 'running' && step.startedAt)) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [steps])
  const toggle = (id: string) => {
    const next = open.includes(id) ? open.filter((value) => value !== id) : [...open, id]
    if (expanded === undefined) setLocalExpanded(next)
    onExpandedChange?.(next)
  }
  const done = steps.filter((step) => step.state === 'done').length
  const answer = (step: TrailStep, approve: boolean) => {
    if (approve) onApprove?.(step)
    else onDecline?.(step)
    setAnswering(null)
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-trail">
      <div className="space-y-1 p-3">
        {title || agent ? (
          <AffectHeader title={title} description={agent ? agent.name : undefined}
            actions={<span className="text-[11px] tabular-nums text-muted-foreground">{done}/{steps.length}</span>} />
        ) : null}
        {steps.length ? (
          <ol role="list" aria-label={title ?? words.untitled} className="space-y-0.5">
            {steps.map((step) => {
              const state = step.state
              const label = state === 'done' ? words.done : state === 'running' ? words.running : state === 'waiting' ? words.waiting : state === 'failed' ? words.failed : state === 'declined' ? words.declined : step.gate ? words.approval : words.pending
              const isOpen = open.includes(step.id)
              const live = state === 'running' && step.startedAt ? formatDuration(now - step.startedAt) : null
              const duration = live ?? (typeof step.duration === 'number' ? formatDuration(step.duration) : step.duration)
              return (
                <li key={step.id}>
                  <div className="flex min-h-8 items-center gap-2 rounded-md px-1.5 py-1">
                    <span aria-hidden="true" className={cn('flex size-4 shrink-0 items-center justify-center rounded-full', markClass[state])}>{mark[state]}</span>
                    {step.substeps?.length ? (
                      <button type="button" aria-expanded={isOpen} aria-label={`${step.title || words.untitled}, ${label}`}
                        onClick={() => toggle(step.id)}
                        className="flex min-w-0 flex-1 items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <ChevronDown aria-hidden="true" className={cn('size-3 shrink-0 text-muted-foreground transition-transform', !isOpen && '-rotate-90')} />
                        <span className={cn('min-w-0 flex-1 truncate text-xs', state === 'declined' ? 'text-muted-foreground line-through' : 'text-foreground')}>
                          {step.title || words.untitled}
                        </span>
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground" aria-current={state === 'running' ? 'step' : undefined}>
                        {step.title || words.untitled}
                      </span>
                    )}
                    {step.status ? <span className="shrink-0 truncate text-[10px] text-muted-foreground">{step.status}</span> : null}
                    {duration ? <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{duration}</span> : null}
                    <span className={cn('shrink-0 text-[10px]', state === 'failed' ? 'text-destructive' : state === 'waiting' ? 'text-warning-subtle-foreground' : 'text-muted-foreground')}>{label}</span>
                    {state === 'waiting' && (onApprove || onDecline) ? (
                      <button type="button" aria-label={`Answer ${step.title}`} onClick={() => setAnswering(answering === step.id ? null : step.id)}
                        className="shrink-0 rounded border border-warning px-1.5 py-0.5 text-[10px] text-warning-subtle-foreground">{words.waiting}</button>
                    ) : null}
                    {state === 'running' && step.startedAt ? <Clock3 aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" /> : null}
                  </div>
                  {isOpen && step.substeps?.length ? (
                    <ul role="list" className="ml-6 space-y-0.5 border-l border-border pl-2">
                      {step.substeps.map((substep, index) => (
                        <li key={substep.id ?? `${substep.title}-${index}`} aria-current={substep.state === 'running' ? 'step' : undefined}
                          className="flex min-h-6 items-center gap-2 px-1 text-[11px]">
                          <span className={cn('size-1.5 shrink-0 rounded-full', substep.state === 'running' ? 'bg-info' : substep.state === 'failed' ? 'bg-destructive' : 'bg-success')} />
                          <span className="min-w-0 flex-1 truncate text-foreground">{substep.title}</span>
                          {substep.detail ? <span className="shrink-0 truncate text-[10px] text-muted-foreground">{substep.detail}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {answering === step.id ? (
                    <div role="group" aria-label={`Answer ${step.title}`} className="ml-6 flex gap-1 rounded-md border border-warning bg-warning-subtle p-2">
                      {onApprove ? (
                        <button type="button" onClick={() => answer(step, true)} className="rounded bg-success-subtle px-2 py-1 text-[10px] text-success-subtle-foreground">{words.approve}</button>
                      ) : null}
                      {onDecline ? (
                        <button type="button" onClick={() => answer(step, false)} className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">{words.decline}</button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : <AffectEmpty>{words.empty}</AffectEmpty>}
        <p className="sr-only" aria-live="polite">{steps.filter((step) => step.state === 'waiting').length} steps need you</p>
      </div>
    </AffectSurface>
  )
}
