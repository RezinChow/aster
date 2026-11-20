import { ChevronDown, LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import { formatDuration, formatRelativeTime } from '../shared/format'
import type { AffectTone } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectSurface, AffectToolbar, AffectToneBadge } from '../shared/ui'

export type InboxStatus = 'running' | 'waiting' | 'done' | 'failed'
export type AgentInboxView = 'board' | 'list'

export interface InboxStep { label: string; time?: string }
export interface AgentTask {
  id: string
  title: string
  agent: string
  status: InboxStatus
  description?: string
  startedAt?: number
  elapsed?: number
  tools?: number
  sources?: number
  steps?: InboxStep[]
}
export interface AgentInboxProps {
  tasks: AgentTask[]
  onApprove?: (task: AgentTask) => void
  onReject?: (task: AgentTask) => void
  onRetry?: (task: AgentTask) => void
  onOpen?: (task: AgentTask) => void
  title?: string
  action?: { label: string; onClick: () => void }
  view?: AgentInboxView
  defaultView?: AgentInboxView
  onViewChange?: (view: AgentInboxView) => void
  className?: string
}

const statusLabel: Record<InboxStatus, string> = {
  running: 'Running', waiting: 'Needs you', done: 'Done', failed: 'Failed'
}
const filterTone: Record<InboxStatus, AffectTone> = {
  running: 'info', waiting: 'warning', done: 'success', failed: 'danger'
}

