import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatDuration } from '../shared/format'
import type { AffectTone } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export type LaneStatus = 'done' | 'running' | 'waiting' | 'failed'
export interface LaneAgent { id: string; name: string; model?: string; avatar?: ReactNode }
export interface LaneTask {
  id: string
  agentId: string
  title: string
  status: LaneStatus
  start: number
  end?: number
  handoffTo?: string
  ask?: string
  summary?: string
  tools?: string[]
}
export interface AgentLanesProps {
  agents: LaneAgent[]
  tasks: LaneTask[]
  span?: number
  now?: number
  onApprove?: (task: LaneTask) => void
  onReject?: (task: LaneTask) => void
  onOpen?: (task: LaneTask) => void
  title?: string
  className?: string
}

const tone: Record<LaneStatus, AffectTone> = {
  done: 'success', running: 'info', waiting: 'warning', failed: 'danger'
}
const label: Record<LaneStatus, string> = {
  done: 'Done', running: 'Running', waiting: 'Needs you', failed: 'Failed'
}
const blockClass: Record<LaneStatus, string> = {
  done: 'bg-success-subtle text-success-subtle-foreground border-success',
  running: 'bg-info-subtle text-info border-info',
  waiting: 'bg-warning-subtle text-warning-subtle-foreground border-warning border-dashed',
  failed: 'bg-destructive/10 text-destructive border-destructive'
}

/** A live timeline with one lane per agent and decisions on the waiting blocks. */
export function AgentLanes({
  agents, tasks, span = 30 * 60_000, now = Date.now(), onApprove, onReject, onOpen,
  title = 'Agents', className
}: AgentLanesProps) {
  const [openBlock, setOpenBlock] = useState<string | null>(null)
  const [resolved, setResolved] = useState<Record<string, LaneStatus>>({})
  const from = now - span
  const percent = (time: number) => Math.min(100, Math.max(0, ((time - from) / span) * 100))
  const statusOf = (task: LaneTask) => resolved[task.id] ?? task.status
  const decide = (task: LaneTask, type: 'approve' | 'reject') => {
    if (type === 'approve') { onApprove?.(task); setResolved((s) => ({ ...s, [task.id]: 'running' })) }
    else { onReject?.(task); setResolved((s) => ({ ...s, [task.id]: 'failed' })) }
    setOpenBlock(null)
  }
  const needsYou = tasks.filter((task) => statusOf(task) === 'waiting').length
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-lanes">
      <div className="space-y-3 p-3">
        <AffectHeader title={title} description={<span aria-live="polite">{needsYou} need you</span>} />
        <div className="space-y-1">
          <div className="flex items-center gap-2 pl-24 text-[10px] tabular-nums text-muted-foreground">
            {ticks.map((tick) => (
              <span key={tick} className="flex-1 text-right">{formatDuration(span * (1 - tick))} ago</span>
            ))}
          </div>
          {agents.map((agent) => {
            const laneTasks = tasks.filter((task) => task.agentId === agent.id)
            return (
              <div key={agent.id} role="list" aria-label={`${agent.name} lane`} className="flex items-center gap-2">
                <div className="flex w-24 shrink-0 items-center gap-1.5">
                  {agent.avatar ?? <span aria-hidden="true" className="size-5 shrink-0 rounded bg-muted" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-foreground">{agent.name}</span>
                    {agent.model ? <span className="block truncate text-[10px] text-muted-foreground">{agent.model}</span> : null}
                  </span>
                </div>
                <div className="relative h-8 flex-1 rounded-md border border-border bg-muted/20">
                  <span aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-foreground/40" />
                  {laneTasks.map((task) => {
                    const status = statusOf(task)
                    const left = percent(task.start)
                    const width = Math.max(2, percent(task.end ?? now) - left)
                    const isOpen = openBlock === task.id
                    return (
                      <div key={task.id} className="absolute inset-y-1" style={{ left: `${left}%`, width: `${width}%` }}>
                        <button type="button" aria-expanded={isOpen}
                          aria-label={`${agent.name}: ${task.title}, ${label[status]}, started ${formatDuration(now - task.start)} ago`}
                          onClick={() => setOpenBlock(isOpen ? null : task.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpenBlock(isOpen ? null : task.id) }
                            if (event.key === 'Escape') setOpenBlock(null)
                          }}
                          className={cn('h-full w-full truncate rounded border px-1.5 text-left text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', blockClass[status])}>
                          {task.title}
                        </button>
                        {isOpen ? (
                          <div role="dialog" aria-label={`${task.title} details`}
                            className="absolute bottom-full left-0 z-10 mb-1 w-52 space-y-1 rounded-md border border-border bg-card p-2 shadow-md"
                            onKeyDown={(event) => { if (event.key === 'Escape') setOpenBlock(null) }}>
                            <span className="flex items-center justify-between gap-1">
                              <span className="truncate text-[11px] font-medium text-foreground">{task.title}</span>
                              <AffectToneBadge tone={tone[status]}>{label[status]}</AffectToneBadge>
                            </span>
                            {task.summary ? <span className="block text-[10px] text-muted-foreground">{task.summary}</span> : null}
                            {task.tools?.length ? <span className="block text-[10px] text-muted-foreground">{task.tools.join(' · ')}</span> : null}
                            {task.handoffTo ? <span className="block text-[10px] text-muted-foreground">Handed to {task.handoffTo}</span> : null}
                            {status === 'waiting' ? (
                              <span className="block text-[10px] text-warning-subtle-foreground">{task.ask ?? 'Needs your decision'}</span>
                            ) : null}
                            <span className="flex gap-1">
                              {status === 'waiting' ? (
                                <>
                                  <button type="button" onClick={() => decide(task, 'approve')} className="rounded bg-success-subtle px-1.5 py-0.5 text-[10px] text-success-subtle-foreground">Approve</button>
                                  <button type="button" onClick={() => decide(task, 'reject')} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Reject</button>
                                </>
                              ) : null}
                              {onOpen ? <button type="button" onClick={() => onOpen(task)} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground">Open</button> : null}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        {agents.length === 0 ? <AffectEmpty>No agents to show.</AffectEmpty> : null}
      </div>
    </AffectSurface>
  )
}
