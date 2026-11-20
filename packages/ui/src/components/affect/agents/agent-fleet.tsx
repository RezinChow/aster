import { ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatCost as defaultCost, formatDuration } from '../shared/format'
import type { AffectStatus } from '../shared/types'
import { AffectHeader, AffectIconButton, AffectRow, AffectStatusDot, AffectSurface } from '../shared/ui'

export type FleetStatus = 'queued' | 'running' | 'waiting' | 'done' | 'failed' | 'stopped'
export type FleetAction = 'approve' | 'reject' | 'retry' | 'dismiss'

export interface FleetStep { title: string; status?: AffectStatus; tool?: string; took?: number }
export interface FleetAgent {
  id: string
  name: string
  task: string
  status: FleetStatus
  model?: string
  avatar?: ReactNode
  tools?: string[]
  steps?: FleetStep[]
  cost?: number
  started?: number
  ended?: number
  children?: FleetAgent[]
  ask?: string
  error?: string
}

export interface AgentFleetProps {
  agents: FleetAgent[]
  open?: string | null
  defaultOpen?: string | null
  onOpenChange?: (id: string | null) => void
  onResolve?: (agent: FleetAgent, action: FleetAction) => void
  onSelect?: (agent: FleetAgent) => void
  now?: number
  formatCost?: (amount: number) => string
  title?: string
  className?: string
}

const toStatus = (status: FleetStatus): AffectStatus => (status === 'stopped' ? 'cancelled' : status)
const statusText: Record<FleetStatus, string> = {
  queued: 'Queued', running: 'Running', waiting: 'Needs you', done: 'Done', failed: 'Failed', stopped: 'Stopped'
}

function branchCost(agent: FleetAgent): number {
  return (agent.cost ?? 0) + (agent.children ?? []).reduce((sum, child) => sum + branchCost(child), 0)
}

/** Several agents side by side; opening one reveals its sub-agent tree. */
export function AgentFleet({
  agents, open, defaultOpen, onOpenChange, onResolve, onSelect, now = Date.now(),
  formatCost = defaultCost, title = 'Agents', className
}: AgentFleetProps) {
  const [localOpen, setLocalOpen] = useState<string | null>(defaultOpen ?? null)
  const [windowAgent, setWindowAgent] = useState<string | null>(null)
  const activeId = open === undefined ? localOpen : open
  const active = agents.find((agent) => agent.id === activeId) ?? null
  const shown = windowAgent ? active?.children?.find((child) => child.id === windowAgent) : undefined
  const setOpen = (id: string | null) => {
    if (open === undefined) setLocalOpen(id)
    onOpenChange?.(id)
    setWindowAgent(null)
  }
  const total = agents.reduce((sum, agent) => sum + branchCost(agent), 0)
  const running = agents.filter((agent) => agent.status === 'running').length
  const needsYou = agents.filter((agent) => agent.status === 'waiting').length

  const resolve = (action: FleetAction) => {
    if (!shown) return
    onResolve?.(shown, action)
    setWindowAgent(null)
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-fleet">
      <div className="space-y-3 p-3">
        <AffectHeader title={title}
          description={`${agents.length} agents · ${running} running · ${needsYou} need you · ${formatCost(total)}`} />
        <div className="flex flex-wrap gap-2">
          <ul role="list" aria-label="Main agents" className="min-w-44 flex-1 space-y-1">
            {agents.map((agent) => {
              const isOpen = agent.id === activeId
              const elapsed = agent.ended && agent.started ? agent.ended - agent.started : agent.started ? now - agent.started : 0
              return (
                <li key={agent.id}>
                  <button type="button" aria-expanded={isOpen} aria-controls={isOpen ? `fleet-${agent.id}` : undefined}
                    onClick={() => setOpen(isOpen ? null : agent.id)}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(isOpen ? null : agent.id) } }}
                    className={cn('w-full rounded-md border border-border bg-card p-2 text-left shadow-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      isOpen && 'border-primary')}>
                    <span className="flex items-center gap-1.5">
                      <ChevronRight aria-hidden="true" className={cn('size-3 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
                      <AffectStatusDot status={toStatus(agent.status)} />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{agent.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-foreground">{formatCost(branchCost(agent))}</span>
                    </span>
                    <span className="mt-1 block truncate pl-4 text-[11px] text-muted-foreground">{agent.task}</span>
                    <span className="mt-1 block pl-4 text-[10px] text-muted-foreground">
                      {statusText[agent.status]}{elapsed ? ` · ${formatDuration(elapsed)}` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {active ? (
            <div id={`fleet-${active.id}`} className="min-w-52 flex-1 rounded-md border border-border bg-muted/30 p-2">
              <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sub-agents of {active.name}</p>
              <ul role="tree" aria-label={`Sub-agents of ${active.name}`} className="space-y-1">
                {(active.children ?? []).map((child) => (
                  <li key={child.id} role="treeitem" aria-selected={windowAgent === child.id}>
                    <AffectRow
                      icon={<AffectStatusDot status={toStatus(child.status)} />}
                      title={child.name}
                      subtitle={`${statusText[child.status]} · ${child.task}`}
                      trailing={<span className="flex items-center gap-1">
                        {child.cost !== undefined ? <span className="text-[10px] tabular-nums text-muted-foreground">{formatCost(child.cost)}</span> : null}
                        <AffectIconButton
                          label={child.steps?.length || child.ask || child.error ? `Open ${child.name} details` : `Select ${child.name}`}
                          onClick={() => {
                            onSelect?.(child)
                            if (child.steps?.length || child.ask || child.error) setWindowAgent(child.id)
                          }}
                        >
                          <ChevronRight aria-hidden="true" className="size-3" />
                        </AffectIconButton>
                      </span>}
                      selected={windowAgent === child.id}
                    />
                  </li>
                ))}
              </ul>
              {(active.children ?? []).length === 0 ? (
                <p className="px-1 py-2 text-[11px] text-muted-foreground">No sub-agents.</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {shown ? (
          <div role="dialog" aria-label={`Tasks of ${shown.name}`} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape') setWindowAgent(null) }}
            className="rounded-md border border-border bg-card p-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{shown.name}</span>
              <AffectIconButton label="Close tasks" onClick={() => setWindowAgent(null)}><X aria-hidden="true" className="size-3" /></AffectIconButton>
            </div>
            {shown.ask || shown.error ? (
              <p className={cn('mt-2 rounded px-2 py-1.5 text-[11px]', shown.error ? 'bg-destructive/10 text-destructive' : 'bg-warning-subtle text-warning-subtle-foreground')}>
                {shown.ask ?? shown.error}
              </p>
            ) : null}
            {(shown.steps ?? []).length ? (
              <ol role="list" className="mt-2 space-y-1">
                {(shown.steps ?? []).map((step, index) => (
                  <li key={`${step.title}-${index}`} className="flex items-center gap-2 text-[11px]">
                    <AffectStatusDot status={step.status ?? 'done'} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{step.title}</span>
                    {step.tool ? <span className="text-muted-foreground">{step.tool}</span> : null}
                    {step.took ? <span className="tabular-nums text-muted-foreground">{formatDuration(step.took)}</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {onResolve && (shown.ask || shown.error) ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {(shown.error ? ['retry', 'dismiss'] : ['approve', 'reject']).map((action) => (
                  <button key={action} type="button" onClick={() => resolve(action as FleetAction)}
                    className="rounded-md border border-border px-2 py-1 text-[11px] capitalize text-foreground hover:bg-muted">
                    {action}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AffectSurface>
  )
}