/** A calm inbox of background tasks with unfoldable history and inline decisions. */
export function AgentInbox({
  tasks, onApprove, onReject, onRetry, onOpen, title = 'Agent inbox', action,
  view, defaultView = 'board', onViewChange, className
}: AgentInboxProps) {
  const [localStatus, setLocalStatus] = useState<Record<string, InboxStatus>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<InboxStatus | 'all'>('all')
  const [localView, setLocalView] = useState<AgentInboxView>(defaultView)
  const currentView = view ?? localView
  const statusOf = (task: AgentTask) => localStatus[task.id] ?? task.status
  const visible = tasks.filter((task) => filter === 'all' || statusOf(task) === filter)
  const counts: Record<InboxStatus, number> = {
    running: tasks.filter((task) => statusOf(task) === 'running').length,
    waiting: tasks.filter((task) => statusOf(task) === 'waiting').length,
    done: tasks.filter((task) => statusOf(task) === 'done').length,
    failed: tasks.filter((task) => statusOf(task) === 'failed').length
  }
  const chooseView = (next: AgentInboxView) => {
    if (view === undefined) setLocalView(next)
    onViewChange?.(next)
  }
  const decide = (task: AgentTask, type: 'approve' | 'reject' | 'retry') => {
    if (type === 'approve') {
      onApprove ? onApprove(task) : setLocalStatus((s) => ({ ...s, [task.id]: 'running' }))
    } else if (type === 'reject') {
      onReject ? onReject(task) : setLocalStatus((s) => ({ ...s, [task.id]: 'failed' }))
    } else {
      onRetry ? onRetry(task) : setLocalStatus((s) => ({ ...s, [task.id]: 'running' }))
    }
  }

  const card = (task: AgentTask) => {
    const status = statusOf(task)
    const isOpen = expanded === task.id
    const elapsed = task.elapsed ?? (task.startedAt ? Date.now() - task.startedAt : 0)
    return (
      <li key={task.id}>
        <div className="rounded-md border border-border bg-card shadow-sm">
          <button type="button" aria-expanded={isOpen} aria-controls={`inbox-${task.id}`}
            onClick={() => setExpanded(isOpen ? null : task.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpanded(isOpen ? null : task.id) }
              if (event.key === 'Escape') setExpanded(null)
            }}
            className="flex w-full items-start gap-2 rounded-md p-2.5 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <span aria-hidden="true" className={cn('mt-1 size-1.5 shrink-0 rounded-full', {
              running: 'bg-info', waiting: 'bg-warning', done: 'bg-success', failed: 'bg-destructive'
            }[status])} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{task.title}</span>
                <AffectToneBadge tone={filterTone[status]}>{statusLabel[status]}</AffectToneBadge>
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{task.description ?? task.agent}</span>
              <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{task.agent}</span>
                {elapsed ? <span className="tabular-nums">{formatDuration(elapsed)}</span> : null}
                {task.tools ? <span>{task.tools} tools</span> : null}
                {task.sources ? <span>{task.sources} sources</span> : null}
                {task.startedAt ? <span>{formatRelativeTime(task.startedAt)}</span> : null}
              </span>
            </span>
            <ChevronDown aria-hidden="true" className={cn('mt-1 size-3 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
          </button>
          {isOpen ? (
            <div id={`inbox-${task.id}`} className="space-y-2 border-t border-border px-3 py-2">
              {(task.steps ?? []).length ? (
                <ol role="list" className="space-y-1">
                  {(task.steps ?? []).map((step, index) => (
                    <li key={`${step.label}-${index}`} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-foreground">{step.label}</span>
                      {step.time ? <span className="shrink-0 text-muted-foreground">{step.time}</span> : null}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-[11px] text-muted-foreground">No recent steps.</p>}
              <AffectToolbar>
                {status === 'waiting' ? (
                  <>
                    <button type="button" onClick={() => decide(task, 'approve')} className="rounded-md bg-success-subtle px-2 py-1 text-[11px] text-success-subtle-foreground">Approve</button>
                    <button type="button" onClick={() => decide(task, 'reject')} className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">Reject</button>
                  </>
                ) : null}
                {status === 'failed' ? (
                  <button type="button" onClick={() => decide(task, 'retry')} className="rounded-md bg-warning-subtle px-2 py-1 text-[11px] text-warning-subtle-foreground">Retry</button>
                ) : null}
                {onOpen && status !== 'waiting' && status !== 'failed' ? (
                  <button type="button" onClick={() => onOpen(task)} className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground">Open</button>
                ) : null}
              </AffectToolbar>
            </div>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-inbox">
      <div className="space-y-3 p-3">
        <AffectHeader title={`Agents / ${title}`}
          description={<span aria-live="polite">{counts.waiting} need you · {counts.running} running</span>}
          actions={
            <AffectToolbar>
              {action ? <button type="button" onClick={action.onClick} className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted">{action.label}</button> : null}
              <div role="radiogroup" aria-label="Layout" className="flex rounded-md border border-border p-0.5">
                {(['board', 'list'] as const).map((option) => (
                  <button key={option} type="button" role="radio" aria-checked={currentView === option}
                    aria-label={`${option[0].toUpperCase()}${option.slice(1)} view`}
                    onClick={() => chooseView(option)}
                    className={cn('rounded px-1.5 py-0.5', currentView === option ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>
                    {option === 'board' ? <LayoutGrid aria-hidden="true" className="size-3" /> : <List aria-hidden="true" className="size-3" />}
                  </button>
                ))}
              </div>
            </AffectToolbar>
          } />
        <AffectToolbar role="tablist" aria-label="Filter tasks">
          {(['all', 'waiting', 'running', 'done', 'failed'] as const).map((option) => (
            <button key={option} type="button" role="tab" aria-selected={filter === option}
              onClick={() => setFilter(option)}
              className={cn('rounded-md px-2 py-1 text-[11px] capitalize', filter === option ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}>
              {option}{option !== 'all' ? <span className="ml-1 tabular-nums">{counts[option]}</span> : null}
            </button>
          ))}
        </AffectToolbar>
        {visible.length ? (
          <ul role="list" aria-label={`${title} tasks`}
            className={currentView === 'board' ? 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}>
            {visible.map(card)}
          </ul>
        ) : <AffectEmpty>No tasks in this view.</AffectEmpty>}
        <p className="sr-only" aria-live="polite">{counts.waiting} need you, {counts.running} running</p>
      </div>
    </AffectSurface>
  )
}
