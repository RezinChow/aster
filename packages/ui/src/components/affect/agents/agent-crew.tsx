import { ChevronDown, CirclePause, CirclePlay, MessageSquare, OctagonX, RotateCcw, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatCost as defaultCost, formatDuration } from '../shared/format'
import type { AffectTone } from '../shared/types'
import { AffectHeader, AffectMeter, AffectSurface, AffectToneBadge } from '../shared/ui'

export type CrewStatus = 'active' | 'idle' | 'paused' | 'waiting' | 'done' | 'failed'
export type SteerAction = 'message' | 'pause' | 'stop' | 'resume' | 'approve' | 'decline' | 'retry'

export interface CrewAgent {
  id: string
  name: string
  status: CrewStatus
  activity: string
  model?: string
  context?: number
  contextLimit?: number
  children?: CrewAgent[]
  tools?: { logo?: ReactNode; name: string }[]
  last?: { from: string; text: string }
  task?: string
  cost?: number
  started?: number
  ended?: number
  logo?: ReactNode
}
export interface CrewHandoff { id: string; from: string; to: string; label?: string }
export interface CrewProject { id: string; name: string; working?: number; needsYou?: number }

export interface AgentCrewProps {
  root: CrewAgent
  handoffs?: CrewHandoff[]
  title?: string
  projects?: CrewProject[]
  project?: string
  onProjectChange?: (id: string) => void
  onSteer?: (agent: CrewAgent, action: SteerAction, message?: string) => void
  onSelect?: (agent: CrewAgent) => void
  formatCost?: (amount: number) => string
  className?: string
}

const tone: Record<CrewStatus, AffectTone> = {
  active: 'info', idle: 'neutral', paused: 'warning', waiting: 'warning', done: 'success', failed: 'danger'
}
const label: Record<CrewStatus, string> = {
  active: 'Working', idle: 'Idle', paused: 'Paused', waiting: 'Needs you', done: 'Done', failed: 'Failed'
}
const actionsFor: Record<CrewStatus, SteerAction[]> = {
  active: ['message', 'pause', 'stop'],
  idle: ['message'],
  paused: ['message', 'resume', 'stop'],
  waiting: ['message', 'approve', 'decline'],
  done: ['message'],
  failed: ['message', 'retry']
}
const actionIcon: Record<SteerAction, ReactNode> = {
  message: <MessageSquare className="size-3" />, pause: <CirclePause className="size-3" />,
  stop: <OctagonX className="size-3" />, resume: <CirclePlay className="size-3" />,
  approve: <ThumbsUp className="size-3" />, decline: <ThumbsDown className="size-3" />,
  retry: <RotateCcw className="size-3" />
}

function flatten(agent: CrewAgent): CrewAgent[] {
  return [agent, ...(agent.children ?? []).flatMap(flatten)]
}

/** A live crew tree with per-agent context, handoffs and a steering detail panel. */
export function AgentCrew({
  root, handoffs = [], title, projects, project, onProjectChange,
  onSteer, onSelect, formatCost = defaultCost, className
}: AgentCrewProps) {
  const all = flatten(root)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [projectOpen, setProjectOpen] = useState(false)
  const [message, setMessage] = useState('')
  const selected = all.find((agent) => agent.id === selectedId) ?? null
  const working = all.filter((agent) => agent.status === 'active').length
  const needsYou = all.filter((agent) => agent.status === 'waiting').length
  const currentProject = projects?.find((item) => item.id === project)

  const open = (agent: CrewAgent) => {
    setSelectedId(agent.id)
    setMessage('')
    onSelect?.(agent)
  }

  const card = (agent: CrewAgent, depth: number): ReactNode => {
    const context = Math.min(1, Math.max(0, agent.context ?? 0))
    const contextTone: AffectTone = context >= 0.95 ? 'danger' : context >= 0.8 ? 'warning' : 'primary'
    return (
      <div key={agent.id} className="space-y-1" style={{ paddingLeft: depth ? 18 : 0 }}>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={selectedId === agent.id}
          aria-label={`${agent.name}: ${label[agent.status]}, ${agent.activity}`}
          onClick={() => open(agent)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(agent) }
          }}
          className={cn(
            'w-full rounded-md border border-border bg-card px-2.5 py-2 text-left shadow-sm transition-colors hover:bg-muted/40 focus-visible:border-primary focus-visible:outline-none',
            selectedId === agent.id && 'bg-accent'
          )}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-sm bg-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{agent.name}</span>
            <AffectToneBadge tone={tone[agent.status]}>{label[agent.status]}</AffectToneBadge>
          </span>
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">{agent.activity}</span>
          {agent.model ? <span className="mt-1 block truncate text-[10px] text-muted-foreground">{agent.model}</span> : null}
          {agent.context !== undefined ? (
            <span className="mt-1.5 block space-y-1">
              <AffectMeter value={context * 100} tone={contextTone} label={`${agent.name} context`} />
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {Math.round(context * 100)}%{agent.contextLimit ? ` · ${Math.round(context * agent.contextLimit / 1000)}k tokens` : ''}
              </span>
            </span>
          ) : null}
        </button>
        {(agent.children ?? []).length ? (
          <div className="space-y-1 border-l border-border pl-2">{(agent.children ?? []).map((child) => card(child, depth + 1))}</div>
        ) : null}
      </div>
    )
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-crew">
      <div className="space-y-3 p-3">
        {projects ? (
          <div className="relative">
            <button type="button" aria-haspopup="listbox" aria-expanded={projectOpen} onClick={() => setProjectOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setProjectOpen(false)
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setProjectOpen(true) }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground">
              {currentProject?.name ?? title ?? 'Crew'} <ChevronDown aria-hidden="true" className="size-3" />
            </button>
            {projectOpen ? (
              <ul role="listbox" aria-label="Projects" className="absolute z-10 mt-1 w-48 rounded-md border border-border bg-card p-1 shadow-md">
                {projects.map((item) => (
                  <li key={item.id} role="option" aria-selected={item.id === project}>
                    <button type="button" onClick={() => { onProjectChange?.(item.id); setProjectOpen(false) }}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-muted">
                      <span>{item.name}</span>
                      <span className="text-[10px] text-muted-foreground">{item.working ?? 0} working · {item.needsYou ?? 0} need you</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : <AffectHeader title={title} description={`${working} working · ${needsYou} need you · ${all.length} agents`} />}

        <div role="tree" aria-label={title ?? 'Agent crew'} className="space-y-1">{card(root, 0)}</div>

        {handoffs.length ? (
          <p className="text-[11px] text-muted-foreground" aria-live="polite">
            {handoffs.map((item) => `${item.from} handed to ${item.to}${item.label ? `: ${item.label}` : ''}`).join(' · ')}
          </p>
        ) : null}

        {selected ? (
          <div role="dialog" aria-label={`${selected.name} details`} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape') setSelectedId(null) }}
            className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">{selected.name}</span>
              <button type="button" aria-label="Close details" onClick={() => setSelectedId(null)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"><X aria-hidden="true" className="size-3" /></button>
            </div>
            {selected.task ? <p className="mt-1 text-[11px] text-muted-foreground">{selected.task}</p> : null}
            <dl className="mt-2 space-y-1 text-[11px]">
              {selected.status !== undefined ? <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd>{label[selected.status]}</dd></div> : null}
              {selected.cost !== undefined ? <div className="flex justify-between"><dt className="text-muted-foreground">Cost</dt><dd>{formatCost(selected.cost)}</dd></div> : null}
              {selected.started && selected.ended ? <div className="flex justify-between"><dt className="text-muted-foreground">Time</dt><dd>{formatDuration(selected.ended - selected.started)}</dd></div> : null}
              {selected.last ? <div className="flex justify-between gap-2"><dt className="shrink-0 text-muted-foreground">Last from {selected.last.from}</dt><dd className="truncate">{selected.last.text}</dd></div> : null}
            </dl>
            {selected.tools?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">{selected.tools.map((tool) => (
                <span key={tool.name} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tool.name}</span>
              ))}</div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-1">
              {actionsFor[selected.status].map((action) => (
                <button key={action} type="button" onClick={() => onSteer?.(selected, action)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted">
                  {actionIcon[action]} {action[0].toUpperCase() + action.slice(1)}
                </button>
              ))}
            </div>
            {onSteer ? (
              <div className="mt-2 flex gap-1">
                <input aria-label={`Message ${selected.name}`} value={message} onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && message.trim()) { onSteer(selected, 'message', message.trim()); setMessage('') }
                    if (event.key === 'Escape') setSelectedId(null)
                  }}
                  placeholder="Message the agent…" className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
                <button type="button" aria-label="Send message" disabled={!message.trim()}
                  onClick={() => { onSteer(selected, 'message', message.trim()); setMessage('') }}
                  className="rounded-md bg-primary px-2 text-primary-foreground disabled:opacity-40"><MessageSquare aria-hidden="true" className="size-3" /></button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AffectSurface>
  )
}
